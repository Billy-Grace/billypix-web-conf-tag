// GTM API functions required
const log = require('logToConsole');
const setInWindow = require('setInWindow');
const createArgumentsQueue = require('createArgumentsQueue');
const injectScript = require('injectScript');
const getTimestamp = require('getTimestamp');
const Math = require('Math');
const getType = require('getType');

// Unique identifier for BillyPix, replace 'ID-XXXXXXXX' with actual ID
const billyPixId = data.trackingID;
const cdnEndpoint = data.useStaging ? 'https://staging.bgmin.cdn.billygrace.com' : 'https://bgmin.cdn.billygrace.com';
const billyFunctionName = data.useStaging ? 'StagBillyPix' : 'BillyPix';

// Tracking ID needs to be set
if (getType(billyPixId) === 'undefined') {
  log('BillyPix not configured correctly, no Tracking ID is set');
  return data.gtmOnFailure();
}

// Function to ensure BillyPix is defined and properly queues commands
const BillyPix = createArgumentsQueue(billyFunctionName, billyFunctionName + '.queue');

// Setup BillyPix with the current timestamp
setInWindow(billyFunctionName + '.t', getTimestamp(), false);

// Generate the script URL with cache busting
const secondsBuste = 30*1000;
const epochRounded = secondsBuste * Math.ceil(getTimestamp() / secondsBuste);
const scriptUrl = cdnEndpoint + '?t=' + epochRounded + '&v=0.2.0';

// Debug to see if correct
if (data.isDebug){
  log('scriptUrl', scriptUrl);
}

function successfullyInjectedScript(){
  // Initialize BillyPix so the Tracking ID is set on the web page
  BillyPix('init', billyPixId);
  
  // Debug to see if correct
  if (data.isDebug){
    log('Successfully initialized the ' + billyFunctionName + ' for ID: ' + billyPixId);
  }
  
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


// Inject the BillyPix script
injectScript(scriptUrl, successfullyInjectedScript(), data.gtmOnFailure, scriptUrl);