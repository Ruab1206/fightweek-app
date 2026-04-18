/**
 * read-all-data.cjs — Read ALL FightWeek data from Firestore into local JSON files.
 *
 * Usage:  node scripts/read-all-data.cjs
 *
 * Prerequisites: serviceAccountKey.json in the fightweek-app/ root.
 * Uses the Firebase Admin service account — bypasses all security rules.
 *
 * Outputs to data/ folder:
 *   story-map.json    — Activities, tasks, slices, personas
 *   backlog.json      — All backlog items
 *   feedback.json     — User feedback
 *   fighters.json     — Each fighter's current week + standard template
 */

const fs = require('fs');
const path = require('path');
const db = require('./firestore-admin.cjs');

const OUT_DIR = path.join(__dirname, '..', 'data');
const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl'];

fs.mkdirSync(OUT_DIR, { recursive: true });

function write(name, data) {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2));
}

function getISOWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

async function main() {
  console.log('🔐 Authenticating with service account...');
  await db.init();
  console.log('  ✅ Authenticated\n');

  const results = { read: [], failed: [] };
  const ok = (label, detail) => { results.read.push(label); console.log(`  ✅ ${label}: ${detail}`); };
  const fail = (label, err) => { results.failed.push(label); console.log(`  ⚠️  ${label}: ${err}`); };

  // ── 1. Story Map ──
  console.log('── Story Map ──');
  try {
    const sm = await db.readDoc(db.PATHS.storyMap);
    if (sm) {
      write('story-map.json', sm);
      ok('Story map', `${sm.activities?.length ?? '?'} activities, ${sm.tasks?.length ?? '?'} tasks, ${sm.slices?.length ?? '?'} slices`);
    } else {
      fail('Story map', 'Document not found at story-map/main');
    }
  } catch (e) { fail('Story map', e.message); }

  // ── 2. Backlog ──
  console.log('\n── Backlog ──');
  try {
    const items = await db.listCollection(db.PATHS.backlog);
    write('backlog.json', items);
    ok('Backlog', `${items.length} items`);
  } catch (e) { fail('Backlog', e.message); }

  // ── 3. Feedback ──
  console.log('\n── Feedback ──');
  try {
    const fb = await db.listCollection(db.PATHS.feedback);
    write('feedback.json', fb);
    ok('Feedback', `${fb.length} items`);
  } catch (e) { fail('Feedback', e.message); }

  // ── 4. Fighter data ──
  const week = getISOWeek();
  console.log(`\n── Fighter Data (week ${week}) ──`);
  const fighters = {};
  for (const name of FIGHTERS) {
    fighters[name] = { currentWeek: null, standardTemplate: null };

    try {
      const weekData = await db.readDoc(db.PATHS.userWeek(name, week));
      if (weekData) fighters[name].currentWeek = weekData;
    } catch (e) { /* may not exist yet */ }

    try {
      const tmpl = await db.readDoc(db.PATHS.userTemplate(name));
      if (tmpl) fighters[name].standardTemplate = tmpl;
    } catch (e) { /* may not exist */ }

    const hasWeek = fighters[name].currentWeek ? '✅ week' : '– no week';
    const hasTmpl = fighters[name].standardTemplate ? '✅ template' : '– no template';
    console.log(`  ${name}: ${hasWeek}, ${hasTmpl}`);
  }
  write('fighters.json', fighters);
  ok('Fighters', `${FIGHTERS.length} fighters, week ${week}`);

  // ── Summary ──
  console.log('\n══════════════════════════════');
  console.log(`✅ Read: ${results.read.join(', ')}`);
  if (results.failed.length) console.log(`⚠️  Failed: ${results.failed.join(', ')}`);
  console.log(`📁 Files in: ${OUT_DIR}/`);
  console.log('══════════════════════════════\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
