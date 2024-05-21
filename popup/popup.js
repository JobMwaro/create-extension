// popup.js
popupTabs();

document.getElementById('openNewTab').addEventListener('click', function() {
  chrome.tabs.create({ url: 'https://www.staging.ursbonline.go.ug/' }, function(tab) {
    // Inject content script after the tab is created
    // chrome.tabs.executeScript(tab.id, { file: 'content.js' });
    chrome.scripting
    .executeScript({
      target : {tabId : tab.id, allFrames : true},
      files : [ "./scripts/content.js" ],
    })
    .then(() => console.log("script injected in all frames"));
  });
});

document.getElementById('stop').addEventListener('click', function() {
  chrome.tabs.query({}, function(tabs) {
    // Loop through the tabs
    for (let tab of tabs) {
      // Get the tab ID
      const tabId = tab.id;
      // Inject the script into the tab
      chrome.scripting.executeScript({
        target: { tabId },
        files : [ "./scripts/undoContent.js" ],
      })
      .then(() => console.log("Script injected and executed"))
      .catch(error => console.error("Error injecting script:", error));
    }
  });

  let port = chrome.runtime.connect({name: "8081"});
  // Send a message through the port
  port.postMessage({action: "getActiveTab"});
  // Listen for messages from the port
  port.onMessage.addListener(function(message) {
    // Handle the response here
    console.log("Received response:", message.success);
  });
});

document.getElementById('clearButton').addEventListener('click', function() {
  
  let port = chrome.runtime.connect({name: "clearStorage"});
  // Send a message through the port
  port.postMessage({action: "getActiveTab"});
  // Listen for messages from the port
  port.onMessage.addListener(function(message) {
    // Handle the response here
    console.log("Received response:", message.success);
  });
});

function popupTabs(){
  // Get the tabs and tab content elements
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".overview");
  const tabContents1 = document.querySelectorAll(".comments");

  // Add a click event listener to each tab
  tabs.forEach(tab => {
    tab.addEventListener("mouseover", () => {
      // Remove the active class from all tabs and tab contents
      tabs.forEach(tab => tab.classList.remove("active"));
      tabContents.forEach(tabContent => tabContent.classList.remove("active"));
      tabContents1.forEach(tabContent => tabContent.classList.remove("active"));
      // Add the active class to the clicked tab and its corresponding tab content
      tab.classList.add("active");
      const tabContent = document.querySelector(`.${tab.dataset.tab}`);
      tabContent.classList.add("active");
    });
  });
}


