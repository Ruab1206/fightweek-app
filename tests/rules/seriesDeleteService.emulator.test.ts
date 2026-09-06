/**
 * seriesDeleteService — EMULATOR verification for durable
 * delete-this-and-following (invisible isDeleted records) + admin-only read.
 *
 * Exercises the REAL delete persistence adapter (no firebase mock) against a
 * local Firestore emulator with production `firestore.rules` loaded, using an
 * injected owner/admin/coach Firestore client.
 *
 * SAFETY: local emulator only (synthetic `demo-` project id). Fails fast if
 * FIRESTORE_EMULATOR_HOST is unset (launch via `npm run test:rules`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { persistSeriesDeleteAtomically } from '../../src/services/seriesDeleteService';
import { materializeSeries } from '../../src/services/seriesMaterializationService';
import { getISOWeekForDate } from '../../src/utils/dateUtils';

const PROJECT_ID = 'demo-fightweek-rules';
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const ROLES_DOC = 'artifacts/production/public/data/config/roles';
const OWNER = 'owner@x';
const SERIES = 'series-1';
const NOW = '2026-02-01T00:00:00.000Z';
const START = '2026-01-05';
const FROM = '2026-01-12';
const HORIZON = '2026-01-26';

const seriesPath = (id: string) => `artifacts/production/users/${OWNER}/eventSeries/${id}`;
const weekPathFor = (dateISO: string) => {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `artifacts/production/users/${OWNER}/weeks/week_${getISOWeekForDate(new Date(y, m - 1, d))}`;
};

let testEnv: RulesTestEnvironment;
const ownerDb = () => testEnv.authenticatedContext(OWNER, { email: OWNER }).firestore();
const adminDb = () => testEnv.authenticatedContext('admin@x', { email: 'admin@x' }).firestore();
const coachDb = () => testEnv.authenticatedContext('coach@x', { email: 'coach@x' }).firestore();
const teammateDb = () => testEnv.authenticatedContext('other@x', { email: 'other@x' }).firestore();

const field = (data: unknown, key: string): unknown => ((data ?? {}) as Record<string, unknown>)[key];
const dayArr = (data: unknown, day = 'Mandag'): Array<Record<string, unknown>> => {
  const arr = field(data, day);
  return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
};

const DEF = {
  id: SERIES, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
  dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: START, intervalWeeks: 1, endDate: null,
  status: 'active', createdAt: NOW, updatedAt: NOW,
};
const occ = (id: string) => ({ id, seriesId: SERIES, name: 'Morning MMA', category: 'MMA', location: 'Gym A', start: '07:00', end: '08:30', status: 'active', isRecurring: true, day: 'Mandag' });

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

async function seed(extraWeek?: { dateISO: string; entries: unknown[] }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, ROLES_DOC), { admins: ['admin@x'], coaches: ['coach@x'], members: { 'owner@x': 'Owner', 'other@x': 'Other', 'coach@x': 'Coach', 'admin@x': 'Admin' } });
    await setDoc(doc(db, seriesPath(SERIES)), DEF);
    await setDoc(doc(db, weekPathFor('2026-01-12')), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
    await setDoc(doc(db, weekPathFor('2026-01-19')), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
    await setDoc(doc(db, weekPathFor('2026-01-26')), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
    if (extraWeek) await setDoc(doc(db, weekPathFor(extraWeek.dateISO)), { Mandag: extraWeek.entries, lastUpdated: NOW });
  });
}
const opts = (firestore: ReturnType<typeof ownerDb>) => ({ now: NOW, horizonEndDate: HORIZON, firestore });
const sel = { id: 'occ-w2', seriesId: SERIES, occurrenceDateISO: FROM };

beforeEach(async () => { await testEnv.clearFirestore(); });

describe('seriesDeleteService (emulator, production rules)', () => {
  it('owner delete: marks occurrences isDeleted in place and ends the definition', async () => {
    await seed();
    const res = await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: sel }, opts(ownerDb()));
    expect(res).toEqual({ ok: true, counts: { definitionUpdates: 1, deletions: 3, total: 4 } });
    expect(field((await getDoc(doc(ownerDb(), seriesPath(SERIES)))).data(), 'endDate')).toBe('2026-01-11');
    for (const d of ['2026-01-12', '2026-01-19', '2026-01-26']) {
      const arr = dayArr((await getDoc(doc(ownerDb(), weekPathFor(d)))).data());
      expect(arr).toHaveLength(1);
      expect(arr[0]).toMatchObject({ isDeleted: true, deletedAt: NOW });
      expect(arr[0].cancellationReason).toBeUndefined();
    }
  });

  it('the ended definition blocks the materializer; isDeleted occurrences are not regenerated/overwritten', async () => {
    await seed({ dateISO: '2026-01-05', entries: [occ('occ-w1')] });
    await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: sel }, opts(ownerDb()));
    const mat = await materializeSeries({ fighterKey: OWNER, seriesId: SERIES }, { now: NOW, horizonEndDate: HORIZON, firestore: ownerDb() });
    if (mat.ok) expect(mat.totalCreated).toBe(0);
    for (const d of ['2026-01-12', '2026-01-19', '2026-01-26']) {
      const arr = dayArr((await getDoc(doc(ownerDb(), weekPathFor(d)))).data());
      expect(arr).toHaveLength(1);
      expect(arr[0]).toMatchObject({ isDeleted: true });
    }
  });

  it('admin deliberate cross-owner delete SUCCEEDS under the admin read rule', async () => {
    await seed();
    const res = await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: sel }, opts(adminDb()));
    expect(res).toEqual({ ok: true, counts: { definitionUpdates: 1, deletions: 3, total: 4 } });
    expect(field((await getDoc(doc(ownerDb(), seriesPath(SERIES)))).data(), 'endDate')).toBe('2026-01-11');
  });

  it('coach cross-owner delete FAILS (no coach eventSeries read) with zero writes', async () => {
    await seed();
    const res = await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: sel }, opts(coachDb()));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe('transaction');
    expect(field((await getDoc(doc(ownerDb(), seriesPath(SERIES)))).data(), 'endDate')).toBeNull();
    expect(dayArr((await getDoc(doc(ownerDb(), weekPathFor('2026-01-12')))).data())[0].isDeleted).toBeUndefined();
  });

  it('teammate cross-owner delete FAILS with zero writes', async () => {
    await seed();
    const res = await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: sel }, opts(teammateDb()));
    expect(res.ok).toBe(false);
    expect(field((await getDoc(doc(ownerDb(), seriesPath(SERIES)))).data(), 'endDate')).toBeNull();
  });

  it('ordinary admin creation/editing of another fighter remains unaffected (direct eventSeries write allowed)', async () => {
    await seed();
    await setDoc(doc(adminDb(), seriesPath('series-admin')), { ...DEF, id: 'series-admin' });
    expect((await getDoc(doc(ownerDb(), seriesPath('series-admin')))).exists()).toBe(true);
  });

  it('leaves no partial state when the planner rejects (conflicting suppression)', async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${seriesPath(SERIES)}/suppressions/2026-01-19`), { seriesId: SERIES, occurrenceDateISO: '2026-01-19', createdAt: NOW });
    });
    const res = await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: sel }, opts(ownerDb()));
    expect(res).toMatchObject({ ok: false, kind: 'planner', reason: 'conflicting_occurrence_and_suppression' });
    expect(field((await getDoc(doc(ownerDb(), seriesPath(SERIES)))).data(), 'endDate')).toBeNull();
    expect(dayArr((await getDoc(doc(ownerDb(), weekPathFor('2026-01-12')))).data())[0].isDeleted).toBeUndefined();
  });
});
