/**
 * seed-siam.cjs — Seeds SIAM gym + classes into Firestore catalogue
 * Usage: node scripts/seed-siam.cjs [--dry-run]
 */
const db = require('./firestore-admin.cjs');

const CATALOGUE_PATH = 'artifacts/production/public/data/catalogue';
const GYMS_PATH = 'artifacts/production/public/data/gyms';

const GYM_ID = 'siam';
const GYM_NAME = 'SIAM';
const GYM_ADDRESS = 'Frederikssundsvej 6, 2400 København';
const GYM_PHONE = '+45 2873 2468';
const GYM_EMAIL = 'info@siam.dk';
const SCHEDULE_URL = 'https://siam.dk/holdplan/';

// Day mapping: 1=Mon … 7=Sun
const DAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const DAY_LABEL = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Class definitions ──
// Each entry: [dayOfWeek, startTime, endTime, title, discipline, level, subDiscipline?, ageGroup?, location]
// Each row becomes its own catalogue item (no grouping).
const RAW_CLASSES = [
  // ─── MONDAY ───
  [DAY.Mon, '07:00', '08:00', 'BJJ Gi – Fundamentals', 'BJJ', 'Beginner', 'Gi', null, 'Jiu Jitsu salen'],
  [DAY.Mon, '08:00', '09:00', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Mon, '08:00', '09:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Mon, '15:00', '16:00', 'BJJ No-Gi – Konkurrencehold', 'BJJ', 'Kamphold', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Mon, '16:00', '16:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Mon, '16:15', '17:00', 'Børne Jiu Jitsu (Gi) 7–9 år', 'BJJ', 'Beginner', 'Gi', '7-9 år', 'Jiu Jitsu salen'],
  [DAY.Mon, '17:00', '17:55', 'Junior Muaythai 14–17 år', 'Muay Thai', 'All', null, '14-17 år', 'Muaythai salen'],
  [DAY.Mon, '17:00', '17:55', 'Kadet Jiu Jitsu (Gi) 10–13 år', 'BJJ', 'Beginner', 'Gi', '10-13 år', 'Jiu Jitsu salen'],
  [DAY.Mon, '18:00', '18:55', 'Junior Kamphold Muaythai', 'Muay Thai', 'Kamphold', null, '14-17 år', 'Muaythai salen'],
  [DAY.Mon, '18:10', '19:05', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Mon, '19:00', '19:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Mon, '19:10', '20:05', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Mon, '20:00', '21:00', 'Intro Muaythai', 'Muay Thai', 'Beginner', null, null, 'Muaythai salen'],

  // ─── TUESDAY ───
  [DAY.Tue, '07:00', '08:00', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Tue, '07:00', '08:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Tue, '15:00', '16:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Tue, '16:00', '16:55', 'BJJ No-Gi – Intro', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Tue, '16:15', '17:00', 'Børne Muaythai 7–9 år', 'Muay Thai', 'Beginner', null, '7-9 år', 'Muaythai salen'],
  [DAY.Tue, '17:00', '17:55', 'BJJ Gi Mix – Fundamentals (14–17 år og voksne)', 'BJJ', 'Beginner', 'Gi', null, 'Jiu Jitsu salen'],
  [DAY.Tue, '17:00', '17:55', 'Kadet Muaythai 10–13 år', 'Muay Thai', 'Beginner', null, '10-13 år', 'Muaythai salen'],
  [DAY.Tue, '18:00', '19:25', 'BJJ No-Gi – Øvede', 'BJJ', 'Advanced', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Tue, '18:00', '19:25', 'MT Kamphold', 'Muay Thai', 'Kamphold', null, null, 'Muaythai salen'],
  [DAY.Tue, '19:30', '20:30', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],

  // ─── WEDNESDAY ───
  [DAY.Wed, '07:00', '08:00', 'BJJ Gi – Fundamentals', 'BJJ', 'Beginner', 'Gi', null, 'Jiu Jitsu salen'],
  [DAY.Wed, '08:00', '09:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Wed, '08:30', '09:30', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Wed, '15:00', '16:00', 'BJJ No-Gi – Konkurrencehold', 'BJJ', 'Kamphold', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Wed, '16:00', '16:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Wed, '16:15', '17:00', 'Børne Jiu Jitsu (Gi) 7–9 år', 'BJJ', 'Beginner', 'Gi', '7-9 år', 'Jiu Jitsu salen'],
  [DAY.Wed, '17:00', '17:55', 'Junior Muaythai 14–17 år', 'Muay Thai', 'All', null, '14-17 år', 'Muaythai salen'],
  [DAY.Wed, '17:00', '17:55', 'Kadet Jiu Jitsu (Gi) 10–13 år', 'BJJ', 'Beginner', 'Gi', '10-13 år', 'Jiu Jitsu salen'],
  [DAY.Wed, '18:00', '18:55', 'Junior Kamphold Muaythai', 'Muay Thai', 'Kamphold', null, '14-17 år', 'Muaythai salen'],
  [DAY.Wed, '18:10', '19:10', 'MMA', 'MMA', 'All', null, null, 'Jiu Jitsu salen'],
  [DAY.Wed, '19:00', '19:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Wed, '19:10', '20:05', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Wed, '20:00', '21:00', 'Intro Muaythai', 'Muay Thai', 'Beginner', null, null, 'Muaythai salen'],

  // ─── THURSDAY ───
  [DAY.Thu, '07:00', '08:00', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Thu, '07:00', '08:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Thu, '15:00', '16:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Thu, '16:00', '16:55', 'BJJ No-Gi – Intro', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Thu, '16:15', '17:00', 'Børne Muaythai 7–9 år', 'Muay Thai', 'Beginner', null, '7-9 år', 'Muaythai salen'],
  [DAY.Thu, '17:00', '17:55', 'BJJ Gi Mix – Fundamentals (14–17 år og voksne)', 'BJJ', 'Beginner', 'Gi', null, 'Jiu Jitsu salen'],
  [DAY.Thu, '17:00', '17:55', 'Kadet Muaythai 10–13 år', 'Muay Thai', 'Beginner', null, '10-13 år', 'Muaythai salen'],
  [DAY.Thu, '18:00', '19:25', 'BJJ No-Gi – Øvede', 'BJJ', 'Advanced', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Thu, '18:00', '19:25', 'MT Kamphold', 'Muay Thai', 'Kamphold', null, null, 'Muaythai salen'],
  [DAY.Thu, '19:30', '20:25', 'Muaythai', 'Muay Thai', 'All', null, null, 'Muaythai salen'],

  // ─── FRIDAY ───
  [DAY.Fri, '07:00', '08:00', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Fri, '08:00', '09:00', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Fri, '15:00', '15:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Fri, '16:00', '16:55', 'BJJ No-Gi Mix – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Fri, '16:00', '16:55', 'Junior Muaythai 14–17 år', 'Muay Thai', 'All', null, '14-17 år', 'Muaythai salen'],
  [DAY.Fri, '17:00', '17:55', 'Muaythai Sparring Mix', 'Muay Thai', 'All', 'Sparring', null, 'Muaythai salen'],
  [DAY.Fri, '17:10', '19:10', 'Open Mat (Gi & No-Gi)', 'BJJ', 'All', 'Open Mat', null, 'Jiu Jitsu salen'],
  [DAY.Fri, '18:00', '19:30', 'MMA', 'MMA', 'All', null, null, 'Jiu Jitsu salen'],

  // ─── SATURDAY ───
  [DAY.Sat, '09:00', '09:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Sat, '10:00', '10:55', 'Muaythai Kampholdssparring', 'Muay Thai', 'Kamphold', 'Sparring', null, 'Jiu Jitsu salen'],
  [DAY.Sat, '10:00', '10:55', 'Muaythai Mix', 'Muay Thai', 'All', null, null, 'Muaythai salen'],
  [DAY.Sat, '11:00', '12:00', 'BJJ No-Gi – Fundamentals', 'BJJ', 'Beginner', 'No-Gi', null, 'Jiu Jitsu salen'],
  [DAY.Sat, '12:00', '13:30', 'MMA – Sparringshold', 'MMA', 'All', 'Sparring', null, 'Muaythai salen'],

  // ─── SUNDAY ───
  [DAY.Sun, '10:00', '10:45', 'BJJ Kids', 'BJJ', 'Beginner', null, '7-13 år', 'Jiu Jitsu salen'],
  [DAY.Sun, '10:00', '10:45', 'MT Kids', 'Muay Thai', 'Beginner', null, '7-13 år', 'Muaythai salen'],
  [DAY.Sun, '11:00', '12:00', 'BJJ Gi Mix – Fundamentals', 'BJJ', 'Beginner', 'Gi', null, 'Jiu Jitsu salen'],
  [DAY.Sun, '12:00', '13:00', 'Open Mat', 'BJJ', 'All', 'Open Mat', null, 'Jiu Jitsu salen'],
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const now = new Date().toISOString();

  console.log(`SIAM: ${RAW_CLASSES.length} schedule slots (1 class per slot)\n`);

  if (dryRun) {
    console.log('--- DRY RUN (not writing to Firestore) ---\n');

    console.log(`GYM: ${GYM_NAME}`);
    console.log(`  Address: ${GYM_ADDRESS}`);
    console.log(`  Phone: ${GYM_PHONE} | Email: ${GYM_EMAIL}`);
    console.log(`  Schedule: ${SCHEDULE_URL}\n`);

    RAW_CLASSES.forEach(([day, start, end, title, discipline, level, subDiscipline, ageGroup, location], i) => {
      const sub = subDiscipline ? `/${subDiscipline}` : '';
      const age = ageGroup ? ` [${ageGroup}]` : '';
      console.log(`${String(i + 1).padStart(2)}. ${DAY_LABEL[day]} ${start}–${end} | ${title} — ${discipline}${sub} | ${level}${age} | ${location}`);
    });
    console.log(`\nTotal: ${RAW_CLASSES.length} classes`);
    return;
  }

  // ── Write to Firestore ──
  await db.init();

  // 1. Write gym document
  const gymData = {
    name: GYM_NAME,
    address: GYM_ADDRESS,
    phone: GYM_PHONE,
    email: GYM_EMAIL,
    scheduleUrl: SCHEDULE_URL,
    createdAt: now,
    updatedAt: now,
  };
  await db.writeDoc(`${GYMS_PATH}/${GYM_ID}`, gymData);
  console.log(`✓ Gym: ${GYM_NAME}`);

  // 2. Write catalogue classes — one per schedule slot
  console.log('\nWriting classes...');
  let count = 0;
  for (const [day, start, end, title, discipline, level, subDiscipline, ageGroup, location] of RAW_CLASSES) {
    const id = `class-siam-${Date.now()}-${count}`;
    const doc = {
      id,
      title,
      discipline,
      level,
      gym: GYM_NAME,
      location,
      address: GYM_ADDRESS,
      schedules: [{ dayOfWeek: day, startTime: start, endTime: end }],
      showRatings: false,
      source: 'holdoversigt-import',
      createdAt: now,
      updatedAt: now,
    };
    if (subDiscipline) doc.subDiscipline = subDiscipline;
    if (ageGroup) doc.ageGroup = ageGroup;

    await db.writeDoc(`${CATALOGUE_PATH}/${id}`, doc);
    console.log(`  ✓ ${DAY_LABEL[day]} ${start}–${end} ${title}`);
    count++;

    // Small delay to avoid hitting Firestore rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Done. ${count} classes seeded for ${GYM_NAME}`);
}

main().catch(err => { console.error(err); process.exit(1); });
