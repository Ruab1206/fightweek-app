/**
 * seriesSplitService — Slice 2b-2 EMULATOR verification (added in 2c-2).
 *
 * Exercises the REAL split persistence adapter (no firebase mock) against a
 * local Firestore emulator with production `firestore.rules` loaded, using an
 * injected owner Firestore client. Proves the single-transaction split commits
 * atomically under real rules and that a planner rejection leaves no partial
 * state or empty definition.
 *
 * SAFETY: local emulator only (synthetic `demo-` project id). Fails fast if
 * FIRESTORE_EMULATOR_HOST is unset (launch via `npm run test:rules`).
 *
 * Deterministic concurrent-retry orchestration (competing edit preserved,
 * concurrent suppression included after retry, competing split makes no
 * duplicate definition) is proven in the in-memory harness
 * (src/services/seriesSplitService.test.ts); this suite proves real
 * single-client transactional + rules behavior.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { persistSeriesSplitAtomically } from '../../src/services/seriesSplitService';
import { getISOWeekForDate } from '../../src/utils/dateUtils';

const PROJECT_ID = 'demo-fightweek-rules';
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const ROLES_DOC = 'artifacts/production/public/data/config/roles';
const OWNER = 'owner@x';
const OLD = 'old-series-1';
const NEW = 'new-series-2';
const NOW = '2026-01-01T00:00:00.000Z';
const SPLIT = '2026-01-12';
const HORIZON = '2026-01-26'; // 01-12, 01-19, 01-26
const EDITED = { title: 'Evening MMA', discipline: 'MMA', location: 'Gym B', startTime: '18:00', endTime: '19:30' };

const seriesPath = (id: string) => `artifacts/production/users/${OWNER}/eventSeries/${id}`;
const weekPathFor = (dateISO: string) => {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `artifacts/production/users/${OWNER}/weeks/week_${getISOWeekForDate(new Date(y, m - 1, d))}`;
};

let testEnv: RulesTestEnvironment;
const ownerDb = () => testEnv.authenticatedContext(OWNER, { email: OWNER }).firestore();

/** Typed field/day-array accessors for snapshot data (avoids `any`). */
const field = (data: unknown, key: string): unknown => ((data ?? {}) as Record<string, unknown>)[key];
const dayArr = (data: unknown, day = 'Mandag'): Array<Record<string, unknown>> => {
  const arr = field(data, day);
  return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
};

const OLD_DEF = {
  id: OLD, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
  dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: '2026-01-05', intervalWeeks: 1, endDate: null,
  status: 'active', createdAt: NOW, updatedAt: NOW,
};
const occ = (id: string) => ({ id, seriesId: OLD, name: 'Morning MMA', category: 'MMA', location: 'Gym A', start: '07:00', end: '08:30', status: 'active', isRecurring: true, day: 'Mandag' });

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run via `npm run test:rules`.');
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('Refusing to run: project id must be a synthetic `demo-` id.');
  const [hostname, portStr] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: hostname, port: Number(portStr) },
  });
});
afterAll(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(defOverrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, ROLES_DOC), { admins: ['admin@x'], coaches: ['coach@x'], members: { 'owner@x': 'Owner', 'other@x': 'Other' } });
    await setDoc(doc(db, seriesPath(OLD)), { ...OLD_DEF, ...defOverrides });
    await setDoc(doc(db, weekPathFor('2026-01-12')), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
    await setDoc(doc(db, weekPathFor('2026-01-19')), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
    await setDoc(doc(db, weekPathFor('2026-01-26')), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function run(selectedId = 'occ-w2') {
  return persistSeriesSplitAtomically(
    { fighterKey: OWNER, selected: { id: selectedId, seriesId: OLD, occurrenceDateISO: SPLIT }, edited: EDITED },
    { firestore: ownerDb() as never, newSeriesId: NEW, now: NOW, horizonEndDate: HORIZON },
  );
}

describe('persistSeriesSplitAtomically — emulator', () => {
  it('commits a complete split atomically under production rules', async () => {
    await seed();
    const res = await run();
    expect(res).toMatchObject({ ok: true, newSeriesId: NEW });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const newDef = await getDoc(doc(db, seriesPath(NEW)));
      const oldDef = await getDoc(doc(db, seriesPath(OLD)));
      expect(newDef.exists()).toBe(true);
      expect(field(newDef.data(), 'startDate')).toBe(SPLIT);
      expect(field(oldDef.data(), 'endDate')).toBe('2026-01-11');
      const wk = await getDoc(doc(db, weekPathFor('2026-01-19')));
      expect(dayArr(wk.data())[0].seriesId).toBe(NEW);
    });
  });

  it('a planner rejection leaves no new definition and no partial re-parenting', async () => {
    // Selected anchor references a series id that does not match its own doc:
    // an occurrence dated before the definition start forces a planner reject.
    await seed({ startDate: '2026-02-02' }); // SPLIT (01-12) is before start → rejected
    const res = await persistSeriesSplitAtomically(
      { fighterKey: OWNER, selected: { id: 'occ-w2', seriesId: OLD, occurrenceDateISO: SPLIT }, edited: EDITED },
      { firestore: ownerDb() as never, newSeriesId: NEW, now: NOW, horizonEndDate: HORIZON },
    );
    expect(res.ok).toBe(false);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const newDef = await getDoc(doc(db, seriesPath(NEW)));
      expect(newDef.exists()).toBe(false); // no empty/partial new definition
      const wk = await getDoc(doc(db, weekPathFor('2026-01-19')));
      expect(dayArr(wk.data())[0].seriesId).toBe(OLD); // unchanged
    });
  });
});
