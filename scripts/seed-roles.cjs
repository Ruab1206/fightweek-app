#!/usr/bin/env node
/**
 * seed-roles.cjs — Populate the Firestore roles config document.
 *
 * Writes the current team role data to:
 *   artifacts/production/public/config/roles
 *
 * Document structure:
 *   { admins: [email], coaches: [email], members: { email: fighterName } }
 *
 * Usage:
 *   node scripts/seed-roles.cjs           # write roles config
 *   node scripts/seed-roles.cjs --dry-run # print what would be written
 */

const db = require('./firestore-admin.cjs');

const CONFIG_PATH = 'artifacts/production/public/data/config/roles';

// Current team data — mirrors USER_MAPPING + FIGHTERS in constants.ts
const ROLES_CONFIG = {
  admins: ['rune.abrahamsson@gmail.com'],
  coaches: ['frodihansen@hotmail.com'],
  members: {
    'carolinemollerh@gmail.com': 'Caroline',
    'sankarem00@gmail.com': 'San',
    'eneasopa354@gmail.com': 'Enea',
    'anton.emil.bang@gmail.com': 'Anton',
    'duraceljones@gmail.com': 'Jonas',
    'karl.lindsgren@gmail.com': 'Karl',
    'frode.lindsgren@gmail.com': 'Frode',
    'frodihansen@hotmail.com': 'Frodi',
    'rune.abrahamsson@gmail.com': 'Rune',
  },
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('DRY RUN — would write to:', CONFIG_PATH);
    console.log(JSON.stringify(ROLES_CONFIG, null, 2));
    return;
  }

  await db.init();

  // Check if document already exists
  const existing = await db.readDoc(CONFIG_PATH);
  if (existing && existing.admins) {
    console.log('⚠️  Roles config already exists at', CONFIG_PATH);
    console.log('   Existing admins:', existing.admins);
    console.log('   Existing coaches:', existing.coaches);
    console.log('   Existing members:', Object.keys(existing.members || {}).length);

    if (!process.argv.includes('--force')) {
      console.log('\n   Use --force to overwrite.');
      return;
    }
    console.log('   --force specified, overwriting...');
  }

  await db.writeDoc(CONFIG_PATH, ROLES_CONFIG);
  console.log('✅ Roles config written to', CONFIG_PATH);

  // Verify by reading back
  const verify = await db.readDoc(CONFIG_PATH);
  console.log('   Admins:', verify.admins);
  console.log('   Coaches:', verify.coaches);
  console.log('   Members:', Object.keys(verify.members || {}).length);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
