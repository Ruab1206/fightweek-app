/**
 * Firestore security-rules characterization harness — Phase 3 (eventLogs privacy).
 *
 * WHAT THIS IS
 *   Verifies the TARGET `firestore.rules`. eventLogs are private-by-default:
 *     - owner: read/write
 *     - administrator: read-only, regardless of membership overlap
 *     - coach: denied (read+write), even if also a member
 *     - other member / non-team / unauthenticated: denied
 *     - owner accessing ANOTHER fighter's logs: denied
 *   The weeks/templates/meta blocks remain REGRESSION tests pinning the
 *   pre-existing team-read / owner+admin/coach-write behavior, which this
 *   change preserves exactly.
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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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
  // A DIFFERENT fighter's log — used to prove an owner cannot reach another
  // fighter's eventLogs.
  otherEventLog: `artifacts/production/users/other@x/eventLogs/log2`,
  // Not a real app path. Stands in for ANY future user-scoped subcollection.
  // After narrowing the recursive `{document=**}` rule it must be DENIED.
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
    await setDoc(doc(db, P.otherEventLog), { id: 'log2' });
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
// eventLogs — TARGET private-by-default policy. Owner read/write; administrator
// read-only regardless of membership; coach and every other principal denied;
// owner cannot reach another fighter's logs.
// ─────────────────────────────────────────────────────────────────────────────
describe('TARGET rules — eventLogs private-by-default (owner R/W; admin read-only)', () => {
  it('owner can read own log', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), P.eventLog)));
  });
  it('owner can write own log', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), P.eventLog), { id: 'log1' }));
  });

  it('other team member cannot read a private log', async () => {
    await assertFails(getDoc(doc(as('other@x'), P.eventLog)));
  });
  it('other team member cannot write a private log', async () => {
    await assertFails(setDoc(doc(as('other@x'), P.eventLog), { id: 'x' }));
  });

  // Administrator (default fixture: NOT a member) — read-only.
  it('admin can read (read-only policy)', async () => {
    await assertSucceeds(getDoc(doc(as('admin@x'), P.eventLog)));
  });
  it('admin cannot write', async () => {
    await assertFails(setDoc(doc(as('admin@x'), P.eventLog), { id: 'x' }));
  });

  // Coach (default fixture: NOT a member) — fully denied.
  it('coach cannot read', async () => {
    await assertFails(getDoc(doc(as('coach@x'), P.eventLog)));
  });
  it('coach cannot write', async () => {
    await assertFails(setDoc(doc(as('coach@x'), P.eventLog), { id: 'x' }));
  });

  // Owner accessing ANOTHER fighter's log — denied both ways.
  it("owner cannot read another fighter's log", async () => {
    await assertFails(getDoc(doc(as(OWNER), P.otherEventLog)));
  });
  it("owner cannot write another fighter's log", async () => {
    await assertFails(setDoc(doc(as(OWNER), P.otherEventLog), { id: 'x' }));
  });

  it('authenticated non-team user cannot read', async () => {
    await assertFails(getDoc(doc(as('rando@x'), P.eventLog)));
  });
  it('authenticated non-team user cannot write', async () => {
    await assertFails(setDoc(doc(as('rando@x'), P.eventLog), { id: 'x' }));
  });
  it('unauthenticated cannot read', async () => {
    await assertFails(getDoc(doc(as(null), P.eventLog)));
  });
  it('unauthenticated cannot write', async () => {
    await assertFails(setDoc(doc(as(null), P.eventLog), { id: 'x' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE OVERLAP — proves the TARGET eventLogs policy is independent of whether an
// administrator or coach is also listed in `members`:
//   - administrator: read allowed, write denied — whether or not a member
//   - coach:         read denied,  write denied — whether or not a member
// The weeks assertions in each block are REGRESSION checks (preserved behavior).
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
  it('read eventLogs allowed — admin read-only regardless of membership', async () => {
    await assertSucceeds(getDoc(doc(as('admin@x'), P.eventLog)));
  });
  it('write eventLogs denied — admin has no write', async () => {
    await assertFails(setDoc(doc(as('admin@x'), P.eventLog), { id: 'x' }));
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
  it('read eventLogs allowed — via isAdmin(), independent of membership', async () => {
    await assertSucceeds(getDoc(doc(as('admin@x'), P.eventLog)));
  });
  it('write eventLogs denied — admin has no write even as a member', async () => {
    await assertFails(setDoc(doc(as('admin@x'), P.eventLog), { id: 'x' }));
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
  it('read eventLogs denied — coach has no read', async () => {
    await assertFails(getDoc(doc(as('coach@x'), P.eventLog)));
  });
  it('write eventLogs denied — coach has no write', async () => {
    await assertFails(setDoc(doc(as('coach@x'), P.eventLog), { id: 'x' }));
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
  it('read eventLogs denied — coach denied even though also a member', async () => {
    await assertFails(getDoc(doc(as('coach@x'), P.eventLog)));
  });
  it('write eventLogs denied — coach denied even though also a member', async () => {
    await assertFails(setDoc(doc(as('coach@x'), P.eventLog), { id: 'x' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unenumerated user path via the recursive `{document=**}` wildcard.
// Makes the impact of narrowing the wildcard explicit: TODAY this arbitrary
// path inherits team-read / owner-write; after narrowing (enumerating
// weeks/templates/meta/eventLogs) it will be DENIED unless explicitly added.
// ─────────────────────────────────────────────────────────────────────────────
describe('TARGET rules — unenumerated user path is denied (wildcard narrowed)', () => {
  it('owner cannot read an unenumerated path', async () => {
    await assertFails(getDoc(doc(as(OWNER), P.unenumerated)));
  });
  it('owner cannot write an unenumerated path', async () => {
    await assertFails(setDoc(doc(as(OWNER), P.unenumerated), { x: 1 }));
  });
  it('other team member cannot read an unenumerated path', async () => {
    await assertFails(getDoc(doc(as('other@x'), P.unenumerated)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint B — bilateral new-model calendar-aggregate + TrainingLog pair.
//
// Minimum test record builders. Pure fixture data only (no domain imports —
// this harness is deliberately independent of the app's TypeScript build).
// ─────────────────────────────────────────────────────────────────────────────

const AGG_PATH = (userKey: string, aggregateId: string) =>
  `artifacts/production/users/${userKey}/calendarEntries/${aggregateId}`;
const LOG_PATH = (userKey: string, logId: string) =>
  `artifacts/production/users/${userKey}/eventLogs/${logId}`;

function makeAggregate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agg1',
    userId: OWNER,
    occurrence: {
      id: 'occ1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'Solo run',
      startDateTime: '2026-08-14T18:00:00',
      endDateTime: '2026-08-14T19:00:00',
      status: 'completed',
    },
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed', userId: OWNER },
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    schemaVersion: 1,
    logRecordId: 'nmlog1',
    ...overrides,
  };
}

function makeNewModelLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nmlog1',
    occurrence: {
      id: 'occ1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'Solo run',
      startDateTime: '2026-08-14T18:00:00',
      endDateTime: '2026-08-14T19:00:00',
      status: 'completed',
    },
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed' },
    log: { id: 'evlog1', occurrenceId: 'occ1', userId: OWNER, attended: true },
    origin: { type: 'new_model_calendar_entry', aggregateId: 'agg1', occurrenceId: 'occ1' },
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    ...overrides,
  };
}

function makeStandaloneLog(id = 'standalone1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    occurrence: {
      id: 'occ_standalone',
      seriesId: null,
      type: 'self_posted_training',
      title: 'Unplanned',
      startDateTime: '2026-08-14T06:00:00',
      endDateTime: '2026-08-14T07:00:00',
      status: 'completed',
    },
    calendarEntry: { id: 'entry_standalone', occurrenceId: 'occ_standalone', status: 'completed' },
    log: { id: 'evlog_standalone', occurrenceId: 'occ_standalone', userId: OWNER, attended: true },
    createdAt: '2026-08-14T07:05:00.000Z',
    updatedAt: '2026-08-14T07:05:00.000Z',
    ...overrides,
  };
}

function makeLegacyOriginLog(id = 'legacy1', overrides: Record<string, unknown> = {}) {
  return {
    ...makeStandaloneLog(id),
    origin: { type: 'self_posted_calendar_session', sessionId: 'sess1', occurrenceDateISO: '2026-08-14' },
    ...overrides,
  };
}

describe('Checkpoint B — calendarEntries permissions', () => {
  beforeEach(async () => {
    // Seed a valid, already-consistent pair with rules disabled, for read/update/delete assertions.
    // Uses a log id distinct from the globally-seeded P.eventLog ('log1') fixture.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate());
      await setDoc(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    });
  });

  it('owner can read own calendarEntries document', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1'))));
  });
  it('admin can read (read-only policy)', async () => {
    await assertSucceeds(getDoc(doc(as('admin@x'), AGG_PATH(OWNER, 'agg1'))));
  });
  it('admin cannot create', async () => {
    await assertFails(
      setDoc(doc(as('admin@x'), AGG_PATH(OWNER, 'agg2')), makeAggregate({ id: 'agg2', logRecordId: 'log2' })),
    );
  });
  it('owner cannot update an existing calendarEntries document (no edit lifecycle yet)', async () => {
    await assertFails(updateDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1')), { 'occurrence.title': 'Changed' }));
  });
  it('owner cannot delete an existing calendarEntries document (no delete lifecycle yet)', async () => {
    await assertFails(deleteDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1'))));
  });
  it('coach cannot read', async () => {
    await assertFails(getDoc(doc(as('coach@x'), AGG_PATH(OWNER, 'agg1'))));
  });
  it('coach cannot create', async () => {
    await assertFails(
      setDoc(doc(as('coach@x'), AGG_PATH(OWNER, 'agg2')), makeAggregate({ id: 'agg2', logRecordId: 'log2' })),
    );
  });
  it("other fighter cannot read another fighter's calendarEntries document", async () => {
    await assertFails(getDoc(doc(as('other@x'), AGG_PATH(OWNER, 'agg1'))));
  });
  it("other fighter cannot create in another fighter's path", async () => {
    await assertFails(
      setDoc(doc(as('other@x'), AGG_PATH(OWNER, 'agg2')), makeAggregate({ id: 'agg2', logRecordId: 'log2' })),
    );
  });
  it('unauthenticated cannot read', async () => {
    await assertFails(getDoc(doc(as(null), AGG_PATH(OWNER, 'agg1'))));
  });
  it('unauthenticated cannot create', async () => {
    await assertFails(
      setDoc(doc(as(null), AGG_PATH(OWNER, 'agg2')), makeAggregate({ id: 'agg2', logRecordId: 'log2' })),
    );
  });
});

describe('Checkpoint B — bilateral pair-integrity invariant (co-persistence, not uniqueness)', () => {
  it('owner batch-creating a consistent aggregate + new-model log together succeeds', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate());
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertSucceeds(batch.commit());
  });

  it('a new-model-origin log created ALONE (no matching aggregate in the same commit) fails', async () => {
    await assertFails(setDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog()));
  });

  it('a calendarEntries aggregate created ALONE (no matching log in the same commit) fails', async () => {
    await assertFails(setDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1')), makeAggregate()));
  });

  it('fails when aggregate.occurrence.id does not match the log occurrence.id', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate({ occurrence: { ...makeAggregate().occurrence, id: 'occ_DIFFERENT' } }));
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertFails(batch.commit());
  });

  it('fails when aggregate.calendarEntry.id does not match the log calendarEntry.id', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate({ calendarEntry: { ...makeAggregate().calendarEntry, id: 'entry_DIFFERENT' } }));
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertFails(batch.commit());
  });

  it('fails when the log origin.aggregateId points at a different aggregate id', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate());
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog({ origin: { type: 'new_model_calendar_entry', aggregateId: 'agg_DIFFERENT', occurrenceId: 'occ1' } }));
    await assertFails(batch.commit());
  });

  it('fails when aggregate.logRecordId does not match the actual log document id', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate({ logRecordId: 'log_DIFFERENT' }));
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertFails(batch.commit());
  });

  it("fails when aggregate.userId does not match the path owner", async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate({ userId: 'someone-else@x' }));
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertFails(batch.commit());
  });

  it('standalone log create (no origin) is unaffected by the bilateral gate', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), LOG_PATH(OWNER, 'standalone1')), makeStandaloneLog()));
  });

  it('legacy self_posted_calendar_session-origin log create is unaffected by the bilateral gate', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), LOG_PATH(OWNER, 'legacy1')), makeLegacyOriginLog()));
  });

  it('fails when the calendarEntries document id differs from aggregate.id, all other pair fields otherwise consistent', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    // Seeded at doc id 'agg_WRONG_DOC_ID' but the persisted field still says 'agg1'.
    batch.set(doc(db, AGG_PATH(OWNER, 'agg_WRONG_DOC_ID')), makeAggregate({ id: 'agg1' }));
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog({ origin: { type: 'new_model_calendar_entry', aggregateId: 'agg1', occurrenceId: 'occ1' } }));
    await assertFails(batch.commit());
  });

  it('fails when the eventLogs document id differs from log.id, all other pair fields otherwise consistent', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate({ logRecordId: 'nmlog1' }));
    // Seeded at doc id 'nmlog_WRONG_DOC_ID' but the persisted field still says 'nmlog1'.
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog_WRONG_DOC_ID')), makeNewModelLog({ id: 'nmlog1' }));
    await assertFails(batch.commit());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Independent CalendarEntry create — persisted CalendarEntry independence (I2).
// An aggregate WITHOUT `logRecordId` may be created alone (no paired log),
// owner-scoped and identity-validated, WITHOUT getAfter(eventLogs). The paired
// path (logRecordId present) is unchanged. Discriminator = logRecordId presence.
// ─────────────────────────────────────────────────────────────────────────────
describe('Independent CalendarEntry create (no paired TrainingLog — logRecordId absent)', () => {
  function makeIndependentAggregate(overrides: Record<string, unknown> = {}) {
    const agg = makeAggregate(overrides) as Record<string, unknown>;
    delete agg.logRecordId; // independent CalendarEntry: no paired-log reference
    return agg;
  }

  it('owner can create an aggregate WITHOUT logRecordId, alone (no paired log required)', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate()));
  });

  it('fails when userId does not match the path owner', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate({ userId: 'someone-else@x' })),
    );
  });

  it('fails when the aggregate id does not match the document path', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg_WRONG_DOC_ID')), makeIndependentAggregate({ id: 'agg1' })),
    );
  });

  it('unauthenticated cannot create an independent aggregate', async () => {
    await assertFails(setDoc(doc(as(null), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate()));
  });

  it("another fighter cannot create an independent aggregate in the owner's path", async () => {
    await assertFails(setDoc(doc(as('other@x'), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate()));
  });

  it('coach cannot create an independent aggregate', async () => {
    await assertFails(setDoc(doc(as('coach@x'), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate()));
  });

  it('an aggregate carrying logRecordId cannot use the independent path: created alone it still fails (routes to paired)', async () => {
    // logRecordId present => independent branch does not apply; paired branch needs a matching log in-commit.
    await assertFails(setDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1')), makeAggregate()));
  });

  it('paired create is unchanged: consistent aggregate (with logRecordId) + matching log together still succeeds', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate());
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertSucceeds(batch.commit());
  });

  it('paired validation is unchanged: broken cross-reference (occurrence id mismatch) still fails', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate({ occurrence: { ...makeAggregate().occurrence, id: 'occ_DIFFERENT' } }));
    batch.set(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    await assertFails(batch.commit());
  });

  it('independent create does not grant update or delete (no edit lifecycle yet)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate());
    });
    await assertFails(updateDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1')), { 'occurrence.title': 'Changed' }));
    await assertFails(deleteDoc(doc(as(OWNER), AGG_PATH(OWNER, 'agg1'))));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Log against an already-existing independent CalendarEntry (TrainingLog.origin
// -> CalendarEntry, unidirectional). The referenced aggregate is PRE-EXISTING
// (seeded before the log create, not in the same batch) and carries NO
// `logRecordId` — a log-less independent entry. This is additive and disjoint
// from the bilateral same-commit path: `get()` (not `getAfter()`) only ever
// sees already-persisted state, so a brand-new same-batch aggregate is
// invisible here and must route through the unchanged bilateral branch
// instead. This establishes REFERENTIAL INTEGRITY for this new path, not
// one-log-per-occurrence (I8) uniqueness — a second log referencing the same
// entry is not prevented here (unchanged from the existing bilateral gate's
// scope). CalendarEntry is never mutated; `logRecordId` is untouched.
// ─────────────────────────────────────────────────────────────────────────────
describe('Log against an already-existing independent CalendarEntry (new-model origin, no bilateral pair)', () => {
  function makeIndependentAggregate(overrides: Record<string, unknown> = {}) {
    const agg = makeAggregate(overrides) as Record<string, unknown>;
    delete agg.logRecordId;
    return agg;
  }

  function makeLogAgainstExistingEntry(overrides: Record<string, unknown> = {}) {
    return makeNewModelLog({ id: 'logX', ...overrides });
  }

  beforeEach(async () => {
    // Seed an ALREADY-PERSISTED independent aggregate (rules disabled), so the
    // log create below is a single-document write, never a same-commit batch.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), AGG_PATH(OWNER, 'agg1')), makeIndependentAggregate());
    });
  });

  it('owner can create a new-model-origin TrainingLog referencing the existing independent CalendarEntry', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry()));
  });

  it('fails when the referenced CalendarEntry does not exist (also proves no fallthrough to standalone/legacy validation, since origin.type is still new_model_calendar_entry)', async () => {
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({
          origin: { type: 'new_model_calendar_entry', aggregateId: 'agg_DOES_NOT_EXIST', occurrenceId: 'occ1' },
        }),
      ),
    );
  });

  it('fails when the referenced aggregate carries logRecordId (paired entries must use the bilateral path)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), AGG_PATH(OWNER, 'agg_paired')), makeAggregate({ id: 'agg_paired', logRecordId: 'someLog' }));
    });
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({
          origin: { type: 'new_model_calendar_entry', aggregateId: 'agg_paired', occurrenceId: 'occ1' },
        }),
      ),
    );
  });

  it('fails when the referenced aggregate document id differs from its own id field', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // Seeded at doc id 'agg_WRONG_DOC_ID' but the persisted field still says 'agg1'.
      await setDoc(doc(context.firestore(), AGG_PATH(OWNER, 'agg_WRONG_DOC_ID')), makeIndependentAggregate({ id: 'agg1' }));
    });
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({
          origin: { type: 'new_model_calendar_entry', aggregateId: 'agg_WRONG_DOC_ID', occurrenceId: 'occ1' },
        }),
      ),
    );
  });

  it('fails when origin.occurrenceId does not match the referenced aggregate occurrence id', async () => {
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({
          origin: { type: 'new_model_calendar_entry', aggregateId: 'agg1', occurrenceId: 'occ_DIFFERENT' },
        }),
      ),
    );
  });

  it('fails when log.occurrence.id does not match the referenced aggregate occurrence id', async () => {
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({ occurrence: { ...makeNewModelLog().occurrence, id: 'occ_DIFFERENT' } }),
      ),
    );
  });

  it('fails when log.calendarEntry.id does not match the referenced aggregate calendarEntry id', async () => {
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({ calendarEntry: { ...makeNewModelLog().calendarEntry, id: 'entry_DIFFERENT' } }),
      ),
    );
  });

  it('fails when the log document id does not match the path logId', async () => {
    await assertFails(setDoc(doc(as(OWNER), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry({ id: 'logY' })));
  });

  it('fails when the referenced aggregate userId does not match the owner', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), AGG_PATH(OWNER, 'agg_wrong_owner')),
        makeIndependentAggregate({ id: 'agg_wrong_owner', userId: 'someone-else@x' }),
      );
    });
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({
          origin: { type: 'new_model_calendar_entry', aggregateId: 'agg_wrong_owner', occurrenceId: 'occ1' },
        }),
      ),
    );
  });

  it('unauthenticated cannot create a log referencing an existing independent entry', async () => {
    await assertFails(setDoc(doc(as(null), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry()));
  });

  it("another fighter cannot create in the owner's eventLogs path", async () => {
    await assertFails(setDoc(doc(as('other@x'), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry()));
  });

  it('coach cannot create a log referencing an existing independent entry', async () => {
    await assertFails(setDoc(doc(as('coach@x'), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry()));
  });

  it('admin cannot create a log referencing an existing independent entry (read-only policy)', async () => {
    await assertFails(setDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry()));
  });

  it('fails with a malformed new_model_calendar_entry origin (missing aggregateId/occurrenceId)', async () => {
    await assertFails(
      setDoc(
        doc(as(OWNER), LOG_PATH(OWNER, 'logX')),
        makeLogAgainstExistingEntry({ origin: { type: 'new_model_calendar_entry' } }),
      ),
    );
  });

  it('a log created via this new branch is also create-once and read-only (existing immutability rule applies automatically)', async () => {
    await setDoc(doc(as(OWNER), LOG_PATH(OWNER, 'logX')), makeLogAgainstExistingEntry());
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'logX')), { 'log.notes': 'Changed' }));
    await assertFails(deleteDoc(doc(as(OWNER), LOG_PATH(OWNER, 'logX'))));
  });

  // Not re-tested here (unchanged, already covered elsewhere in this file, and
  // re-run by every `npm run test:rules` invocation):
  //   - existing bilateral same-commit aggregate+log creation still succeeds
  //     ("Checkpoint B — bilateral pair-integrity invariant" describe block)
  //   - standalone (no origin) log creation is unaffected
  //     ("standalone log create (no origin) is unaffected by the bilateral gate")
  //   - legacy self_posted_calendar_session log creation is unaffected
  //     ("legacy self_posted_calendar_session-origin log create is unaffected...")
  //   - existing broken bilateral cross-references still fail
  //     (multiple "fails when aggregate.* does not match..." tests above)
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint B — paired new-model TrainingLogs are create-once and read-only
// in this slice: editing/deleting is not implemented, and allowing it would
// risk corrupting the bilaterally validated pair identity or orphaning the
// immutable calendarEntries aggregate. Classified on the EXISTING persisted
// resource.data (not request.resource.data), so an update cannot bypass the
// restriction by rewriting/removing `origin` in the replacement document.
// Standalone and legacy self_posted_calendar_session logs are unaffected.
// ─────────────────────────────────────────────────────────────────────────────
describe('Checkpoint B — paired new-model TrainingLog immutability (update/delete denied)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, AGG_PATH(OWNER, 'agg1')), makeAggregate());
      await setDoc(doc(db, LOG_PATH(OWNER, 'nmlog1')), makeNewModelLog());
    });
  });

  it('owner cannot update ordinary log content', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'log.attended': false }));
  });
  it('owner cannot change notes', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'log.notes': 'Changed' }));
  });
  it('owner cannot change intensity', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'log.intensity': 5 }));
  });
  it('owner cannot change data.id', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { id: 'nmlog_OTHER' }));
  });
  it('owner cannot change origin.type', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'origin.type': 'self_posted_calendar_session' }));
  });
  it('owner cannot change origin.aggregateId', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'origin.aggregateId': 'agg_OTHER' }));
  });
  it('owner cannot change origin.occurrenceId', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'origin.occurrenceId': 'occ_OTHER' }));
  });
  it('owner cannot change occurrence.id', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'occurrence.id': 'occ_OTHER' }));
  });
  it('owner cannot change calendarEntry.id', async () => {
    await assertFails(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1')), { 'calendarEntry.id': 'entry_OTHER' }));
  });
  it('owner cannot delete the paired log', async () => {
    await assertFails(deleteDoc(doc(as(OWNER), LOG_PATH(OWNER, 'nmlog1'))));
  });
  it('admin cannot update the paired log', async () => {
    await assertFails(updateDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'nmlog1')), { 'log.notes': 'Changed' }));
  });
  it('admin cannot delete the paired log', async () => {
    await assertFails(deleteDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'nmlog1'))));
  });
  it('coach cannot update or delete the paired log', async () => {
    await assertFails(updateDoc(doc(as('coach@x'), LOG_PATH(OWNER, 'nmlog1')), { 'log.notes': 'Changed' }));
    await assertFails(deleteDoc(doc(as('coach@x'), LOG_PATH(OWNER, 'nmlog1'))));
  });
  it('other fighter cannot update or delete the paired log', async () => {
    await assertFails(updateDoc(doc(as('other@x'), LOG_PATH(OWNER, 'nmlog1')), { 'log.notes': 'Changed' }));
    await assertFails(deleteDoc(doc(as('other@x'), LOG_PATH(OWNER, 'nmlog1'))));
  });
  it('unauthenticated cannot update or delete the paired log', async () => {
    await assertFails(updateDoc(doc(as(null), LOG_PATH(OWNER, 'nmlog1')), { 'log.notes': 'Changed' }));
    await assertFails(deleteDoc(doc(as(null), LOG_PATH(OWNER, 'nmlog1'))));
  });
});

describe('Checkpoint B — standalone/legacy log update-delete backward compatibility (unchanged)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, LOG_PATH(OWNER, 'standalone1')), makeStandaloneLog());
      await setDoc(doc(db, LOG_PATH(OWNER, 'legacy1')), makeLegacyOriginLog());
    });
  });

  it('owner can still update a standalone log without origin', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'standalone1')), { 'log.notes': 'Updated' }));
  });
  it('owner can still delete a standalone log without origin', async () => {
    await assertSucceeds(deleteDoc(doc(as(OWNER), LOG_PATH(OWNER, 'standalone1'))));
  });
  it('owner can still update a legacy self_posted_calendar_session log', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), LOG_PATH(OWNER, 'legacy1')), { 'log.notes': 'Updated' }));
  });
  it('owner can still delete a legacy self_posted_calendar_session log', async () => {
    await assertSucceeds(deleteDoc(doc(as(OWNER), LOG_PATH(OWNER, 'legacy1'))));
  });
  it('admin remains unable to update or delete a standalone log (unchanged — admin has no write)', async () => {
    await assertFails(updateDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'standalone1')), { 'log.notes': 'Changed' }));
    await assertFails(deleteDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'standalone1'))));
  });
  it('admin remains unable to update or delete a legacy log (unchanged — admin has no write)', async () => {
    await assertFails(updateDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'legacy1')), { 'log.notes': 'Changed' }));
    await assertFails(deleteDoc(doc(as('admin@x'), LOG_PATH(OWNER, 'legacy1'))));
  });
});
