#!/usr/bin/env node
/**
 * #1194 — Delete LEGACY name-keyed schedule docs left behind by #1191.
 *
 *   artifacts/production/users/{fighterName}/...   (DELETE)
 *   artifacts/production/users/{email}/...         (KEEP — live, email-keyed)
 *
 * Only deletes the exact doc groups #1191 copied: weeks/*, templates/standard, meta/notes.
 * Targets ONLY name-keyed paths (where name !== email). Email-keyed live data is never touched.
 * Safety: BEFORE deleting a name-keyed doc, it confirms the email-keyed copy EXISTS.
 *
 * Usage:
 *   node scripts/cleanup-legacy-name-paths.cjs            # dry-run (default) — lists what WOULD delete
 *   node scripts/cleanup-legacy-name-paths.cjs --apply    # actually delete
 *   node scripts/cleanup-legacy-name-paths.cjs --only=San # restrict to one fighter (name)
 */
const db = require('./firestore-admin.cjs');

const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1] : null;

const ROOT = 'artifacts/production/users';
const ROLES_PATH = 'artifacts/production/public/data/config/roles';

async function considerDelete(namePath, emailPath, label, stats) {
  const data = await db.readDoc(namePath);
  if (data === null) return; // legacy doc doesn't exist — nothing to delete
  // SAFETY: only delete the legacy copy if the email-keyed copy exists.
  const emailCopy = await db.readDoc(emailPath);
  if (emailCopy === null) {
    stats.skippedNoCopy++;
    console.log(`  ⚠ SKIP ${label}: ${namePath} (no email-keyed copy at ${emailPath})`);
    return;
  }
  stats.found++;
  if (APPLY) {
    await db.deleteDoc(namePath);
    stats.deleted++;
    console.log(`  ✗ ${label}: DELETED ${namePath}`);
  } else {
    console.log(`  • ${label}: would delete ${namePath}`);
  }
}

async function run() {
  await db.init();

  const roles = await db.readDoc(ROLES_PATH);
  if (!roles || !roles.members) {
    console.error('❌ Could not read roles config (members map) at ' + ROLES_PATH);
    process.exit(1);
  }

  const pairs = Object.entries(roles.members).map(([email, name]) => ({ name, email: email.toLowerCase() }));

  console.log(`\n${APPLY ? 'APPLYING DELETE' : 'DRY-RUN'} of legacy name-keyed docs for ${pairs.length} member(s)`);
  if (ONLY) console.log(`(restricted to: ${ONLY})`);
  console.log('');

  const stats = { found: 0, deleted: 0, skippedNoCopy: 0 };

  for (const { name, email } of pairs) {
    if (ONLY && name !== ONLY) continue;
    if (name === email) { console.log(`- ${name}: already email-keyed (no legacy path), skipping`); continue; }
    console.log(`- ${name}  (email: ${email})`);

    // 1. weeks/* (a collection)
    let weeks = [];
    try { weeks = await db.listCollection(`${ROOT}/${name}/weeks`); }
    catch (e) { console.log(`    (no weeks collection: ${e.message.slice(0, 60)})`); }
    for (const w of weeks) {
      const id = w._id;
      await considerDelete(`${ROOT}/${name}/weeks/${id}`, `${ROOT}/${email}/weeks/${id}`, `week ${id}`, stats);
    }

    // 2. templates/standard
    await considerDelete(`${ROOT}/${name}/templates/standard`, `${ROOT}/${email}/templates/standard`, 'template', stats);

    // 3. meta/notes
    await considerDelete(`${ROOT}/${name}/meta/notes`, `${ROOT}/${email}/meta/notes`, 'notes', stats);
  }

  console.log('');
  if (APPLY) {
    console.log(`✅ Done. Deleted ${stats.deleted} legacy doc(s). Skipped ${stats.skippedNoCopy} (no email copy).`);
  } else {
    console.log(`Dry-run complete. ${stats.found} legacy doc(s) would be deleted. ${stats.skippedNoCopy} skipped (no email copy).`);
    console.log('Re-run with --apply to perform the delete.');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
