// popup.js
const RECORDING_TAB_KEY = 'recordingTabId';

popupTabs();

document.getElementById('openNewTab').addEventListener('click', startRecordingOnActiveTab);
document.getElementById('stop').addEventListener('click', stopRecordingAndOpenGuide);
document.getElementById('clearButton').addEventListener('click', clearStoredSteps);

function showMessage(boxId, text) {
  const messageBox = document.getElementById(boxId);
  const messageText = messageBox && messageBox.querySelector('p');
  if (!messageBox) return;
  if (messageText && text) messageText.textContent = text;
  messageBox.style.display = 'block';
  setTimeout(function () {
    messageBox.style.display = 'none';
  }, 3000);
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

function getStoredRecordingTabId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(RECORDING_TAB_KEY, (res) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(res[RECORDING_TAB_KEY] || null);
    });
  });
}

function setStoredRecordingTabId(tabId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [RECORDING_TAB_KEY]: tabId }, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

function clearStoredRecordingTabId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(RECORDING_TAB_KEY, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(response);
    });
  });
}

function openGuideTab() {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'openGuideTab' });
    port.onMessage.addListener(function onMessage(message) {
      port.onMessage.removeListener(onMessage);
      if (message && message.success) resolve(message);
      else reject(new Error((message && message.error) || 'Unable to open guide tab'));
    });
    port.postMessage({ action: 'open' });
  });
}

function browserNeedsMaximize() {
  return new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: 'maximizeWindow' });
    port.onMessage.addListener(function onMessage(message) {
      port.onMessage.removeListener(onMessage);
      resolve(Boolean(message && message.success));
    });
    port.postMessage({ action: 'maximize' });
  });
}

function canInjectInto(tab) {
  return tab && tab.id && /^(https?:|file:)/.test(tab.url || '');
}

async function injectRecorder(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId, allFrames: true },
    files: ['styles.css'],
  });
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['scripts/content.js'],
  });
  try {
    await sendTabMessage(tabId, { action: 'startRecording' });
  } catch (err) {
    // The script starts itself on first injection; this covers older pages that
    // may not have finished registering the message listener yet.
  }
}

async function stopRecorderInTab(tabId) {
  try {
    await sendTabMessage(tabId, { action: 'stopRecording' });
  } catch (err) {
    console.warn('Recorder message did not reach tab:', err && err.message ? err.message : err);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['scripts/undoContent.js'],
    });
  } catch (err) {
    console.warn('Recorder cleanup script did not run:', err && err.message ? err.message : err);
  }
}

async function startRecordingOnActiveTab() {
  try {
    if (await browserNeedsMaximize()) {
      showMessage('message-box', 'Please maximize your browser window to continue!');
      return;
    }

    const tab = await getActiveTab();
    if (!canInjectInto(tab)) {
      showMessage('message-box', 'Open a web page before starting a recording.');
      return;
    }

    // Fresh Start always appends — clear any stale insertion target left
    // over from a previous + Insert step session.
    await new Promise(r => chrome.storage.local.remove('guide:insertAfter', r));
    await injectRecorder(tab.id);
    await setStoredRecordingTabId(tab.id);
    showMessage('message-box-success', 'Recording started.');
  } catch (err) {
    console.error('Unable to start recording:', err);
    showMessage('message-box', 'Unable to start recording on this page.');
  }
}

async function stopRecordingAndOpenGuide() {
  try {
    const storedTabId = await getStoredRecordingTabId();
    const activeTab = await getActiveTab();
    const tabId = storedTabId || (activeTab && activeTab.id);

    if (tabId) {
      await stopRecorderInTab(tabId);
    }

    await clearStoredRecordingTabId();
    await openGuideTab();
  } catch (err) {
    console.error('Unable to stop recording:', err);
    showMessage('message-box', 'Unable to stop recording.');
  }
}

async function clearStoredSteps() {
  const port = chrome.runtime.connect({ name: 'clearStorage' });
  port.postMessage({ action: 'clear' });
  port.onMessage.addListener(function onMessage(message) {
    port.onMessage.removeListener(onMessage);
    if (message && message.success === true) {
      showMessage('message-box-success', 'Storage cleared successfully.');
    } else {
      showMessage('message-box', 'Unable to clear storage.');
    }
  });
}

function popupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.overview');
  const tabContents1 = document.querySelectorAll('.comments');

  tabs.forEach(tab => {
    tab.addEventListener('mouseover', () => {
      tabs.forEach(tab => tab.classList.remove('active'));
      tabContents.forEach(tabContent => tabContent.classList.remove('active'));
      tabContents1.forEach(tabContent => tabContent.classList.remove('active'));
      tab.classList.add('active');
      const tabContent = document.querySelector(`.${tab.dataset.tab}`);
      if (tabContent) tabContent.classList.add('active');
    });
  });
}

window.startRecordingOnActiveTab = startRecordingOnActiveTab;
window.stopRecordingAndOpenGuide = stopRecordingAndOpenGuide;
