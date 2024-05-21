// chrome.runtime.onInstalled.addListener(function() {
//   console.log("Create extension installed.");
// });

// Function to reload all open tabs
function reloadAllTabs() {
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      chrome.tabs.reload(tab.id);
    });
  });
}

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "update" || details.reason === "install" || details.reason === "chrome_update") {
    // reloadAllTabs();
    
  }
});

var stepCounter = 0;
var stepString = 'step';
var elementTypeString = 'elementType';
var elementValueString = 'elementValue';
var step, elementType, elementValue;

// Listen for port connections
chrome.runtime.onConnect.addListener(function(port) {

  // Check the port name
  if (port.name === "8080") {
    
    // Listen for messages from the port
    port.onMessage.addListener(async function(message) {
      // Get the active tab from the message
      // let myActiveTab = message?.activeTab;
      let getElementType = message[0];
      let getElementValue = message[1];
      step = stepString + stepCounter;
      elementType = elementTypeString + stepCounter;
      elementValue = elementValueString + stepCounter;
      chrome.tabs.captureVisibleTab(null, { format: "png" })
      .then(tabCapture => {
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

        var dataToSave = {
          [step]: tabCapture,
          [elementType]: getElementType,
          [elementValue]: getElementValue
        };
        
        chrome.storage.local.set(dataToSave, function() {
          console.log("Data saved successfully!");
          port.postMessage({ success: true });
        });
        

      })
      .catch(error => {
        // Handle the error appropriately
        console.error("Error capturing tab:", error.message);
        // Provide user feedback or take alternative actions
      });
    });
    stepCounter += 1;
  }
  else if(port.name === "8081"){
    port.onMessage.addListener(async function(message) {
      const viewTabUrl = chrome.runtime.getURL('screenshot.html');

      chrome.tabs.create({ url: viewTabUrl }, function (tab) {
        
      });
      port.postMessage({ success: true });

    })
  }
  else if (port.name === "clearStorage") {
    
    // Listen for messages from the port
    port.onMessage.addListener(async function(message) {
        chrome.storage.local.clear(function() {})
    });
  }
});
