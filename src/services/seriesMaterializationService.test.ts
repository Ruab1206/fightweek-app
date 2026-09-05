/**
 * seriesMaterializationService.test.ts — Slice 2c-2 persistence adapter with a
 * mocked `firebase/firestore` in-memory transaction harness (no real Firestore
 * / emulator). The harness models optimistic-concurrency retry: a configured
 * concurrent mutation forces exactly one re-run of a week's updater against the
 * mutated store, discarding the first attempt's buffered writes. Deterministic
 * concurrency/retry orchestration is proven HERE; real cross-client Firestore
 * behavior is proven separately in the emulator suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getISOWeekForDate } from '../utils/dateUtils';
import { materializedOccurrenceId } from '../domain/calendar/materializationPlan';

// ---- firebase/firestore mock: in-memory store keyed by ref path ----
const store = new Map<string, any>();
let concurrentMutation: (() => void) | null = null;

function snapFor(path: string) {
  const data = store.get(path);
  return { exists: () => data !== undefined, data: () => data };
}

const mockDoc = vi.fn((_db: unknown, ...rest: string[]) => ({ __ref: rest.join('/') }));
const mockGetDoc = vi.fn(async (ref: any) => snapFor(ref.__ref));
const mockCollection = vi.fn((_db: unknown, ...rest: string[]) => ({ __col: rest.join('/') }));
// Shallow collection read: direct children only (one more path segment, no deeper).
const mockGetDocs = vi.fn(async (col: any) => {
  const prefix = `${col.__col}/`;
  const docs: Array<{ id: string; data: () => any }> = [];
  for (const [path, data] of store.entries()) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    if (rest.includes('/')) continue; // nested subcollection doc → not a direct child
    docs.push({ id: rest, data: () => data });
  }
  return { docs };
});

const mockRunTransaction = vi.fn(async (_db: unknown, updater: (tx: any) => Promise<any>) => {
  let didMutate = false;
  for (;;) {
    const writes: Array<{ path: string; data: any; mode: 'set' | 'update' }> = [];
    const tx = {
      get: async (ref: any) => snapFor(ref.__ref),
      set: (ref: any, data: any) => writes.push({ path: ref.__ref, data, mode: 'set' }),
      update: (ref: any, data: any) => writes.push({ path: ref.__ref, data, mode: 'update' }),
    };
    const result = await updater(tx); // may throw → propagate, nothing committed
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
  getDoc: (...args: any[]) => (mockGetDoc as any)(...args),
  collection: (...args: any[]) => (mockCollection as any)(...args),
  getDocs: (...args: any[]) => (mockGetDocs as any)(...args),
  runTransaction: (...args: any[]) => (mockRunTransaction as any)(...args),
}));
vi.mock('../config/firebase', () => ({ db: {} }));

import { materializeSeries, listActiveOwnerSeriesDefinitions } from './seriesMaterializationService';

const OWNER = 'fighter@example.com';
const SERIES = 'series-1';
const NOW = '2026-01-01T00:00:00.000Z';
const HORIZON = '2026-01-19'; // 3 Mondays: 01-05, 01-12, 01-19

function seriesPath(id: string) { return `artifacts/production/users/${OWNER}/eventSeries/${id}`; }
function suppPath(seriesId: string, dateISO: string) { return `artifacts/production/users/${OWNER}/eventSeries/${seriesId}/suppressions/${dateISO}`; }
function weekPathFor(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const wk = getISOWeekForDate(new Date(y, m - 1, d));
  return `artifacts/production/users/${OWNER}/weeks/week_${wk}`;
}
function dayEntry(dateISO: string, overrides: Record<string, unknown> = {}) {
  return {
    id: materializedOccurrenceId(SERIES, dateISO),
    seriesId: SERIES,
    day: 'Mandag',
    name: 'Morning MMA',
    category: 'MMA',
    location: 'Gym A',
    start: '07:00',
    end: '08:30',
    status: 'active',
    isRecurring: true,
    ...overrides,
  };
}
function seedDef(overrides: Record<string, unknown> = {}) {
  store.set(seriesPath(SERIES), {
    id: SERIES, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
    dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: '2026-01-05', intervalWeeks: 1, endDate: null,
    status: 'active', createdAt: NOW, updatedAt: NOW, ...overrides,
  });
}

function run(opts: Record<string, unknown> = {}) {
  return materializeSeries({ fighterKey: OWNER, seriesId: SERIES }, { now: NOW, horizonEndDate: HORIZON, ...opts });
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  concurrentMutation = null;
});

describe('seriesMaterializationService — planner success consumed correctly', () => {
  it('materializes every candidate date into its own week transaction', async () => {
    seedDef();
    const res = await run();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.totalCreated).toBe(3);
    expect(res.weeks).toHaveLength(3);
    expect(res.weeks.every((w) => w.ok)).toBe(true);
    // One transaction per affected week document.
    expect(mockRunTransaction).toHaveBeenCalledTimes(3);
    for (const date of ['2026-01-05', '2026-01-12', '2026-01-19']) {
      const week = store.get(weekPathFor(date));
      expect(week.Mandag).toHaveLength(1);
      expect(week.Mandag[0].id).toBe(materializedOccurrenceId(SERIES, date));
      expect(week.Mandag[0].seriesId).toBe(SERIES);
      expect(week.lastUpdated).toBe(NOW);
    }
  });

  it('uses the deterministic occurrence id — never a random id', async () => {
    seedDef();
    const res = await run();
    if (!res.ok) return;
    const createdIds = res.weeks.flatMap((w) => (w.ok ? w.created : []));
    expect(createdIds).toEqual([
      materializedOccurrenceId(SERIES, '2026-01-05'),
      materializedOccurrenceId(SERIES, '2026-01-12'),
      materializedOccurrenceId(SERIES, '2026-01-19'),
    ]);
  });

  it('preserves unrelated same-week activity in the week document', async () => {
    seedDef();
    const other = { id: 'other-1', seriesId: 'x', name: 'BJJ', start: '19:00', end: '20:00', status: 'active', day: 'Mandag' };
    store.set(weekPathFor('2026-01-12'), { Mandag: [other], Tirsdag: [{ id: 't1', name: 'Run', start: '06:00' }], lastUpdated: NOW });
    const res = await run();
    if (!res.ok) return;
    const week = store.get(weekPathFor('2026-01-12'));
    expect(week.Mandag.map((s: any) => s.id)).toContain('other-1');
    expect(week.Mandag).toHaveLength(2); // other + the materialized one
    expect(week.Tirsdag).toEqual([{ id: 't1', name: 'Run', start: '06:00' }]); // untouched
  });

  it('honors an explicit endDate that precedes the horizon', async () => {
    seedDef({ endDate: '2026-01-12' });
    const res = await run();
    if (!res.ok) return;
    expect(res.totalCreated).toBe(2); // 01-05, 01-12 only
    expect(store.get(weekPathFor('2026-01-19'))).toBeUndefined();
  });
});

describe('seriesMaterializationService — definition fail-closed (pre-flight)', () => {
  it('returns a definition failure when the definition is missing', async () => {
    const res = await run();
    expect(res).toEqual({ ok: false, kind: 'definition', reason: 'missing_definition' });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('returns a definition failure for a discontinued series', async () => {
    seedDef({ status: 'discontinued' });
    const res = await run();
    expect(res).toEqual({ ok: false, kind: 'definition', reason: 'discontinued_series' });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('returns a definition failure for a malformed interval', async () => {
    seedDef({ intervalWeeks: 0 });
    const res = await run();
    expect(res).toEqual({ ok: false, kind: 'definition', reason: 'invalid_interval' });
  });

  it('does not write or mutate the definition document', async () => {
    seedDef();
    const before = structuredClone(store.get(seriesPath(SERIES)));
    await run();
    expect(store.get(seriesPath(SERIES))).toEqual(before);
  });
});

describe('seriesMaterializationService — R8 skip (idempotent)', () => {
  it('skips a date that already has an occurrence (no duplicate)', async () => {
    seedDef();
    store.set(weekPathFor('2026-01-12'), { Mandag: [dayEntry('2026-01-12')], lastUpdated: NOW });
    const res = await run();
    if (!res.ok) return;
    expect(res.totalCreated).toBe(2); // 01-05 and 01-19 only
    const week = store.get(weekPathFor('2026-01-12'));
    expect(week.Mandag).toHaveLength(1); // still exactly one
  });

  it('skips a suppressed date', async () => {
    seedDef();
    store.set(suppPath(SERIES, '2026-01-12'), { seriesId: SERIES, occurrenceDateISO: '2026-01-12', reason: 'deleted', createdAt: NOW });
    const res = await run();
    if (!res.ok) return;
    expect(res.totalCreated).toBe(2);
    expect(store.get(weekPathFor('2026-01-12'))).toBeUndefined(); // never created
  });

  it('is safe to re-run: a second identical range creates nothing', async () => {
    seedDef();
    await run();
    const res2 = await run();
    if (!res2.ok) return;
    expect(res2.totalCreated).toBe(0);
    for (const date of ['2026-01-05', '2026-01-12', '2026-01-19']) {
      expect(store.get(weekPathFor(date)).Mandag).toHaveLength(1); // no duplication
    }
  });
});

describe('seriesMaterializationService — fail-closed conflicts (zero mutation)', () => {
  it('aborts a week (no mutation) when an active occurrence coexists with a suppression', async () => {
    seedDef();
    const week = { Mandag: [dayEntry('2026-01-12', { status: 'active' })], lastUpdated: NOW };
    store.set(weekPathFor('2026-01-12'), week);
    store.set(suppPath(SERIES, '2026-01-12'), { seriesId: SERIES, occurrenceDateISO: '2026-01-12', reason: 'deleted', createdAt: NOW });
    const before = structuredClone(store.get(weekPathFor('2026-01-12')));
    const res = await run();
    if (!res.ok) return;
    const w = res.weeks.find((r) => r.weekKey === `week_${getISOWeekForDate(new Date(2026, 0, 12))}`)!;
    expect(w).toMatchObject({ ok: false, kind: 'planner', reason: 'active_occurrence_with_suppression', occurrenceDateISO: '2026-01-12' });
    expect(store.get(weekPathFor('2026-01-12'))).toEqual(before); // unchanged
    // Other weeks still succeed — no range-wide atomicity.
    expect(res.weeks.some((r) => r.ok)).toBe(true);
  });

  it('aborts a week on a duplicate same-series/date occurrence', async () => {
    seedDef();
    store.set(weekPathFor('2026-01-12'), { Mandag: [dayEntry('2026-01-12', { id: 'dup-a' }), dayEntry('2026-01-12', { id: 'dup-b' })], lastUpdated: NOW });
    const res = await run();
    if (!res.ok) return;
    const w = res.weeks.find((r) => !r.ok)!;
    expect(w).toMatchObject({ ok: false, kind: 'planner', reason: 'duplicate_occurrence_for_date' });
  });

  it('reports both successful and failed weeks (no range-wide atomicity claim)', async () => {
    seedDef();
    store.set(weekPathFor('2026-01-12'), { Mandag: [dayEntry('2026-01-12', { status: 'active' })], lastUpdated: NOW });
    store.set(suppPath(SERIES, '2026-01-12'), { seriesId: SERIES, occurrenceDateISO: '2026-01-12', reason: 'deleted', createdAt: NOW });
    const res = await run();
    if (!res.ok) return;
    const ok = res.weeks.filter((w) => w.ok).length;
    const failed = res.weeks.filter((w) => !w.ok).length;
    expect(ok).toBe(2);
    expect(failed).toBe(1);
    expect(res.totalCreated).toBe(2);
  });
});

describe('seriesMaterializationService — concurrency (harness retry)', () => {
  it('two concurrent attempts create exactly one occurrence (retry sees the winner)', async () => {
    seedDef({ endDate: '2026-01-05' }); // single week for a focused concurrency check
    concurrentMutation = () => {
      // A competing client commits the occurrence between our read and write.
      store.set(weekPathFor('2026-01-05'), { Mandag: [dayEntry('2026-01-05')], lastUpdated: NOW });
    };
    const res = await run();
    if (!res.ok) return;
    expect(res.totalCreated).toBe(0); // our retry saw the existing occurrence
    expect(store.get(weekPathFor('2026-01-05')).Mandag).toHaveLength(1); // exactly one
  });

  it('a concurrently-created suppression is honored on retry (never overwritten)', async () => {
    seedDef({ endDate: '2026-01-05' });
    concurrentMutation = () => {
      store.set(suppPath(SERIES, '2026-01-05'), { seriesId: SERIES, occurrenceDateISO: '2026-01-05', reason: 'deleted', createdAt: NOW });
    };
    const res = await run();
    if (!res.ok) return;
    expect(res.totalCreated).toBe(0); // suppressed on retry
    expect(store.get(weekPathFor('2026-01-05'))).toBeUndefined();
  });
});

describe('listActiveOwnerSeriesDefinitions — owner active-series reader', () => {
  it('returns only active definitions and counts skipped inactive/malformed ones', async () => {
    store.set(seriesPath('a'), { id: 'a', status: 'active', startDate: '2026-01-05', intervalWeeks: 1 });
    store.set(seriesPath('b'), { id: 'b', status: 'discontinued', startDate: '2026-01-05', intervalWeeks: 1 });
    store.set(seriesPath('c'), { status: 'active' }); // malformed: no id
    const res = await listActiveOwnerSeriesDefinitions(OWNER);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.definitions.map((d) => d.id)).toEqual(['a']);
    expect(res.skipped).toBe(2);
  });

  it('does not descend into the suppressions subcollection (shallow read)', async () => {
    store.set(seriesPath('a'), { id: 'a', status: 'active', startDate: '2026-01-05', intervalWeeks: 1 });
    store.set(suppPath('a', '2026-01-12'), { seriesId: 'a', occurrenceDateISO: '2026-01-12', reason: 'deleted' });
    const res = await listActiveOwnerSeriesDefinitions(OWNER);
    if (!res.ok) return;
    expect(res.definitions.map((d) => d.id)).toEqual(['a']); // suppression doc excluded
  });

  it('returns a typed read failure instead of throwing', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('offline'));
    const res = await listActiveOwnerSeriesDefinitions(OWNER);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe('read');
  });

  it('does not mutate any definition or write anything', async () => {
    store.set(seriesPath('a'), { id: 'a', status: 'active', startDate: '2026-01-05', intervalWeeks: 1 });
    const before = new Map(store);
    await listActiveOwnerSeriesDefinitions(OWNER);
    expect(store).toEqual(before);
  });
});
