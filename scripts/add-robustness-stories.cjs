/**
 * Add robustness stories to the backlog.
 * Run once: node scripts/add-robustness-stories.cjs
 */
const db = require('./firestore-admin.cjs');

const BACKLOG_PATH = 'artifacts/production/public/data/backlog';
const now = new Date().toISOString();

const stories = [
  {
    title: 'Add ESLint with react-hooks/exhaustive-deps rule',
    desc: 'Set up ESLint with eslint-plugin-react-hooks to catch hook dependency issues at dev time. Several bugs in 1.7 were caused by subtle hook dependency mistakes that this rule would have caught automatically.',
    acceptance: '- ESLint is configured and runs on `npm run lint`\n- react-hooks/exhaustive-deps rule is enabled as error\n- All existing violations are resolved\n- Pre-commit or CI check prevents new violations',
    notes: 'Quick setup: npm i -D eslint eslint-plugin-react-hooks + minimal config.',
    status: 'backlog',
    tag: 'DX',
    priority: 'High',
    release: '1.8 — Robustness',
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    title: 'Add Vitest for unit testing core hooks and utilities',
    desc: 'Set up Vitest and write unit tests for pure functions and hooks: useEventMerge, cloneWithoutEvents, getISOWeekForDate, getDaysInRange. These are the functions most prone to regression and trivially testable.',
    acceptance: '- Vitest is configured with `npm test` script\n- Unit tests cover useEventMerge merge logic\n- Unit tests cover cloneWithoutEvents stripping\n- Unit tests cover getISOWeekForDate and getDaysInRange\n- All tests pass in CI',
    notes: 'Vitest integrates with Vite out of the box: npm i -D vitest. Consider happy-dom for hook testing.',
    status: 'backlog',
    tag: 'DX',
    priority: 'High',
    release: '1.8 — Robustness',
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    title: 'Centralize Firestore week-save to always strip event sessions',
    desc: 'Create a single saveWeekClean(weekNum, data) wrapper that always calls cloneWithoutEvents before persisting to Firestore. Replace all ~8 call sites that currently handle stripping individually. This eliminates an entire class of bugs where virtual event sessions leak into persisted data.',
    acceptance: '- A single saveWeekClean function exists that strips event sessions before saving\n- All save paths (handleSaveSession, handleDeleteSession, handleAddFromCatalogue, handleAddRecurring, handleFravær, handleDeleteFravær, handleAddFromDesktopCatalogue, onDeleteThisAndFuture) use this function\n- No direct calls to saveWeekToDb remain outside the wrapper\n- Existing functionality unchanged — no regressions',
    notes: 'Consider co-locating with saveWeekToDb in useScheduleData or useSessionHandlers.',
    status: 'backlog',
    tag: 'Architecture',
    priority: 'Medium',
    release: '1.8 — Robustness',
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
];

async function seed() {
  await db.init();

  // Find existing highest number
  const existing = await db.listCollection(BACKLOG_PATH);
  let maxNum = 0;
  for (const item of existing) {
    if (typeof item.number === 'number' && item.number > maxNum) maxNum = item.number;
  }

  for (let i = 0; i < stories.length; i++) {
    const story = { ...stories[i], number: maxNum + 1 + i };
    await db.addDoc(BACKLOG_PATH, story);
    console.log(`  ✅ #${story.number}: ${story.title}`);
  }
  console.log(`\n✅ Added ${stories.length} stories to release "1.8 — Robustness".`);
}

seed().catch(console.error);
