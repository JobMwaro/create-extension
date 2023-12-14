// popup.js

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


