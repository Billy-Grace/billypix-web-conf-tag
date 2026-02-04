// GTM API functions required
const log = require('logToConsole');
const JSON = require('JSON');
const setInWindow = require('setInWindow');
const createQueue = require('createQueue');
const getTimestamp = require('getTimestamp');
const Math = require('Math');
const injectScript = require('injectScript');
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

// Tracking ID needs to be set
if (getType(billyPixId) === 'undefined') {
  log('Error: Billy Grace Pixel not configured correctly. No Tracking ID is set.');
  return data.gtmOnFailure();
}

// Check permission to inject the script
if (!queryPermission('inject_script', scriptUrl)) {
  log('Error: Permission denied to inject Billy Grace Pixel script from', scriptUrl);
  data.gtmOnFailure();
  return;
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

// Check if BillyPix already exists - same as original snippet's first check
const existingFunc = copyFromWindow(billyFunctionName);
if (!existingFunc) {
  addMainFunctionToWindow();
} else {
  debugLog(billyFunctionName + ' already exists in window, using existing implementation');
}

/**
 * Callback function when script is successfully loaded
 * Initializes the pixel and triggers page view if configured
 */
function onScriptLoaded() {
  // Get the function again to ensure we have latest reference
  const BillyPix = copyFromWindow(billyFunctionName);

  if (!BillyPix) {
    log('Error: ' + billyFunctionName + ' not found after script load');
    return data.gtmOnFailure();
  }
  
  // Extra options for this pixel session
  let extraInitOptions = {debug: isGtmDebugSession};
    
  // Optionally check the cookie domain needs to be overwritten
  if (getType(data.overrideCookiedomain) !== 'undefined') {
    extraInitOptions.cookie_domain = data.overrideCookiedomain;
  }

  // Initialize BillyPix with the tracking ID
  BillyPix('init', billyPixId, extraInitOptions);
  
  // By default unchecked, meaning we send out the pageload event
  if (data.noPageloadEvent === false){
     
    // Event id is used for de-duplication
    if (data.pageloadEventID){
       BillyPix('event', 'pageload', {event_id: data.pageloadEventID});
    }else{
       BillyPix('event', 'pageload');
    }
  }
  
  // Finish with the success handler to close this function
  return data.gtmOnSuccess();
}

/**
 * Callback function when script fails to load
 */
function onScriptFailed() {
  log('Error: Billy Grace Pixel script failed to load from ' + scriptUrl);
  return data.gtmOnFailure();
}

// Log script loading
debugLog('Loading script from: ' + scriptUrl);

// Inject the script
injectScript(scriptUrl, onScriptLoaded, onScriptFailed, scriptUrl);