/**
 * seed-rbk77.cjs — Add RBK77 (Rødovre Bokseklub) Kamphold to catalogue
 * Source: https://rbk77.dk/
 * Usage: node scripts/seed-rbk77.cjs [--dry-run]
 */
const db = require('./firestore-admin.cjs');

const CATALOGUE_PATH = 'artifacts/production/public/data/catalogue';

const now = new Date().toISOString();

const rbk77Kamphold = {
  id: `class-rbk77-kamphold`,
  title: 'Kamphold',
  discipline: 'Boxing',
  level: 'Kamphold',
  gym: 'RBK77',
  location: 'Rødovre Bokseklub',
  address: 'Højnæsvej 63, Rødovre',
  schedules: [
    { dayOfWeek: 1, startTime: '17:30', endTime: '19:00' },  // Mandag
    { dayOfWeek: 2, startTime: '17:30', endTime: '19:00' },  // Tirsdag
    { dayOfWeek: 4, startTime: '17:30', endTime: '19:00' },  // Torsdag
    { dayOfWeek: 6, startTime: '10:00', endTime: '11:30' },  // Lørdag
  ],
  showRatings: false,
  source: 'manual',
  createdAt: now,
  updatedAt: now,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('--- DRY RUN ---');
    console.log(JSON.stringify(rbk77Kamphold, null, 2));
    return;
  }

  await db.init();
  await db.writeDoc(`${CATALOGUE_PATH}/${rbk77Kamphold.id}`, rbk77Kamphold);
  console.log(`✓ RBK77 Kamphold seeded (4 timeslots: Mon, Tue, Thu, Sat)`);
}

main().catch(err => { console.error(err); process.exit(1); });
