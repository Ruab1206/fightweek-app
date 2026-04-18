/**
 * Seed script — push sample events to Firestore.
 * Run once: node scripts/seed-events.cjs
 */
const db = require('./firestore-admin.cjs');

const EVENTS_PATH = 'artifacts/production/public/data/events';

const now = new Date().toISOString();

const events = [
  {
    title: 'DM i Brydning 2026',
    type: 'tournament',
    discipline: 'Brydning',
    date: '2026-05-16',
    endDate: '2026-05-17',
    startTime: '09:00',
    endTime: '18:00',
    location: 'Frederiksberg Hallerne',
    address: 'Frederiksberg Hallerne, Ndr. Fasanvej 37, 2000 Frederiksberg',
    description: 'Danmarksmesterskabet i brydning 2026. Alle vægtklasser, kadetter + seniorer. Indvejning lørdag 07:30.',
    organiser: 'Dansk Bryde Forbund',
    url: 'https://brydning.dk',
    cost: '0 kr (deltagergebyr via klub)',
    registrationDeadline: '2026-05-01',
    signups: {},
    createdBy: 'rune.abrahamsson@gmail.com',
    createdAt: now,
    updatedAt: now,
  },
  {
    title: 'MMA Seminar — Takedown Defence',
    type: 'seminar',
    discipline: 'MMA',
    date: '2026-04-25',
    startTime: '13:00',
    endTime: '16:00',
    location: 'Arte Suave',
    address: 'Arte Suave, Nørrebrogade 45, 2200 København N',
    description: 'Tre timer med fokus på takedown defence fra bur og åbent mat. Intermediate+.',
    organiser: 'Arte Suave København',
    cost: '300 kr',
    registrationDeadline: '2026-04-22',
    signups: {},
    createdBy: 'rune.abrahamsson@gmail.com',
    createdAt: now,
    updatedAt: now,
  },
  {
    title: 'No-Gi Grappling Open',
    type: 'tournament',
    discipline: 'Grappling',
    date: '2026-06-07',
    startTime: '10:00',
    endTime: '17:00',
    location: 'Greve Idrætscenter',
    address: 'Greve Idrætscenter, Greve Centervej 53, 2670 Greve',
    description: 'Åbent no-gi grappling stævne. Alle bæltefarver. IBJJF-regler.',
    organiser: 'Danish Grappling Association',
    url: 'https://danishgrappling.dk',
    cost: '350 kr',
    registrationDeadline: '2026-05-25',
    signups: {},
    createdBy: 'rune.abrahamsson@gmail.com',
    createdAt: now,
    updatedAt: now,
  },
  {
    title: 'Team Social — Sommerfest',
    type: 'social',
    date: '2026-06-20',
    startTime: '18:00',
    endTime: '23:00',
    location: 'Runes have',
    address: 'Frederiksberg, København',
    description: 'Sæsonafslutning! Grill, hygge og planlægning af næste sæson.',
    organiser: 'Holdet',
    cost: '100 kr (mad & drikke)',
    signups: {},
    createdBy: 'rune.abrahamsson@gmail.com',
    createdAt: now,
    updatedAt: now,
  },
  {
    title: 'Boksning Sparring Day',
    type: 'other',
    discipline: 'Boksning',
    date: '2026-05-03',
    startTime: '14:00',
    endTime: '17:00',
    location: 'København Boxing',
    address: 'København Boxing, Istedgade 100, 1650 København V',
    description: 'Åben sparringsdag. Alle niveauer velkommen. Medbring eget udstyr.',
    organiser: 'København Boxing',
    cost: '0 kr',
    signups: {},
    createdBy: 'rune.abrahamsson@gmail.com',
    createdAt: now,
    updatedAt: now,
  },
];

async function seed() {
  await db.init();
  for (const evt of events) {
    const docId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.writeDoc(`${EVENTS_PATH}/${docId}`, evt);
  }
  console.log(`✅ Seeded ${events.length} events to Firestore.`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
