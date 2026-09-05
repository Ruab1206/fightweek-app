/**
 * seriesSplitService.test.ts — Slice 2b-2 atomic persistence adapter with a
 * mocked `firebase/firestore` in-memory transaction harness (no real Firestore
 * / emulator). The harness models optimistic-concurrency retry: a configured
 * concurrent mutation forces exactly one re-run of the updater against the
 * mutated store, discarding the first attempt's buffered writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getISOWeekForDate } from '../utils/dateUtils';

// ---- firebase/firestore mock: in-memory store keyed by ref path ----
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
    const result = await updater(tx); // may throw → propagate, nothing committed
    callAttempts.push(writes);
    if (!didMutate && concurrentMutation) {
      didMutate = true;
      concurrentMutation(); // simulate a concurrent commit → forces one retry
      continue;
    }
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

import { persistSeriesSplitAtomically } from './seriesSplitService';

const OWNER = 'fighter@example.com';
const OLD = 'old-series-1';
const NEW = 'new-series-2';
const NOW = '2026-01-01T00:00:00.000Z';
const SPLIT = '2026-01-12'; // Monday
const HORIZON = '2026-01-26'; // bounds candidates to 3 Mondays: 01-12, 01-19, 01-26

const EDITED = { title: 'Evening MMA', discipline: 'MMA', location: 'Gym B', startTime: '18:00', endTime: '19:30' };

function seriesPath(id: string) { return `artifacts/production/users/${OWNER}/eventSeries/${id}`; }
function suppPath(seriesId: string, dateISO: string) { return `artifacts/production/users/${OWNER}/eventSeries/${seriesId}/suppressions/${dateISO}`; }
function weekPathFor(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const wk = getISOWeekForDate(new Date(y, m - 1, d));
  return `artifacts/production/users/${OWNER}/weeks/week_${wk}`;
}
function occ(id: string) {
  return { id, seriesId: OLD, name: 'Morning MMA', category: 'MMA', location: 'Gym A', start: '07:00', end: '08:30', status: 'active', isRecurring: true, day: 'Mandag' };
}
function seedOldDef(overrides: Record<string, unknown> = {}) {
  store.set(seriesPath(OLD), {
    id: OLD, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
    dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: '2026-01-05', intervalWeeks: 1, endDate: null,
    status: 'active', createdAt: NOW, updatedAt: NOW, ...overrides,
  });
}
function seedThreeWeeks() {
  store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
  store.set(weekPathFor('2026-01-19'), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
  store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
}
const SELECTED = { id: 'occ-w2', seriesId: OLD, occurrenceDateISO: SPLIT };
function run(overrides: Partial<{ selected: any; edited: any }> = {}) {
  return persistSeriesSplitAtomically(
    { fighterKey: OWNER, selected: overrides.selected ?? SELECTED, edited: overrides.edited ?? EDITED },
    { newSeriesId: NEW, now: NOW, horizonEndDate: HORIZON },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  callAttempts = [];
  concurrentMutation = null;
});

describe('seriesSplitService — transaction success', () => {
  it('commits a complete split atomically in one transaction', async () => {
    seedOldDef();
    seedThreeWeeks();
    const res = await run();
    expect(res).toEqual({ ok: true, newSeriesId: NEW, counts: { definitionUpdates: 1, definitionCreates: 1, occurrenceReparents: 3, suppressionContinuations: 0, total: 5 } });
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(callAttempts).toHaveLength(1);
  });

  it('creates the new definition correctly', async () => {
    seedOldDef();
    seedThreeWeeks();
    await run();
    const newDef = store.get(seriesPath(NEW));
    expect(newDef.id).toBe(NEW);
    expect(newDef.startDate).toBe(SPLIT);
    expect(newDef.title).toBe('Evening MMA');
    expect(newDef.location).toBe('Gym B');
    expect(newDef.startTime).toBe('18:00');
    expect(newDef.status).toBe('active');
  });

  it('ends the old definition (endDate = day before split), not discontinued', async () => {
    seedOldDef();
    seedThreeWeeks();
    await run();
    const oldDef = store.get(seriesPath(OLD));
    expect(oldDef.endDate).toBe('2026-01-11');
    expect(oldDef.status).toBe('active');
    expect(oldDef.updatedAt).toBe(NOW);
  });

  it('discontinues the old definition when the anchor is its first occurrence', async () => {
    seedOldDef({ startDate: SPLIT });
    seedThreeWeeks();
    await run();
    const oldDef = store.get(seriesPath(OLD));
    expect(oldDef.status).toBe('discontinued');
  });

  it('re-parents every forward occurrence with new seriesId + edited fields, preserving id and date', async () => {
    seedOldDef();
    seedThreeWeeks();
    await run();
    for (const [dateISO, id] of [['2026-01-12', 'occ-w2'], ['2026-01-19', 'occ-w3'], ['2026-01-26', 'occ-w4']] as const) {
      const wk = store.get(weekPathFor(dateISO));
      const entry = wk.Mandag.find((s: any) => s.id === id);
      expect(entry.seriesId).toBe(NEW);
      expect(entry.name).toBe('Evening MMA');
      expect(entry.start).toBe('18:00');
      expect(entry.end).toBe('19:30');
      expect(entry.location).toBe('Gym B');
    }
  });

  it('persists suppression continuity for a future cancelled occurrence', async () => {
    seedOldDef();
    store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-19'), { Mandag: [{ ...occ('occ-w3'), status: 'cancelled' }], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
    const res = await run();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(store.get(suppPath(NEW, '2026-01-19'))).toMatchObject({ seriesId: NEW, occurrenceDateISO: '2026-01-19', reason: 'deleted' });
    // Cancelled occurrence NOT re-parented — stays on old series untouched.
    const wk = store.get(weekPathFor('2026-01-19'));
    expect(wk.Mandag[0].seriesId).toBe(OLD);
    expect(wk.Mandag[0].status).toBe('cancelled');
    expect(res.counts).toMatchObject({ occurrenceReparents: 2, suppressionContinuations: 1 });
  });

  it('copies an existing forward suppression forward to the new series', async () => {
    seedOldDef();
    // 01-19 has no stored occurrence but a suppression on the old series.
    store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-19'), { Mandag: [], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
    store.set(suppPath(OLD, '2026-01-19'), { seriesId: OLD, occurrenceDateISO: '2026-01-19', reason: 'deleted', createdAt: NOW });
    const res = await run();
    expect(res.ok).toBe(true);
    expect(store.get(suppPath(NEW, '2026-01-19'))).toMatchObject({ seriesId: NEW, occurrenceDateISO: '2026-01-19' });
  });
});

describe('seriesSplitService — rollback (zero writes)', () => {
  it('planner failure (conflicting active occurrence + suppression) writes nothing', async () => {
    seedOldDef();
    seedThreeWeeks(); // occ-w3 is active
    store.set(suppPath(OLD, '2026-01-19'), { seriesId: OLD, occurrenceDateISO: '2026-01-19', reason: 'deleted', createdAt: NOW });
    const res = await run();
    expect(res).toEqual({ ok: false, kind: 'planner', reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: '2026-01-19' });
    expect(store.get(seriesPath(NEW))).toBeUndefined();
    expect(store.get(seriesPath(OLD)).endDate).toBeNull();
    expect(store.get(weekPathFor('2026-01-12')).Mandag[0].seriesId).toBe(OLD);
  });

  it('missing definition writes nothing', async () => {
    seedThreeWeeks(); // no old def seeded
    const res = await run();
    expect(res).toEqual({ ok: false, kind: 'planner', reason: 'missing_definition' });
    expect(store.get(seriesPath(NEW))).toBeUndefined();
  });

  it('legacy occurrence (no seriesId) fails closed before the transaction', async () => {
    const res = await persistSeriesSplitAtomically(
      { fighterKey: OWNER, selected: { id: 'x', occurrenceDateISO: SPLIT } as any, edited: EDITED },
      { newSeriesId: NEW, now: NOW, horizonEndDate: HORIZON },
    );
    expect(res).toEqual({ ok: false, kind: 'planner', reason: 'unsupported_legacy_occurrence' });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('transaction failure surfaces as a typed transaction result and writes nothing', async () => {
    seedOldDef();
    seedThreeWeeks();
    mockRunTransaction.mockImplementationOnce(async () => { throw new Error('network down'); });
    const res = await run();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe('transaction');
    expect(store.get(seriesPath(NEW))).toBeUndefined();
  });
});

describe('seriesSplitService — retry safety', () => {
  it('reuses the same newSeriesId across an updater retry and creates no duplicate definition', async () => {
    seedOldDef();
    seedThreeWeeks();
    // Force one retry via a benign concurrent touch of a read week doc.
    concurrentMutation = () => {
      const p = weekPathFor('2026-01-26');
      store.set(p, { ...store.get(p), lastUpdated: '2026-01-02T00:00:00.000Z' });
    };
    // Do NOT inject newSeriesId → prove it is minted once, outside the updater.
    const res = await persistSeriesSplitAtomically({ fighterKey: OWNER, selected: SELECTED, edited: EDITED }, { now: NOW, horizonEndDate: HORIZON });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(callAttempts).toHaveLength(2);
    const newDefPath = seriesPath(res.newSeriesId);
    const attempt0Def = callAttempts[0].find((w) => w.path === newDefPath);
    const attempt1Def = callAttempts[1].find((w) => w.path === newDefPath);
    expect(attempt0Def).toBeDefined();
    expect(attempt1Def).toBeDefined();
    // Exactly one new definition doc exists after commit.
    const newDefDocs = [...store.keys()].filter((k) => k.startsWith('artifacts/production/users/' + OWNER + '/eventSeries/') && k.endsWith('/' + res.newSeriesId));
    expect(newDefDocs).toHaveLength(1);
  });

  it('deterministic suppression id means a retry does not create duplicate suppressions', async () => {
    seedOldDef();
    store.set(weekPathFor('2026-01-12'), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-19'), { Mandag: [{ ...occ('occ-w3'), status: 'cancelled' }], lastUpdated: NOW });
    store.set(weekPathFor('2026-01-26'), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
    concurrentMutation = () => {
      const p = weekPathFor('2026-01-26');
      store.set(p, { ...store.get(p), lastUpdated: '2026-01-02T00:00:00.000Z' });
    };
    const res = await run();
    expect(res.ok).toBe(true);
    const suppDocs = [...store.keys()].filter((k) => k === suppPath(NEW, '2026-01-19'));
    expect(suppDocs).toHaveLength(1);
  });
});

describe('seriesSplitService — concurrency', () => {
  it('preserves a concurrent unrelated same-week edit (transaction retries against fresh data)', async () => {
    seedOldDef();
    seedThreeWeeks();
    concurrentMutation = () => {
      const p = weekPathFor('2026-01-19');
      const wk = store.get(p);
      store.set(p, { ...wk, Mandag: [...wk.Mandag, { id: 'unrelated-1', name: 'Yoga', start: '20:00', end: '21:00', status: 'active' }] });
    };
    const res = await run();
    expect(res.ok).toBe(true);
    const wk = store.get(weekPathFor('2026-01-19'));
    // Unrelated session survived AND the series occurrence was re-parented.
    expect(wk.Mandag.find((s: any) => s.id === 'unrelated-1')).toBeDefined();
    expect(wk.Mandag.find((s: any) => s.id === 'occ-w3').seriesId).toBe(NEW);
  });

  it('resolves a concurrent same-occurrence edit safely (split fields win on retry, no crash)', async () => {
    seedOldDef();
    seedThreeWeeks();
    concurrentMutation = () => {
      const p = weekPathFor('2026-01-19');
      const wk = store.get(p);
      const clone = structuredClone(wk);
      clone.Mandag[0].name = 'Concurrently renamed';
      store.set(p, clone);
    };
    const res = await run();
    expect(res.ok).toBe(true);
    const entry = store.get(weekPathFor('2026-01-19')).Mandag.find((s: any) => s.id === 'occ-w3');
    expect(entry.seriesId).toBe(NEW);
    expect(entry.name).toBe('Evening MMA');
  });

  it('carries forward a concurrently-created suppression (cancelled + suppression on retry)', async () => {
    seedOldDef();
    seedThreeWeeks();
    concurrentMutation = () => {
      // A concurrent single-occurrence deletion: cancels the occurrence AND writes a suppression.
      const p = weekPathFor('2026-01-19');
      const wk = structuredClone(store.get(p));
      wk.Mandag[0].status = 'cancelled';
      store.set(p, wk);
      store.set(suppPath(OLD, '2026-01-19'), { seriesId: OLD, occurrenceDateISO: '2026-01-19', reason: 'deleted', createdAt: NOW });
    };
    const res = await run();
    expect(res.ok).toBe(true);
    expect(store.get(suppPath(NEW, '2026-01-19'))).toMatchObject({ seriesId: NEW, occurrenceDateISO: '2026-01-19' });
    expect(store.get(weekPathFor('2026-01-19')).Mandag[0].seriesId).toBe(OLD);
  });

  it('fails safely (stale) against a competing split that already re-parented the anchor — no duplicate definition', async () => {
    seedOldDef();
    seedThreeWeeks();
    concurrentMutation = () => {
      // Competing split moved every occurrence to another series and ended the old def.
      for (const dateISO of ['2026-01-12', '2026-01-19', '2026-01-26']) {
        const p = weekPathFor(dateISO);
        const wk = structuredClone(store.get(p));
        wk.Mandag[0].seriesId = 'other-new-series';
        store.set(p, wk);
      }
      store.set(seriesPath(OLD), { ...store.get(seriesPath(OLD)), endDate: '2026-01-11' });
    };
    const res = await run();
    expect(res).toEqual({ ok: false, kind: 'stale', reason: 'anchor_not_found' });
    // No new definition created.
    expect(store.get(seriesPath(NEW))).toBeUndefined();
  });
});

describe('seriesSplitService — identity preservation (Notes / TrainingLog)', () => {
  it('preserves occurrence id and date so Note (s_{date}_{id}) and TrainingLog keys still resolve', async () => {
    seedOldDef();
    seedThreeWeeks();
    await run();
    for (const [dateISO, id] of [['2026-01-12', 'occ-w2'], ['2026-01-19', 'occ-w3'], ['2026-01-26', 'occ-w4']] as const) {
      const entry = store.get(weekPathFor(dateISO)).Mandag.find((s: any) => s.id === id);
      expect(entry).toBeDefined();
      expect(entry.id).toBe(id); // id unchanged
      // date is the week/day slot — unchanged because the occurrence stayed in place
      expect(`s_${dateISO}_${entry.id}`).toBe(`s_${dateISO}_${id}`);
    }
  });
});
