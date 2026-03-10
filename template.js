// GTM API functions required
const log = require('logToConsole');
const JSON = require('JSON');
const setInWindow = require('setInWindow');
const getTimestamp = require('getTimestamp');
const Math = require('Math');
const injectScript = require('injectScript');
const callInWindow = require('callInWindow');
const copyFromWindow = require('copyFromWindow');
const getType = require('getType');
const getContainerVersion = require('getContainerVersion');
const queryPermission = require('queryPermission');

/**
 * Billy Grace - Configuration Web Pixel Template
 * 
 * This handles initialization, script loading, and the event tracking code
 * in accordance with the original implementation.
 */

// Unique identifier for the client's account
const billyPixId = data.trackingID;
const cdnEndpoint = data.useStaging ? 'https://staging.bgmin.cdn.billygrace.com' : 'https://bgmin.cdn.billygrace.com';
const billyFunctionName = data.useStaging ? 'StagBillyPix' : 'BillyPix';

// Calculate cache busting value
const secondsBuste = 30*1000; // 6 hours in milliseconds
const epochRounded = secondsBuste * Math.ceil(getTimestamp() / secondsBuste);
const scriptUrl = cdnEndpoint + '?t=' + epochRounded + '&v=0.2.0';

// Determine if live debugging needs to be turned on
const cv = getContainerVersion();

// Difference preview and debug: https://support.google.com/tagmanager/answer/6107056
// TLDR: Both are set to true when you are debugging your container
const isGtmDebugSession = cv.debugMode && cv.previewMode;


// Optionally log messages when debug is enabled
function debugLog(message) {
  if (data.isDebug) {
    log('[BG Conf Tag]', message);
  }
}
// For all error messages the end user should see
function errorLog(message) {
   log('[BG Conf Tag] Error: ', message);
}


// Tracking ID needs to be set
if (getType(billyPixId) === 'undefined') {
  errorLog('Billy Grace Pixel not configured correctly. No Tracking ID is set.');
  return data.gtmOnFailure();
}

// Check permission to inject the script
if (!queryPermission('inject_script', scriptUrl)) {
  errorLog('Permission denied to inject Billy Grace Pixel script from: ' + scriptUrl);
  return data.gtmOnFailure();
}


/**
 * Adds the main tracking function to the window
 * This function replicates the behavior of the original Billy Grace snippet
 */
function addMainFunctionToWindow() {
  debugLog(billyFunctionName + ' not found, initializing...');
  
  // Main function that gets triggered on each call to it
  const pixelFunction = function() {
    
    // Store arguments for easier access
    let args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    // Get a fresh reference to the function to ensure we have the latest version
    const pixelFunc = copyFromWindow(billyFunctionName);
    
    // If process method exists and is a function, pass arguments to it
    if (pixelFunc && typeof pixelFunc.process === 'function') {
     debugLog('Processing ' + billyFunctionName + '("' + args[0] + '", "' + args[1] + '", ' +JSON.stringify(args[2] || {}) + ')');
      // Call process safely using call instead of apply
      return pixelFunc.process(args[0], args[1], args[2]);
    } else {
      // Process isn't available yet, queue the command for later execution
      debugLog('Queueing ' + billyFunctionName + '("' + args[0] + '", "' + args[1] + '", ' +JSON.stringify(args[2] || {}) + ')');
      
      // Get the queue and push to it
      const queue = copyFromWindow(billyFunctionName + '.queue');
      
      // Add to queu for later processing when remote js arrives
      if (queue && getType(queue) === 'array') {
        queue.push(args);

        // Need to overwrite the queue with the new one as its just a copy of the original
        setInWindow(billyFunctionName + '.queue', queue, true);
      } else {
        // If queue isn't available, initialize it first
        setInWindow(billyFunctionName + '.queue', [args], true);
        debugLog('Created new queue with first event');
      }
    }
  };
  
  // Set the function in the window
  setInWindow(billyFunctionName, pixelFunction, true);
  
  // Initialize an empty queue array
  setInWindow(billyFunctionName + '.queue', [], true);
  
  // Set the timestamp
  setInWindow(billyFunctionName + '.t', getTimestamp(), true);
  
}

function onScriptLoaded() {
  debugLog('Script loaded successfully');
  return data.gtmOnSuccess();
}

function onScriptFailed() {
  debugLog('Error: Billy Grace Pixel script failed to load from ' + scriptUrl, true);
  return data.gtmOnFailure();
}

// Check if BillyPix already exists, mimics the original snippet's first check
const existingFunc = copyFromWindow(billyFunctionName);
if (!existingFunc) {
  addMainFunctionToWindow();
} else {
  debugLog(billyFunctionName + ' already exists in window, using existing implementation');
}

// Build init options
let extraInitOptions = {debug: isGtmDebugSession};
if (getType(data.overrideCookiedomain) !== 'undefined') {
  extraInitOptions.cookie_domain = data.overrideCookiedomain;
}

// Check if the CDN bundle is already loaded (e.g. by the event tag)
const processFunc = copyFromWindow(billyFunctionName + '.process');


// CDN already loaded: call .process directly, bypassing the stub
if (processFunc && getType(processFunc) === 'function') {
  debugLog('CDN already loaded, calling .process directly');
  
  // Setup the initialiazation with any given extra options
  callInWindow(billyFunctionName + '.process', 'init', billyPixId, extraInitOptions);

  // Make sure the pageload event gets triggered 
  if (data.noPageloadEvent === false) {
    if (data.pageloadEventID) {
      callInWindow(billyFunctionName + '.process', 'event', 'pageload', {event_id: data.pageloadEventID});
    } else {
      callInWindow(billyFunctionName + '.process', 'event', 'pageload');
    }
  }

  // Complete the tag as required events have been fired directly at .process 
  return data.gtmOnSuccess();
} 
// CDN not loaded yet: write events directly into the queue
else {

  // Grab a copy (non reference) from an existing queue object to add to 
  const currentQueue = copyFromWindow(billyFunctionName + '.queue');
  
  if (currentQueue && getType(currentQueue) === 'array') {
    debugLog('CDN not loaded yet, writing events to queue');

    // Add init and initial pageload event to the queue (if required)
    currentQueue.push(['init', billyPixId, extraInitOptions]);
    
    // Make sure the pageload event gets triggered 
    if (data.noPageloadEvent === false) {
      if (data.pageloadEventID) {
        currentQueue.push(['event', 'pageload', {event_id: data.pageloadEventID}]);
      } else {
        currentQueue.push(['event', 'pageload']);
      }
    }

    // Need to overwrite the queue with the new one as its just a copy of the original
    setInWindow(billyFunctionName + '.queue', currentQueue, true);
  }else{
    errorLog('Queue does not exist so can\'t add "pageload" event to queue..');
  }

  // Load the script into the website and complete the tag when its loaded
  debugLog('Loading script from: ' + scriptUrl);
  injectScript(scriptUrl, onScriptLoaded, onScriptFailed, scriptUrl);
}