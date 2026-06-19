// Manual builder UI controller.

const MANUAL_BODY_ID    = 'manualBody';
const EMPTY_STATE_ID    = 'emptyState';
const STEP_COUNT_LABEL  = 'stepCountLabel';
const SAVED_PILL_ID     = 'savedPill';
const SAVED_LABEL_ID    = 'savedLabel';
const OUTLINE_ID        = 'outline';
const TOAST_ID          = 'toast';

const addStepBtn       = document.getElementById('addStep');
const previewToggleBtn = document.getElementById('previewToggle');
const downloadDocxBtn  = document.getElementById('downloadDocx');
const downloadPdfBtn   = document.getElementById('downloadPdf');
const clearAllBtn      = document.getElementById('clearAll');

// SVG icons used in the per-step hover chip
const ICON_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
const ICON_UP     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
const ICON_DOWN   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

async function moveCompiledStep(sourceIds, direction) {
  try {
    const ok = await StepsRepo.reorderCompiledSteps(sourceIds, direction);
    if (!ok) {
      toast(direction === 'up' ? 'Already at the top of the section.' : 'Already at the bottom of the section.');
      return false;
    }
    await renderManualBody();
    return true;
  } catch (err) {
    toast(String(err && err.message ? err.message : err));
    return false;
  }
}

function toast(message) {
  const el = document.getElementById(TOAST_ID);
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function flashSaved() {
  const pill = document.getElementById(SAVED_PILL_ID);
  const label = document.getElementById(SAVED_LABEL_ID);
  if (!pill || !label) return;
  label.textContent = 'Saving…';
  pill.classList.remove('saved');
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => {
    label.textContent = 'All changes saved';
    pill.classList.add('saved');
  }, 500);
}

// --- metadata binding --------------------------------------------------------

async function loadMetaIntoDom() {
  const meta = await StepsRepo.getMeta();
  document.querySelectorAll('[data-meta]').forEach(el => {
    const key = el.dataset.meta;
    if (key in meta) el.textContent = meta[key] || '';
  });
}

function bindMetaFields() {
  document.querySelectorAll('[data-meta]').forEach(el => {
    el.addEventListener('blur', async () => {
      flashSaved();
      const key = el.dataset.meta;
      const value = el.textContent.trim();
      await StepsRepo.setMeta({ [key]: value });
    });
    el.addEventListener('keydown', (ev) => {
      // Enter commits single-line fields (everything except the intro paragraph).
      if (ev.key === 'Enter' && !ev.shiftKey && !el.classList.contains('section-intro')) {
        ev.preventDefault();
        el.blur();
      }
    });
  });
}

// --- step rendering ----------------------------------------------------------

function buildStepNode(step, prevStep) {
  // A compiled step may stand for several raw events; user edits go to the
  // FIRST raw event (which is what compileSteps reads back), and delete
  // removes every raw event that fed this compiled step.
  const sourceIds = Array.isArray(step.sourceIds) && step.sourceIds.length > 0
    ? step.sourceIds
    : [step.id];
  const primaryId = sourceIds[0];

  const li = document.createElement('li');
  li.className = 'step';
  li.dataset.stepId = primaryId;
  li.id = `step-${primaryId}`;
  if (step.kind === 'fillForm') li.dataset.kind = 'fillForm';

  const description = document.createElement('div');
  description.className = 'description field-editable';
  description.contentEditable = 'true';
  description.spellcheck = true;
  description.textContent = step.description && step.description.length > 0
    ? step.description
    : StepsRepo.describeStep(step);
  description.addEventListener('blur', () => {
    flashSaved();
    StepsRepo.updateStep(primaryId, { description: description.textContent.trim() });
  });

  const extras = buildExtrasBlock(step, prevStep, primaryId);

  const figure = document.createElement('div');
  figure.className = 'figure';
  const figureFrame = document.createElement('div');
  figureFrame.className = 'figure-frame';
  const img = document.createElement('img');
  img.src = step.image;
  img.alt = `Step ${step.order ?? step.id}`;
  figureFrame.appendChild(img);
  // The click marker (purple ribbon with cursor pointer) is already baked
  // into the screenshot at capture time, so no overlay is needed here.
  figure.appendChild(figureFrame);

  const captionWrap = document.createElement('div');
  captionWrap.className = 'caption-wrap';
  const caption = document.createElement('span');
  caption.className = 'caption field-editable';
  caption.contentEditable = 'true';
  caption.spellcheck = true;
  caption.textContent = step.caption && step.caption.length > 0
    ? step.caption
    : StepsRepo.defaultCaption(step);
  caption.addEventListener('blur', () => {
    flashSaved();
    StepsRepo.updateStep(primaryId, { caption: caption.textContent.trim() });
  });
  captionWrap.appendChild(caption);
  figure.appendChild(captionWrap);

  // Result callout (toast / validation / dialog text observed after the action)
  if (step.result && step.result.trim().length > 0) {
    const resultLine = document.createElement('div');
    resultLine.className = 'result-line';
    const arrow = document.createElement('span');
    arrow.className = 'result-arrow';
    arrow.textContent = '→ ';
    const label = document.createElement('span');
    label.className = 'result-label';
    label.textContent = 'Result: ';
    const body = document.createElement('span');
    body.className = 'result-body field-editable';
    body.contentEditable = 'true';
    body.spellcheck = true;
    body.textContent = step.result.trim();
    const persistResultId = step.resultRawId || primaryId;
    body.addEventListener('blur', () => {
      flashSaved();
      // Persist back to the original result raw step so compileSteps picks
      // up the edited text instead of overwriting it on the next render.
      StepsRepo.updateStep(persistResultId, { resultText: body.textContent.trim() });
    });
    resultLine.appendChild(arrow);
    resultLine.appendChild(label);
    resultLine.appendChild(body);
    figure.appendChild(resultLine);
  }

  const actions = document.createElement('div');
  actions.className = 'step-actions';

  const upBtn = document.createElement('button');
  upBtn.className = 'reorder';
  upBtn.type = 'button';
  upBtn.title = 'Move step up';
  upBtn.setAttribute('aria-label', 'Move step up');
  upBtn.innerHTML = ICON_UP;
  upBtn.addEventListener('click', (ev) => { ev.preventDefault(); moveCompiledStep(sourceIds, 'up'); });
  actions.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.className = 'reorder';
  downBtn.type = 'button';
  downBtn.title = 'Move step down';
  downBtn.setAttribute('aria-label', 'Move step down');
  downBtn.innerHTML = ICON_DOWN;
  downBtn.addEventListener('click', (ev) => { ev.preventDefault(); moveCompiledStep(sourceIds, 'down'); });
  actions.appendChild(downBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete';
  deleteBtn.type = 'button';
  deleteBtn.title = `Delete step ${step.order ?? step.id}`;
  deleteBtn.setAttribute('aria-label', `Delete step ${step.order ?? step.id}`);
  deleteBtn.innerHTML = ICON_DELETE;
  deleteBtn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const n = sourceIds.length;
    const msg = n > 1
      ? `Delete this step? (removes ${n} raw events that compiled into it)`
      : `Delete step #${step.order ?? primaryId}?`;
    if (!confirm(msg)) return;
    // Removing serially so order re-packing stays consistent
    for (const id of sourceIds) {
      await StepsRepo.removeStep(id);
    }
    await renderSteps();
    toast('Step deleted.');
  });
  actions.appendChild(deleteBtn);

  const noteBlock = buildNoteBlock(step, primaryId);

  li.appendChild(description);
  if (extras) li.appendChild(extras);
  li.appendChild(figure);
  li.appendChild(noteBlock);
  li.appendChild(actions);
  return li;
}

function buildNarrativeNode(step) {
  const sourceIds = Array.isArray(step.sourceIds) ? step.sourceIds : [step.id];
  const primaryId = sourceIds[0];
  const li = document.createElement('li');
  li.className = 'narrative';
  li.id = `step-${primaryId}`;
  const body = document.createElement('div');
  body.className = 'narrative-body field-editable';
  body.contentEditable = 'true';
  body.spellcheck = true;
  body.textContent = step.description || '';
  body.addEventListener('blur', () => {
    flashSaved();
    StepsRepo.updateStep(primaryId, { description: body.textContent.trim() });
  });

  // Same hover-revealed chip as recorded steps: up / down / delete.
  const actions = document.createElement('div');
  actions.className = 'step-actions narrative-actions';

  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'reorder';
  up.title = 'Move up';
  up.setAttribute('aria-label', 'Move up');
  up.innerHTML = ICON_UP;
  up.addEventListener('click', (ev) => { ev.preventDefault(); moveCompiledStep(sourceIds, 'up'); });
  actions.appendChild(up);

  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'reorder';
  down.title = 'Move down';
  down.setAttribute('aria-label', 'Move down');
  down.innerHTML = ICON_DOWN;
  down.addEventListener('click', (ev) => { ev.preventDefault(); moveCompiledStep(sourceIds, 'down'); });
  actions.appendChild(down);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.title = 'Remove narrative';
  remove.setAttribute('aria-label', 'Remove narrative');
  remove.innerHTML = ICON_DELETE;
  remove.addEventListener('click', async () => {
    if (!confirm('Remove this narrative paragraph?')) return;
    await StepsRepo.removeStep(primaryId);
    await renderSteps();
    toast('Narrative removed.');
  });
  actions.appendChild(remove);

  li.appendChild(body);
  li.appendChild(actions);
  return li;
}

function buildInsertNarrativeButton(afterOrder) {
  // Renamed for clarity but keeping the old name as alias below. This now
  // returns a row with two affordances: + Step (recorded) and + Note (prose).
  return buildInsertButtonsRow(afterOrder);
}

function buildInsertButtonsRow(afterOrder) {
  const wrap = document.createElement('li');
  wrap.className = 'insert-narrative';

  const stepBtn = document.createElement('button');
  stepBtn.type = 'button';
  stepBtn.className = 'insert-narrative-btn';
  stepBtn.textContent = '+ Step';
  stepBtn.title = 'Insert a recorded step here';
  stepBtn.addEventListener('click', () => openAddStepPicker(afterOrder));

  const noteBtn = document.createElement('button');
  noteBtn.type = 'button';
  noteBtn.className = 'insert-narrative-btn';
  noteBtn.textContent = '+ Note';
  noteBtn.title = 'Insert a narrative paragraph here';
  noteBtn.addEventListener('click', async () => {
    const text = prompt('Narrative text (a prose paragraph between steps):');
    if (text === null) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    await StepsRepo.insertNarrative({ text: trimmed, afterOrder });
    await renderManualBody();
    toast('Narrative inserted.');
  });

  wrap.appendChild(stepBtn);
  wrap.appendChild(noteBtn);
  return wrap;
}

function buildExtrasBlock(step, prevStep, persistTargetId) {
  const wrap = document.createElement('div');
  wrap.className = 'extras';
  const persistId = persistTargetId || step.id;

  function persistExtras() {
    const items = Array.from(wrap.querySelectorAll('.extra-line'))
      .map(el => el.textContent.trim())
      .filter(t => t.length > 0);
    flashSaved();
    StepsRepo.updateStep(persistId, { contextExtras: items });
  }

  function addLineNode(text, focusAfter) {
    const row = document.createElement('div');
    row.className = 'extra-row';
    const line = document.createElement('div');
    line.className = 'extra-line field-editable';
    line.contentEditable = 'true';
    line.spellcheck = true;
    line.textContent = text;
    line.addEventListener('blur', persistExtras);
    line.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); line.blur(); }
    });
    const del = document.createElement('button');
    del.className = 'extra-remove';
    del.type = 'button';
    del.title = 'Remove this line';
    del.setAttribute('aria-label', 'Remove this line');
    del.textContent = '×';
    del.addEventListener('click', () => {
      row.remove();
      persistExtras();
    });
    row.appendChild(line);
    row.appendChild(del);
    wrap.appendChild(row);
    if (focusAfter) line.focus();
  }

  // Show only extras that aren't a repeat of the previous step's extras —
  // keeps "Filters available: ..." from re-printing under every step on the
  // same screen. Storage still keeps the full list per step.
  const items = StepsRepo.visibleExtras(step, prevStep);
  items.forEach(t => addLineNode(t, false));

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'extras-add';
  addBtn.textContent = '+ Add detail';
  addBtn.addEventListener('click', () => addLineNode('', true));
  wrap.appendChild(addBtn);

  if (items.length === 0) {
    // Show only the add button (extras section stays minimal)
    wrap.classList.add('extras-empty');
  }
  return wrap;
}

function buildNoteBlock(step, persistTargetId) {
  const wrap = document.createElement('div');
  wrap.className = 'note-wrap';
  const persistId = persistTargetId || step.id;

  const noteText = step.note && step.note.length > 0 ? step.note : '';

  function persistNote(value) {
    flashSaved();
    StepsRepo.updateStep(persistId, { note: value.trim() });
  }

  function renderEditor(initial) {
    wrap.innerHTML = '';
    const block = document.createElement('div');
    block.className = 'note';
    const label = document.createElement('span');
    label.className = 'note-label';
    label.textContent = 'Note:';
    const body = document.createElement('div');
    body.className = 'note-body field-editable';
    body.contentEditable = 'true';
    body.spellcheck = true;
    body.textContent = initial;
    body.addEventListener('blur', () => {
      const v = body.textContent.trim();
      if (v.length === 0) {
        persistNote('');
        renderAddButton();
        return;
      }
      persistNote(v);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'note-remove';
    remove.title = 'Remove note';
    remove.setAttribute('aria-label', 'Remove note');
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      persistNote('');
      renderAddButton();
    });
    block.appendChild(label);
    block.appendChild(body);
    block.appendChild(remove);
    wrap.appendChild(block);
    return body;
  }

  function renderAddButton() {
    wrap.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'note-add';
    btn.textContent = '+ Add note';
    btn.addEventListener('click', () => {
      const body = renderEditor('');
      body.focus();
    });
    wrap.appendChild(btn);
  }

  if (noteText) renderEditor(noteText);
  else          renderAddButton();

  return wrap;
}

function renderOutline(sections, compiled) {
  const nav = document.getElementById(OUTLINE_ID);
  if (!nav) return;
  nav.innerHTML = '';
  if (compiled.length === 0 && sections.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'outline-item';
    empty.style.color = 'var(--text-faint)';
    empty.style.cursor = 'default';
    empty.textContent = 'No content yet';
    nav.appendChild(empty);
    return;
  }
  // Group by section; show section headers + each section's steps (numbered
  // 1..N within the section).
  const groups = sections.length > 0
    ? sections.map(sec => ({
        title: sec.title || 'Untitled section',
        steps: compiled.filter(s => s.sectionId === sec.id),
      }))
    : [{ title: '', steps: compiled }];
  groups.forEach(group => {
    if (group.title) {
      const hdr = document.createElement('div');
      hdr.className = 'outline-section-header';
      hdr.textContent = group.title;
      nav.appendChild(hdr);
    }
    group.steps.forEach((step, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'outline-item';
      const primaryId = (step.sourceIds && step.sourceIds[0]) || step.id;
      btn.dataset.targetId = `step-${primaryId}`;
      btn.innerHTML = `<span class="num">${idx + 1}</span>
                       <span class="text">${escapeHtml(stepSummary(step))}</span>`;
      btn.addEventListener('click', () => {
        const el = document.getElementById(`step-${primaryId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(btn);
    });
  });
}

function stepSummary(step) {
  const text = step.description && step.description.length > 0
    ? step.description
    : StepsRepo.describeStep(step);
  return text.length > 60 ? text.slice(0, 60).trim() + '…' : text;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function renderManualBody() {
  const root  = document.getElementById(MANUAL_BODY_ID);
  const empty = document.getElementById(EMPTY_STATE_ID);
  const label = document.getElementById(STEP_COUNT_LABEL);
  if (!root) return;

  const [sections, raw, meta] = await Promise.all([
    StepsRepo.listSections(),
    StepsRepo.listSteps(),
    StepsRepo.getMeta(),
  ]);
  const compiled = StepsRepo.compileSteps(raw);

  root.innerHTML = '';

  // Legacy mode (no explicit sections yet) — synthesize one section from
  // meta so the user still sees the editable section header.
  const renderList = sections.length > 0
    ? sections
    : [{
        id: null,                              // signals legacy/meta-backed
        title:           meta.sectionTitle,
        intro:           meta.intro,
        purpose:         meta.purpose,
        prerequisites:   meta.prerequisites,
        expectedOutcome: meta.expectedOutcome,
      }];

  // Group compiled steps by section. Steps with no sectionId belong to the
  // legacy/first section (defensive fallback).
  for (const section of renderList) {
    const stepsInSection = section.id == null
      ? compiled.filter(s => !s.sectionId)
      : compiled.filter(s => s.sectionId === section.id);
    root.appendChild(buildSectionCard(section, stepsInSection, sections.length > 0));
  }

  // "+ Add section" footer
  root.appendChild(buildAddSectionButton());

  if (empty) empty.style.display = (compiled.length === 0) ? 'block' : 'none';
  if (label) {
    const compiledTxt = `${compiled.length} step${compiled.length === 1 ? '' : 's'}`;
    const rawTxt     = raw.length === compiled.length ? '' : ` (${raw.length} raw)`;
    label.textContent = compiledTxt + rawTxt;
  }
  renderOutline(sections, compiled);
}

// Back-compat alias for the rest of the file (delete handlers, etc.)
async function renderSteps() { return renderManualBody(); }

function buildSectionCard(section, stepsInSection, isMultiSection) {
  const card = document.createElement('section');
  card.className = 'section-card';
  if (section.id) card.dataset.sectionId = section.id;

  // Persistence helper: legacy section writes back to meta; real sections
  // write back to the section record.
  function persist(field, value) {
    flashSaved();
    if (section.id == null) {
      const key = (field === 'title') ? 'sectionTitle' : field;
      StepsRepo.setMeta({ [key]: value });
    } else {
      StepsRepo.updateSection(section.id, { [field]: value });
    }
  }

  // Title row
  const header = document.createElement('div');
  header.className = 'section-card-header';
  const title = document.createElement('h2');
  title.className = 'section-title field-editable';
  title.contentEditable = 'true';
  title.spellcheck = true;
  title.setAttribute('data-placeholder', 'Section title…');
  title.textContent = section.title || '';
  title.addEventListener('blur', () => persist('title', title.textContent.trim()));
  title.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); title.blur(); }
  });
  header.appendChild(title);

  // Per-section actions (only for real sections — legacy can't be deleted)
  if (section.id != null && isMultiSection) {
    const actions = document.createElement('div');
    actions.className = 'section-card-actions';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete';
    del.title = 'Delete this section';
    del.setAttribute('aria-label', 'Delete this section');
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
    del.addEventListener('click', async () => {
      const stepCount = stepsInSection.length;
      const msg = stepCount > 0
        ? `Delete section "${section.title || 'Untitled'}"? Its ${stepCount} step(s) will be moved into the previous section.`
        : `Delete section "${section.title || 'Untitled'}"?`;
      if (!confirm(msg)) return;
      try {
        await StepsRepo.removeSection(section.id);
        await renderManualBody();
        toast('Section deleted.');
      } catch (err) {
        toast(String(err && err.message ? err.message : err));
      }
    });
    actions.appendChild(del);
    header.appendChild(actions);
  }
  card.appendChild(header);

  // Intro
  const intro = document.createElement('p');
  intro.className = 'section-intro field-editable';
  intro.contentEditable = 'true';
  intro.spellcheck = true;
  intro.setAttribute('data-placeholder', 'Section introduction…');
  intro.textContent = section.intro || '';
  intro.addEventListener('blur', () => persist('intro', intro.textContent.trim()));
  card.appendChild(intro);

  // Purpose / Prerequisites / Expected outcome
  card.appendChild(buildLabelledMetaBlock('Purpose', 'purpose',
    section.purpose, persist, 'What this section helps the reader accomplish…'));
  card.appendChild(buildLabelledMetaBlock('Prerequisites', 'prerequisites',
    section.prerequisites, persist, 'What the reader needs in place first — one per line…'));

  // Steps list (numbered restarting at 1 per section)
  const stepsList = document.createElement('ol');
  stepsList.className = 'steps';
  if (section.id) stepsList.dataset.sectionId = section.id;

  let prev = null;
  for (const step of stepsInSection) {
    if (step.kind === 'narrative') {
      stepsList.appendChild(buildNarrativeNode(step));
    } else {
      stepsList.appendChild(buildStepNode(step, prev));
      prev = step;
    }
    stepsList.appendChild(buildInsertNarrativeButton(step.order));
  }
  if (stepsInSection.length > 0) {
    stepsList.insertBefore(buildInsertNarrativeButton(0), stepsList.firstChild);
  }
  card.appendChild(stepsList);

  // Expected outcome rendered AFTER the steps
  card.appendChild(buildLabelledMetaBlock('Expected outcome', 'expectedOutcome',
    section.expectedOutcome, persist, 'What the reader should see when the section is complete…'));

  return card;
}

function buildLabelledMetaBlock(label, fieldKey, value, persist, placeholder) {
  const wrap = document.createElement('div');
  wrap.className = 'meta-block';
  wrap.dataset.metaBlock = fieldKey;
  const lbl = document.createElement('span');
  lbl.className = 'meta-label';
  lbl.textContent = label;
  const body = document.createElement('div');
  body.className = 'meta-body field-editable';
  body.contentEditable = 'true';
  body.spellcheck = true;
  body.setAttribute('data-placeholder', placeholder || '');
  body.textContent = value || '';
  body.addEventListener('blur', () => persist(fieldKey, body.textContent.trim()));
  wrap.appendChild(lbl);
  wrap.appendChild(body);
  return wrap;
}

function buildAddSectionButton() {
  const wrap = document.createElement('div');
  wrap.className = 'add-section-row';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'add-section-btn';
  btn.textContent = '+ Add section';
  btn.addEventListener('click', async () => {
    const title = prompt('Section title:', '');
    if (title === null) return;
    await StepsRepo.addSection({ title: title.trim() });
    await renderManualBody();
    toast('Section added.');
  });
  wrap.appendChild(btn);
  return wrap;
}

// --- toolbar wiring ----------------------------------------------------------

function wireToolbar() {
  if (addStepBtn) {
    addStepBtn.addEventListener('click', () => openAddStepPicker());
  }

  if (previewToggleBtn) {
    previewToggleBtn.addEventListener('click', () => {
      const on = document.body.classList.toggle('preview-mode');
      previewToggleBtn.innerHTML = on
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>Preview`;
      document.querySelectorAll('[contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', on ? 'false' : 'true');
      });
    });
  }

  if (downloadDocxBtn) {
    downloadDocxBtn.addEventListener('click', async () => {
      if (!window.CreateExtDocx) { toast('Word exporter not loaded.'); return; }
      const original = downloadDocxBtn.innerHTML;
      downloadDocxBtn.disabled = true;
      downloadDocxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 1-9 9" stroke-linecap="round"/></svg>Building…';
      try {
        await window.CreateExtDocx.export();
        toast('Word document downloaded.');
      } catch (err) {
        console.error('docx export failed', err);
        toast('Unable to export Word file.');
      } finally {
        downloadDocxBtn.disabled = false;
        downloadDocxBtn.innerHTML = original;
      }
    });
  }

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', async () => {
      if (!window.CreateExtPdf) { toast('PDF exporter not loaded.'); return; }
      const original = downloadPdfBtn.innerHTML;
      downloadPdfBtn.disabled = true;
      downloadPdfBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 1-9 9" stroke-linecap="round"/></svg>Building…';
      try {
        await window.CreateExtPdf.export();
        toast('PDF downloaded.');
      } catch (err) {
        console.error('pdf export failed', err);
        toast('Unable to export PDF.');
      } finally {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.innerHTML = original;
      }
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('Delete all recorded steps? Cover-page details will be kept.')) return;
      await StepsRepo.clearAll();
      await renderSteps();
      toast('All steps cleared.');
    });
  }
}

// --- init --------------------------------------------------------------------

// ----- Add-step picker -----
// Modal lets the user resume on the previous URL, any URL recorded earlier
// in this manual, or any currently-open browser tab.

async function openAddStepPicker(insertAfter) {
  const modal = document.getElementById('addStepModal');
  const urlInput = document.getElementById('addStepUrlInput');
  const recentSection = document.getElementById('addStepRecentSection');
  const recentList = document.getElementById('addStepRecentList');
  const tabsSection = document.getElementById('addStepTabsSection');
  const tabsList = document.getElementById('addStepTabsList');
  const goBtn = document.getElementById('addStepGo');
  const cancelBtn = document.getElementById('addStepCancel');
  if (!modal || !urlInput) return;

  // Insertion mode? Adjust the modal title + subtitle for clarity.
  const isInsert = (insertAfter !== null && insertAfter !== undefined);
  const titleEl = document.getElementById('addStepModalTitle');
  const subtitleEl = modal.querySelector('.modal-subtitle');
  if (titleEl) titleEl.textContent = isInsert ? 'Insert step here' : 'Resume recording';
  if (subtitleEl) subtitleEl.textContent = isInsert
    ? `New captures will be inserted after step ${insertAfter} (existing later steps shift down).`
    : 'Pick where to capture additional steps. New steps will be added to the latest section.';

  // Pre-fill with the most recent step's URL — when inserting, prefer the
  // URL of the step we're inserting after.
  const raw = await StepsRepo.listSteps();
  const recentUrls = uniqueRecentUrls(raw);
  if (isInsert) {
    const prior = raw.find(s => s.order === Number(insertAfter));
    urlInput.value = (prior && prior.pageUrl) || recentUrls[0] || '';
  } else {
    urlInput.value = recentUrls[0] || '';
  }

  // Populate "Recently recorded" — unique pageUrls from prior steps.
  recentList.innerHTML = '';
  if (recentUrls.length > 0) {
    for (const u of recentUrls) {
      recentList.appendChild(makePickerItem({ title: titleForUrl(u), url: u }, () => {
        urlInput.value = u;
        submit();
      }));
    }
    recentSection.hidden = false;
  } else {
    recentSection.hidden = true;
  }

  // Populate "Open tabs" — fetched from background.
  tabsList.innerHTML = '';
  tabsSection.hidden = true;
  const tabs = await fetchOpenTabs();
  if (tabs.length > 0) {
    for (const t of tabs) {
      tabsList.appendChild(makePickerItem({
        title: t.title || titleForUrl(t.url),
        url: t.url,
        favIconUrl: t.favIconUrl,
        active: t.active,
      }, () => {
        urlInput.value = t.url;
        submit();
      }));
    }
    tabsSection.hidden = false;
  }

  modal.hidden = false;
  setTimeout(() => urlInput.focus(), 30);

  function close() {
    modal.hidden = true;
    goBtn.removeEventListener('click', submit);
    cancelBtn.removeEventListener('click', close);
    urlInput.removeEventListener('keydown', onKey);
    modal.removeEventListener('click', onBackdrop);
  }
  function onBackdrop(ev) {
    if (ev.target === modal) close();
  }
  function onKey(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
  }
  async function submit() {
    const url = urlInput.value.trim();
    if (!url) {
      toast('Enter or pick a URL to record on.');
      return;
    }
    close();
    // Set or clear the insertion target depending on mode
    if (isInsert) {
      await StepsRepo.setInsertionTarget(insertAfter);
    } else {
      await StepsRepo.setInsertionTarget(null);
    }
    await sendResume(url);
  }
  goBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', close);
  urlInput.addEventListener('keydown', onKey);
  modal.addEventListener('click', onBackdrop);
}

function makePickerItem(item, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'picker-item';
  if (item.favIconUrl) {
    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = item.favIconUrl;
    img.alt = '';
    img.onerror = () => { img.style.visibility = 'hidden'; };
    btn.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'favicon';
    btn.appendChild(placeholder);
  }
  const title = document.createElement('span');
  title.className = 'picker-title';
  title.textContent = item.title;
  btn.appendChild(title);
  const url = document.createElement('span');
  url.className = 'picker-url';
  url.textContent = item.url;
  btn.appendChild(url);
  if (item.active) {
    const pill = document.createElement('span');
    pill.className = 'active-pill';
    pill.textContent = 'Active';
    btn.appendChild(pill);
  }
  btn.addEventListener('click', onClick);
  return btn;
}

function uniqueRecentUrls(rawSteps) {
  // Newest first; dedupe; only http(s)/file.
  const seen = new Set();
  const out = [];
  for (let i = rawSteps.length - 1; i >= 0; i--) {
    const u = rawSteps[i].pageUrl;
    if (!u || !/^https?:|^file:/.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= 6) break;
  }
  return out;
}

function titleForUrl(u) {
  try { return new URL(u).hostname + new URL(u).pathname.replace(/\/$/, ''); }
  catch (e) { return u; }
}

function fetchOpenTabs() {
  return new Promise((resolve) => {
    try {
      const port = chrome.runtime.connect({ name: 'listOpenTabs' });
      port.postMessage({});
      port.onMessage.addListener(function onResp(message) {
        port.onMessage.removeListener(onResp);
        resolve(message && message.success && Array.isArray(message.tabs) ? message.tabs : []);
      });
    } catch (e) { resolve([]); }
  });
}

async function sendResume(url) {
  if (addStepBtn) {
    addStepBtn.disabled = true;
    addStepBtn.dataset.original = addStepBtn.innerHTML;
    addStepBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 1-9 9" stroke-linecap="round"/></svg>Opening…';
  }
  await new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: 'resumeRecording' });
    port.postMessage({ action: 'resume', url });
    port.onMessage.addListener(function onResp(message) {
      port.onMessage.removeListener(onResp);
      if (message && message.success) {
        toast('Recording resumed. Capture clicks; press the red Stop button when done.');
      } else {
        toast(message && message.error ? message.error : 'Unable to resume recording.');
      }
      resolve();
    });
  });
  if (addStepBtn) {
    addStepBtn.disabled = false;
    addStepBtn.innerHTML = addStepBtn.dataset.original || addStepBtn.innerHTML;
  }
}

// Re-render whenever new steps/sections land in storage (debounced so a
// burst of writes during recording only triggers a single repaint).
let storageRenderTimer = null;
function watchStorageForUpdates() {
  if (!chrome.storage || !chrome.storage.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const touched = Object.keys(changes).some(k => k.startsWith('step:') || k.startsWith('section:'));
    if (!touched) return;
    clearTimeout(storageRenderTimer);
    storageRenderTimer = setTimeout(() => {
      // Avoid clobbering a contenteditable the user is actively typing in.
      const active = document.activeElement;
      if (active && active.isContentEditable) return;
      renderManualBody().catch(err => console.error('Auto-rerender failed:', err));
    }, 250);
  });
}

async function init() {
  await loadMetaIntoDom();   // still binds cover-page meta fields
  bindMetaFields();
  wireToolbar();
  watchStorageForUpdates();
  // Silent one-time pass: attach auto-notes to any pre-existing steps that
  // never got them, and refresh legacy "Tabs available:" phrasing. Each
  // step is stamped with autoNoteApplied: true, so a note the user later
  // deletes will not come back on subsequent opens.
  try { await StepsRepo.regenerateNotes(); } catch (e) { console.warn('Auto-notes pass skipped:', e); }
  await renderManualBody();
}

init().catch(err => {
  console.error('Manual builder init failed', err);
  toast('Failed to load. Check the console.');
});
