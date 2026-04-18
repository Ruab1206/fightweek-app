/**
 * cleanup-future-weeks.cjs
 * 
 * Deletes week documents beyond a cutoff date for all fighters.
 * These are auto-seeded weeks that keep re-appearing because the template
 * still existed when they were created.
 *
 * Usage:
 *   node scripts/cleanup-future-weeks.cjs              # dry-run
 *   node scripts/cleanup-future-weeks.cjs --apply      # delete for real
 */

const db = require('./firestore-admin.cjs');

const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl', 'Frode', 'Frodi', 'Rune'];
const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');

// Cutoff: end of October 2027 → anything after Nov 1 2027 gets deleted
const CUTOFF = new Date('2027-11-01T00:00:00');

// Replicate getDateForWeekDay logic from the app
function getDateForWeekDay(weekNumber, dayName) {
  const dayIndex = DAYS.indexOf(dayName);
  if (dayIndex === -1) return null;
  // Use 2026 as base year (current year in the app)
  const simple = new Date(2026, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay();
  if (dow <= 4) simple.setDate(simple.getDate() - simple.getDay() + 1);
  else simple.setDate(simple.getDate() + 8 - simple.getDay());
  const target = new Date(simple);
  target.setDate(simple.getDate() + dayIndex);
  return target;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Cleanup: Delete future week documents                  ║');
  console.log(`║  Cutoff: ${CUTOFF.toISOString().slice(0, 10)} (delete weeks after this)       ║`);
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN (no deletes)' : '⚡ APPLY (deleting from Firestore)'}${DRY_RUN ? '      ' : ' '}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  await db.init();

  let totalDeleted = 0;

  for (const fighter of FIGHTERS) {
    console.log(`\n── ${fighter} ──`);
    const weeksPath = `artifacts/production/users/${fighter}/weeks`;
    const weekDocs = await db.listCollection(weeksPath);

    if (weekDocs.length === 0) {
      console.log('  No weeks found');
      continue;
    }

    let deleted = 0;
    for (const weekDoc of weekDocs) {
      const weekId = weekDoc._id; // e.g. "week_58"
      const weekNum = parseInt(weekId.replace('week_', ''), 10);
      if (isNaN(weekNum)) continue;

      // Get the Monday date for this week
      const monday = getDateForWeekDay(weekNum, 'Mandag');
      if (!monday) continue;

      if (monday >= CUTOFF) {
        // Check if there are any non-template sessions (manually added one-off sessions)
        // If so, we might want to keep them. But since user says "delete all", let's delete.
        console.log(`  🗑️  ${weekId} → ${monday.toISOString().slice(0, 10)} (${monday.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })})`);
        if (!DRY_RUN) {
          await db.deleteDoc(`${weeksPath}/${weekId}`);
        }
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`  → ${deleted} week(s) ${DRY_RUN ? 'would be deleted' : 'deleted'}`);
    } else {
      console.log(`  ✓ All weeks within cutoff`);
    }
    totalDeleted += deleted;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  TOTAL: ${totalDeleted} week documents ${DRY_RUN ? 'would be deleted' : 'deleted'}`);
  if (DRY_RUN) console.log('  ℹ️  Re-run with --apply to delete.');
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
