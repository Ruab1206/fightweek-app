/**
 * Firestore security-rules characterization harness — Phase 3 (eventLogs privacy).
 *
 * WHAT THIS IS
 *   A BASELINE characterization of the CURRENT `firestore.rules`. It pins what
 *   the rules do TODAY — including the known eventLogs read leak to team
 *   members — so the subsequent rules-change step can be verified as an
 *   intentional, reviewed behavior change rather than an accident.
 *   All tests here are expected to be GREEN against the current rules.
 *
 * WHAT HAPPENS NEXT (not in this commit)
 *   In the following step, the eventLogs expectations marked "CURRENT LEAK" /
 *   "characterizes current behavior" will be REPLACED with the target
 *   private-by-default expectations (owner read/write; admin read-only;
 *   coach/other/team/anon denied), and firestore.rules will be updated.
 *
 * SAFETY
 *   - Runs ONLY against a local Firestore emulator (never production).
 *   - Uses an obviously synthetic `demo-` project id. The `demo-` prefix forces
 *     the Firebase SDK into offline/demo mode; it cannot reach a real project.
 *   - No service-account files, no real credentials, no production Firebase.
 *   - Fails fast if FIRESTORE_EMULATOR_HOST is not set (i.e. not launched via
 *     `firebase emulators:exec` / `npm run test:rules`).
 *
 * FIXTURE (roles doc) — default, used by the top-level `beforeEach`:
 *   admins:  [admin@x]
 *   coaches: [coach@x]
 *   members: { owner@x, other@x }
 *   Here admin@x and coach@x are NOT in `members`, so isTeamMember() is FALSE
 *   for them under this default fixture.
 *
 * ROLE OVERLAP
 *   The rules document models admins[], coaches[] and members{} as INDEPENDENT
 *   collections — a person MAY appear in more than one. Rather than assuming
 *   admin/coach are (or are not) also members, this suite explicitly proves
 *   BOTH combinations against the actual rules, for both a representative
 *   user-scoped path (`weeks`) and `eventLogs`:
 *     - administrator who is NOT a member
 *     - administrator who IS ALSO a member
 *     - coach who is NOT a member
 *     - coach who IS ALSO a member
 *   See the "Role overlap" describe blocks below, each with its own
 *   `beforeEach` that re-seeds the roles doc for that specific scenario.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-fightweek-rules'; // synthetic; `demo-` => offline mode
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

// ── Fixture paths ────────────────────────────────────────────────────────────
const ROLES_DOC = 'artifacts/production/public/data/config/roles';
const OWNER = 'owner@x';
const P = {
  week: `artifacts/production/users/${OWNER}/weeks/week_10`,
  template: `artifacts/production/users/${OWNER}/templates/standard`,
  notes: `artifacts/production/users/${OWNER}/meta/notes`,
  notifications: `artifacts/production/users/${OWNER}/meta/notifications`,
  eventLog: `artifacts/production/users/${OWNER}/eventLogs/log1`,
  // Not a real app path. Stands in for ANY future user-scoped subcollection
  // that is currently reachable ONLY via the recursive `{document=**}` rule.
  // Included so the impact of later narrowing the wildcard is explicit.
  unenumerated: `artifacts/production/users/${OWNER}/goals/g1`,
};

let testEnv: RulesTestEnvironment;

/** Firestore handle for an authenticated email, or unauthenticated when null. */
function as(email: string | null) {
  const context = email
    ? testEnv.authenticatedContext(email, { email })
    : testEnv.unauthenticatedContext();
  return context.firestore();
}

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. These rules tests must run against a ' +
        'local Firestore emulator. Use `npm run test:rules` (which launches the ' +
        'emulator via `firebase emulators:exec`). Refusing to run without an emulator.',
    );
  }
  if (!PROJECT_ID.startsWith('demo-')) {
    throw new Error('Refusing to run: project id must be a synthetic `demo-` id.');
  }
  const [hostname, portStr] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: hostname,
      port: Number(portStr),
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed representative documents with security rules DISABLED.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, ROLES_DOC), {
      admins: ['admin@x'],
      coaches: ['coach@x'],
      members: { 'owner@x': 'Owner', 'other@x': 'Other' },
    });
    await setDoc(doc(db, P.week), { day: 'Mandag' });
    await setDoc(doc(db, P.template), { seeded: true });
    await setDoc(doc(db, P.notes), { updatedAt: '2026-08-14' });
    await setDoc(doc(db, P.notifications), { lastSeen: '2026-08-14' });
    await setDoc(doc(db, P.eventLog), { id: 'log1' });
    await setDoc(doc(db, P.unenumerated), { placeholder: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Team-readable, owner/admin/coach-writable user paths.
// This task explicitly does NOT change access to these paths.
// ─────────────────────────────────────────────────────────────────────────────
const TEAM_READ_PATHS: Array<[string, keyof typeof P]> = [
  ['weeks/week_10', 'week'],
  ['templates/standard', 'template'],
  ['meta/notes', 'notes'],
  ['meta/notifications', 'notifications'],
];

describe('CURRENT rules — weeks / templates / meta (behavior preserved by this task)', () => {
  for (const [label, key] of TEAM_READ_PATHS) {
    const path = P[key];
    describe(label, () => {
      it('owner can read', async () => {
        await assertSucceeds(getDoc(doc(as(OWNER), path)));
      });
      it('owner can write', async () => {
        await assertSucceeds(setDoc(doc(as(OWNER), path), { touched: 1 }));
      });
      it('other team member can read', async () => {
        await assertSucceeds(getDoc(doc(as('other@x'), path)));
      });
      it('other team member cannot write', async () => {
        await assertFails(setDoc(doc(as('other@x'), path), { touched: 1 }));
      });
      // admin@x / coach@x are NOT in `members` in this fixture → isTeamMember()
      // is false → they currently CANNOT READ these paths. They CAN WRITE via
      // isAdminOrCoach(). This is accurate current behavior and is unchanged by
      // this task.
      it('admin (not a member) currently cannot read', async () => {
        await assertFails(getDoc(doc(as('admin@x'), path)));
      });
      it('admin can write (isAdminOrCoach)', async () => {
        await assertSucceeds(setDoc(doc(as('admin@x'), path), { touched: 1 }));
      });
      it('coach (not a member) currently cannot read', async () => {
        await assertFails(getDoc(doc(as('coach@x'), path)));
      });
      it('coach can write (isAdminOrCoach)', async () => {
        await assertSucceeds(setDoc(doc(as('coach@x'), path), { touched: 1 }));
      });
      it('authenticated non-team user cannot read', async () => {
        await assertFails(getDoc(doc(as('rando@x'), path)));
      });
      it('authenticated non-team user cannot write', async () => {
        await assertFails(setDoc(doc(as('rando@x'), path), { touched: 1 }));
      });
      it('unauthenticated cannot read', async () => {
        await assertFails(getDoc(doc(as(null), path)));
      });
      it('unauthenticated cannot write', async () => {
        await assertFails(setDoc(doc(as(null), path), { touched: 1 }));
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// eventLogs — CHARACTERIZES THE CURRENT LEAK. These expectations pin CURRENT
// behavior and are expected to be GREEN. They will be REPLACED with the target
// private-by-default expectations in the subsequent rules-change step.
//
// Under the CURRENT recursive `{document=**}` rule, eventLogs are treated
// exactly like weeks/templates/meta (team read; owner/admin/coach write).
// ─────────────────────────────────────────────────────────────────────────────
describe('CURRENT rules — eventLogs (CHARACTERIZES CURRENT LEAK; to be replaced)', () => {
  it('owner can read [target: KEEP]', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), P.eventLog)));
  });
  it('owner can write [target: KEEP]', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), P.eventLog), { id: 'log1' }));
  });

  // THE LEAK: a plain team member can currently read another fighter's private
  // training log. Target after the rules change: DENY.
  it('CURRENT LEAK: other team member can read a private log [target: DENY]', async () => {
    await assertSucceeds(getDoc(doc(as('other@x'), P.eventLog)));
  });
  it('other team member cannot write [target: keep denied]', async () => {
    await assertFails(setDoc(doc(as('other@x'), P.eventLog), { id: 'x' }));
  });

  // admin@x is NOT in `members` in this fixture → currently CANNOT READ the log
  // (isTeamMember() false). admin CAN currently WRITE via isAdminOrCoach().
  // Target: admin READ-ONLY (read via explicit isAdmin(); no write).
  it('admin today: cannot read (not a member) [target: ALLOW read]', async () => {
    await assertFails(getDoc(doc(as('admin@x'), P.eventLog)));
  });
  it('admin today: CAN write via isAdminOrCoach [target: DENY write]', async () => {
    await assertSucceeds(setDoc(doc(as('admin@x'), P.eventLog), { id: 'x' }));
  });

  // coach@x is NOT in `members` → currently CANNOT READ. coach CAN currently
  // WRITE via isAdminOrCoach(). Target: coach fully denied (no read, no write).
  it('coach today: cannot read (not a member) [target: DENY]', async () => {
    await assertFails(getDoc(doc(as('coach@x'), P.eventLog)));
  });
  it('coach today: CAN write via isAdminOrCoach [target: DENY write]', async () => {
    await assertSucceeds(setDoc(doc(as('coach@x'), P.eventLog), { id: 'x' }));
  });

  it('authenticated non-team user cannot read [target: keep denied]', async () => {
    await assertFails(getDoc(doc(as('rando@x'), P.eventLog)));
  });
  it('authenticated non-team user cannot write [target: keep denied]', async () => {
    await assertFails(setDoc(doc(as('rando@x'), P.eventLog), { id: 'x' }));
  });
  it('unauthenticated cannot read [target: keep denied]', async () => {
    await assertFails(getDoc(doc(as(null), P.eventLog)));
  });
  it('unauthenticated cannot write [target: keep denied]', async () => {
    await assertFails(setDoc(doc(as(null), P.eventLog), { id: 'x' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FUTURE TARGET EXPECTATIONS (documented only — NOT implemented in this commit;
// firestore.rules and these tests are unchanged by this step). The next
// rules-change step must make eventLogs behavior independent of role overlap:
//
//   - owner:                       read/write
//   - administrator:               read-only, REGARDLESS of membership overlap
//   - coach:                       denied (read AND write), EVEN IF also a member
//   - other member/fighter:        denied
//   - authenticated non-team user: denied
//   - unauthenticated user:        denied
//
// The "Role overlap" blocks below prove that TODAY, admin/coach read access to
// eventLogs depends entirely on incidental team membership (isTeamMember()),
// not on their admin/coach role — which is exactly what the target step must
// stop relying on.
// ─────────────────────────────────────────────────────────────────────────────

/** Overwrite the roles doc (rules disabled) for one specific overlap scenario. */
async function seedRoles(members: Record<string, string>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), ROLES_DOC), {
      admins: ['admin@x'],
      coaches: ['coach@x'],
      members,
    });
  });
}

describe('Role overlap — administrator who is NOT a member', () => {
  beforeEach(async () => {
    await seedRoles({ 'owner@x': 'Owner', 'other@x': 'Other' }); // admin@x absent
  });

  it('read user-scoped path (weeks) denied — isTeamMember() false', async () => {
    await assertFails(getDoc(doc(as('admin@x'), P.week)));
  });
  it('write user-scoped path (weeks) allowed — isAdminOrCoach()', async () => {
    await assertSucceeds(setDoc(doc(as('admin@x'), P.week), { touched: 1 }));
  });
  it('read eventLogs denied — isTeamMember() false [target: ALLOW read]', async () => {
    await assertFails(getDoc(doc(as('admin@x'), P.eventLog)));
  });
  it('write eventLogs allowed via isAdminOrCoach() [target: DENY write]', async () => {
    await assertSucceeds(setDoc(doc(as('admin@x'), P.eventLog), { id: 'x' }));
  });
});

describe('Role overlap — administrator who IS ALSO a member', () => {
  beforeEach(async () => {
    await seedRoles({ 'owner@x': 'Owner', 'other@x': 'Other', 'admin@x': 'Admin' });
  });

  it('read user-scoped path (weeks) allowed — isTeamMember() true', async () => {
    await assertSucceeds(getDoc(doc(as('admin@x'), P.week)));
  });
  it('write user-scoped path (weeks) allowed — isAdminOrCoach()', async () => {
    await assertSucceeds(setDoc(doc(as('admin@x'), P.week), { touched: 1 }));
  });
  it('CURRENT LEAK: read eventLogs allowed via isTeamMember(), not admin role [target: KEEP read, but via isAdmin() not membership]', async () => {
    await assertSucceeds(getDoc(doc(as('admin@x'), P.eventLog)));
  });
  it('write eventLogs allowed via isAdminOrCoach() [target: DENY write]', async () => {
    await assertSucceeds(setDoc(doc(as('admin@x'), P.eventLog), { id: 'x' }));
  });
});

describe('Role overlap — coach who is NOT a member', () => {
  beforeEach(async () => {
    await seedRoles({ 'owner@x': 'Owner', 'other@x': 'Other' }); // coach@x absent
  });

  it('read user-scoped path (weeks) denied — isTeamMember() false', async () => {
    await assertFails(getDoc(doc(as('coach@x'), P.week)));
  });
  it('write user-scoped path (weeks) allowed — isAdminOrCoach()', async () => {
    await assertSucceeds(setDoc(doc(as('coach@x'), P.week), { touched: 1 }));
  });
  it('read eventLogs denied — isTeamMember() false [target: keep denied]', async () => {
    await assertFails(getDoc(doc(as('coach@x'), P.eventLog)));
  });
  it('write eventLogs allowed via isAdminOrCoach() [target: DENY write]', async () => {
    await assertSucceeds(setDoc(doc(as('coach@x'), P.eventLog), { id: 'x' }));
  });
});

describe('Role overlap — coach who IS ALSO a member', () => {
  beforeEach(async () => {
    await seedRoles({ 'owner@x': 'Owner', 'other@x': 'Other', 'coach@x': 'Coach' });
  });

  it('read user-scoped path (weeks) allowed — isTeamMember() true', async () => {
    await assertSucceeds(getDoc(doc(as('coach@x'), P.week)));
  });
  it('write user-scoped path (weeks) allowed — isAdminOrCoach()', async () => {
    await assertSucceeds(setDoc(doc(as('coach@x'), P.week), { touched: 1 }));
  });
  it('CURRENT LEAK: read eventLogs allowed via isTeamMember() [target: DENY, even though also a member]', async () => {
    await assertSucceeds(getDoc(doc(as('coach@x'), P.eventLog)));
  });
  it('write eventLogs allowed via isAdminOrCoach() [target: DENY write]', async () => {
    await assertSucceeds(setDoc(doc(as('coach@x'), P.eventLog), { id: 'x' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unenumerated user path via the recursive `{document=**}` wildcard.
// Makes the impact of narrowing the wildcard explicit: TODAY this arbitrary
// path inherits team-read / owner-write; after narrowing (enumerating
// weeks/templates/meta/eventLogs) it will be DENIED unless explicitly added.
// ─────────────────────────────────────────────────────────────────────────────
describe('CURRENT rules — unenumerated path via recursive wildcard (narrowing impact)', () => {
  it('owner can currently read an unenumerated path [target after narrowing: DENY]', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), P.unenumerated)));
  });
  it('owner can currently write an unenumerated path [target after narrowing: DENY]', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), P.unenumerated), { x: 1 }));
  });
  it('other team member can currently read an unenumerated path [target: DENY]', async () => {
    await assertSucceeds(getDoc(doc(as('other@x'), P.unenumerated)));
  });
});
