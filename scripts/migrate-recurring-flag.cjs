/**
 * migrate-recurring-flag.cjs
 * 
 * One-time, idempotent migration to unify the recurring session data model.
 * Stamps `isRecurring: true` and `recurrenceInterval: 1` (default) on:
 *   1. Template sessions in `templates/standard` that lack these fields
 *   2. Week sessions in `weeks/week_*` that match a template entry by day|name|start
 *
 * Safe to run against production — all changes are additive (new fields only).
 * The current production code ignores these fields entirely.
 *
 * Usage:
 *   node scripts/migrate-recurring-flag.cjs              # dry-run (default)
 *   node scripts/migrate-recurring-flag.cjs --apply      # write changes
 *   node scripts/migrate-recurring-flag.cjs --fighter=Rune          # single fighter dry-run
 *   node scripts/migrate-recurring-flag.cjs --fighter=Rune --apply  # single fighter write
 */

const db = require('./firestore-admin.cjs');

const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl', 'Frode', 'Frodi', 'Rune'];
const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const FIGHTER_FILTER = args.find(a => a.startsWith('--fighter='))?.split('=')[1] || null;

async function migrateFighter(name) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Fighter: ${name}`);
  console.log('═'.repeat(60));

  // ── Step 1: Read & enrich template ──
  const templatePath = db.PATHS.userTemplate(name);
  const template = await db.readDoc(templatePath);

  if (!template) {
    console.log('  ⚠️  No template found — skipping');
    return { templateUpdated: false, weeksUpdated: 0, sessionsStamped: 0 };
  }

  // Build programKeys set from template (before mutation)
  const programKeys = new Set();
  let templateChanged = false;
  const enrichedTemplate = { ...template };

  for (const day of DAYS) {
    const sessions = enrichedTemplate[day];
    if (!Array.isArray(sessions)) continue;

    for (const s of sessions) {
      if (s.isRestDay) continue;
      const key = `${day}|${(s.name || '').toLowerCase()}|${s.start || ''}`;
      programKeys.add(key);

      // Stamp isRecurring if missing
      if (!s.isRecurring) {
        s.isRecurring = true;
        templateChanged = true;
        console.log(`  📋 Template: ${day} "${s.name}" ${s.start} → isRecurring: true`);
      }
      // Stamp recurrenceInterval if missing (default = 1 = every week)
      if (!s.recurrenceInterval) {
        s.recurrenceInterval = 1;
        templateChanged = true;
        console.log(`  📋 Template: ${day} "${s.name}" ${s.start} → recurrenceInterval: 1`);
      }
    }
  }

  if (templateChanged && !DRY_RUN) {
    enrichedTemplate.lastUpdated = new Date().toISOString();
    await db.writeDoc(templatePath, enrichedTemplate);
    console.log('  ✅ Template saved');
  } else if (templateChanged) {
    console.log('  🔍 Template would be updated (dry-run)');
  } else {
    console.log('  ✓  Template already up to date');
  }

  // ── Step 2: Scan all week documents ──
  const weeksPath = `artifacts/production/users/${name}/weeks`;
  const weekDocs = await db.listCollection(weeksPath);

  let weeksUpdated = 0;
  let sessionsStamped = 0;

  for (const weekDoc of weekDocs) {
    const weekId = weekDoc._id;
    const weekPath = `${weeksPath}/${weekId}`;
    let weekChanged = false;

    for (const day of DAYS) {
      const sessions = weekDoc[day];
      if (!Array.isArray(sessions)) continue;

      for (const s of sessions) {
        if (s.isRestDay) continue;
        if (s.isRecurring) continue; // already stamped

        const key = `${day}|${(s.name || '').toLowerCase()}|${s.start || ''}`;
        if (programKeys.has(key)) {
          s.isRecurring = true;
          weekChanged = true;
          sessionsStamped++;
          console.log(`  📅 ${weekId} ${day} "${s.name}" ${s.start} → isRecurring: true`);
        }
      }
    }

    if (weekChanged) {
      weeksUpdated++;
      if (!DRY_RUN) {
        weekDoc.lastUpdated = new Date().toISOString();
        // Remove _id before writing back (it's metadata from listCollection)
        const toWrite = { ...weekDoc };
        delete toWrite._id;
        await db.writeDoc(weekPath, toWrite);
        console.log(`  ✅ ${weekId} saved`);
      } else {
        console.log(`  🔍 ${weekId} would be updated (dry-run)`);
      }
    }
  }

  console.log(`\n  Summary: template=${templateChanged ? 'updated' : 'ok'}, weeks=${weeksUpdated}, sessions=${sessionsStamped}`);
  return { templateUpdated: templateChanged, weeksUpdated, sessionsStamped };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Migration: Stamp isRecurring on program sessions       ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : '⚡ APPLY (writing to Firestore)'}${DRY_RUN ? '       ' : '  '}║`);
  if (FIGHTER_FILTER) {
    console.log(`║  Fighter: ${FIGHTER_FILTER.padEnd(46)}║`);
  }
  console.log('╚══════════════════════════════════════════════════════════╝');

  await db.init();

  const fighters = FIGHTER_FILTER ? [FIGHTER_FILTER] : FIGHTERS;
  const totals = { templates: 0, weeks: 0, sessions: 0 };

  for (const fighter of fighters) {
    if (FIGHTER_FILTER && fighter !== FIGHTER_FILTER) continue;
    const result = await migrateFighter(fighter);
    if (result.templateUpdated) totals.templates++;
    totals.weeks += result.weeksUpdated;
    totals.sessions += result.sessionsStamped;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  TOTAL: ${totals.templates} templates, ${totals.weeks} weeks, ${totals.sessions} sessions`);
  if (DRY_RUN) {
    console.log('  ℹ️  This was a dry run. Re-run with --apply to write changes.');
  } else {
    console.log('  ✅ All changes written to Firestore.');
  }
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
