importScripts('scripts/stepsRepo.js');

chrome.runtime.onInstalled.addListener(() => {
  // no-op for now
});

let captureQueue = Promise.resolve();

// ----- Active recording tabs (persists across SW restarts) -----
// Recording can span multiple tabs: a tab opened via target=_blank from a
// recording tab is followed automatically, and the recorder is re-injected
// on every page reload/navigation in every tracked tab. Stored as an array
// under `recordingTabIds` plus a single-tab legacy key the popup writes to.
const RECORDING_TAB_KEY  = 'recordingTabId';      // popup writes here (single)
const RECORDING_TABS_KEY = 'recordingTabIds';     // background owns the array

async function getRecordingTabIds() {
  return new Promise((resolve) => {
    chrome.storage.local.get([RECORDING_TABS_KEY, RECORDING_TAB_KEY], (res) => {
      const set = new Set();
      const arr = res[RECORDING_TABS_KEY];
      if (Array.isArray(arr)) for (const x of arr) if (typeof x === 'number') set.add(x);
      const single = res[RECORDING_TAB_KEY];
      if (typeof single === 'number') set.add(single);
      resolve(Array.from(set));
    });
  });
}

async function addRecordingTabId(tabId) {
  const ids = await getRecordingTabIds();
  if (!ids.includes(tabId)) ids.push(tabId);
  await new Promise((resolve, reject) => {
    chrome.storage.local.set({ [RECORDING_TABS_KEY]: ids }, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

async function removeRecordingTabId(tabId) {
  const r = await new Promise((res) => chrome.storage.local.get([RECORDING_TABS_KEY, RECORDING_TAB_KEY], res));
  const updates = {};
  if (Array.isArray(r[RECORDING_TABS_KEY])) {
    updates[RECORDING_TABS_KEY] = r[RECORDING_TABS_KEY].filter(x => x !== tabId);
  }
  await new Promise((res) => chrome.storage.local.set(updates, res));
  if (r[RECORDING_TAB_KEY] === tabId) {
    await new Promise((res) => chrome.storage.local.remove(RECORDING_TAB_KEY, res));
  }
}

async function clearAllRecordingTabIds() {
  // Tell every tab to stop locally, then drop our tracking state.
  const ids = await getRecordingTabIds();
  for (const id of ids) {
    try { await chrome.tabs.sendMessage(id, { action: 'stopRecording' }); } catch (e) { /* tab gone */ }
  }
  await new Promise((res) => chrome.storage.local.remove([RECORDING_TABS_KEY, RECORDING_TAB_KEY], res));
}

// Back-compat shims (still used by the existing code paths).
async function getActiveRecordingTabId() {
  const ids = await getRecordingTabIds();
  return ids.length > 0 ? ids[ids.length - 1] : null;
}
async function setActiveRecordingTabId(tabId) {
  await addRecordingTabId(tabId);
  // Mirror to the single-tab key so the popup's reader stays in sync.
  await new Promise((res) => chrome.storage.local.set({ [RECORDING_TAB_KEY]: tabId }, res));
}
async function clearActiveRecordingTabId() { await clearAllRecordingTabIds(); }

async function clearInsertionTarget() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('guide:insertAfter', () => resolve());
  });
}

// Re-inject the recorder on any tracked tab whenever it finishes loading.
// Covers full reloads and navigation (login → dashboard etc.) for every tab
// in the recording set, not just one.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const ids = await getRecordingTabIds();
  if (!ids.includes(tabId)) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['styles.css'] });
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['scripts/content.js'] });
    try { await chrome.tabs.sendMessage(tabId, { action: 'startRecording' }); } catch (e) { /* listener may not be registered yet */ }
  } catch (e) {
    // chrome:// / restricted page — silently skip.
    console.warn('Recording re-inject skipped:', e && e.message ? e.message : e);
  }
});

// New tab opened from a recording tab? Follow it so a "click opens a new
// tab for continuation/completion" flow keeps recording without manual
// intervention.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab || !tab.openerTabId) return;
  const ids = await getRecordingTabIds();
  if (!ids.includes(tab.openerTabId)) return;
  if (typeof tab.id === 'number') await addRecordingTabId(tab.id);
  // onUpdated will fire when the new tab finishes loading and inject for us.
});

// Stop tracking when a recording tab is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const ids = await getRecordingTabIds();
  if (ids.includes(tabId)) {
    await removeRecordingTabId(tabId);
    // Only clear the insertion target when ALL tabs are gone, so a multi-
    // tab insertion session doesn't lose its target when one tab closes.
    const remaining = await getRecordingTabIds();
    if (remaining.length === 0) await clearInsertionTarget();
  }
});

// Defensive: on SW startup, drop any stored tabIds that no longer exist.
(async () => {
  try {
    const ids = await getRecordingTabIds();
    for (const id of ids) {
      chrome.tabs.get(id, (tab) => {
        if (chrome.runtime.lastError || !tab) removeRecordingTabId(id);
      });
    }
  } catch (e) { /* ignore */ }
})();

// Return the pageUrl of the latest captured step (any eventType) — the
// natural place for "+ Add step" to resume from.
async function findResumeTargetUrl() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (all) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      let best = null;
      for (const k of Object.keys(all)) {
        if (!k.startsWith('step:')) continue;
        const s = all[k];
        if (!s || !s.pageUrl) continue;
        if (s.eventType === 'narrative') continue; // narratives have no url
        if (!best || (s.order || 0) > (best.order || 0)) best = s;
      }
      resolve(best ? best.pageUrl : null);
    });
  });
}

// Focus an existing tab matching the URL, or open a new tab and wait for
// it to finish loading before returning.
async function openOrFocusTab(url) {
  const existing = await chrome.tabs.query({ url });
  if (existing && existing.length > 0) {
    const t = existing[0];
    await chrome.tabs.update(t.id, { active: true });
    if (t.windowId) await chrome.windows.update(t.windowId, { focused: true });
    // Give SPA frameworks a moment to settle after the focus.
    await new Promise(r => setTimeout(r, 150));
    return t;
  }
  const tab = await new Promise(resolve => chrome.tabs.create({ url }, resolve));
  await new Promise(resolve => {
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Safety timeout
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 8000);
  });
  return tab;
}

function enqueueCapture(operation) {
  const next = captureQueue.then(operation, operation);
  captureQueue = next.catch(() => {});
  return next;
}

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === 'captureStep') {
    port.onMessage.addListener(async function (message) {
      // Backwards-compat: old payload was [elementType, elementValue]
      const payload = Array.isArray(message)
        ? { elementType: message[0], elementValue: message[1] }
        : (message || {});
      try {
        const record = await enqueueCapture(async () => {
          const image = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
          return StepsRepo.addStep(Object.assign({}, payload, { image }));
        });
        port.postMessage({ success: true, id: record.id });
      } catch (err) {
        console.error('captureStep failed:', err && err.message ? err.message : err);
        port.postMessage({ success: false, error: String(err && err.message ? err.message : err) });
      }
    });
    return;
  }

  if (port.name === 'openGuideTab') {
    port.onMessage.addListener(async function () {
      // Recording is finishing — stop every tracked tab (Stop is global)
      // and drop any pending insertion target so the next session starts
      // clean.
      await clearAllRecordingTabIds();
      await clearInsertionTarget();
      const url = chrome.runtime.getURL('screenshot.html');
      try {
        const existing = await chrome.tabs.query({ url });
        if (existing && existing.length > 0) {
          // Reuse the open guide tab instead of opening a duplicate.
          const t = existing[0];
          await chrome.tabs.update(t.id, { active: true });
          if (t.windowId) await chrome.windows.update(t.windowId, { focused: true });
          port.postMessage({ success: true, reused: true });
          return;
        }
        chrome.tabs.create({ url }, () => port.postMessage({ success: true, reused: false }));
      } catch (err) {
        port.postMessage({ success: false, error: String(err) });
      }
    });
    return;
  }

  if (port.name === 'listOpenTabs') {
    port.onMessage.addListener(async function () {
      try {
        const tabs = await chrome.tabs.query({});
        const safe = tabs
          .filter(t => t.url && /^https?:|^file:/.test(t.url))
          .map(t => ({
            id: t.id,
            url: t.url,
            title: t.title || '',
            favIconUrl: t.favIconUrl || '',
            active: !!t.active,
            windowId: t.windowId,
          }));
        port.postMessage({ success: true, tabs: safe });
      } catch (err) {
        port.postMessage({ success: false, error: String(err) });
      }
    });
    return;
  }

  if (port.name === 'resumeRecording') {
    port.onMessage.addListener(async function (message) {
      try {
        const requestedUrl = message && typeof message.url === 'string' ? message.url.trim() : '';
        const targetUrl = requestedUrl || await findResumeTargetUrl();
        if (!targetUrl) {
          port.postMessage({ success: false, error: 'No previous recording URL found. Start a new recording from the popup.' });
          return;
        }
        const tab = await openOrFocusTab(targetUrl);
        if (!tab || !tab.id) {
          port.postMessage({ success: false, error: 'Unable to open the recording tab.' });
          return;
        }
        // Inject the recorder. content.js is idempotent — re-injection just
        // re-attaches listeners; the existing recorder calls startRecording
        // on itself if already loaded.
        try {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id, allFrames: true }, files: ['styles.css'] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['scripts/content.js'] });
          try { await chrome.tabs.sendMessage(tab.id, { action: 'startRecording' }); } catch (e) {}
        } catch (e) {
          // chrome:// or restricted pages can't be scripted — give the
          // editor a clear error.
          port.postMessage({ success: false, error: 'Cannot inject into this page. Open a regular web page first.' });
          return;
        }
        await setActiveRecordingTabId(tab.id);
        port.postMessage({ success: true, tabId: tab.id, url: targetUrl });
      } catch (err) {
        console.error('resumeRecording failed:', err);
        port.postMessage({ success: false, error: String(err && err.message ? err.message : err) });
      }
    });
    return;
  }

  if (port.name === 'clearStorage') {
    port.onMessage.addListener(async function () {
      try {
        await StepsRepo.clearAll();
        port.postMessage({ success: true });
      } catch (err) {
        port.postMessage({ success: false, error: String(err) });
      }
    });
    return;
  }

  if (port.name === 'deleteStep') {
    port.onMessage.addListener(async function (message) {
      const id = typeof message === 'object' ? message.id : message;
      try {
        await StepsRepo.removeStep(Number(id));
        port.postMessage({ success: true });
      } catch (err) {
        console.error('deleteStep failed:', err);
        port.postMessage({ success: false, error: String(err) });
      }
    });
    return;
  }

  if (port.name === 'maximizeWindow') {
    port.onMessage.addListener(function (message) {
      if (message && message.action === 'maximize') {
        chrome.windows.getCurrent((win) => {
          port.postMessage({ success: win.state === 'maximized' ? false : true });
        });
      }
    });
    return;
  }
});
