/**
 * Add LejonCupen event to Firestore.
 * Run: node scripts/add-lejoncupen.cjs
 */
const db = require('./firestore-admin.cjs');

const EVENTS_PATH = 'artifacts/production/public/data/events';
const now = new Date().toISOString();

const event = {
  title: 'LejonCupen i Fristil 2026',
  type: 'tournament',
  discipline: 'Brydning',
  date: '2026-04-18',
  startTime: '11:00',
  endTime: '18:00',
  location: 'Linköpings SportCenter',
  address: 'Gumpekullavägen 3, Linköping, Sverige',
  description: 'LejonCupen i fristil arrangeret af IFK Linköpings BK. Del af Svenska Rankingcupen Fristil. Kategorier: WW og FS fra 7 år til senior. Invägning 08:30–09:30, tävlingsstart 11:00. Anmälningsavgift 250 kr via Profixio.',
  organiser: 'IFK Linköpings BK',
  url: 'https://www.svenskalag.se/ifklinkopingsbk/sida/96756/inbjudan',
  cost: '250 SEK',
  contactName: 'Evelina Gryvik / Lotta Jakobsson',
  contactPhone: '073-360 80 76',
  contactEmail: 'evegryvik@gmail.com',
  registrationDeadline: '2026-04-16',
  latitude: 58.4023,
  longitude: 15.6313,
  signups: {},
  createdBy: 'rune.abrahamsson@gmail.com',
  createdAt: now,
  updatedAt: now,
};

async function run() {
  await db.init();
  const docId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.writeDoc(`${EVENTS_PATH}/${docId}`, event);
  console.log(`✅ Added "${event.title}" (${event.date}) to Firestore as ${docId}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
