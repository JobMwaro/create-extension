(function (root) {
  const STATE_KEY = '__CREATE_RECORDER__';

  if (root[STATE_KEY]) {
    root[STATE_KEY].startRecording();
    return;
  }

  const state = {
    active: false,
    ribbon: null,
    stopButton: null,
    onMouseMove: null,
    onClick: null,
    onChange: null,
    onSubmit: null,
    lastChangeSig: '',
    resetChangeSig: null,
    resultObserver: null,
    lastEventAt: 0,
    resultSentForWindow: false,
    resetResultLatch: null,
    onMessage: null,
  };

  function makeRecorderButton() {
    // The pulsing red dot is drawn via the .create-ext-stop::before pseudo
    // element in styles.css, so we only need to emit the label here.
    const container = document.createElement('button');
    container.className = 'create-ext-stop';
    container.type = 'button';
    container.setAttribute('aria-label', 'Stop recording');
    container.textContent = 'Stop recording';
    return container;
  }

  function createRibbon() {
    const ribbon = document.createElement('div');
    ribbon.className = 'create-ext-ribbon';
    // Cursor pointer drawn inside the ribbon — its tip sits at the centre
    // (the click position) so screenshots clearly show what was clicked.
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'create-ext-ribbon-cursor');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    const path = document.createElementNS(NS, 'path');
    // Classic arrow cursor — tip at (3,2), opens down-right.
    path.setAttribute('d', 'M3 2 L3 18 L7.5 14 L10.5 20 L13 19 L10 13 L16 13 Z');
    path.setAttribute('fill', '#ffffff');
    path.setAttribute('stroke', '#1a1a1a');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    ribbon.appendChild(svg);
    document.body.appendChild(ribbon);
    return ribbon;
  }

  function updateRibbonPosition(event) {
    if (!state.ribbon) return;
    state.ribbon.style.left = event.pageX + 'px';
    state.ribbon.style.top = event.pageY + 'px';
  }

  function openGuideTab() {
    const port = chrome.runtime.connect({ name: 'openGuideTab' });
    port.postMessage({ action: 'open' });
  }

  function flashOverlay() {
    const flashDiv = document.createElement('div');
    flashDiv.className = 'create-ext-flash';
    document.body.appendChild(flashDiv);
    setTimeout(() => flashDiv.remove(), 100);
  }

  function captureClick(event) {
    if (!state.active) return;

    if (state.stopButton && state.stopButton.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      stopRecording();
      openGuideTab();
      return;
    }

    const element = event.target;
    const payload = gatherClickContext(element, 'click');
    sendCapture(payload);
  }

  function captureChange(event) {
    if (!state.active) return;
    const element = event.target;
    if (!element || !element.tagName) return;
    // Only field-shaped elements
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)) return;
    // Avoid duplicate emits if the same change fires twice within a tick
    const sig = elementSignature(element);
    if (state.lastChangeSig === sig) return;
    state.lastChangeSig = sig;
    clearTimeout(state.resetChangeSig);
    state.resetChangeSig = setTimeout(() => { state.lastChangeSig = ''; }, 400);
    const payload = gatherClickContext(element, 'change');
    sendCapture(payload);
  }

  function captureSubmit(event) {
    if (!state.active) return;
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    const payload = gatherClickContext(form, 'submit');
    payload.formName = form.getAttribute('name') || form.id || '';
    payload.formAction = form.getAttribute('action') || '';
    sendCapture(payload);
  }

  function elementSignature(el) {
    const tag = (el.tagName || '').toUpperCase();
    return `${tag}|${el.id || ''}|${el.name || ''}|${(tag === 'INPUT' && (el.type || '') === 'checkbox') ? el.checked : (el.value || '').slice(0, 16)}`;
  }

  function sendCapture(payload) {
    state.lastEventAt = Date.now();
    state.resultSentForWindow = false;
    clearTimeout(state.resetResultLatch);
    state.resetResultLatch = setTimeout(() => { state.resultSentForWindow = false; }, 3000);
    const capturePort = chrome.runtime.connect({ name: 'captureStep' });
    capturePort.postMessage(payload);
    capturePort.onMessage.addListener(function onCaptureResponse(response) {
      capturePort.onMessage.removeListener(onCaptureResponse);
      if (response && response.success) flashOverlay();
      else console.error('Unable to capture step:', response && response.error);
    });
  }

  // -------- result-state capture --------
  // After each user-initiated event, watch the DOM for toast/alert/dialog
  // additions within a 3-second window. The first match is captured as a
  // step with eventType='result' and the toast text; compileSteps then
  // merges it into the preceding manual step.
  const RESULT_WINDOW_MS = 3000;

  function startResultObserver() {
    if (state.resultObserver) return;
    state.resultObserver = new MutationObserver((mutations) => {
      if (state.resultSentForWindow) return;
      if (Date.now() - state.lastEventAt > RESULT_WINDOW_MS) return;
      for (const m of mutations) {
        if (!m.addedNodes || m.addedNodes.length === 0) continue;
        for (const n of m.addedNodes) {
          const hit = resultLikeNode(n);
          if (hit) {
            const text = extractResultText(hit);
            if (text) {
              // Let CSS animations settle so the screenshot is clean
              setTimeout(() => sendResultCapture(text, hit), 220);
              return;
            }
          }
        }
      }
    });
    state.resultObserver.observe(document.body, { childList: true, subtree: true });
  }

  function stopResultObserver() {
    if (state.resultObserver) {
      state.resultObserver.disconnect();
      state.resultObserver = null;
    }
  }

  function resultLikeNode(node) {
    if (!node || node.nodeType !== 1) return null;
    if (matchesResultPattern(node)) return node;
    // Also walk into the subtree — a wrapper div may host the alert
    if (node.querySelector) {
      const inner = node.querySelector('[role="alert"], [role="status"], [role="alertdialog"], [role="dialog"], [aria-live="assertive"], [aria-live="polite"]');
      if (inner) return inner;
    }
    return null;
  }

  function matchesResultPattern(el) {
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'alert' || role === 'status' || role === 'alertdialog' || role === 'dialog') return true;
    const live = el.getAttribute && el.getAttribute('aria-live');
    if (live === 'assertive' || live === 'polite') return true;
    const cls = (typeof el.className === 'string') ? el.className : '';
    return /\b(toast|notification|snackbar|alert|flash|banner|validation|invalid-feedback|success-message|error-message|form-error)\b/i.test(cls);
  }

  function extractResultText(node) {
    const text = (node.innerText || node.textContent || '').trim().replace(/\s+/g, ' ');
    return text.length > 0 && text.length < 240 ? text : '';
  }

  function sendResultCapture(text, hostNode) {
    if (state.resultSentForWindow) return;
    state.resultSentForWindow = true;
    // Use the host node's rect as the highlight for the screenshot, since
    // the result UI itself is the most relevant region to mark.
    const targetRect = readBoundingRect(hostNode);
    const viewport = readViewport();
    const payload = {
      eventType: 'result',
      resultText: text,
      elementType: hostNode && hostNode.tagName ? hostNode.tagName : '',
      elementLabel: text,
      targetRect,
      viewport,
      pageTitle: (document.title || '').trim(),
      pageUrl: location.href || '',
    };
    const port = chrome.runtime.connect({ name: 'captureStep' });
    port.postMessage(payload);
    port.onMessage.addListener(function onResp(r) {
      port.onMessage.removeListener(onResp);
      if (r && r.success) flashOverlay();
    });
  }

  // -------- click-context gathering --------
  // Snapshots what the user is seeing when they click: the element itself,
  // the section title above it, sibling tab labels, visible filter fields,
  // and any status-counter-looking elements. The richer the snapshot, the
  // less the user has to edit by hand in the manual builder.

  function gatherClickContext(element, eventType) {
    const inputType = inferInputType(element);
    const isSensitive = isSensitiveField(element, inputType);
    // Mask values of password / OTP / PIN / CVV fields entirely. Replace with
    // a fixed glyph so descriptions can still mention "your password" without
    // ever revealing the typed value.
    const rawValue = (element.value || element.textContent || '').trim();
    const elementValue = isSensitive
      ? (rawValue ? '••••••' : '')
      : sanitizeCapturedText(rawValue);
    const targetRect = readBoundingRect(element);
    const viewport = readViewport();
    return {
      eventType:       eventType || 'click',
      elementType:     element.tagName || '',
      elementValue,
      elementLabel:    accessibleName(element),
      elementRole:     inferRole(element),
      targetRect,
      viewport,
      // inputType: HTML `type` attr for <input> (email/password/checkbox/etc),
      // and `submit` shorthand for <button type="submit">. Drives intent-based
      // templates and captions.
      inputType,
      sensitive:       isSensitive,
      ancestorHeading: nearestHeadingText(element),
      siblingTabs:     collectSiblingTabs(element),
      filterFields:    collectVisibleFilterFields(element),
      statusBadges:    collectStatusBadgeLabels(element),
      pageTitle:       (document.title || '').trim(),
      pageUrl:         location.href || '',
    };
  }

  function readBoundingRect(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  function readViewport() {
    return {
      width:  window.innerWidth  || document.documentElement.clientWidth  || 0,
      height: window.innerHeight || document.documentElement.clientHeight || 0,
      dpr:    window.devicePixelRatio || 1,
    };
  }

  function isSensitiveField(el, inputType) {
    if (inputType === 'password') return true;
    const probe = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('autocomplete') || '')).toLowerCase();
    return /password|otp|pin|cvv|cvc|secret|token|2fa|authcode|one[\s\-_]?time/.test(probe);
  }

  function inferInputType(el) {
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT') {
      return ((el.getAttribute('type') || 'text') + '').toLowerCase();
    }
    if (tag === 'TEXTAREA') return 'textarea';
    if (tag === 'SELECT') return 'select';
    if (tag === 'BUTTON') {
      return ((el.getAttribute('type') || 'button') + '').toLowerCase();
    }
    return '';
  }

  function accessibleName(el) {
    // 1. Explicit a11y attributes win
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) return cleanLabel(aria);
    const labelledby = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledby) {
      const ref = document.getElementById(labelledby);
      if (ref) return cleanLabel(ref.textContent || '');
    }
    const title = el.getAttribute && el.getAttribute('title');
    if (title) return cleanLabel(title);
    const alt = el.getAttribute && el.getAttribute('alt');
    if (alt) return cleanLabel(alt);

    // 2. Form fields without a11y attributes: try linked label, wrapping
    //    label, placeholder, then name. textContent is almost always empty
    //    on inputs/selects/textareas, so don't fall back to it for them.
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (el.id) {
        try {
          const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lbl && lbl.textContent.trim()) return cleanLabel(lbl.textContent);
        } catch (e) { /* invalid selector — skip */ }
      }
      const wrappingLabel = el.closest && el.closest('label');
      if (wrappingLabel && wrappingLabel.textContent.trim()) {
        return cleanLabel(wrappingLabel.textContent);
      }
      if (el.placeholder) return cleanLabel(el.placeholder);
      // Sibling label-like element (common in custom form components)
      const prev = el.previousElementSibling;
      if (prev && /^(LABEL|SPAN|DIV|P)$/i.test(prev.tagName)) {
        const t = (prev.textContent || '').trim();
        if (t && t.length < 80) return cleanLabel(t);
      }
      // For SELECT, the selected option's text is meaningful
      if (tag === 'SELECT' && el.selectedOptions && el.selectedOptions[0]) {
        const optText = el.selectedOptions[0].textContent;
        if (optText && optText.trim()) return cleanLabel(optText);
      }
      if (el.name) return cleanLabel(el.name);
      return '';
    }

    // 3. Everything else: text content, then value
    return cleanLabel(el.textContent || el.value || '');
  }

  function cleanLabel(s) {
    return sanitizeCapturedText(s, 120);
  }

  // Normalises whitespace, rejects text that looks like source code, and
  // hard-caps length. Returns '' when the input is unsuitable as a label,
  // so callers can fall through to a generic description.
  function sanitizeCapturedText(s, maxLen) {
    const cleaned = (s || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    if (looksLikeCode(cleaned)) return '';
    const cap = typeof maxLen === 'number' ? maxLen : 120;
    return cleaned.length > cap ? cleaned.slice(0, cap) : cleaned;
  }

  // Heuristic: any 2+ of: language keywords, arrow-functions, braces/semis,
  // explicit `function(...)` opener. Short strings are always treated as
  // labels even if they happen to contain matching characters.
  function looksLikeCode(s) {
    if (!s || s.length < 30) return false;
    let score = 0;
    if (/\b(function|return|const|let|var|typeof|=>|if\s*\(|for\s*\(|while\s*\()\b/.test(s)) score++;
    if (/=>/.test(s)) score++;
    const braceParts = s.split(/[{};]/).length;
    if (braceParts > 4) score++;
    if (/^\(?function\s*\(/.test(s)) score += 2;
    if (/window\.|document\.|performance\./.test(s)) score++;
    return score >= 2;
  }

  function inferRole(el) {
    const explicit = el.getAttribute && el.getAttribute('role');
    if (explicit) return explicit;
    let p = el.parentElement;
    for (let depth = 0; p && depth < 6; depth++, p = p.parentElement) {
      const role = p.getAttribute && p.getAttribute('role');
      const cls = (p.className && typeof p.className === 'string') ? p.className : '';
      if (role === 'tablist' || /\btab(s|list|bar|nav)?\b/i.test(cls)) return 'tab';
      if (/\bnav(bar|item|link)?\b/i.test(cls)) return 'navlink';
    }
    if (el.tagName === 'BUTTON') return 'button';
    if (el.tagName === 'A')      return 'link';
    if (el.tagName === 'INPUT')  return 'input';
    if (el.tagName === 'SELECT') return 'select';
    return '';
  }

  function nearestHeadingText(el) {
    let p = el;
    while (p && p !== document.body) {
      let sib = p.previousElementSibling;
      while (sib) {
        if (/^H[1-6]$/.test(sib.tagName || '')) {
          return (sib.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 150);
        }
        sib = sib.previousElementSibling;
      }
      p = p.parentElement;
    }
    return '';
  }

  function collectSiblingTabs(el) {
    // Look for any nav/tab/sidebar/menu-like ancestor — broad detection to
    // catch Material, Bootstrap, custom Angular/React components.
    let host = null;
    let p = el;
    for (let depth = 0; p && depth < 8; depth++, p = p.parentElement) {
      if (!p.tagName) continue;
      const tag = p.tagName.toLowerCase();
      const role = p.getAttribute && p.getAttribute('role');
      const cls = (typeof p.className === 'string') ? p.className : '';
      if (tag === 'nav' || tag === 'aside' ||
          role === 'tablist' || role === 'navigation' || role === 'menu' || role === 'menubar' ||
          /\b(tab|tablist|tabbar|tabs|nav|sidebar|side-?bar|side-?menu|menu|sidenav)\b/i.test(cls)) {
        host = p;
        break;
      }
    }
    if (!host) return [];
    const candidates = Array.from(host.querySelectorAll(
      '[role="tab"], [role="menuitem"], [role="link"], button, a, li'
    )).filter(isVisibleInViewport);
    const labels = candidates.map(t => {
      const ari = t.getAttribute && t.getAttribute('aria-label');
      return (ari || t.textContent || '').trim().replace(/\s+/g, ' ');
    }).filter(t => t.length > 0 && t.length < 60);
    return Array.from(new Set(labels)).slice(0, 12);
  }

  function collectVisibleFilterFields(el) {
    // Walk up parents looking for the smallest scope that already contains
    // two or more visible form fields. Falls back to <body>.
    const scopes = [];
    let p = el.parentElement;
    for (let depth = 0; p && depth < 8; depth++, p = p.parentElement) scopes.push(p);
    scopes.push(document.body);
    for (const scope of scopes) {
      const inputs = Array.from(scope.querySelectorAll('input, select, textarea'))
        .filter(isVisibleInViewport)
        .slice(0, 24);
      if (inputs.length >= 2) return extractFieldLabels(inputs);
    }
    return [];
  }

  function extractFieldLabels(inputs) {
    const out = inputs.map(input => {
      if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');
      if (input.id) {
        try {
          const lbl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (lbl) return lbl.textContent || '';
        } catch (e) { /* ignore invalid selector */ }
      }
      const parentLabel = input.closest('label');
      if (parentLabel) return parentLabel.textContent || '';
      if (input.placeholder) return input.placeholder;
      if (input.name) return input.name;
      return '';
    }).map(s => (s || '').trim().replace(/\s+/g, ' ')).filter(s => s.length > 0 && s.length < 60);
    return Array.from(new Set(out)).slice(0, 12);
  }

  function collectStatusBadgeLabels(el) {
    // Look for a counter STRIP: a container whose children are all small
    // boxes containing a number + label. Walk ancestors looking for the
    // first such row pattern.
    const found = [];
    let p = el.parentElement;
    for (let depth = 0; p && depth < 10; depth++, p = p.parentElement) {
      const children = Array.from(p.children).filter(isVisibleInViewport);
      if (children.length < 3 || children.length > 14) continue;
      let goodCount = 0;
      const labels = [];
      for (const c of children) {
        const t = (c.innerText || c.textContent || '').trim().replace(/\s+/g, ' ');
        if (!t || t.length > 60) continue;
        if (!/\d/.test(t)) continue;
        const words = t.match(/[A-Za-z][A-Za-z\-]+/g);
        if (!words) continue;
        const candidate = words.find(w => w.length >= 3 && w.length <= 20);
        if (!candidate) continue;
        goodCount++;
        labels.push(candidate);
      }
      if (goodCount >= 3 && goodCount / children.length >= 0.5) {
        labels.forEach(l => found.push(l));
        break;
      }
    }
    return Array.from(new Set(found)).slice(0, 12);
  }

  function isVisibleInViewport(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.bottom < 0 || r.top > (window.innerHeight || 0)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return true;
  }

  function startRecording() {
    if (state.active) return;

    state.active = true;
    state.ribbon = state.ribbon || createRibbon();
    state.stopButton = state.stopButton || makeRecorderButton();
    if (!state.stopButton.isConnected) document.body.appendChild(state.stopButton);

    state.onMouseMove = updateRibbonPosition;
    state.onClick = captureClick;
    state.onChange = captureChange;
    state.onSubmit = captureSubmit;
    document.addEventListener('mousemove', state.onMouseMove);
    document.addEventListener('click', state.onClick);
    document.addEventListener('change', state.onChange, true);     // capture phase to catch before form re-renders
    document.addEventListener('submit', state.onSubmit, true);
    startResultObserver();
  }

  function stopRecording() {
    if (!state.active && !state.ribbon && !state.stopButton) return;

    state.active = false;
    if (state.onMouseMove) document.removeEventListener('mousemove', state.onMouseMove);
    if (state.onClick)     document.removeEventListener('click',     state.onClick);
    if (state.onChange)    document.removeEventListener('change',    state.onChange, true);
    if (state.onSubmit)    document.removeEventListener('submit',    state.onSubmit, true);
    state.onMouseMove = null;
    state.onClick = null;
    state.onChange = null;
    state.onSubmit = null;
    state.lastChangeSig = '';
    clearTimeout(state.resetChangeSig);
    state.resetChangeSig = null;
    clearTimeout(state.resetResultLatch);
    state.resetResultLatch = null;
    state.resultSentForWindow = false;
    stopResultObserver();

    if (state.ribbon) state.ribbon.remove();
    if (state.stopButton) state.stopButton.remove();
    document.querySelectorAll('.create-ext-warning, .create-ext-flash').forEach(el => el.remove());
    state.ribbon = null;
    state.stopButton = null;
  }

  state.onMessage = function (message, sender, sendResponse) {
    if (!message || !message.action) return false;
    if (message.action === 'startRecording') {
      startRecording();
      sendResponse({ success: true });
      return true;
    }
    if (message.action === 'stopRecording') {
      stopRecording();
      sendResponse({ success: true });
      return true;
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(state.onMessage);

  root[STATE_KEY] = {
    startRecording,
    stopRecording,
    isRecording: () => state.active,
  };

  startRecording();
})(typeof globalThis !== 'undefined' ? globalThis : window);
