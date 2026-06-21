#!/usr/bin/env node
/**
 * #1191 — Migrate per-fighter schedule data from NAME-keyed paths to EMAIL-keyed paths.
 *
 *   artifacts/production/users/{fighterName}/...  ->  artifacts/production/users/{email}/...
 *
 * Non-destructive: COPIES every doc (weeks/*, templates/standard, meta/notes) to the
 * email-keyed path and leaves the original name-keyed docs untouched. Old paths are
 * cleaned up only later, after the app is verified on the new paths (acceptance #6).
 *
 * The name->email map is read from the live roles config doc
 *   artifacts/production/public/data/config/roles  (members: { email: name }).
 *
 * Usage:
 *   node scripts/migrate-to-email-paths.cjs            # dry-run (default) — shows what WOULD copy
 *   node scripts/migrate-to-email-paths.cjs --apply    # actually copy
 *   node scripts/migrate-to-email-paths.cjs --only=San # restrict to one fighter (name)
 */
const db = require('./firestore-admin.cjs');

const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1] : null;

const ROOT = 'artifacts/production/users';
const ROLES_PATH = 'artifacts/production/public/data/config/roles';

function strip(data) {
  if (!data) return data;
  const { _id, ...rest } = data;
  return rest;
}

async function copyDoc(fromPath, toPath, label, stats) {
  const data = await db.readDoc(fromPath);
  if (data === null) return; // nothing to copy
  stats.found++;
  if (APPLY) {
    await db.writeDoc(toPath, strip(data));
    stats.copied++;
    console.log(`  ✓ ${label}: ${fromPath} -> ${toPath}`);
  } else {
    console.log(`  • ${label}: ${fromPath} -> ${toPath}`);
  }
}

async function run() {
  await db.init();

  const roles = await db.readDoc(ROLES_PATH);
  if (!roles || !roles.members) {
    console.error('❌ Could not read roles config (members map) at ' + ROLES_PATH);
    process.exit(1);
  }

  // members: { email: name }  ->  pairs of [name, email]
  const pairs = Object.entries(roles.members).map(([email, name]) => ({ name, email: email.toLowerCase() }));

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY-RUN'} migration name -> email for ${pairs.length} member(s)`);
  if (ONLY) console.log(`(restricted to: ${ONLY})`);
  console.log('');

  const stats = { found: 0, copied: 0 };

  for (const { name, email } of pairs) {
    if (ONLY && name !== ONLY) continue;
    if (name === email) { console.log(`- ${name}: already email-keyed, skipping`); continue; }
    console.log(`- ${name}  ->  ${email}`);

    // 1. weeks/* (a collection)
    let weeks = [];
    try { weeks = await db.listCollection(`${ROOT}/${name}/weeks`); }
    catch (e) { console.log(`    (no weeks collection: ${e.message.slice(0, 60)})`); }
    for (const w of weeks) {
      const id = w._id;
      await copyDoc(`${ROOT}/${name}/weeks/${id}`, `${ROOT}/${email}/weeks/${id}`, `week ${id}`, stats);
    }

    // 2. templates/standard
    await copyDoc(`${ROOT}/${name}/templates/standard`, `${ROOT}/${email}/templates/standard`, 'template', stats);

    // 3. meta/notes
    await copyDoc(`${ROOT}/${name}/meta/notes`, `${ROOT}/${email}/meta/notes`, 'notes', stats);
  }

  console.log('');
  if (APPLY) {
    console.log(`✅ Done. Copied ${stats.copied} of ${stats.found} source doc(s) to email paths.`);
  } else {
    console.log(`Dry-run complete. ${stats.found} source doc(s) would be copied.`);
    console.log('Re-run with --apply to perform the copy.');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
