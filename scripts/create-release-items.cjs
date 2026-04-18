/**
 * Create backlog items for 1.7 - Events and Roles & Security releases.
 * Run with: node scripts/create-release-items.cjs
 */

const db = require('./firestore-admin.cjs');

const BACKLOG_PATH = 'artifacts/production/public/data/backlog';
const SLICE_17 = 'slice-1775672452734-1'; // 1.7 - Events slice from story map
const NOW = new Date().toISOString();

const items = [
  // ── 1.7 - Events ──
  {
    number: 1150,
    title: 'Extract inline components from App.tsx',
    desc: 'Extract PersonalSchedule, MobileScrollView, and SessionDetailSheet from App.tsx into separate component files under src/components/. App.tsx orchestrates; rendering lives in components. Target: App.tsx under 800 lines.',
    notes: 'Retro 1.6 action item. App.tsx is 1700+ lines with 3 inline components. Every feature change touches dozens of locations. This is the #1 refactoring priority. Prerequisite for clean event card integration.',
    acceptance: '1. PersonalSchedule.tsx, MobileScrollView.tsx, SessionDetailSheet.tsx exist as separate files\n2. App.tsx imports and renders them — no inline component definitions\n3. App.tsx under 800 lines\n4. Build passes, no regressions',
    release: '1.7 - Events',
    releaseSliceId: SLICE_17,
    tag: 'refactoring',
    priority: 'High',
    order: 147,
  },
  {
    number: 1151,
    title: 'Event entity model and Firestore collection',
    desc: 'Create an Event TypeScript interface and Firestore collection at artifacts/production/public/data/events/{docId}. Events are one-off activities like tournaments, seminars, and social gatherings. Fields: id, title, type (tournament/seminar/social/other), discipline, date, endDate, startTime, endTime, location, address, description, organiser, url, cost, registrationDeadline, createdBy.',
    notes: 'Different from catalogue classes which are recurring weekly. Events are one-off or multi-day. Reuse the existing catalogue colour system for discipline tagging. Security: readable by team members, writable by admin/coach (initially).',
    acceptance: '1. Event interface defined in src/types/\n2. Firestore collection exists with security rules (team read, admin/coach write)\n3. Seed script with 3–5 real upcoming events (DM i Brydning, seminars, etc.)\n4. useEvents hook with onSnapshot subscription',
    release: '1.7 - Events',
    releaseSliceId: SLICE_17,
    tag: 'General',
    priority: 'High',
    order: 148,
  },
  {
    number: 1152,
    title: 'Event list view',
    desc: 'A dedicated Events page showing upcoming events in chronological order. Each event card shows: title, type badge (tournament/seminar/social), date, location, discipline, and who from the team has signed up. Past events collapse or move to a "Tidligere" section.',
    notes: 'Mobile-first card list. Accessible from the main menu. Consider grouping by month. Reuse the design system card pattern from catalogue and schedule views.',
    acceptance: '1. Events page accessible from the main menu\n2. Upcoming events shown chronologically with card layout\n3. Past events separated or collapsed\n4. Event type shown as a colour-coded badge\n5. Team participation visible (who has signed up)\n6. Dark/light theme support',
    release: '1.7 - Events',
    releaseSliceId: SLICE_17,
    tag: 'General',
    priority: 'High',
    order: 149,
  },
  {
    number: 1153,
    title: 'Event detail view and sign-up',
    desc: 'Tap an event card to see full details: description, organiser, cost, registration deadline, address with Google Maps link, URL. Team members can register interest (Interesseret), sign up (Tilmeldt), or decline (Ikke interesseret). Status visible to the whole team.',
    notes: 'Builds on #1049 acceptance criteria: all members can register interest, sign up, or decline. Other team members can see who has taken action. Registration status stored per fighter on the event document.',
    acceptance: '1. Detail view shows all event fields\n2. Three-state sign-up: Interesseret / Tilmeldt / Ikke interesseret\n3. Team can see each member\'s status on the event\n4. Google Maps link on address\n5. External URL link for registration page\n6. Registration deadline shown with warning if close',
    release: '1.7 - Events',
    releaseSliceId: SLICE_17,
    tag: 'General',
    priority: 'High',
    order: 150,
  },
  {
    number: 1154,
    title: 'Events in schedule view',
    desc: 'When a fighter signs up for (Tilmeldt) or shows interest in an event, it appears on the relevant day(s) in their personal schedule. Shown as a distinct card type (different from training sessions and fravær) — e.g. a purple/teal event card with the event title, time, and type badge.',
    notes: 'Relates to #1049 AC3 and #1149 "Add event to calendar". Events should also be visible in team view so the coach sees who is competing when. Multi-day events show on each day with day count.',
    acceptance: '1. Signed-up events appear on the correct day(s) in the personal schedule\n2. Event cards are visually distinct from training sessions\n3. Events visible in team view for signed-up fighters\n4. Multi-day events show on each day with day count',
    release: '1.7 - Events',
    releaseSliceId: SLICE_17,
    tag: 'General',
    priority: 'Medium',
    order: 151,
  },

  // ── Roles & Security (separate release, for later) ──
  {
    number: 1155,
    title: 'Firestore role config document',
    desc: 'Move role definitions (admin, coach, team-member, fighter-name mapping) from hardcoded firestore.rules to a Firestore document at artifacts/production/public/config/roles. Document structure: { admins: [email], coaches: [email], members: { email: fighterName } }. Security rules read from this doc instead of inline email lists.',
    notes: 'Tech debt called out in firestore.rules comments. Unblocks adding/removing fighters without redeploying rules. The config path already has read rules for authenticated users.',
    acceptance: '1. Role document exists at artifacts/production/public/config/roles with current team data\n2. firestore.rules functions (isAdmin, isCoach, isTeamMember, fighterNameForEmail) read from the config doc\n3. Existing security behaviour preserved — no permission changes\n4. Seed script populates the config doc from current hardcoded values',
    release: 'Roles & Security',
    releaseSliceId: '',
    tag: 'General',
    priority: 'High',
    order: 152,
  },
  {
    number: 1156,
    title: 'Update security rules to use config doc',
    desc: 'Rewrite firestore.rules so isAdmin(), isCoach(), isTeamMember(), and fighterNameForEmail() use get() to read from the roles config document instead of hardcoded email lists. Validate with Firebase emulator or rules playground before deploying.',
    notes: 'Firestore rules support get() to read other documents. The config doc path is artifacts/production/public/config/roles. Must handle the case where the config doc doesn\'t exist (deny all as safe default). Deploy via Firebase Rules REST API (no CLI).',
    acceptance: '1. All four role functions read from Firestore config doc\n2. Rules deny access if config doc is missing (safe default)\n3. Verified in Firebase Rules Playground with existing team emails\n4. Deployed to production without downtime',
    release: 'Roles & Security',
    releaseSliceId: '',
    tag: 'General',
    priority: 'High',
    order: 153,
  },
  {
    number: 1157,
    title: 'Admin UI for role management',
    desc: 'Add a "Roles" page in the admin area (BacklogPage sidebar) where the admin can view and edit team members, assign roles (admin, coach, member), and map emails to fighter names. Changes write to the Firestore config doc at artifacts/production/public/config/roles.',
    notes: 'Only admin can write to config. Consider a simple table/list UI — add member (email + name), assign role checkboxes, remove member. No need for complex UX — this is admin-only.',
    acceptance: '1. Admin can see all current team members with their roles\n2. Admin can add a new member (email + fighter name + role)\n3. Admin can change a member\'s role\n4. Admin can remove a member\n5. Changes persist to Firestore config doc immediately\n6. App constants (FIGHTERS, USER_MAPPING) read from config doc instead of hardcoded arrays',
    release: 'Roles & Security',
    releaseSliceId: '',
    tag: 'General',
    priority: 'Medium',
    order: 154,
  },
];

async function main() {
  console.log('🔐 Authenticating...');
  await db.init();
  console.log('  ✅ Authenticated\n');

  console.log(`Creating ${items.length} backlog items...\n`);

  for (const item of items) {
    const doc = {
      ...item,
      _id: '', // will be set by Firestore
      status: 'backlog',
      desc: item.desc || '',
      notes: item.notes || '',
      acceptance: item.acceptance || '',
      mapOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };

    try {
      const result = await db.addDoc(BACKLOG_PATH, doc);
      console.log(`  ✅ #${item.number} — ${item.title} (${result._id || result.id || 'ok'})`);
    } catch (err) {
      console.log(`  ❌ #${item.number} — ${err.message}`);
    }
  }

  console.log('\nDone!');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
