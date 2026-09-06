/**
 * seriesDeleteService.test.ts — atomic delete-this-and-following persistence
 * with a mocked `firebase/firestore` in-memory transaction harness (no real
 * Firestore / emulator). The harness models optimistic-concurrency retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getISOWeekForDate } from '../utils/dateUtils';

const store = new Map<string, any>();
let callAttempts: Array<Array<{ path: string; data: any; mode: 'set' | 'update' }>> = [];
let concurrentMutation: (() => void) | null = null;

function snapFor(path: string) {
  const data = store.get(path);
  return { exists: () => data !== undefined, data: () => data };
}
const mockDoc = vi.fn((_db: unknown, ...rest: string[]) => ({ __ref: rest.join('/') }));
const mockRunTransaction = vi.fn(async (_db: unknown, updater: (tx: any) => Promise<any>) => {
  callAttempts = [];
  let didMutate = false;
  for (;;) {
    const writes: Array<{ path: string; data: any; mode: 'set' | 'update' }> = [];
    const tx = {
      get: async (ref: any) => snapFor(ref.__ref),
      set: (ref: any, data: any) => writes.push({ path: ref.__ref, data, mode: 'set' }),
      update: (ref: any, data: any) => writes.push({ path: ref.__ref, data, mode: 'update' }),
    };
    const result = await updater(tx);
    callAttempts.push(writes);
    if (!didMutate && concurrentMutation) { didMutate = true; concurrentMutation(); continue; }
    for (const w of writes) {
      if (w.mode === 'set') store.set(w.path, w.data);
      else store.set(w.path, { ...(store.get(w.path) ?? {}), ...w.data });
    }
    return result;
  }
});

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => (mockDoc as any)(...args),
  runTransaction: (...args: any[]) => (mockRunTransaction as any)(...args),
}));
vi.mock('../config/firebase', () => ({ db: {} }));

import { persistSeriesDeleteAtomically } from './seriesDeleteService';

const OWNER = 'fighter@example.com';
const SERIES = 'series-1';
const OTHER = 'series-2';
const NOW = '2026-02-01T00:00:00.000Z';
const START = '2026-01-05';
const FROM = '2026-01-12';
const HORIZON = '2026-01-26';

function seriesPath(id: string) { return `artifacts/production/users/${OWNER}/eventSeries/${id}`; }
function suppPath(seriesId: string, dateISO: string) { return `artifacts/production/users/${OWNER}/eventSeries/${seriesId}/suppressions/${dateISO}`; }
function weekPathFor(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `artifacts/production/users/${OWNER}/weeks/week_${getISOWeekForDate(new Date(y, m - 1, d))}`;
}
function occ(id: string, seriesId = SERIES, extra: Record<string, unknown> = {}) {
  return { id, seriesId, name: 'Morning MMA', category: 'MMA', location: 'Gym A', start: '07:00', end: '08:30', status: 'active', isRecurring: true, day: 'Mandag', ...extra };
}
function seedDef(overrides: Record<string, unknown> = {}) {
  store.set(seriesPath(SERIES), {
    id: SERIES, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
    dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: START, intervalWeeks: 1, endDate: null,
    status: 'active', createdAt: NOW, updatedAt: NOW, ...overrides,
  });
}
function seedThreeWeeks() {
  store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
  store.set(weekPathFor('2026-01-19'), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
  store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
}
const SELECTED = { id: 'occ-w2', seriesId: SERIES, occurrenceDateISO: FROM };
function run(selected: any = SELECTED) {
  return persistSeriesDeleteAtomically({ fighterKey: OWNER, selected }, { now: NOW, horizonEndDate: HORIZON });
}

beforeEach(() => { vi.clearAllMocks(); store.clear(); callAttempts = []; concurrentMutation = null; });

describe('seriesDeleteService — atomic invisible deletion', () => {
  it('commits in one transaction and marks every forward occurrence isDeleted', async () => {
    seedDef(); seedThreeWeeks();
    const res = await run();
    expect(res).toEqual({ ok: true, counts: { definitionUpdates: 1, deletions: 3, total: 4 } });
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    for (const d of ['2026-01-12', '2026-01-19', '2026-01-26']) {
      const arr = store.get(weekPathFor(d)).Mandag;
      expect(arr).toHaveLength(1); // physically retained
      expect(arr[0]).toMatchObject({ isDeleted: true, deletedAt: NOW });
    }
  });

  it('never physically removes an occurrence and never sets cancellation fields', async () => {
    seedDef(); seedThreeWeeks();
    await run();
    const e = store.get(weekPathFor('2026-01-12')).Mandag[0];
    expect(e.id).toBe('occ-w2');
    expect(e.seriesId).toBe(SERIES);
    expect(e.status).toBe('active'); // status untouched — NOT converted to cancelled
    expect(e.cancellationReason).toBeUndefined();
    expect(e.cancellationTime).toBeUndefined();
  });

  it('uses one stable deletedAt across all marks', async () => {
    seedDef(); seedThreeWeeks();
    await run();
    const stamps = ['2026-01-12', '2026-01-19', '2026-01-26'].map((d) => store.get(weekPathFor(d)).Mandag[0].deletedAt);
    expect(new Set(stamps)).toEqual(new Set([NOW]));
  });

  it('ends the definition the day before the selected date', async () => {
    seedDef(); seedThreeWeeks();
    await run();
    const def = store.get(seriesPath(SERIES));
    expect(def.endDate).toBe('2026-01-11');
    expect(def.status).toBe('active');
  });

  it('discontinues the definition when deleting from its first occurrence', async () => {
    seedDef();
    store.set(weekPathFor(START), { Mandag: [occ('occ-w1')], lastUpdated: NOW });
    seedThreeWeeks();
    const res = await run({ id: 'occ-w1', seriesId: SERIES, occurrenceDateISO: START });
    expect(res.ok).toBe(true);
    expect(store.get(seriesPath(SERIES)).status).toBe('discontinued');
  });

  it('writes no suppression documents and touches no notes/logs paths', async () => {
    seedDef(); seedThreeWeeks();
    await run();
    for (const w of callAttempts[0]) {
      expect(w.path.includes('/suppressions/') || w.path.includes('/meta/notes') || w.path.includes('/eventLogs/')).toBe(false);
    }
  });
});

describe('seriesDeleteService — isolation & preservation', () => {
  it('never affects a same-tuple sibling series', async () => {
    seedDef();
    store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2'), occ('sib-w2', OTHER)], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-19'), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
    await run();
    const arr = store.get(weekPathFor('2026-01-12')).Mandag;
    expect(arr.find((s: any) => s.id === 'sib-w2')).toEqual(occ('sib-w2', OTHER)); // untouched
    expect(arr.find((s: any) => s.id === 'occ-w2').isDeleted).toBe(true);
  });

  it('preserves unrelated activities in the same week document', async () => {
    seedDef();
    const other = { id: 'yoga', name: 'Yoga', start: '18:00', end: '19:00', status: 'active', day: 'Mandag' };
    store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2'), other], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-19'), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
    await run();
    expect(store.get(weekPathFor('2026-01-12')).Mandag.find((s: any) => s.id === 'yoga')).toEqual(other);
  });
});

describe('seriesDeleteService — concurrency & repeat', () => {
  it('preserves a concurrent unrelated same-week edit through a retry', async () => {
    seedDef(); seedThreeWeeks();
    concurrentMutation = () => {
      const path = weekPathFor('2026-01-19');
      const cur = store.get(path);
      store.set(path, { ...cur, Mandag: [...cur.Mandag, { id: 'yoga', name: 'Yoga', status: 'active', day: 'Mandag', start: '18:00' }] });
    };
    const res = await run();
    expect(res.ok).toBe(true);
    expect(callAttempts).toHaveLength(2);
    const w3 = store.get(weekPathFor('2026-01-19')).Mandag;
    expect(w3.find((s: any) => s.id === 'yoga')).toBeTruthy();
    expect(w3.find((s: any) => s.id === 'occ-w3').isDeleted).toBe(true);
  });

  it('is safely stale on a repeat run (definition already ended)', async () => {
    seedDef(); seedThreeWeeks();
    await run();
    const res2 = await run();
    expect(res2).toMatchObject({ ok: false, kind: 'planner', reason: 'selected_after_definition_end' });
  });
});

describe('seriesDeleteService — fail closed (rollback)', () => {
  it('returns a planner failure and writes nothing for a legacy occurrence', async () => {
    seedDef(); seedThreeWeeks();
    const res = await persistSeriesDeleteAtomically({ fighterKey: OWNER, selected: { id: 'x', occurrenceDateISO: FROM } }, { now: NOW, horizonEndDate: HORIZON });
    expect(res).toEqual({ ok: false, kind: 'planner', reason: 'unsupported_legacy_occurrence' });
    expect(store.get(weekPathFor('2026-01-12')).Mandag[0].isDeleted).toBeUndefined();
  });

  it('aborts (no writes) when a live occurrence conflicts with a suppression', async () => {
    seedDef(); seedThreeWeeks();
    store.set(suppPath(SERIES, '2026-01-19'), { seriesId: SERIES, occurrenceDateISO: '2026-01-19', createdAt: NOW });
    const res = await run();
    expect(res).toMatchObject({ ok: false, kind: 'planner', reason: 'conflicting_occurrence_and_suppression' });
    expect(store.get(seriesPath(SERIES)).endDate).toBeNull();
    expect(store.get(weekPathFor('2026-01-12')).Mandag[0].isDeleted).toBeUndefined();
  });
});

describe('seriesDeleteService — year-boundary week-document lookup', () => {
  // Anchored the Monday before an ISO year boundary so the forward horizon
  // spans both the same year and the next one.
  const Y_START = '2026-12-14';
  const Y_NOW = '2026-12-22T00:00:00.000Z';
  const Y_HORIZON = '2027-02-01';
  const EARLIER = '2026-12-14';      // before the selected date — must stay untouched
  const SELECTED_DATE = '2026-12-21'; // delete-this-and-following anchor
  const SAME_YEAR_FWD = '2026-12-28'; // forward, but no year boundary crossed yet
  const NEXT_YEAR_1 = '2027-01-04';   // forward, crosses into the next ISO year
  const NEXT_YEAR_2 = '2027-01-11';   // forward, further into the next ISO year

  /**
   * Independently mirrors the REAL production recurring-session creation
   * path's week-document convention (computeRecurringWeeks/getDaysInRange in
   * src/hooks/useSessionHandlers.ts + src/utils/dateUtils.ts): the series
   * anchor's own ISO week plus a whole-week offset, which keeps incrementing
   * and never resets at a calendar-year boundary. Built from first principles
   * here — it never calls into seriesDeleteService.ts or its helpers, so it
   * cannot accidentally encode the same assumption as the code under test.
   */
  function productionWeekPathFor(dateISO: string) {
    const [sy, sm, sd] = Y_START.split('-').map(Number);
    const anchorWeek = getISOWeekForDate(new Date(sy, sm - 1, sd));
    const [ty, tm, td] = dateISO.split('-').map(Number);
    const diffDays = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000);
    return `artifacts/production/users/${OWNER}/weeks/week_${anchorWeek + diffDays / 7}`;
  }

  function seedYearBoundarySeries() {
    store.set(seriesPath(SERIES), {
      id: SERIES, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
      dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: Y_START, intervalWeeks: 1, endDate: null,
      status: 'active', createdAt: Y_NOW, updatedAt: Y_NOW,
    });
    store.set(productionWeekPathFor(EARLIER), { Mandag: [occ('occ-earlier')], lastUpdated: Y_NOW });
    store.set(productionWeekPathFor(SELECTED_DATE), { Mandag: [occ('occ-selected'), occ('occ-unrelated', OTHER)], lastUpdated: Y_NOW });
    store.set(productionWeekPathFor(SAME_YEAR_FWD), { Mandag: [occ('occ-same-year-fwd')], lastUpdated: Y_NOW });
    store.set(productionWeekPathFor(NEXT_YEAR_1), { Mandag: [occ('occ-next-year-1')], lastUpdated: Y_NOW });
    store.set(productionWeekPathFor(NEXT_YEAR_2), { Mandag: [occ('occ-next-year-2')], lastUpdated: Y_NOW });
  }

  function runYearBoundary() {
    const selected = { id: 'occ-selected', seriesId: SERIES, occurrenceDateISO: SELECTED_DATE };
    return persistSeriesDeleteAtomically({ fighterKey: OWNER, selected }, { now: Y_NOW, horizonEndDate: Y_HORIZON });
  }

  it('marks the selected occurrence and every persisted future occurrence — including across the ISO year boundary — isDeleted, while leaving the earlier occurrence and an unrelated series untouched', async () => {
    seedYearBoundarySeries();
    const res = await runYearBoundary();

    // Characterizes the defect: pre-fix, the two next-year dates are looked
    // up under the wrong (annually-reset) week document and never reached,
    // so `deletions` stops at 2 instead of 4. This is the assertion that
    // fails against pre-fix behavior for the intended reason.
    expect(res).toEqual({ ok: true, counts: { definitionUpdates: 1, deletions: 4, total: 5 } });

    const earlier = store.get(productionWeekPathFor(EARLIER)).Mandag[0];
    expect(earlier.id).toBe('occ-earlier');
    expect(earlier.isDeleted).toBeUndefined(); // earlier occurrence unaffected

    for (const [dateISO, id] of [
      [SELECTED_DATE, 'occ-selected'],
      [SAME_YEAR_FWD, 'occ-same-year-fwd'],
      [NEXT_YEAR_1, 'occ-next-year-1'],
      [NEXT_YEAR_2, 'occ-next-year-2'],
    ] as const) {
      const entry = store.get(productionWeekPathFor(dateISO)).Mandag.find((s: any) => s.id === id);
      expect(entry).toMatchObject({ id, seriesId: SERIES, isDeleted: true, deletedAt: Y_NOW });
    }

    // Unrelated series sharing the selected week's document is untouched.
    const sharedWeek = store.get(productionWeekPathFor(SELECTED_DATE)).Mandag;
    expect(sharedWeek.find((s: any) => s.id === 'occ-unrelated')).toEqual(occ('occ-unrelated', OTHER));
  });
});
