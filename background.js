chrome.runtime.onInstalled.addListener(function() {
  console.log("Create extension installed.");
});

var stepCounter = 1;
var stepString = 'step';

// Listen for port connections
chrome.runtime.onConnect.addListener(function(port) {
  // Check the port name
  if (port.name === "8080") {
    // Listen for messages from the port
    port.onMessage.addListener(async function(message) {
      // Get the active tab from the message
      let myActiveTab = message?.activeTab;
      // Await the promise and use the resolved value as the url
      const tabCapture = await chrome.tabs.captureVisibleTab(null, { format: "png" });
      // const fileName = 
      // myActiveTab?.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() +
      //   "_" +
      //   new Date().toISOString().slice(0, 10) +
      //   ".png";

      // chrome.downloads.download({
      //   url: tabCapture,
      //   filename: fileName,
      //   saveAs: false,
      // });
      // chrome.storage.local.clear(function() {})
      let step = stepString + stepCounter;
      chrome.storage.local.set({[step]: tabCapture}, function() {
        console.log("Screenshot saved");
        port.postMessage({ success: true });
        stepCounter = stepCounter + 1;
      });
    });
  }
  else if(port.name === "8081"){
    port.onMessage.addListener(async function(message) {
      const viewTabUrl = chrome.runtime.getURL('screenshot.html');

      chrome.tabs.create({ url: viewTabUrl }, function (tab) {
        
      });
      port.postMessage({ success: true });

    })
  }
});
