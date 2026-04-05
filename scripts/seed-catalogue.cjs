/**
 * seed-catalogue.cjs — Reads holdoversigt prototype data and seeds Firestore
 * Usage: node scripts/seed-catalogue.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const db = require('./firestore-admin.cjs');

const CATALOGUE_PATH = 'artifacts/production/public/data/catalogue';

// ── Level normalization ──
// Prototype "sub_discipline" values that are actually levels
const LEVEL_MAP = {
  'Elite': 'Elite',
  'Kamp': 'Kamphold',
  'Begynder': 'Beginner',
  'Øvet': 'Advanced',
  'Lukket': 'Elite',        // "Lukket Hold" = invitation-only elite
  'Børn Elite': 'Advanced',  // level is Advanced; ageGroup extracted separately
};

// Prototype "level" normalization
const LEVEL_NORMALIZE = {
  'Pro': 'Pro',
  'Advanced': 'Advanced',
  'Beginner': 'Beginner',
  'All': 'All',
};

// Sub-discipline values that are actual technique / format sub-disciplines
const REAL_SUB_DISCIPLINES = new Set([
  'No-Gi', 'No-Gi Sparring', 'Sparring', 'Open Mat',
  'Pads', 'Wall Wrestling', 'Styrke og Kondition',
  'Hypertrofi/Styrke', 'Kvinder',
]);

// ── Age group extraction ──
function extractAgeGroup(title, subDisc) {
  if (subDisc === 'Børn' || subDisc === 'Børn Elite') return '6-12 år';
  const m = title.match(/\((\d+-\d+ år)\)/);
  return m ? m[1] : undefined;
}

// ── Fix UTF-8 mojibake from PowerShell extraction ──
function fixEncoding(s) {
  if (!s) return s;
  return s
    .replace(/Ã¸/g, 'ø').replace(/Ã˜/g, 'Ø')
    .replace(/Ã¦/g, 'æ').replace(/Ã†/g, 'Æ')
    .replace(/Ã¥/g, 'å').replace(/Ã…/g, 'Å')
    .replace(/Ã©/g, 'é').replace(/Ã¼/g, 'ü');
}

// ── Transform one prototype entry into CatalogueClass ──
function transform(raw, index) {
  const title = fixEncoding(raw.title);
  const subDisc = fixEncoding(raw.sub_discipline);
  const discipline = fixEncoding(raw.discipline);
  const gym = fixEncoding(raw.source_name);
  const locationName = fixEncoding(raw.location_name);
  const addr = fixEncoding(raw.address);
  const instructor = fixEncoding(raw.instructor_name);
  const prereqs = fixEncoding(raw.prerequisites);

  // Determine level: use LEVEL_MAP on sub_discipline first, then normalize raw level
  let level = LEVEL_NORMALIZE[raw.level] || 'All';
  if (subDisc && LEVEL_MAP[subDisc]) {
    level = LEVEL_MAP[subDisc];
  }

  // Determine subDiscipline: only keep if it's a real technique/format concept
  let subDiscipline = undefined;
  if (subDisc && REAL_SUB_DISCIPLINES.has(subDisc)) {
    subDiscipline = subDisc;
  }

  // Age group
  const ageGroup = extractAgeGroup(title, subDisc);

  // Schedules
  const schedules = (raw.schedules || [])
    .filter(s => s.is_recurring && s.day_of_week != null && s.start_time && s.end_time)
    .map(s => ({
      dayOfWeek: s.day_of_week,           // 1=Mon … 7=Sun already in prototype data
      startTime: s.start_time,
      endTime: s.end_time,
    }));

  const now = new Date().toISOString();

  const cls = {
    id: `class-${Date.now()}-${index}`,
    title,
    discipline,
    level,
    gym,
    location: locationName || gym,
    schedules,
    showRatings: false,
    source: 'holdoversigt-import',
    createdAt: now,
    updatedAt: now,
  };

  // Optional fields — only include if present
  if (subDiscipline) cls.subDiscipline = subDiscipline;
  if (ageGroup) cls.ageGroup = ageGroup;
  if (addr) cls.address = addr;
  if (instructor) cls.instructor = instructor;
  if (prereqs) cls.description = prereqs;

  return cls;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Read raw prototype data
  const htmlPath = path.join(__dirname, '..', '..', 'Fightweek-app resources', 'holdoversigt.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const startMarker = 'const rawJsonFromUser = [';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) { console.error('Could not find rawJsonFromUser in holdoversigt.html'); process.exit(1); }
  const endIdx = html.indexOf('];', startIdx) + 2;
  const jsArray = html.substring(startIdx + startMarker.length - 1, endIdx);

  // eslint-disable-next-line no-eval
  const rawData = eval(jsArray);
  console.log(`Found ${rawData.length} entries in prototype data`);

  // Filter: skip private/team-template entries
  const publicEntries = rawData.filter(d => !d.visibility || d.visibility === 'Public' || d.visibility === 'public');
  // Also skip entries with no schedules (or only flexible templates)
  const withSchedules = publicEntries.filter(d =>
    d.schedules && d.schedules.some(s => s.is_recurring && s.day_of_week != null)
  );
  console.log(`After filtering: ${withSchedules.length} public classes with recurring schedules`);

  // Transform
  const classes = withSchedules.map((raw, i) => transform(raw, i));

  if (dryRun) {
    console.log('\n--- DRY RUN (not writing to Firestore) ---\n');
    classes.forEach(c => {
      console.log(`${c.gym} | ${c.title} | ${c.discipline}/${c.subDiscipline || '-'} | ${c.level} | ${c.ageGroup || '-'} | ${c.schedules.length} slots`);
    });
    console.log(`\nTotal: ${classes.length} classes`);
    return;
  }

  // Write to Firestore
  await db.init();
  console.log('\nWriting to Firestore...');
  for (const cls of classes) {
    await db.writeDoc(`${CATALOGUE_PATH}/${cls.id}`, cls);
    console.log(`  ✓ ${cls.gym} — ${cls.title}`);
  }
  console.log(`\nDone. ${classes.length} classes seeded to ${CATALOGUE_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
