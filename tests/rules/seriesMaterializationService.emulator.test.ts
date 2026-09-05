/**
 * seriesMaterializationService — Slice 2c-2 EMULATOR verification.
 *
 * Exercises the REAL persistence adapter (no firebase mock) against a local
 * Firestore emulator with the production `firestore.rules` loaded, using an
 * injected owner Firestore client. Proves owner-only, deterministic, per-week
 * transactional materialization end to end.
 *
 * SAFETY: runs ONLY against a local emulator (synthetic `demo-` project id).
 * Fails fast if FIRESTORE_EMULATOR_HOST is unset (launch via `npm run test:rules`).
 *
 * Deterministic cross-client concurrency RETRY orchestration is proven in the
 * in-memory harness (src/services/seriesMaterializationService.test.ts); this
 * emulator suite proves real single-client transactional + rules behavior.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { materializeSeries } from '../../src/services/seriesMaterializationService';
import { materializedOccurrenceId } from '../../src/domain/calendar/materializationPlan';
import { getISOWeekForDate } from '../../src/utils/dateUtils';

const PROJECT_ID = 'demo-fightweek-rules';
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const ROLES_DOC = 'artifacts/production/public/data/config/roles';
const OWNER = 'owner@x';
const INTRUDER = 'intruder@x';
const SERIES = 'series-1';
const NOW = '2026-01-01T00:00:00.000Z';
const HORIZON = '2026-01-12'; // 2 Mondays: 2026-01-05, 2026-01-12

const seriesPath = (id: string) => `artifacts/production/users/${OWNER}/eventSeries/${id}`;
const suppPath = (dateISO: string) => `artifacts/production/users/${OWNER}/eventSeries/${SERIES}/suppressions/${dateISO}`;
const notesPath = `artifacts/production/users/${OWNER}/meta/notes`;
const eventLogPath = `artifacts/production/users/${OWNER}/eventLogs/log1`;
// 2026-01-05 is ISO week 2, 2026-01-12 is ISO week 3.
const weekPathFor = (dateISO: string) => {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `artifacts/production/users/${OWNER}/weeks/week_${getISOWeekForDate(new Date(y, m - 1, d))}`;
};

let testEnv: RulesTestEnvironment;

function ownerDb() {
  return testEnv.authenticatedContext(OWNER, { email: OWNER }).firestore();
}
function intruderDb() {
  return testEnv.authenticatedContext(INTRUDER, { email: INTRUDER }).firestore();
}

/** Read a day's session array from a week document snapshot data, typed. */
function dayArr(data: unknown, day = 'Mandag'): Array<Record<string, unknown>> {
  const wk = (data ?? {}) as Record<string, unknown>;
  const arr = wk[day];
  return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
}

const DEF = {
  id: SERIES, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
  dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: '2026-01-05', intervalWeeks: 1, endDate: null,
  status: 'active', createdAt: NOW, updatedAt: NOW,
};

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Run via `npm run test:rules` (launches the emulator).',
    );
  }
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('Refusing to run: project id must be a synthetic `demo-` id.');
  const [hostname, portStr] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: hostname, port: Number(portStr) },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, ROLES_DOC), { admins: ['admin@x'], coaches: ['coach@x'], members: { 'owner@x': 'Owner', 'other@x': 'Other' } });
    await setDoc(doc(db, seriesPath(SERIES)), DEF);
  });
});

function run(dbInstance = ownerDb(), overrides: Record<string, unknown> = {}) {
  return materializeSeries({ fighterKey: OWNER, seriesId: SERIES }, { firestore: dbInstance as never, now: NOW, horizonEndDate: HORIZON, ...overrides });
}

describe('materializeSeries — emulator, owner flow', () => {
  it('owner materializes into their own week documents', async () => {
    const res = await run();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.totalCreated).toBe(2);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const wk1 = await getDoc(doc(db, weekPathFor('2026-01-05')));
      const wk2 = await getDoc(doc(db, weekPathFor('2026-01-12')));
      expect(dayArr(wk1.data()).map((s) => s.id)).toContain(materializedOccurrenceId(SERIES, '2026-01-05'));
      expect(dayArr(wk2.data()).map((s) => s.id)).toContain(materializedOccurrenceId(SERIES, '2026-01-12'));
    });
  });

  it('preserves unrelated same-week activity', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, weekPathFor('2026-01-05')), { Mandag: [{ id: 'keep-1', name: 'BJJ', start: '19:00', end: '20:00', status: 'active', day: 'Mandag' }], lastUpdated: NOW });
    });
    await run();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const wk = await getDoc(doc(db, weekPathFor('2026-01-05')));
      const ids = dayArr(wk.data()).map((s) => s.id);
      expect(ids).toContain('keep-1');
      expect(ids).toContain(materializedOccurrenceId(SERIES, '2026-01-05'));
    });
  });

  it('does not generate a suppressed date', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, suppPath('2026-01-12')), { seriesId: SERIES, occurrenceDateISO: '2026-01-12', reason: 'deleted', createdAt: NOW });
    });
    const res = await run();
    if (!res.ok) return;
    expect(res.totalCreated).toBe(1); // only 2026-01-05
  });

  it('does not duplicate an existing occurrence and stays idempotent on re-run', async () => {
    await run();
    const res2 = await run();
    if (!res2.ok) return;
    expect(res2.totalCreated).toBe(0);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const wk = await getDoc(doc(db, weekPathFor('2026-01-05')));
      const mandag = dayArr(wk.data());
      expect(mandag.filter((s) => s.id === materializedOccurrenceId(SERIES, '2026-01-05'))).toHaveLength(1);
    });
  });

  it('uses a deterministic id stable across repeated calls', async () => {
    const a = await run();
    const b = await run();
    if (!a.ok || !b.ok) return;
    const idsA = a.weeks.flatMap((w) => (w.ok ? w.created : []));
    // second run creates nothing but the persisted ids are the deterministic ones
    expect(idsA).toEqual([
      materializedOccurrenceId(SERIES, '2026-01-05'),
      materializedOccurrenceId(SERIES, '2026-01-12'),
    ]);
    expect(b.totalCreated).toBe(0);
  });

  it('planner conflict causes zero week mutation', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // active occurrence + suppression for the same date = conflict
      await setDoc(doc(db, weekPathFor('2026-01-12')), {
        Mandag: [{ id: materializedOccurrenceId(SERIES, '2026-01-12'), seriesId: SERIES, status: 'active', day: 'Mandag', start: '07:00' }],
        lastUpdated: NOW,
      });
      await setDoc(doc(db, suppPath('2026-01-12')), { seriesId: SERIES, occurrenceDateISO: '2026-01-12', reason: 'deleted', createdAt: NOW });
    });
    const res = await run();
    if (!res.ok) return;
    const failed = res.weeks.find((w) => !w.ok);
    expect(failed).toMatchObject({ ok: false, kind: 'planner', reason: 'active_occurrence_with_suppression' });
    // week_3 unchanged: still exactly the one active seeded occurrence
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const wk = await getDoc(doc(db, weekPathFor('2026-01-12')));
      expect(dayArr(wk.data())).toHaveLength(1);
    });
  });

  it('does not mutate Notes or eventLogs', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, notesPath), { 's_2026-01-05_x': 'my note', updatedAt: NOW });
      await setDoc(doc(db, eventLogPath), { id: 'log1', title: 'Sparring', createdAt: NOW });
    });
    await run();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const notes = await getDoc(doc(db, notesPath));
      const log = await getDoc(doc(db, eventLogPath));
      expect(notes.data()).toEqual({ 's_2026-01-05_x': 'my note', updatedAt: NOW });
      expect(log.data()).toEqual({ id: 'log1', title: 'Sparring', createdAt: NOW });
    });
  });
});

describe('materializeSeries — emulator, owner boundary', () => {
  it('a non-owner cannot read the definition or materialize the series', async () => {
    await assertFails(run(intruderDb()));
    // owner data untouched: no week doc was created
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const wk = await getDoc(doc(db, weekPathFor('2026-01-05')));
      expect(wk.exists()).toBe(false);
    });
  });
});
