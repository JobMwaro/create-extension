// Single-record-per-step storage for the Create extension.
// Each step is stored under key `step:{id}` with shape:
//   { id, order, image, elementType, elementValue, description? }
//
// Loaded as a classic script in two contexts:
//   - service worker (via importScripts)
//   - screenshot.html (via <script src=...>)
// Exposes globalThis.StepsRepo.

(function (root) {
  const KEY_PREFIX = 'step:';
  const SECTION_PREFIX = 'section:';
  const META_KEY = 'guide:meta';
  const INSERT_AFTER_KEY = 'guide:insertAfter';
  // Defaults — only fill fields that are nearly always identical across
  // manuals (organisation, version). Title/section/intro left blank so they
  // don't leak placeholder text into the export.
  const DEFAULT_META = Object.freeze({
    title: '',
    subtitle: '',
    tagline: '',
    organization: 'Uganda Registration Services Bureau (URSB)',
    portalName: '',
    url: '',
    version: 'Version 1.0',
    sectionTitle: '',
    intro: '',
    // Section MVP — extra labelled blocks rendered between intro and steps.
    purpose: '',
    prerequisites: '',
    expectedOutcome: '',
  });
  let writeQueue = Promise.resolve();

  function keyFor(id) {
    return KEY_PREFIX + id;
  }

  function sectionKey(id) {
    return SECTION_PREFIX + id;
  }

  function readAllRecords() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (all) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        const records = [];
        for (const k of Object.keys(all)) {
          if (k.startsWith(KEY_PREFIX)) records.push(all[k]);
        }
        resolve(records);
      });
    });
  }

  // ---- sections ----
  // Sections are top-level chapters of the manual. Each has its own title,
  // intro, purpose, prerequisites and expected outcome. Steps reference a
  // section via `step.sectionId`. If no explicit sections exist yet, the
  // editor + exporters fall back to the single-section legacy view that
  // sources its fields from meta.

  function _readSectionsSync(allKeys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (all) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        const list = [];
        for (const k of Object.keys(all)) {
          if (k.startsWith(SECTION_PREFIX)) list.push(all[k]);
        }
        list.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(list);
      });
    });
  }

  async function listSections() {
    return _readSectionsSync();
  }

  async function getSection(id) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(sectionKey(id), (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve(res[sectionKey(id)] || null);
      });
    });
  }

  function _newSectionRecord(existing, partial) {
    const nextId = existing.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
    const nextOrder = existing.length + 1;
    return {
      id: nextId,
      order: nextOrder,
      title:           partial.title           || '',
      intro:           partial.intro           || '',
      purpose:         partial.purpose         || '',
      prerequisites:   partial.prerequisites   || '',
      expectedOutcome: partial.expectedOutcome || '',
    };
  }

  async function _writeRecord(key, record) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: record }, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve();
      });
    });
  }

  async function addSection(partial = {}) {
    return enqueueWrite(async () => {
      const existing = await _readSectionsSync();
      const record = _newSectionRecord(existing, partial);
      await _writeRecord(sectionKey(record.id), record);
      return record;
    });
  }

  async function updateSection(id, patch) {
    const current = await getSection(id);
    if (!current) return null;
    const next = Object.assign({}, current, patch, { id: current.id });
    await _writeRecord(sectionKey(id), next);
    return next;
  }

  async function removeSection(id) {
    return enqueueWrite(async () => {
      const sections = await _readSectionsSync();
      const target = sections.find(s => s.id === Number(id));
      if (!target) return;
      if (sections.length === 1) {
        // Keep at least one section if any steps reference it; otherwise
        // safe to delete.
        const steps = await readAllRecords();
        const refs = steps.filter(s => s.sectionId === target.id);
        if (refs.length > 0) {
          throw new Error('Cannot remove the only section while steps reference it.');
        }
      }
      // Reassign any steps in this section to the previous section
      const prev = sections.filter(s => s.id !== target.id && s.order < target.order).pop();
      const fallback = prev || sections.find(s => s.id !== target.id);
      const steps = await readAllRecords();
      const updates = {};
      for (const s of steps) {
        if (s.sectionId === target.id) {
          updates[keyFor(s.id)] = Object.assign({}, s, { sectionId: fallback ? fallback.id : null });
        }
      }
      // Remove the section, re-pack orders on remaining
      const remaining = sections.filter(s => s.id !== target.id);
      remaining.forEach((s, idx) => {
        updates[sectionKey(s.id)] = Object.assign({}, s, { order: idx + 1 });
      });
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove(sectionKey(target.id), () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
      if (Object.keys(updates).length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(updates, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
          });
        });
      }
    });
  }

  function enqueueWrite(operation) {
    const next = writeQueue.then(operation, operation);
    writeQueue = next.catch(() => {});
    return next;
  }

  async function listSteps() {
    const records = await readAllRecords();
    records.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
    return records;
  }

  async function getStep(id) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keyFor(id), (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve(res[keyFor(id)] || null);
      });
    });
  }

  async function addStep(input) {
    const payload = input || {};
    return enqueueWrite(async () => {
      const existing = await readAllRecords();
      const nextId = existing.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;

      // Handle insertion target. When set, the new step is placed at
      // `target + 1` and every existing step with order > target is bumped
      // down by one. The target then auto-advances so subsequent captures
      // during this insertion stack after this one.
      const insertAfter = await getInsertionTarget();
      let nextOrder;
      const orderUpdates = {};
      let preferredSectionId = null;
      if (insertAfter !== null) {
        nextOrder = insertAfter + 1;
        for (const rec of existing) {
          if ((rec.order || 0) > insertAfter) {
            orderUpdates[keyFor(rec.id)] = Object.assign({}, rec, { order: (rec.order || 0) + 1 });
          }
        }
        // Inherit section from the step we're inserting after, when known.
        const priorStep = existing.find(s => s.order === insertAfter);
        if (priorStep && priorStep.sectionId) preferredSectionId = priorStep.sectionId;
        // Advance the target for the next capture in this insertion session.
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [INSERT_AFTER_KEY]: insertAfter + 1 }, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
          });
        });
      } else {
        nextOrder = existing.length + 1;
      }

      // Determine the current section. If none exists yet, bootstrap a
      // default one from any meta values the user may have already typed
      // (and any unowned existing steps inherit it).
      let sections = await _readSectionsSync();
      let currentSection;
      if (preferredSectionId) {
        currentSection = sections.find(s => s.id === preferredSectionId);
      }
      if (!currentSection && sections.length === 0) {
        const meta = await getMeta();
        const seed = _newSectionRecord([], {
          title:           meta.sectionTitle    || '',
          intro:           meta.intro           || '',
          purpose:         meta.purpose         || '',
          prerequisites:   meta.prerequisites   || '',
          expectedOutcome: meta.expectedOutcome || '',
        });
        await _writeRecord(sectionKey(seed.id), seed);
        currentSection = seed;
        // Tag every pre-existing step with this seed section so the
        // multi-section view groups them correctly.
        const updates = {};
        for (const s of existing) {
          if (!s.sectionId) updates[keyFor(s.id)] = Object.assign({}, s, { sectionId: seed.id });
        }
        if (Object.keys(updates).length > 0) {
          await new Promise((resolve, reject) => {
            chrome.storage.local.set(updates, () => {
              if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
              resolve();
            });
          });
        }
      } else if (!currentSection) {
        currentSection = sections[sections.length - 1];
      }

      const record = {
        id:            nextId,
        order:         nextOrder,
        sectionId:     currentSection.id,
        image:         payload.image,
        // 'click' (default) | 'change' | 'submit' | 'navigation' | 'result'
        eventType:     payload.eventType     || 'click',
        elementType:   payload.elementType   || '',
        elementValue:  payload.elementValue  || '',
        elementLabel:  payload.elementLabel  || '',
        elementRole:   payload.elementRole   || '',
        inputType:     payload.inputType     || '',
        sensitive:     !!payload.sensitive,
        formName:      payload.formName      || '',
        formAction:    payload.formAction    || '',
        targetRect:    payload.targetRect || null, // {x,y,width,height} in CSS px at click time
        viewport:      payload.viewport   || null, // {width,height,dpr} at click time
        ancestorHeading: payload.ancestorHeading || '',
        siblingTabs:   Array.isArray(payload.siblingTabs)  ? payload.siblingTabs  : [],
        filterFields:  Array.isArray(payload.filterFields) ? payload.filterFields : [],
        statusBadges:  Array.isArray(payload.statusBadges) ? payload.statusBadges : [],
        pageTitle:     payload.pageTitle || '',
        pageUrl:       payload.pageUrl   || '',
        description:   payload.description || '',
        caption:       '',
        note:          '',
        // Toast / validation / dialog text captured by the result observer.
        // Only populated on records with eventType === 'result'; compileSteps
        // surfaces it on the preceding manual step as `result`.
        resultText:    payload.resultText  || '',
        contextExtras: synthesizeContextExtras(payload),
        // Once this is true, regenerateNotes skips the record so a deleted
        // auto-note doesn't keep coming back on every editor open.
        autoNoteApplied: true,
      };
      // Auto-suggest a note for this step (only if the user hasn't supplied
      // one). Deduped against existing notes in the same section so a kind
      // never re-appears after deletion.
      const peersInSection = existing.filter(s => s.sectionId === currentSection.id);
      const auto = suggestStepNote(record, peersInSection);
      if (auto) record.note = auto;
      // Write the new record alongside any bumped-order updates so the
      // sequence stays consistent under concurrent storage observers.
      orderUpdates[keyFor(nextId)] = record;
      await new Promise((resolve, reject) => {
        chrome.storage.local.set(orderUpdates, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
      return record;
    });
  }

  function synthesizeContextExtras(ctx) {
    const out = [];
    const tabsLine    = synthesizeTabsExtra(ctx);
    const statusLine  = synthesizeStatusExtra(ctx);
    const filtersLine = synthesizeFiltersExtra(ctx);
    if (tabsLine)    out.push(tabsLine);
    if (statusLine)  out.push(statusLine);
    if (filtersLine) out.push(filtersLine);
    return out;
  }

  function synthesizeTabsExtra(ctx) {
    if (!ctx || !Array.isArray(ctx.siblingTabs) || ctx.siblingTabs.length < 2) return '';
    // Exclude the clicked tab from the "other tabs" list — the step description
    // already says which one was clicked, so listing it again is noise.
    const clicked = ((ctx.elementLabel || ctx.elementValue || '') + '').trim().toLowerCase();
    const others = ctx.siblingTabs.filter(t => (t || '').trim().toLowerCase() !== clicked);
    if (others.length === 0) {
      // All tabs matched the clicked label (unlikely) — fall back to the
      // generic phrasing.
      return `Tabs on this page: ${ctx.siblingTabs.join(', ')}.`;
    }
    if (others.length === ctx.siblingTabs.length) {
      // The clicked element wasn't one of the tabs (e.g. a button inside a
      // tab-strip's wrapper). Use generic phrasing.
      return `Tabs on this page: ${ctx.siblingTabs.join(', ')}.`;
    }
    return `Other tabs on this page: ${others.join(', ')}.`;
  }

  function synthesizeStatusExtra(ctx) {
    if (!ctx || !Array.isArray(ctx.statusBadges) || ctx.statusBadges.length === 0) return '';
    return `Status counters at the top of the page: ${ctx.statusBadges.join(', ')}.`;
  }

  function synthesizeFiltersExtra(ctx) {
    if (!ctx || !Array.isArray(ctx.filterFields) || ctx.filterFields.length === 0) return '';
    return `Filters above the list: ${ctx.filterFields.join(', ')}.`;
  }

  // Returns a new contextExtras array with legacy-phrasing items refreshed
  // (or null if nothing changed). Items not matching the legacy auto-format
  // exactly are left alone, so user edits survive.
  function refreshStaleContextExtras(step) {
    const extras = Array.isArray(step && step.contextExtras) ? step.contextExtras.slice() : [];
    if (extras.length === 0) return null;
    let changed = false;
    for (let i = 0; i < extras.length; i++) {
      const line = extras[i];
      if (/^Tabs available:/.test(line)) {
        const fresh = synthesizeTabsExtra(step);
        if (fresh && fresh !== line) { extras[i] = fresh; changed = true; }
      } else if (/^Status counters are:/.test(line)) {
        const fresh = synthesizeStatusExtra(step);
        if (fresh && fresh !== line) { extras[i] = fresh; changed = true; }
      } else if (/^Filters available:/.test(line)) {
        const fresh = synthesizeFiltersExtra(step);
        if (fresh && fresh !== line) { extras[i] = fresh; changed = true; }
      }
    }
    return changed ? extras : null;
  }

  // Strip extras that are identical to the same line on the previous step.
  // Used by editor and exports so the same "Filters available: ..." line
  // doesn't repeat under every step on the same screen.
  function visibleExtras(step, prevStep) {
    const mine = Array.isArray(step && step.contextExtras) ? step.contextExtras : [];
    if (!prevStep) return mine.slice();
    const prev = new Set(Array.isArray(prevStep.contextExtras) ? prevStep.contextExtras : []);
    return mine.filter(x => !prev.has(x));
  }

  // ---- raw-events → manual-steps compiler ----
  //
  // Groups consecutive 'change' events on the same page+form into a single
  // "fill the form" manual step, optionally absorbing the immediately
  // following submit (or the submit-style button click) so we don't render
  // three separate "Enter email", "Enter password", "Click Sign In" steps
  // when one combined sentence reads better in a manual.
  //
  // Inputs: raw step records (already persisted via addStep)
  // Output: compiled step records. Compiled records have the same shape as
  //         raw records — they get rendered the same way — but with a
  //         rewritten `description`, a `sourceIds` array, and a
  //         `kind: 'fillForm' | 'single'` hint for downstream UI.
  //
  // User-edited fields (description, caption, note, contextExtras) on raw
  // records are preserved: compiled.description honours the first raw step's
  // user description if set; caption uses the last raw step's; etc.
  function compileSteps(rawSteps) {
    const raw = Array.isArray(rawSteps) ? rawSteps : [];
    const out = [];
    let i = 0;
    while (i < raw.length) {
      const e = raw[i];

      // Narrative: standalone manual paragraph
      if (e.eventType === 'narrative') {
        out.push(Object.assign({}, e, {
          order: out.length + 1, kind: 'narrative', sourceIds: [e.id],
        }));
        i += 1;
        continue;
      }

      // Result: absorbed into the preceding non-narrative compiled step.
      // We replace its image with the result event's image (post-action
      // state) and append the text as the step's `result` field.
      if (e.eventType === 'result') {
        const target = lastNonNarrative(out);
        if (target) {
          target.result = (target.result ? target.result + ' ' : '') + (e.resultText || '');
          // Track the raw event id so user edits to the "Result:" line can
          // be persisted back to the right record (so compileSteps doesn't
          // overwrite them on the next render).
          target.resultRawId = e.id;
          if (e.image) {
            target.image = e.image;
            if (e.targetRect) target.targetRect = e.targetRect;
            if (e.viewport)   target.viewport   = e.viewport;
          }
          target.sourceIds = (target.sourceIds || []).concat([e.id]);
          i += 1;
          continue;
        }
        // No preceding step — promote to its own standalone step.
        out.push(Object.assign({}, e, {
          order: out.length + 1,
          kind: 'single',
          description: e.resultText || '',
          sourceIds: [e.id],
        }));
        i += 1;
        continue;
      }

      const cluster = collectFormFillCluster(raw, i);
      if (cluster.length >= 2) {
        out.push(buildFillFormStep(cluster, out.length + 1));
        i += cluster.length;
      } else {
        out.push(passThroughStep(raw[i], out.length + 1));
        i += 1;
      }
    }
    return out;
  }

  function lastNonNarrative(arr) {
    for (let j = arr.length - 1; j >= 0; j--) {
      if (arr[j].kind !== 'narrative') return arr[j];
    }
    return null;
  }

  function collectFormFillCluster(raw, start) {
    // A cluster is: 1+ change events, optionally terminated by a single
    // submit event or a click on a submit-shaped button — all on the same
    // pageUrl (and same formName when both events expose one).
    const cluster = [];
    let i = start;
    let scopePage = null;
    let scopeForm = null;
    while (i < raw.length) {
      const e = raw[i];
      if (e.eventType !== 'change') break;
      if (scopePage === null) { scopePage = e.pageUrl; scopeForm = e.formName || ''; }
      if (e.pageUrl !== scopePage) break;
      if ((e.formName || '') && scopeForm && (e.formName !== scopeForm)) break;
      cluster.push(e);
      i++;
    }
    if (cluster.length === 0) return [];
    const terminator = raw[i];
    if (terminator && terminator.pageUrl === scopePage) {
      if (terminator.eventType === 'submit') {
        cluster.push(terminator);
      } else if (terminator.eventType === 'click' && (terminator.inputType === 'submit' || isSubmitishButton(terminator))) {
        cluster.push(terminator);
      }
    }
    return cluster;
  }

  // Suggest a note for a freshly-captured step. Returns '' when nothing
  // useful applies. Triggers are intentionally conservative and deduped
  // against `existingInSection` so each kind only auto-attaches once per
  // section — deleting a note prevents it from coming back later.
  function suggestStepNote(newStep, existingInSection) {
    if (!newStep) return '';
    if (newStep.eventType === 'narrative' || newStep.eventType === 'result') return '';
    if (newStep.note && newStep.note.length > 0) return ''; // user already set one
    const peers = Array.isArray(existingInSection) ? existingInSection : [];

    const itype = (newStep.inputType || '').toLowerCase();
    const label = (newStep.elementLabel || '').trim();
    const value = (newStep.elementValue || '').trim();
    const labelLower = label.toLowerCase();
    const combinedTextLower = (labelLower + ' ' + value.toLowerCase()).trim();

    const PASSWORD_RE = /\b(password|pwd|passcode)\b/;
    const OTP_RE      = /\b(otp|one[\s\-]?time|verification[\s\-]?code|2fa|auth[\s\-]?code)\b/i;
    const NOTE_MARKERS = {
      password: /password|credentials provided/i,
      otp:      /one[\s\-]?time|verification\s*code|otp/i,
      file:     /upload|approved\s*template/i,
      submit:   /not\s+saved|submit\s+button/i,
      orient:   /navigation items|focuses on the highlighted/i,
      search:   /specific keywords|narrow the results|narrow the list/i,
      select:   /dropdown|relevant option/i,
      date:     /date picker|required format/i,
      textarea: /multi[\s\-]?line|text area/i,
      back:     /returns you to the previous|unsaved changes/i,
      addform:  /opens a form for a new entry|new entry/i,
    };
    const alreadyHas = (kind) => peers.some(p => p.note && NOTE_MARKERS[kind].test(p.note));

    // 1. Password — first occurrence per section
    if ((itype === 'password' || PASSWORD_RE.test(labelLower)) && !alreadyHas('password')) {
      return 'Use the credentials provided through your registered channel. The password characters are hidden for security and should not be shared.';
    }

    // 2. OTP / verification code
    if (OTP_RE.test(combinedTextLower) && !alreadyHas('otp')) {
      return 'Enter the one-time code sent to your registered channel within the time limit. Each code is single-use.';
    }

    // 3. File upload
    if (itype === 'file' && !alreadyHas('file')) {
      return 'Ensure the file follows the approved template before uploading. Submitting an incorrect format will be rejected.';
    }

    // 4a. Back / Cancel / Close — navigation away from current screen
    const isBackish = (newStep.elementType === 'A' || newStep.elementType === 'BUTTON')
      && /\b(back|cancel|close|previous|return)\b/i.test(label);
    if (isBackish && !alreadyHas('back')) {
      return 'This returns you to the previous screen. Any unsaved changes on this page will be lost unless you save first.';
    }

    // 4b. Add / Create / New / Register — opens a form for a new entry
    const isAddish = (newStep.elementType === 'BUTTON' || newStep.elementRole === 'button' || newStep.elementType === 'A')
      && /\b(add|create|new|register|configure|setup)\b/i.test(label)
      && !/\b(back|cancel|close|return)\b/i.test(label);
    if (isAddish && !alreadyHas('addform')) {
      return 'Opens a form for a new entry. Required fields are typically marked with an asterisk; the entry is saved only after you submit.';
    }

    // 4c. Submit click — covers <button type=submit>, form submit events,
    //    and submit-shaped buttons like "Sign in / Save / Submit / Verify".
    const isSubmit = itype === 'submit' || newStep.eventType === 'submit' || isSubmitishButton(newStep);
    if (isSubmit && !alreadyHas('submit')) {
      return 'Changes are not saved until you click the submit button. Make sure all required fields are completed first.';
    }

    // 5. Search / filter input — covers explicit type=search, search-y labels,
    //    AND text inputs that sit in a filter row (≥2 visible filter fields)
    const isInFilterRow = Array.isArray(newStep.filterFields) && newStep.filterFields.length >= 2;
    const isTextLike    = /^(text|search|tel|url|number)$/.test(itype) || (newStep.elementType === 'INPUT' && !itype);
    if ((itype === 'search' || /\bsearch\b/.test(labelLower) || (isTextLike && isInFilterRow)) && !alreadyHas('search')) {
      return 'Type specific values to narrow the list. Multiple filters can usually be combined; some apply as you type while others require pressing Enter.';
    }

    // 6. Select / dropdown — value depends on the user's context
    if ((itype === 'select' || newStep.elementType === 'SELECT') && !alreadyHas('select')) {
      return 'Pick the relevant option from the dropdown. The available options depend on your role and the data context.';
    }

    // 7. Date / datetime picker
    if (/^(date|datetime|datetime-local|month|time|week)$/.test(itype) && !alreadyHas('date')) {
      return "Use the date picker to choose a date in the system's required format.";
    }

    // 8. Textarea — generic multi-line input
    if ((newStep.elementType === 'TEXTAREA' || itype === 'textarea') && !alreadyHas('textarea')) {
      return 'Type the required information into the text area. Multi-line content is supported; line breaks are preserved as entered.';
    }

    // 9. Orientation note. Fires the FIRST time we capture a step with a
    //    sibling-tabs/nav group in this section (not just the first step
    //    overall), so a nav click partway through still gets context.
    const sectionHasTabsAlready = peers.some(p =>
      Array.isArray(p.siblingTabs) && p.siblingTabs.length >= 3
    );
    if (!sectionHasTabsAlready
        && Array.isArray(newStep.siblingTabs)
        && newStep.siblingTabs.length >= 3
        && !alreadyHas('orient')) {
      const tabs = newStep.siblingTabs.slice(0, 6).join(', ');
      return `Available navigation items: ${tabs}. This section focuses on the highlighted one.`;
    }

    return '';
  }

  function isSubmitishButton(step) {
    if (!step || step.elementType !== 'BUTTON') return false;
    const label = (step.elementLabel || step.elementValue || '').toLowerCase();
    return /\b(sign in|log in|login|submit|save|continue|next|verify|confirm|register|send)\b/.test(label);
  }

  function passThroughStep(raw, ordinal) {
    return Object.assign({}, raw, {
      order: ordinal,
      kind: 'single',
      sourceIds: [raw.id],
    });
  }

  function buildFillFormStep(cluster, ordinal) {
    const last = cluster[cluster.length - 1];
    const inputs = cluster.filter(e => e.eventType === 'change');
    const submitter = cluster.find(e => e.eventType === 'submit' || (e.eventType === 'click' && (e.inputType === 'submit' || isSubmitishButton(e))));

    // Description: list the fields filled (using labels), then the submit
    const fieldNames = inputs.map(fieldNameFor).filter(Boolean);
    const submitLabel = submitter ? (submitter.elementLabel || submitter.elementValue || '').trim() : '';

    let description = '';
    if (fieldNames.length === 1) {
      const e = inputs[0];
      description = describeStep(e); // reuse intent template
    } else if (fieldNames.length > 1) {
      description = `Fill in the ${joinList(fieldNames)} fields`;
      if (inputs.some(e => e.sensitive)) {
        description = description.replace(/fields$/, 'fields (password characters are hidden for security)');
      }
      description += submitter
        ? `, then click ${submitLabel ? '"' + submitLabel + '"' : 'the submit button'} to submit the form.`
        : '.';
    } else if (submitter) {
      description = submitLabel
        ? `Click "${submitLabel}" to submit the form.`
        : 'Submit the form.';
    }

    // Prefer the user's edited description on the first raw step
    if (cluster[0].description && cluster[0].description.length > 0) {
      description = cluster[0].description;
    }

    // When collapsing a cluster, the most security-relevant note wins.
    // Order: password > otp > file > submit > first-set > none.
    const noteFromCluster = pickClusterNote(cluster);
    const compiled = Object.assign({}, last, {
      order: ordinal,
      description,
      caption: cluster[0].caption && cluster[0].caption.length > 0
        ? cluster[0].caption
        : '',
      note: noteFromCluster,
      // Use the last event's screenshot — shows the form filled out before
      // (or at the moment of) submission.
      image: last.image,
      // Combine context extras: union, dedupe later by render-time helper
      contextExtras: dedupeStrings([].concat(
        ...cluster.map(e => Array.isArray(e.contextExtras) ? e.contextExtras : [])
      )),
      kind: 'fillForm',
      sourceIds: cluster.map(e => e.id),
    });
    return compiled;
  }

  function pickClusterNote(cluster) {
    if (!Array.isArray(cluster) || cluster.length === 0) return '';
    const find = (re) => {
      const hit = cluster.find(c => c.note && re.test(c.note));
      return hit ? hit.note : null;
    };
    // Priority: password > OTP > file > date > search > select > textarea
    //  > addform > back > submit > first-set.
    return (
      find(/password|credentials provided/i) ||
      find(/one[\s\-]?time|verification\s*code|otp/i) ||
      find(/upload|approved\s*template/i) ||
      find(/date picker|required format/i) ||
      find(/specific values|specific keywords|narrow the results|narrow the list/i) ||
      find(/dropdown|relevant option/i) ||
      find(/multi[\s\-]?line|text area/i) ||
      find(/opens a form for a new entry|new entry/i) ||
      find(/returns you to the previous|unsaved changes/i) ||
      find(/not\s+saved|submit\s+button/i) ||
      (cluster[0].note || '') ||
      ''
    );
  }

  function fieldNameFor(step) {
    const label = (step.elementLabel || '').trim();
    if (label) return label;
    if (step.elementType === 'SELECT') return 'dropdown';
    if (step.inputType === 'checkbox') return 'option';
    return '';
  }

  function joinList(items) {
    const a = items.filter(Boolean);
    if (a.length === 0) return '';
    if (a.length === 1) return `"${a[0]}"`;
    if (a.length === 2) return `"${a[0]}" and "${a[1]}"`;
    return a.slice(0, -1).map(x => `"${x}"`).join(', ') + `, and "${a[a.length - 1]}"`;
  }

  function dedupeStrings(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  // A narrative step is a manual prose block the user inserts between
  // recorded steps. It has no screenshot or interaction context — just text.
  async function insertNarrative({ text = '', afterOrder = null, sectionId = null } = {}) {
    return enqueueWrite(async () => {
      const existing = await readAllRecords();
      const nextId = existing.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
      // Inherit the section of the step we're inserted after, if known;
      // else default to current/last section.
      let inheritedSectionId = sectionId;
      if (!inheritedSectionId && afterOrder !== null) {
        const prior = existing.find(s => s.order === Number(afterOrder));
        if (prior && prior.sectionId) inheritedSectionId = prior.sectionId;
      }
      if (!inheritedSectionId) {
        const sections = await _readSectionsSync();
        if (sections.length > 0) inheritedSectionId = sections[sections.length - 1].id;
      }
      // Place narrative right after `afterOrder` if given, else at the end
      const insertAfter = afterOrder === null
        ? existing.reduce((m, r) => Math.max(m, r.order || 0), 0)
        : Number(afterOrder);
      // Bump down any steps with order > insertAfter
      const updates = {};
      for (const rec of existing) {
        if ((rec.order || 0) > insertAfter) {
          updates[keyFor(rec.id)] = Object.assign({}, rec, { order: (rec.order || 0) + 1 });
        }
      }
      const record = {
        id: nextId,
        order: insertAfter + 1,
        sectionId: inheritedSectionId || null,
        image: '',
        eventType: 'narrative',
        elementType: '',
        elementValue: '',
        elementLabel: '',
        elementRole: '',
        inputType: '',
        sensitive: false,
        formName: '',
        formAction: '',
        ancestorHeading: '',
        siblingTabs: [],
        filterFields: [],
        statusBadges: [],
        pageTitle: '',
        pageUrl: '',
        description: text,
        caption: '',
        note: '',
        contextExtras: [],
      };
      updates[keyFor(nextId)] = record;
      await new Promise((resolve, reject) => {
        chrome.storage.local.set(updates, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
      return record;
    });
  }

  async function updateStep(id, patch) {
    const current = await getStep(id);
    if (!current) return null;
    const next = Object.assign({}, current, patch, { id: current.id });
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [keyFor(id)]: next }, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve();
      });
    });
    return next;
  }

  // Swap a compiled step (identified by its sourceIds) with the adjacent
  // compiled step in the same section. `direction` is 'up' or 'down'.
  // Returns true if the move happened, false if it was a no-op (already at
  // an edge or the swap partner would cross section boundaries).
  // Walk every step in order and call suggestStepNote on the ones without
  // a user-set note. Lets the user retro-fit auto-notes onto a manual that
  // was recorded before a trigger existed (or before the dedup rules were
  // tuned). Returns the number of notes added.
  async function regenerateNotes() {
    return enqueueWrite(async () => {
      const all = await readAllRecords();
      all.sort((a, b) => (a.order || 0) - (b.order || 0));
      const sectionPeers = new Map(); // sectionId → cumulative peers (in order)
      const updates = {};
      let added = 0;
      let refreshedExtras = 0;
      for (const rec of all) {
        const sid = rec.sectionId || 0;
        const peers = sectionPeers.get(sid) || [];
        let working = rec;
        let mustWrite = false;

        // 1. Refresh stale contextExtras. Exact-match against the legacy
        //    auto-format only, so user edits survive. Idempotent — safe to
        //    re-run.
        const refreshedExtra = refreshStaleContextExtras(working);
        if (refreshedExtra) {
          working = Object.assign({}, working, { contextExtras: refreshedExtra });
          refreshedExtras++;
          mustWrite = true;
        }

        // 2. Auto-attach a note — but ONLY if this step has never been
        //    auto-processed before. Once autoNoteApplied is true, a deleted
        //    note stays deleted.
        if (!working.autoNoteApplied) {
          if (!working.note || working.note.length === 0) {
            const suggested = suggestStepNote(working, peers);
            if (suggested) {
              working = Object.assign({}, working, { note: suggested });
              added++;
            }
          }
          working = Object.assign({}, working, { autoNoteApplied: true });
          mustWrite = true;
        }

        if (mustWrite) updates[keyFor(rec.id)] = working;
        peers.push(working);
        sectionPeers.set(sid, peers);
      }
      if (Object.keys(updates).length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(updates, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
          });
        });
      }
      return { notesAdded: added, extrasRefreshed: refreshedExtras };
    });
  }

  async function reorderCompiledSteps(blockIds, direction) {
    if (!Array.isArray(blockIds) || blockIds.length === 0) return false;
    return enqueueWrite(async () => {
      const raw = await readAllRecords();
      raw.sort((a, b) => (a.order || 0) - (b.order || 0));
      const compiled = compileSteps(raw);

      const sameIds = (a, b) =>
        Array.isArray(a) && Array.isArray(b) &&
        a.length === b.length && a.every((id, i) => id === b[i]);
      const idx = compiled.findIndex(c => sameIds(c.sourceIds, blockIds));
      if (idx < 0) return false;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= compiled.length) return false;

      const movingBlock = compiled[idx];
      const swapBlock   = compiled[swapIdx];
      // Confine moves to the same section so step↔section affinity stays
      // explicit (cross-section moves can come later via a "move to section"
      // affordance).
      if (movingBlock.sectionId !== swapBlock.sectionId) return false;

      const lookup = (id) => raw.find(r => r.id === id);
      const movingRaw = movingBlock.sourceIds.map(lookup).filter(Boolean);
      const swapRaw   = swapBlock.sourceIds.map(lookup).filter(Boolean);
      if (movingRaw.length === 0 || swapRaw.length === 0) return false;

      const firstBlock  = direction === 'up' ? movingRaw : swapRaw;
      const secondBlock = direction === 'up' ? swapRaw   : movingRaw;
      const allInOrder  = direction === 'up' ? swapRaw.concat(movingRaw) : movingRaw.concat(swapRaw);
      const baseOrder = allInOrder[0].order;

      const updates = {};
      let cur = baseOrder;
      for (const r of firstBlock)  { if (r.order !== cur) updates[keyFor(r.id)] = Object.assign({}, r, { order: cur }); cur++; }
      for (const r of secondBlock) { if (r.order !== cur) updates[keyFor(r.id)] = Object.assign({}, r, { order: cur }); cur++; }
      if (Object.keys(updates).length === 0) return false;

      await new Promise((resolve, reject) => {
        chrome.storage.local.set(updates, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
      return true;
    });
  }

  async function removeStep(id) {
    return enqueueWrite(async () => {
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove(keyFor(id), () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
      // Re-pack `order` so the rendered list stays 1..N without gaps.
      const remaining = await listSteps();
      if (remaining.length === 0) return;
      const updates = {};
      remaining.forEach((rec, idx) => {
        const desired = idx + 1;
        if (rec.order !== desired) {
          updates[keyFor(rec.id)] = Object.assign({}, rec, { order: desired });
        }
      });
      if (Object.keys(updates).length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(updates, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
          });
        });
      }
    });
  }

  async function clearAll() {
    return enqueueWrite(async () => {
      const all = await new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (res) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(res);
        });
      });
      const keys = Object.keys(all).filter((k) => k.startsWith(KEY_PREFIX));
      if (keys.length === 0) return;
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
    });
  }

  // Insertion target — when set to an order N, the next addStep call places
  // its record at order N+1, bumps every later step down by one, then
  // self-increments the target so successive captures stack in order.
  async function getInsertionTarget() {
    return new Promise((resolve) => {
      chrome.storage.local.get(INSERT_AFTER_KEY, (res) => {
        const v = res[INSERT_AFTER_KEY];
        resolve((v === null || v === undefined) ? null : Number(v));
      });
    });
  }

  async function setInsertionTarget(orderOrNull) {
    return new Promise((resolve, reject) => {
      if (orderOrNull === null || orderOrNull === undefined) {
        chrome.storage.local.remove(INSERT_AFTER_KEY, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      } else {
        chrome.storage.local.set({ [INSERT_AFTER_KEY]: Number(orderOrNull) }, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      }
    });
  }

  // Legacy placeholder strings that used to be the DEFAULT_META values
  // before they were emptied. We treat them as blank on read so stale
  // installs don't leak "1. Section title" / "This section explains how
  // to ..." etc. into exports.
  const LEGACY_META_PLACEHOLDERS = {
    title:        'OBRS User Manual',
    subtitle:     'Non-Individual Module',
    tagline:      'Registration · Forms · Settings · Associate Registers',
    portalName:   'OBRS Administration Portal',
    sectionTitle: '1. Section title',
    intro:        'This section explains how to ...',
  };

  function stripLegacyPlaceholders(meta) {
    const out = Object.assign({}, meta);
    for (const k of Object.keys(LEGACY_META_PLACEHOLDERS)) {
      if (out[k] === LEGACY_META_PLACEHOLDERS[k]) out[k] = '';
    }
    return out;
  }

  async function getMeta() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(META_KEY, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        const stored = res[META_KEY] || {};
        resolve(stripLegacyPlaceholders(Object.assign({}, DEFAULT_META, stored)));
      });
    });
  }

  async function setMeta(patch) {
    const current = await getMeta();
    const next = Object.assign({}, current, patch);
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [META_KEY]: next }, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve();
      });
    });
    return next;
  }

  // Compose a narrative caption: "Figure N. <Subject> <noun> showing <detail>."
  // The screen noun (page / panel / list / tab / dialog) is inferred from
  // context. Detail prioritises the interaction (which control / pattern is
  // central to the screenshot) and avoids awkward repetition.
  function defaultCaption(step) {
    if (!step) return 'Figure.';
    const order   = step.order ?? step.id;
    const heading = (step.ancestorHeading || '').trim();
    const title   = cleanPageTitle(step.pageTitle || '');
    const label   = (step.elementLabel || step.elementValue || '').trim();
    const role    = step.elementRole || '';
    const itype   = ((step.inputType || '')).toLowerCase();
    const tabs    = Array.isArray(step.siblingTabs)  ? step.siblingTabs  : [];
    const badges  = Array.isArray(step.statusBadges) ? step.statusBadges : [];
    const filters = Array.isArray(step.filterFields) ? step.filterFields : [];

    let subject = heading || title;
    if (subject && label && subject.toLowerCase() === label.toLowerCase()) {
      subject = ''; // collapse "Foo page showing the Foo button" duplication
    }

    const screenNoun = inferScreenNoun(step, subject);
    const subjectPhrase = subject ? `${subject} ${screenNoun}` : '';

    let detail = '';
    if ((role === 'tab' || role === 'navlink') && label) {
      detail = `the ${label} ${role === 'tab' ? 'tab' : 'menu item'} highlighted`;
    } else if (itype === 'password') {
      detail = label ? `the ${label} field` : 'the password field';
    } else if (itype === 'submit' || (role === 'button' && /\b(sign in|log in|submit|save|continue|next|verify|confirm)\b/i.test(label))) {
      detail = label ? `the ${label} button before submission` : 'the submit button before submission';
    } else if (itype === 'file') {
      detail = label ? `the ${label} upload control` : 'the file-upload control';
    } else if (itype === 'checkbox') {
      detail = label ? `the ${label} checkbox` : 'the checkbox';
    } else if (itype === 'select' || step.elementType === 'SELECT') {
      detail = label ? `the ${label} dropdown` : 'the dropdown';
    } else if ((itype === 'text' || itype === 'email' || itype === 'tel' || itype === 'search' || step.elementType === 'INPUT') && label) {
      detail = `the ${label} field`;
    } else if (role === 'button' && label) {
      detail = `the ${label} button`;
    } else if ((role === 'link' || step.elementType === 'A') && label) {
      detail = `the "${label}" link`;
    } else if (badges.length >= 2 && filters.length >= 2) {
      detail = 'status counters, filters, and the data table';
    } else if (badges.length >= 2) {
      detail = 'the status counters';
    } else if (filters.length >= 2) {
      detail = 'the filter row';
    } else if (label && label.length <= 60) {
      detail = `the "${label}" control`;
    }

    let text;
    if (subjectPhrase && detail) text = `Figure ${order}. ${subjectPhrase} showing ${detail}.`;
    else if (subjectPhrase)      text = `Figure ${order}. ${subjectPhrase}.`;
    else if (detail)             text = `Figure ${order}. ${capitalise(detail)}.`;
    else                         text = `Figure ${order}.`;

    return text.length > MAX_DESCRIPTION_LEN ? text.slice(0, MAX_DESCRIPTION_LEN - 1) + '.' : text;
  }

  function cleanPageTitle(title) {
    if (!title) return '';
    return String(title).split(/\s*[|\-—·]\s*/)[0].trim();
  }

  function capitalise(s) {
    if (!s) return s;
    return s[0].toUpperCase() + s.slice(1);
  }

  // Pick a noun ("page", "panel", "dialog", "list", "tab", "form") for the
  // subject in the caption sentence. Heuristic: prefer a tab/list/form noun
  // when the captured shape suggests one; otherwise default to "page".
  function inferScreenNoun(step, subject) {
    const badges  = Array.isArray(step.statusBadges) ? step.statusBadges : [];
    const filters = Array.isArray(step.filterFields) ? step.filterFields : [];
    const tabs    = Array.isArray(step.siblingTabs)  ? step.siblingTabs  : [];
    const subjL = (subject || '').toLowerCase();
    if (/\b(list|applications?|registrations?|results?|table)\b/.test(subjL)) return 'list';
    if (/\b(form|registration|application)\b/.test(subjL) && filters.length === 0 && badges.length === 0) return 'form';
    if (/\b(modal|dialog)\b/.test(subjL)) return 'dialog';
    if (/\b(panel|sidebar|menu)\b/.test(subjL)) return 'panel';
    if (filters.length >= 2 || badges.length >= 2) return 'list';
    if (tabs.length >= 2 && (step.elementRole === 'tab' || step.elementRole === 'navlink')) return 'tab';
    return 'page';
  }

  // ---- step description templating, shared by guide renderer + PDF export ----

  // Intent-keyed templates. Each takes the element's accessible name (`v`)
  // and returns user-facing prose. They are the *defaults*; users can edit
  // any description in the manual builder.
  const INPUT_TYPE_TEMPLATES = {
    email:    (v) => v ? `Enter your email address in the "${v}" field.`            : `Enter your email address in the field.`,
    password: (v) => v ? `Enter your password in the "${v}" field. The characters are hidden for security.` : `Enter your password in the field. The characters are hidden for security.`,
    tel:      (v) => v ? `Enter your phone number in the "${v}" field.`             : `Enter your phone number in the field.`,
    number:   (v) => v ? `Enter the numeric value in the "${v}" field.`             : `Enter the numeric value in the field.`,
    date:     (v) => v ? `Select the date in the "${v}" field.`                     : `Select the date in the field.`,
    datetime: (v) => v ? `Select the date and time in the "${v}" field.`            : `Select the date and time in the field.`,
    'datetime-local': (v) => v ? `Select the date and time in the "${v}" field.`    : `Select the date and time in the field.`,
    month:    (v) => v ? `Select the month in the "${v}" field.`                    : `Select the month in the field.`,
    time:     (v) => v ? `Select the time in the "${v}" field.`                     : `Select the time in the field.`,
    search:   (v) => v ? `Type your query in the "${v}" search field.`              : `Type your query in the search field.`,
    url:      (v) => v ? `Enter the web address in the "${v}" field.`               : `Enter the web address in the field.`,
    file:     (v) => v ? `Click the "${v}" control, select the file from your computer, and confirm the file name appears beside the control.` : `Click the upload control, select the file from your computer, and confirm the file name appears beside it.`,
    checkbox: (v) => v ? `Tick the "${v}" checkbox if applicable.`                  : `Tick the checkbox if applicable.`,
    radio:    (v) => v ? `Select the "${v}" option.`                                : `Select the radio option.`,
    submit:   (v) => v ? `Click "${v}" to submit the form.`                         : `Click the submit button to submit the form.`,
    reset:    (v) => v ? `Click "${v}" to reset the form.`                          : `Click reset to clear the form.`,
    color:    (v) => v ? `Choose a colour in the "${v}" picker.`                    : `Choose a colour in the picker.`,
    range:    (v) => v ? `Drag the "${v}" slider to the desired value.`             : `Drag the slider to the desired value.`,
    text:     (v) => v ? `Enter the required value in the "${v}" field.`            : `Enter the required value in the field.`,
    textarea: (v) => v ? `Enter the required text in the "${v}" textarea.`          : `Enter the required text in the textarea.`,
    select:   (v) => v ? `From the "${v}" dropdown, select the relevant option.`    : `From the dropdown, select the relevant option.`,
  };

  const DESCRIPTION_TEMPLATES = {
    DIV:    (v) => v ? `Click the "${v}" option to access ${v.toLowerCase()}.`     : `Click the option as shown.`,
    SPAN:   (v) => v ? `Click the "${v}" option.`                                  : `Click the option as shown.`,
    A:      (v) => v ? `Click the "${v}" link to access ${v.toLowerCase()}.`       : `Click the link as shown.`,
    BUTTON: (v) => v ? `Click the "${v}" button to ${v.toLowerCase()}.`            : `Click the button as shown.`,
  };
  const HEADING_OR_TEXT_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','TR','TD']);
  const MAX_DESCRIPTION_LEN = 215;

  function describeStep(step) {
    if (step && step.description && step.description.length > 0) return step.description;
    const label = ((step && (step.elementLabel || step.elementValue)) || '').trim();
    const role  = (step && step.elementRole) || '';
    const tag   = (step && step.elementType) || '';
    const itype = ((step && step.inputType) || '').toLowerCase();

    let text;
    // 1. Tab/nav clicks take priority — most-distinct intent
    if (role === 'tab' || role === 'navlink') {
      text = label ? `Click the ${label} ${role === 'tab' ? 'tab' : 'menu item'}.` : 'Click the menu item.';
    }
    // 2. Intent-keyed: <input type=...>, <textarea>, <select>, <button type=submit>
    else if (itype && INPUT_TYPE_TEMPLATES[itype]) {
      text = INPUT_TYPE_TEMPLATES[itype](label);
    } else if (tag === 'TEXTAREA') {
      text = INPUT_TYPE_TEMPLATES.textarea(label);
    } else if (tag === 'SELECT') {
      text = INPUT_TYPE_TEMPLATES.select(label);
    } else if (tag === 'INPUT') {
      text = INPUT_TYPE_TEMPLATES.text(label);
    }
    // 3. Element-type fallback (DIV/SPAN/A/BUTTON)
    else if (DESCRIPTION_TEMPLATES[tag]) {
      text = DESCRIPTION_TEMPLATES[tag](label);
    } else if (role === 'link') {
      text = label ? `Click the "${label}" link.` : 'Click the link.';
    } else if (HEADING_OR_TEXT_TAGS.has(tag)) {
      text = label ? `Click "${label}" as shown.` : 'Click as shown.';
    } else if (label) {
      text = `Click "${label}".`;
    } else {
      // No usable label and no specific tag template — point the reader to
      // the visual cursor in the screenshot.
      text = 'Click the highlighted element in the screenshot.';
    }
    return text.length > MAX_DESCRIPTION_LEN ? text.slice(0, MAX_DESCRIPTION_LEN) : text;
  }

  root.StepsRepo = {
    KEY_PREFIX,
    META_KEY,
    DEFAULT_META,
    MAX_DESCRIPTION_LEN,
    keyFor,
    listSteps,
    getStep,
    addStep,
    insertNarrative,
    updateStep,
    removeStep,
    reorderCompiledSteps,
    regenerateNotes,
    clearAll,
    getMeta,
    setMeta,
    describeStep,
    defaultCaption,
    visibleExtras,
    compileSteps,
    suggestStepNote,
    // Sections
    listSections,
    getSection,
    addSection,
    updateSection,
    removeSection,
    // Insertion target
    getInsertionTarget,
    setInsertionTarget,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
