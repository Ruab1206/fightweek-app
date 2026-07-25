/**
 * seed-burnell.cjs — Replace the Burnell MMA & BJJ class schedule in the catalogue.
 * Source: https://burnellmma.dk/holdoversigt-tider/
 * Usage: node scripts/seed-burnell.cjs [--dry-run]
 *
 * Idempotent UPSERT-by-title: reuses existing catalogue doc IDs (and their
 * createdAt/source/address metadata) so the app keeps stable references and
 * no duplicates are created. Existing Burnell docs not in this schedule are
 * removed so the live schedule matches exactly.
 */
const db = require('./firestore-admin.cjs');

const CATALOGUE_PATH = 'artifacts/production/public/data/catalogue';

const GYM_NAME = 'Burnell MMA & BJJ';
const GYM_ADDRESS = 'Sydmarken 48, 2860 Søborg';
const SOURCE = 'manual-2026-04';

// Day mapping: 1=Mon … 7=Sun
const DAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const DAY_LABEL = ['', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

const s = (day, start, end) => ({ dayOfWeek: day, startTime: start, endTime: end });

// ── New Burnell schedule ──
// Conventions match existing live docs: "Invite Only" lives in the title,
// level is always "All" (skill qualifier is expressed in the title).
const BURNELL_CLASSES = [
  { title: 'MMA Kamphold (Invite Only)', discipline: 'MMA',
    schedules: [s(DAY.Mon, '15:00', '16:00'), s(DAY.Wed, '15:00', '16:00'), s(DAY.Fri, '16:00', '17:00')] },
  { title: 'No-Gi Intro', discipline: 'BJJ', subDiscipline: 'No-Gi',
    schedules: [s(DAY.Mon, '16:00', '17:00'), s(DAY.Thu, '18:00', '19:00')] },
  { title: 'No-Gi All Levels', discipline: 'BJJ', subDiscipline: 'No-Gi',
    schedules: [s(DAY.Mon, '17:00', '18:00'), s(DAY.Wed, '18:00', '19:00')] },
  { title: 'Boksning', discipline: 'Boxing',
    schedules: [s(DAY.Mon, '18:00', '19:00'), s(DAY.Tue, '16:00', '17:00'), s(DAY.Thu, '16:00', '17:00')] },
  { title: 'Kickboksning', discipline: 'Muay Thai',
    schedules: [s(DAY.Mon, '19:00', '20:00'), s(DAY.Tue, '19:00', '20:00'), s(DAY.Wed, '19:00', '20:00')] },
  { title: 'No-Gi Øvede', discipline: 'BJJ', subDiscipline: 'No-Gi',
    schedules: [s(DAY.Tue, '17:00', '18:00'), s(DAY.Thu, '17:00', '18:00')] },
  { title: 'MMA Intro', discipline: 'MMA',
    schedules: [s(DAY.Tue, '18:00', '19:00')] },
  { title: 'Fitness Boksning', discipline: 'Boxing',
    schedules: [s(DAY.Wed, '16:00', '17:00'), s(DAY.Sun, '10:00', '11:00')] },
  { title: 'Brydning', discipline: 'Wrestling',
    schedules: [s(DAY.Wed, '17:00', '18:00')] },
  { title: 'Bokse Sparring', discipline: 'Boxing',
    schedules: [s(DAY.Fri, '17:00', '18:00')] },
  { title: 'No-Gi & Boksning', discipline: 'MMA',
    schedules: [s(DAY.Sat, '10:00', '11:00')] },
  { title: 'Stående Sparring (Invite Only)', discipline: 'MMA',
    schedules: [s(DAY.Sat, '11:00', '12:00')] },
  { title: 'MMA Sparring (Invite Only)', discipline: 'MMA',
    schedules: [s(DAY.Sun, '11:00', '12:00')] },
];

// Repurpose predecessor docs so existing IDs/history are kept when a class is renamed.
// The old all-levels "No-Gi" doc becomes "No-Gi All Levels".
const RENAMED_FROM = { 'No-Gi All Levels': 'No-Gi' };

function fmtSlots(schedules) {
  return schedules.map(x => `${DAY_LABEL[x.dayOfWeek]} ${x.startTime}-${x.endTime}`).join(', ');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const nowIso = new Date().toISOString();

  await db.init();
  const all = await db.listCollection(CATALOGUE_PATH);
  const existing = all.filter(x => x.gym === GYM_NAME);
  const byTitle = new Map(existing.map(d => [d.title, d]));

  const usedIds = new Set();
  const plan = BURNELL_CLASSES.map((c, i) => {
    let match = byTitle.get(c.title);
    if (!match && RENAMED_FROM[c.title]) match = byTitle.get(RENAMED_FROM[c.title]);
    const id = match ? match._id : `class-${Date.now()}-${i}`;
    usedIds.add(id);

    const doc = {
      id,
      title: c.title,
      discipline: c.discipline,
      level: 'All',
      gym: GYM_NAME,
      location: match ? (match.location || '') : '',
      instructor: match ? (match.instructor || '') : '',
      address: match ? (match.address || GYM_ADDRESS) : GYM_ADDRESS,
      schedules: c.schedules,
      showRatings: match ? !!match.showRatings : false,
      source: match ? (match.source || SOURCE) : SOURCE,
      createdAt: match ? (match.createdAt || nowIso) : nowIso,
      updatedAt: nowIso,
    };
    if (c.subDiscipline) doc.subDiscipline = c.subDiscipline;

    return { action: match ? 'update' : 'create', from: match ? match.title : null, doc };
  });

  const obsolete = existing.filter(d => !usedIds.has(d._id));

  // ── Report ──
  console.log(`Burnell schedule: ${BURNELL_CLASSES.length} classes / ${BURNELL_CLASSES.reduce((n, c) => n + c.schedules.length, 0)} slots`);
  console.log(`Existing Burnell docs in Firestore: ${existing.length}\n`);
  plan.forEach(p => {
    const rename = p.from && p.from !== p.doc.title ? ` (was "${p.from}")` : '';
    const sub = p.doc.subDiscipline ? `/${p.doc.subDiscipline}` : '';
    console.log(`  [${p.action.toUpperCase()}] ${p.doc.title}${rename} — ${p.doc.discipline}${sub} | ${fmtSlots(p.doc.schedules)}`);
  });
  if (obsolete.length) {
    console.log('\nObsolete Burnell docs to DELETE:');
    obsolete.forEach(d => console.log(`  [DELETE] ${d.title} (${d._id})`));
  }

  if (dryRun) {
    console.log('\n--- DRY RUN (no writes) ---');
    return;
  }

  console.log('\nWriting to Firestore...');
  for (const p of plan) {
    await db.writeDoc(`${CATALOGUE_PATH}/${p.doc.id}`, p.doc);
    console.log(`  ✓ ${p.action} — ${p.doc.title}`);
  }
  for (const d of obsolete) {
    await db.deleteDoc(`${CATALOGUE_PATH}/${d._id}`);
    console.log(`  ✗ deleted — ${d.title}`);
  }
  console.log(`\nDone. ${plan.length} classes upserted, ${obsolete.length} removed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
