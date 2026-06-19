// Standalone test runner. Mocks chrome.storage.local with an in-memory map
// and exercises addStep / listSteps / updateStep / removeStep / clearAll.
// Run with: node scripts/stepsRepo.test.cjs

const store = new Map();
globalThis.chrome = {
  runtime: { lastError: null },
  storage: {
    local: {
      get(keysOrNull, cb) {
        const out = {};
        if (keysOrNull === null || keysOrNull === undefined) {
          for (const [k, v] of store) out[k] = v;
        } else if (typeof keysOrNull === 'string') {
          if (store.has(keysOrNull)) out[keysOrNull] = store.get(keysOrNull);
        } else if (Array.isArray(keysOrNull)) {
          for (const k of keysOrNull) if (store.has(k)) out[k] = store.get(k);
        }
        queueMicrotask(() => cb(out));
      },
      set(obj, cb) {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
        queueMicrotask(() => cb && cb());
      },
      remove(keys, cb) {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) store.delete(k);
        queueMicrotask(() => cb && cb());
      }
    }
  }
};

require('./stepsRepo.js');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures++; }
  else       { console.log ('  ok  :', msg); }
}

(async () => {
  console.log('# clearAll on empty store is a no-op');
  await StepsRepo.clearAll();
  assert((await StepsRepo.listSteps()).length === 0, 'empty list');

  console.log('# addStep assigns sequential ids starting at 1');
  const a = await StepsRepo.addStep({ image: 'imgA', elementType: 'BUTTON', elementValue: 'Save' });
  const b = await StepsRepo.addStep({ image: 'imgB', elementType: 'DIV',    elementValue: 'Menu' });
  const c = await StepsRepo.addStep({ image: 'imgC', elementType: 'A',      elementValue: 'Profile' });
  assert(a.id === 1 && b.id === 2 && c.id === 3, 'ids 1,2,3');
  assert(a.order === 1 && b.order === 2 && c.order === 3, 'orders 1,2,3');

  console.log('# listSteps returns sorted records');
  let steps = await StepsRepo.listSteps();
  assert(steps.length === 3, 'three records');
  assert(steps[0].id === 1 && steps[1].id === 2 && steps[2].id === 3, 'sorted by order');
  assert(steps[0].image === 'imgA' && steps[1].elementValue === 'Menu', 'payload preserved');

  console.log('# updateStep persists a partial');
  await StepsRepo.updateStep(2, { description: 'Click the menu' });
  const b2 = await StepsRepo.getStep(2);
  assert(b2.description === 'Click the menu', 'description saved');
  assert(b2.id === 2 && b2.image === 'imgB', 'other fields intact');

  console.log('# removeStep deletes and re-packs order');
  await StepsRepo.removeStep(2);
  steps = await StepsRepo.listSteps();
  assert(steps.length === 2, 'two remain');
  assert(steps.find(s => s.id === 2) === undefined, 'id 2 gone');
  assert(steps[0].order === 1 && steps[1].order === 2, 'orders re-packed to 1,2');
  assert(steps[0].id === 1 && steps[1].id === 3, 'ids unchanged (1,3)');

  console.log('# addStep after delete continues from max existing id');
  const d = await StepsRepo.addStep({ image: 'imgD', elementType: 'INPUT', elementValue: '' });
  assert(d.id === 4, 'next id is 4 (max+1), not reused 2');
  steps = await StepsRepo.listSteps();
  assert(steps.map(s => s.order).join(',') === '1,2,3', 'orders 1,2,3 after add');

  console.log('# clearAll wipes only step:* keys');
  globalThis.chrome.storage.local.set({ 'unrelated': 'keep me' }, () => {});
  await new Promise(r => setTimeout(r, 0));
  await StepsRepo.clearAll();
  assert((await StepsRepo.listSteps()).length === 0, 'no steps after clear');
  assert(store.get('unrelated') === 'keep me', 'unrelated key preserved');

  console.log('# concurrent addStep calls are serialized');
  const concurrent = await Promise.all([
    StepsRepo.addStep({ image: 'img1', elementType: 'BUTTON', elementValue: 'One' }),
    StepsRepo.addStep({ image: 'img2', elementType: 'BUTTON', elementValue: 'Two' }),
    StepsRepo.addStep({ image: 'img3', elementType: 'BUTTON', elementValue: 'Three' })
  ]);
  steps = await StepsRepo.listSteps();
  assert(concurrent.length === 3, 'all concurrent calls resolve');
  assert(steps.length === 3, 'three concurrent records persisted');
  assert(new Set(steps.map(s => s.id)).size === 3, 'concurrent records have unique ids');
  assert(steps.map(s => s.order).join(',') === '1,2,3', 'concurrent records have stable order');
  await StepsRepo.clearAll();

  console.log('# getMeta / setMeta');
  const m0 = await StepsRepo.getMeta();
  assert(m0.title === '', 'default title is blank (no placeholder leakage)');
  assert(m0.organization.includes('Uganda'), 'organization default present');
  assert(m0.version === 'Version 1.0', 'version default present');
  // Title chosen so it doesn't collide with the legacy stale-placeholder check.
  await StepsRepo.setMeta({ url: 'https://example.com', sectionTitle: '2.1 Login', title: 'My Custom Manual' });
  const m1 = await StepsRepo.getMeta();
  assert(m1.url === 'https://example.com', 'url persisted');
  assert(m1.sectionTitle === '2.1 Login', 'sectionTitle persisted');
  assert(m1.title === 'My Custom Manual', 'title persists after set');
  assert(m1.organization.includes('Uganda'), 'unset defaults survive set');

  console.log('# defaultCaption (narrative)');
  assert(
    StepsRepo.defaultCaption({ order: 1, elementLabel: 'Sign In', elementRole: 'button', inputType: 'submit' })
      === 'Figure 1. The Sign In button before submission.',
    'submit button without subject'
  );
  assert(
    StepsRepo.defaultCaption({ order: 2, ancestorHeading: 'Admin Portal', elementLabel: 'Sign In', elementRole: 'button', inputType: 'submit' })
      === 'Figure 2. Admin Portal page showing the Sign In button before submission.',
    'subject + submit button'
  );
  assert(
    StepsRepo.defaultCaption({ order: 3, ancestorHeading: 'Applications List', elementLabel: 'Bulk Applications', elementRole: 'tab', siblingTabs: ['Applications','Bulk'] })
      === 'Figure 3. Applications List list showing the Bulk Applications tab highlighted.',
    'tab caption with list noun'
  );
  assert(
    StepsRepo.defaultCaption({ order: 4, ancestorHeading: 'Data Update', siblingTabs: ['Applications','Bulk'], statusBadges: ['Pending','Submitted','Approved'], filterFields: ['Tracking','ERN','Status'] })
      === 'Figure 4. Data Update list showing status counters, filters, and the data table.',
    'rich list caption'
  );
  assert(
    StepsRepo.defaultCaption({ order: 5, pageTitle: 'Dashboard | OBRS Admin Portal', elementLabel: 'View', elementRole: 'button' })
      === 'Figure 5. Dashboard page showing the View button.',
    'pageTitle subject, suffix stripped'
  );
  assert(
    StepsRepo.defaultCaption({ order: 6, ancestorHeading: 'Sign In', elementLabel: 'Password', elementRole: 'input', inputType: 'password' })
      === 'Figure 6. Sign In page showing the Password field.',
    'password input caption'
  );
  assert(
    StepsRepo.defaultCaption({ order: 7 }) === 'Figure 7.',
    'caption fallback'
  );

  console.log('# synthesizeContextExtras via addStep');
  await StepsRepo.clearAll();
  const richStep = await StepsRepo.addStep({
    image: 'imgRich',
    elementType: 'BUTTON',
    elementValue: 'View',
    elementLabel: 'View',
    elementRole: 'button',
    ancestorHeading: 'Applications List',
    siblingTabs:  ['Applications', 'Bulk Applications', 'Forced Registrations'],
    statusBadges: ['Pending', 'Submitted', 'Approved'],
    filterFields: ['Tracking Number', 'Search ERN', 'Select Status'],
  });
  assert(Array.isArray(richStep.contextExtras), 'contextExtras is array');
  assert(richStep.contextExtras.length === 3, 'three extras');
  assert(richStep.contextExtras[0].startsWith('Tabs on this page:'), 'tabs extra uses "Tabs on this page:" (clicked label was "View", not in tab list)');
  assert(richStep.contextExtras[1].startsWith('Status counters at the top'), 'status extra uses "at the top of the page"');
  assert(richStep.contextExtras[2].startsWith('Filters above the list'), 'filters extra uses "above the list"');

  console.log('# synthesizeTabsExtra excludes the clicked tab when matched');
  const tabClick = await StepsRepo.addStep({
    image: 'imgTab',
    elementType: 'A',
    elementLabel: 'Forms',
    elementRole: 'tab',
    siblingTabs: ['Notification Preferences', 'Entity Types', 'Forms'],
  });
  const tabExtras = tabClick.contextExtras;
  assert(tabExtras.length === 1, 'one extra (just tabs)');
  assert(tabExtras[0] === 'Other tabs on this page: Notification Preferences, Entity Types.',
    `tab extra excludes "Forms" → actual: ${tabExtras[0]}`);

  console.log('# visibleExtras dedupes against previous step');
  const sA = { contextExtras: ['Tabs available: A, B.', 'Filters: X, Y.'] };
  const sB = { contextExtras: ['Tabs available: A, B.', 'Filters: X, Y.', 'New: Z.'] };
  assert(StepsRepo.visibleExtras(sA, null).length === 2, 'first step shows all extras');
  const shown = StepsRepo.visibleExtras(sB, sA);
  assert(shown.length === 1 && shown[0] === 'New: Z.', 'second step suppresses repeats');

  console.log('# smarter describeStep with role');
  assert(
    StepsRepo.describeStep({ elementRole: 'tab', elementLabel: 'Data Update Applications' }) === 'Click the Data Update Applications tab.',
    'tab description'
  );
  assert(
    StepsRepo.describeStep({ elementRole: 'link', elementLabel: 'Forgot your password?' }) === 'Click the "Forgot your password?" link.',
    'link description'
  );

  console.log('# describeStep templating');
  assert(
    StepsRepo.describeStep({ elementType: 'BUTTON', elementValue: 'Save' }) === 'Click the "Save" button to save.',
    'BUTTON template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'H1', elementValue: 'Example Domain' }) === 'Click "Example Domain" as shown.',
    'H1 template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'INPUT', inputType: 'text', elementValue: '' }) === 'Enter the required value in the field.',
    'plain text input (no label)'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'INPUT', inputType: 'email', elementLabel: 'Email address' }) === 'Enter your email address in the "Email address" field.',
    'email input template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'INPUT', inputType: 'password', elementLabel: 'Password' }) === 'Enter your password in the "Password" field. The characters are hidden for security.',
    'password input template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'INPUT', inputType: 'file', elementLabel: 'Upload roster' }) === 'Click the "Upload roster" control, select the file from your computer, and confirm the file name appears beside the control.',
    'file input template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'INPUT', inputType: 'checkbox', elementLabel: 'Generate ERN' }) === 'Tick the "Generate ERN" checkbox if applicable.',
    'checkbox input template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'BUTTON', inputType: 'submit', elementLabel: 'Sign In' }) === 'Click "Sign In" to submit the form.',
    'submit button template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'TEXTAREA', elementLabel: 'Comments' }) === 'Enter the required text in the "Comments" textarea.',
    'textarea template'
  );
  assert(
    StepsRepo.describeStep({ elementType: 'SELECT', elementLabel: 'Country' }) === 'From the "Country" dropdown, select the relevant option.',
    'select template'
  );
  assert(
    StepsRepo.describeStep({ description: 'edited', elementType: 'BUTTON', elementValue: 'Save' }) === 'edited',
    'description overrides template'
  );
  const longVal = 'x'.repeat(400);
  assert(
    StepsRepo.describeStep({ elementType: 'BUTTON', elementValue: longVal }).length <= StepsRepo.MAX_DESCRIPTION_LEN,
    'truncates to MAX_DESCRIPTION_LEN'
  );

  console.log('# compileSteps groups form-fill clusters');
  const rawA = [
    { id: 11, eventType: 'change', elementType: 'INPUT', inputType: 'email',    elementLabel: 'Email', pageUrl: 'https://x/login', image: 'imgA1' },
    { id: 12, eventType: 'change', elementType: 'INPUT', inputType: 'password', elementLabel: 'Password', sensitive: true, pageUrl: 'https://x/login', image: 'imgA2' },
    { id: 13, eventType: 'click',  elementType: 'BUTTON', inputType: 'submit',  elementLabel: 'Sign In', pageUrl: 'https://x/login', image: 'imgA3' },
  ];
  const compiledA = StepsRepo.compileSteps(rawA);
  assert(compiledA.length === 1, 'three raw events → one compiled step');
  assert(compiledA[0].kind === 'fillForm', 'kind = fillForm');
  assert(compiledA[0].sourceIds.join(',') === '11,12,13', 'sourceIds preserved');
  assert(compiledA[0].image === 'imgA3', 'compiled image = last raw image');
  assert(
    compiledA[0].description.includes('Email') && compiledA[0].description.includes('Password') && compiledA[0].description.includes('Sign In'),
    'fillForm description mentions both fields and submit button'
  );
  assert(/password characters are hidden/.test(compiledA[0].description), 'fillForm note mentions masking');

  console.log('# compileSteps preserves non-cluster events');
  const rawB = [
    { id: 21, eventType: 'click', elementType: 'BUTTON', elementLabel: 'Open menu', pageUrl: 'https://x/home', image: 'imgB1' },
    { id: 22, eventType: 'click', elementType: 'A',      elementLabel: 'Profile',    pageUrl: 'https://x/home', image: 'imgB2' },
  ];
  const compiledB = StepsRepo.compileSteps(rawB);
  assert(compiledB.length === 2, 'two clicks stay as two steps');
  assert(compiledB.every(s => s.kind === 'single'), 'kind = single for pass-through');

  console.log('# sections: auto-bootstrap on first addStep + tag step');
  await StepsRepo.clearAll();
  // Wipe sections from prior tests
  await new Promise(r => setTimeout(r, 0));
  for (const k of Array.from(store.keys())) { if (k.startsWith('section:')) store.delete(k); }
  await StepsRepo.setMeta({ sectionTitle: '1. Login', purpose: 'Sign in to the portal' });
  const sBoot = await StepsRepo.addStep({ image: 'img1', elementType: 'BUTTON', elementValue: 'Sign In' });
  const sectionsAfter = await StepsRepo.listSections();
  assert(sectionsAfter.length === 1, 'first addStep created a default section');
  assert(sectionsAfter[0].title === '1. Login', 'section seeded with meta sectionTitle');
  assert(sectionsAfter[0].purpose === 'Sign in to the portal', 'section seeded with meta purpose');
  assert(sBoot.sectionId === sectionsAfter[0].id, 'step tagged with section id');

  console.log('# addSection then subsequent addStep tags newest section');
  const sec2 = await StepsRepo.addSection({ title: '2. Profile setup' });
  assert(sec2.order === 2, 'second section gets order 2');
  const sNext = await StepsRepo.addStep({ image: 'img2', elementType: 'A', elementValue: 'Profile' });
  assert(sNext.sectionId === sec2.id, 'step lands in latest section');
  const list = await StepsRepo.listSections();
  assert(list.length === 2, 'two sections now exist');

  console.log('# updateSection persists changes');
  await StepsRepo.updateSection(sec2.id, { intro: 'Configure your account.' });
  const sec2b = await StepsRepo.getSection(sec2.id);
  assert(sec2b.intro === 'Configure your account.', 'update persisted');
  assert(sec2b.title === '2. Profile setup', 'other fields intact');

  // Clean up so later tests start from known state
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) { if (k.startsWith('section:')) store.delete(k); }

  console.log('# suggestStepNote triggers + per-section dedupe');
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }
  // Direct: password input
  const pwNote = StepsRepo.suggestStepNote(
    { inputType: 'password', elementLabel: 'Password', eventType: 'change' }, []
  );
  assert(/credentials provided/i.test(pwNote), 'password input suggests credentials note');
  // OTP via label
  const otpNote = StepsRepo.suggestStepNote(
    { inputType: 'text', elementLabel: 'Enter OTP', eventType: 'change' }, []
  );
  assert(/one-time code/i.test(otpNote), 'OTP label suggests one-time-code note');
  // File upload
  const fileNote = StepsRepo.suggestStepNote(
    { inputType: 'file', elementLabel: 'Upload roster', eventType: 'change' }, []
  );
  assert(/approved template/i.test(fileNote), 'file input suggests approved-template note');
  // Submit click
  const submitNote = StepsRepo.suggestStepNote(
    { inputType: 'submit', elementType: 'BUTTON', elementLabel: 'Sign In', eventType: 'click' }, []
  );
  assert(/not saved/i.test(submitNote), 'submit suggests not-saved note');
  // Orientation note (first step in section + sibling tabs)
  const orient = StepsRepo.suggestStepNote(
    { elementType: 'A', elementLabel: 'Registration', siblingTabs: ['Registration', 'Forms', 'Settings', 'Associate'] }, []
  );
  assert(/navigation items/i.test(orient), 'first step with sibling tabs suggests orientation note');
  // Search field
  const searchNote = StepsRepo.suggestStepNote(
    { inputType: 'search', elementLabel: 'Search records', eventType: 'change' }, []
  );
  assert(/specific values|narrow the list/i.test(searchNote), 'search input suggests narrow-the-list note');
  // Select dropdown
  const selNote = StepsRepo.suggestStepNote(
    { elementType: 'SELECT', inputType: 'select', elementLabel: 'Country', eventType: 'change' }, []
  );
  assert(/dropdown/i.test(selNote), 'select suggests dropdown note');
  // Date input
  const dateNote = StepsRepo.suggestStepNote(
    { inputType: 'date', elementLabel: 'Start date', eventType: 'change' }, []
  );
  assert(/date picker/i.test(dateNote), 'date input suggests date-picker note');
  // Fallback: bare click with no useful label produces generic description
  const noLabelDesc = StepsRepo.describeStep({ elementType: 'PRE' });
  assert(/highlighted element/i.test(noLabelDesc), 'no-label fallback points at the screenshot');
  // Textarea note
  const textareaNote = StepsRepo.suggestStepNote(
    { elementType: 'TEXTAREA', elementLabel: 'How can I help you today?', eventType: 'change' }, []
  );
  assert(/multi-line/i.test(textareaNote), 'textarea suggests multi-line note');
  // Filter-row text input
  const filterNote = StepsRepo.suggestStepNote(
    { elementType: 'INPUT', inputType: 'text', elementLabel: 'Tracking Number',
      filterFields: ['Tracking Number', 'Search ERN', 'Select Status'], eventType: 'change' },
    []
  );
  assert(/narrow the list/i.test(filterNote), 'text input in a filter row suggests narrow-the-list note');
  // Back link
  const backNote = StepsRepo.suggestStepNote(
    { elementType: 'A', elementLabel: 'Back to Applications', eventType: 'click' }, []
  );
  assert(/returns you to the previous/i.test(backNote), 'back link suggests returns-to-previous note');
  // Add/Create button
  const addNote = StepsRepo.suggestStepNote(
    { elementType: 'BUTTON', elementLabel: 'Add Email', elementRole: 'button', eventType: 'click' }, []
  );
  assert(/opens a form for a new entry/i.test(addNote), 'Add button suggests new-entry-form note');
  // Orientation relaxation: fires on a NON-FIRST step when no prior step had tabs
  const orientLater = StepsRepo.suggestStepNote(
    { elementType: 'A', elementLabel: 'Claude', siblingTabs: ['Claude', 'Claude Code', 'Claude Cowork', 'Skills'] },
    [
      { elementType: 'BUTTON', elementLabel: 'Continue', siblingTabs: [] },
      { elementType: 'INPUT',  elementLabel: 'Search',   siblingTabs: [] },
    ]
  );
  assert(/navigation items/i.test(orientLater), 'orientation note fires on first step WITH sibling tabs, even when not first overall');

  console.log('# reorderCompiledSteps swaps adjacent compiled blocks');
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }
  const r1 = await StepsRepo.addStep({ image: 'a', elementType: 'A',      elementValue: 'A', pageUrl: 'https://x/' });
  const r2 = await StepsRepo.addStep({ image: 'b', elementType: 'A',      elementValue: 'B', pageUrl: 'https://x/' });
  const r3 = await StepsRepo.addStep({ image: 'c', elementType: 'A',      elementValue: 'C', pageUrl: 'https://x/' });
  // Sanity: compiled view is A, B, C
  const beforeMove = StepsRepo.compileSteps(await StepsRepo.listSteps()).map(s => s.elementValue).join(',');
  assert(beforeMove === 'A,B,C', 'starting compiled order is A,B,C');
  // Move B down (between C). Result should be A, C, B
  const movedDown = await StepsRepo.reorderCompiledSteps([r2.id], 'down');
  assert(movedDown === true, 'reorder reported success');
  const afterDown = StepsRepo.compileSteps(await StepsRepo.listSteps()).map(s => s.elementValue).join(',');
  assert(afterDown === 'A,C,B', `after move-down: ${afterDown}`);
  // Move B back up. Now A, B, C again
  await StepsRepo.reorderCompiledSteps([r2.id], 'up');
  const afterUp = StepsRepo.compileSteps(await StepsRepo.listSteps()).map(s => s.elementValue).join(',');
  assert(afterUp === 'A,B,C', `after move-up: ${afterUp}`);
  // Edge: moving the first step up is a no-op
  const noOp = await StepsRepo.reorderCompiledSteps([r1.id], 'up');
  assert(noOp === false, 'moving first step up returns false');
  // Edge: moving the last step down is a no-op
  const noOp2 = await StepsRepo.reorderCompiledSteps([r3.id], 'down');
  assert(noOp2 === false, 'moving last step down returns false');

  console.log('# reorder moves a multi-source cluster as a block');
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }
  // Build a fill-form cluster (change, change, submit) sandwiched between
  // two singletons: nav-click → [email change, password change, Sign In] → toast
  const navStep   = await StepsRepo.addStep({ image: 'n', elementType: 'A', elementValue: 'Open login', pageUrl: 'https://x/' });
  const emailStep = await StepsRepo.addStep({ image: 'e', eventType: 'change', elementType: 'INPUT', inputType: 'email',    elementLabel: 'Email',    pageUrl: 'https://x/login' });
  const pwStep    = await StepsRepo.addStep({ image: 'p', eventType: 'change', elementType: 'INPUT', inputType: 'password', elementLabel: 'Password', pageUrl: 'https://x/login' });
  const signInStep= await StepsRepo.addStep({ image: 's', eventType: 'click',  elementType: 'BUTTON', inputType: 'submit',  elementLabel: 'Sign In',  pageUrl: 'https://x/login' });
  const afterStep = await StepsRepo.addStep({ image: 'd', elementType: 'A', elementValue: 'Dashboard', pageUrl: 'https://x/dashboard' });
  const compiledBefore = StepsRepo.compileSteps(await StepsRepo.listSteps());
  assert(compiledBefore.length === 3, 'three compiled steps (nav, fill-form, dashboard)');
  // Move the fill-form cluster (middle compiled step) up — should leapfrog the nav
  const moveUpOk = await StepsRepo.reorderCompiledSteps(compiledBefore[1].sourceIds, 'up');
  assert(moveUpOk === true, 'cluster moved up');
  const compiledAfter = StepsRepo.compileSteps(await StepsRepo.listSteps());
  assert(compiledAfter.length === 3, 'still three compiled steps after move');
  // The cluster is now first; nav is second; dashboard third
  assert(compiledAfter[0].kind === 'fillForm', 'fill-form cluster is now first');
  assert(compiledAfter[1].elementValue === 'Open login', 'nav step now second');
  assert(compiledAfter[2].elementValue === 'Dashboard', 'dashboard still last');
  // All 3 raw IDs of the cluster moved together — verify orders are 1,2,3
  const rawSorted = (await StepsRepo.listSteps());
  const clusterRaw = [emailStep, pwStep, signInStep].map(s => rawSorted.find(r => r.id === s.id));
  const clusterOrders = clusterRaw.map(r => r.order).sort((a, b) => a - b);
  assert(JSON.stringify(clusterOrders) === '[1,2,3]', `cluster orders contiguous + at top: ${clusterOrders}`);

  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }

  console.log('# regenerateNotes back-fills onto records missing the autoNoteApplied flag');
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }
  // Simulate steps captured by an older build (no autoNoteApplied set, no notes)
  const reg1 = await StepsRepo.addStep({ image: 'i1', elementType: 'INPUT', inputType: 'password', elementLabel: 'Password' });
  const reg2 = await StepsRepo.addStep({ image: 'i2', elementType: 'A',     elementLabel: 'Back to Applications' });
  const reg3 = await StepsRepo.addStep({ image: 'i3', elementType: 'BUTTON', elementLabel: 'Add Email', elementRole: 'button' });
  // Strip notes AND the autoNoteApplied flag to mimic legacy records
  for (const r of [reg1, reg2, reg3]) {
    const key = `step:${r.id}`;
    const rec = store.get(key);
    delete rec.autoNoteApplied;
    rec.note = '';
    store.set(key, rec);
  }
  let walk = await StepsRepo.listSteps();
  assert(walk.every(s => !s.note),           'all notes cleared');
  assert(walk.every(s => !s.autoNoteApplied), 'flag cleared');
  // First regeneration: notes attached, flag set
  const regResult = await StepsRepo.regenerateNotes();
  assert(regResult.notesAdded === 3, `regeneration added ${regResult.notesAdded} notes (expected 3)`);
  walk = await StepsRepo.listSteps();
  const noteByLabel = Object.fromEntries(walk.map(s => [s.elementLabel, s.note]));
  assert(/credentials provided/i.test(noteByLabel['Password']), 'password note regenerated');
  assert(/returns you to the previous/i.test(noteByLabel['Back to Applications']), 'back-link note regenerated');
  assert(/opens a form for a new entry/i.test(noteByLabel['Add Email']), 'add-email note regenerated');
  assert(walk.every(s => s.autoNoteApplied === true), 'autoNoteApplied stamped on every processed record');

  console.log('# regenerateNotes does NOT re-add a deleted note');
  // User deletes a note on a step that has already been processed
  await StepsRepo.updateStep(reg1.id, { note: '' });
  const reRun = await StepsRepo.regenerateNotes();
  assert(reRun.notesAdded === 0, `re-run did not re-add the deleted note (got ${reRun.notesAdded})`);
  const reg1ReloadDeleted = (await StepsRepo.listSteps()).find(s => s.id === reg1.id);
  assert(reg1ReloadDeleted.note === '', 'deleted note stays deleted');

  // User-set notes are preserved on re-run
  await StepsRepo.updateStep(reg2.id, { note: 'My custom note' });
  await StepsRepo.regenerateNotes();
  const reg2Reload = (await StepsRepo.listSteps()).find(s => s.id === reg2.id);
  assert(reg2Reload.note === 'My custom note', 'user-set notes are not overwritten');

  console.log('# regenerateNotes refreshes legacy-phrasing contextExtras');
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }
  const legacyStep = await StepsRepo.addStep({
    image: 'lg',
    elementType: 'A',
    elementLabel: 'Forms',
    elementRole: 'tab',
    siblingTabs: ['Notification Preferences', 'Entity Types', 'Forms'],
    filterFields: ['Tracking', 'ERN'],
  });
  // Simulate legacy storage: rewrite contextExtras to the old phrasing
  await StepsRepo.updateStep(legacyStep.id, {
    contextExtras: [
      'Tabs available: Notification Preferences, Entity Types, Forms.',
      'Filters available: Tracking, ERN.',
      'Custom user-edited line that should NOT be touched.',
    ],
  });
  const regen = await StepsRepo.regenerateNotes();
  assert(regen.extrasRefreshed >= 1, `regenerateNotes refreshed extras (got ${regen.extrasRefreshed})`);
  const after = (await StepsRepo.listSteps()).find(s => s.id === legacyStep.id);
  assert(after.contextExtras[0] === 'Other tabs on this page: Notification Preferences, Entity Types.',
    `legacy tabs line refreshed → actual: ${after.contextExtras[0]}`);
  assert(after.contextExtras[1] === 'Filters above the list: Tracking, ERN.',
    `legacy filters line refreshed → actual: ${after.contextExtras[1]}`);
  assert(after.contextExtras[2] === 'Custom user-edited line that should NOT be touched.',
    'user-edited extras preserved');

  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }

  console.log('# stale placeholder meta is stripped on read');
  await StepsRepo.setMeta({ sectionTitle: '1. Section title', intro: 'This section explains how to ...', title: 'OBRS User Manual' });
  const cleanedMeta = await StepsRepo.getMeta();
  assert(cleanedMeta.sectionTitle === '', 'stale "1. Section title" cleared');
  assert(cleanedMeta.intro === '', 'stale "This section explains how to ..." cleared');
  assert(cleanedMeta.title === '', 'stale "OBRS User Manual" title cleared');

  // Dedupe: a second password step in the same section gets no note
  const pwAlready = StepsRepo.suggestStepNote(
    { inputType: 'password', elementLabel: 'Password', eventType: 'change' },
    [{ inputType: 'password', elementLabel: 'Password', note: 'Use the credentials provided through your registered channel.' }]
  );
  assert(pwAlready === '', 'second password step in section does NOT re-add password note');

  // Dedupe: deleted note (peer step has no note) — also no resuggest because
  // we check the PEER's `note` field. If the user deleted it, peers don't
  // have it. Want to verify by simulating a deletion.
  const pwAfterDeletion = StepsRepo.suggestStepNote(
    { inputType: 'password', elementLabel: 'Password', eventType: 'change' },
    [{ inputType: 'password', elementLabel: 'Password', note: '' }]  // user deleted
  );
  // Currently this would RE-suggest because the marker check looks at notes,
  // not at "did this kind ever occur". That's a known trade-off; the
  // primary peer-step's note is the source of truth for "did the user
  // accept it". A deleted note CAN re-appear if another password comes.
  // For now, expect re-suggestion — test pins this behavior.
  assert(/credentials provided/i.test(pwAfterDeletion), 'deletion of peer note allows re-suggestion (documented behavior)');

  // End-to-end via addStep: first password step gets the note auto-attached
  const pwStep1 = await StepsRepo.addStep({ image: 'a', elementType: 'INPUT', inputType: 'password', elementLabel: 'Password' });
  assert(/credentials provided/i.test(pwStep1.note || ''), 'addStep auto-attaches password note');
  const pwStep2 = await StepsRepo.addStep({ image: 'b', elementType: 'INPUT', inputType: 'password', elementLabel: 'New password' });
  assert(pwStep2.note === '', 'second password step in same section gets no auto note');

  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }

  console.log('# insertion target: addStep inserts between existing steps');
  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }
  const e1 = await StepsRepo.addStep({ image: 'a', elementType: 'BUTTON', elementValue: 'A' });
  const e2 = await StepsRepo.addStep({ image: 'b', elementType: 'BUTTON', elementValue: 'B' });
  const e3 = await StepsRepo.addStep({ image: 'c', elementType: 'BUTTON', elementValue: 'C' });
  assert(e1.order === 1 && e2.order === 2 && e3.order === 3, 'starting orders 1,2,3');
  // Insert after step 1 (between A and B)
  await StepsRepo.setInsertionTarget(1);
  const ins1 = await StepsRepo.addStep({ image: 'x', elementType: 'BUTTON', elementValue: 'X1' });
  assert(ins1.order === 2, 'first inserted step takes order 2');
  // Target should auto-advance to 2
  const target = await StepsRepo.getInsertionTarget();
  assert(target === 2, 'insertion target auto-advanced to 2');
  // Insert another — stacks after the first inserted one
  const ins2 = await StepsRepo.addStep({ image: 'y', elementType: 'BUTTON', elementValue: 'X2' });
  assert(ins2.order === 3, 'second inserted step takes order 3 (after the first inserted one)');
  // Check that the original B, C got bumped to 4, 5
  const all = await StepsRepo.listSteps();
  const labels = all.map(s => s.elementValue + '@' + s.order).join(' ');
  assert(labels === 'A@1 X1@2 X2@3 B@4 C@5', `final order is "${labels}"`);

  // Clear the target — subsequent addStep should append at the end
  await StepsRepo.setInsertionTarget(null);
  const tail = await StepsRepo.addStep({ image: 'z', elementType: 'BUTTON', elementValue: 'Z' });
  assert(tail.order === 6, 'after clearing target, addStep appends');

  await StepsRepo.clearAll();
  for (const k of Array.from(store.keys())) {
    if (k.startsWith('section:') || k === 'guide:insertAfter') store.delete(k);
  }

  console.log('# compileSteps merges result events into preceding step');
  const rawR = [
    { id: 41, eventType: 'click',  elementType: 'BUTTON', elementLabel: 'Save', pageUrl: 'https://x/form', image: 'imgR1' },
    { id: 42, eventType: 'result', resultText: 'Record saved successfully.',     pageUrl: 'https://x/form', image: 'imgR2' },
  ];
  const compiledR = StepsRepo.compileSteps(rawR);
  assert(compiledR.length === 1, 'result event absorbed into preceding step');
  assert(compiledR[0].result === 'Record saved successfully.', 'result text surfaced');
  assert(compiledR[0].image === 'imgR2', 'image replaced with result screenshot');
  assert(compiledR[0].resultRawId === 42, 'resultRawId tracks the underlying record');
  assert(compiledR[0].sourceIds.join(',') === '41,42', 'sourceIds include both');

  console.log('# compileSteps result without preceding step stands alone');
  const rawR2 = [
    { id: 51, eventType: 'result', resultText: 'Welcome!', pageUrl: 'https://x/', image: 'imgX' },
  ];
  const compiledR2 = StepsRepo.compileSteps(rawR2);
  assert(compiledR2.length === 1, 'lone result becomes own step');
  assert(compiledR2[0].description === 'Welcome!', 'description promoted from resultText');

  console.log('# compileSteps single change without submit stays single');
  const rawC = [
    { id: 31, eventType: 'change', elementType: 'INPUT', inputType: 'search', elementLabel: 'Search', pageUrl: 'https://x/list', image: 'imgC1' },
    { id: 32, eventType: 'click',  elementType: 'A',     elementLabel: 'Open record',                 pageUrl: 'https://x/list', image: 'imgC2' },
  ];
  const compiledC = StepsRepo.compileSteps(rawC);
  assert(compiledC.length === 2, 'lone change + unrelated click stays as two steps');

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} failures)`);
  process.exit(failures === 0 ? 0 : 1);
})();
