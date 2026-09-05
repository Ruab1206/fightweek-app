// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import type { User } from 'firebase/auth';
import {
  createOwnSeriesMaterializationCoordinator,
  msUntilNextISOWeekBoundary,
  useOwnSeriesMaterialization,
  type OwnSeriesMaterializationDeps,
} from './useOwnSeriesMaterialization';
import type { ActiveOwnerSeriesResult, SeriesMaterializationResult } from '../services/seriesMaterializationService';
import type { EventSeriesDefinition } from '../domain/calendar/eventSeriesDefinition';

function def(id: string): EventSeriesDefinition {
  return { id } as EventSeriesDefinition;
}
function okList(ids: string[], skipped = 0): ActiveOwnerSeriesResult {
  return { ok: true, definitions: ids.map(def), skipped };
}
function okMaterialize(created: string[] = ['occ']): SeriesMaterializationResult {
  return { ok: true, weeks: [{ weekKey: 'week_2', ok: true, created }], totalCreated: created.length };
}

function makeDeps(over: Partial<OwnSeriesMaterializationDeps> = {}): {
  deps: OwnSeriesMaterializationDeps;
  list: ReturnType<typeof vi.fn>;
  materialize: ReturnType<typeof vi.fn>;
  setWeek: (w: number) => void;
} {
  let week = 2;
  const list = vi.fn(async () => okList(['s1']));
  const materialize = vi.fn(async () => okMaterialize());
  const deps: OwnSeriesMaterializationDeps = {
    listActiveOwnerSeries: over.listActiveOwnerSeries ?? (list as never),
    materialize: over.materialize ?? (materialize as never),
    isoWeek: over.isoWeek ?? (() => week),
  };
  return { deps, list, materialize, setWeek: (w) => { week = w; } };
}

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warnSpy.mockRestore(); vi.restoreAllMocks(); });

describe('coordinator — owner boundary', () => {
  it('materializes using the owner key set via setOwner', async () => {
    const { deps, materialize } = makeDeps();
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(materialize).toHaveBeenCalledWith({ fighterKey: 'rune@x', seriesId: 's1' });
    expect(run?.ownerKey).toBe('rune@x');
    expect(run?.totalCreated).toBe(1);
  });

  it('does nothing when no owner is set', async () => {
    const { deps, list, materialize } = makeDeps();
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    const run = await coord.attempt('startup');
    expect(run).toBeNull();
    expect(list).not.toHaveBeenCalled();
    expect(materialize).not.toHaveBeenCalled();
  });

  it('switching owner materializes the NEW owner, never the old', async () => {
    const { deps, materialize } = makeDeps();
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    await coord.attempt('startup');
    coord.setOwner('san@x');
    await coord.attempt('startup');
    expect(materialize).toHaveBeenNthCalledWith(1, { fighterKey: 'rune@x', seriesId: 's1' });
    expect(materialize).toHaveBeenNthCalledWith(2, { fighterKey: 'san@x', seriesId: 's1' });
  });
});

describe('coordinator — one attempt per owner/week', () => {
  it('a second attempt in the same week is a no-op', async () => {
    const { deps, materialize } = makeDeps();
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    await coord.attempt('startup');
    const second = await coord.attempt('visibility');
    expect(second).toBeNull();
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('a changed ISO week triggers exactly one new attempt', async () => {
    const { deps, materialize, setWeek } = makeDeps();
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    await coord.attempt('startup');
    setWeek(3);
    await coord.attempt('week-boundary');
    setWeek(3);
    await coord.attempt('visibility'); // same new week → no dup
    expect(materialize).toHaveBeenCalledTimes(2);
  });

  it('an in-flight attempt blocks a concurrent one (no double run)', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => { resolve = r; });
    const materialize = vi.fn(async () => { await gate; return okMaterialize(); });
    const { deps } = makeDeps({ materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const p1 = coord.attempt('startup');
    const p2 = coord.attempt('visibility'); // while first in flight
    expect(await p2).toBeNull();
    resolve();
    await p1;
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('a week change while a run is in flight does not start a concurrent run', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => { resolve = r; });
    const materialize = vi.fn(async () => { await gate; return okMaterialize(); });
    const { deps, setWeek } = makeDeps({ materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const p1 = coord.attempt('startup'); // week 2, in flight
    setWeek(3); // week advances WHILE the first run is still in flight
    const p2 = coord.attempt('week-boundary');
    expect(await p2).toBeNull(); // blocked by in-flight guard, regardless of week
    resolve();
    await p1;
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('after the in-flight run completes, a later valid signal processes the new week', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => { resolve = r; });
    let gated = true;
    const materialize = vi.fn(async () => {
      if (gated) { gated = false; await gate; }
      return okMaterialize();
    });
    const { deps, setWeek } = makeDeps({ materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const p1 = coord.attempt('startup');
    setWeek(3);
    await coord.attempt('week-boundary'); // blocked while in flight
    resolve();
    await p1; // week 2 run completes successfully
    const p3 = await coord.attempt('visibility'); // now week 3 is a fresh, valid check
    expect(p3).not.toBeNull();
    expect(materialize).toHaveBeenCalledTimes(2);
  });

  it('a later valid check runs after the first completes', async () => {
    const { deps, materialize, setWeek } = makeDeps();
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    await coord.attempt('startup');
    setWeek(4);
    await coord.attempt('week-boundary');
    expect(materialize).toHaveBeenCalledTimes(2);
  });

  it('owner change resets week-success state — the new owner is not skipped in the same week', async () => {
    const { deps, materialize } = makeDeps(); // fixed week (2) for both owners
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    await coord.attempt('startup'); // rune's week 2 succeeds
    coord.setOwner('san@x');
    const run = await coord.attempt('startup'); // same ISO week, but a NEW owner
    expect(run).not.toBeNull();
    expect(materialize).toHaveBeenNthCalledWith(2, { fighterKey: 'san@x', seriesId: 's1' });
  });
});

describe('coordinator — failure & diagnostic semantics', () => {
  it('a read failure is non-blocking and flagged, with no materialize', async () => {
    const list = vi.fn(async (): Promise<ActiveOwnerSeriesResult> => ({ ok: false, kind: 'read', error: new Error('offline') }));
    const materialize = vi.fn(async () => okMaterialize());
    const { deps } = makeDeps({ listActiveOwnerSeries: list as never, materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.readFailed).toBe(true);
    expect(run?.successful).toBe(false);
    expect(materialize).not.toHaveBeenCalled();
  });

  it('an owner-series read failure permits a later same-week visibility retry', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: false, kind: 'read', error: new Error('offline') } satisfies ActiveOwnerSeriesResult)
      .mockResolvedValueOnce(okList(['s1']));
    const { deps, materialize } = makeDeps({ listActiveOwnerSeries: list as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const first = await coord.attempt('startup');
    expect(first?.successful).toBe(false);
    const second = await coord.attempt('visibility'); // same ISO week — retry allowed
    expect(second).not.toBeNull();
    expect(second?.successful).toBe(true);
    expect(materialize).toHaveBeenCalledTimes(1); // only the successful retry reached materialize
  });

  it('a materialization infrastructure failure permits a later same-week visibility retry', async () => {
    const materialize = vi.fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(okMaterialize(['x']));
    const { deps } = makeDeps({ materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const first = await coord.attempt('startup');
    expect(first?.infraFailures).toBe(1);
    expect(first?.successful).toBe(false);
    const second = await coord.attempt('visibility'); // same ISO week — retry allowed
    expect(second?.successful).toBe(true);
    expect(materialize).toHaveBeenCalledTimes(2);
  });

  it('a retry does not duplicate previously successful occurrence creation', async () => {
    // First series always succeeds and, on retry, its own idempotent creation
    // reports zero NEW creates (already materialized) — the second series is
    // the one that failed the first time and only creates on retry.
    const materialize = vi.fn(async (req: { seriesId: string }, attemptState: { first: boolean }): Promise<SeriesMaterializationResult> => {
      if (req.seriesId === 'stable') return okMaterialize(attemptState.first ? ['stable-occ'] : []);
      return attemptState.first ? Promise.reject(new Error('unavailable')) : Promise.resolve(okMaterialize(['flaky-occ']));
    });
    let first = true;
    const list = vi.fn(async () => okList(['stable', 'flaky']));
    const { deps } = makeDeps({
      listActiveOwnerSeries: list as never,
      materialize: (async (req: { fighterKey: string; seriesId: string }) => materialize(req, { first }))  as never,
    });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run1 = await coord.attempt('startup');
    expect(run1?.totalCreated).toBe(1); // stable-occ only; flaky threw
    expect(run1?.successful).toBe(false);
    first = false;
    const run2 = await coord.attempt('visibility');
    expect(run2?.totalCreated).toBe(1); // flaky-occ only; stable reported 0 new (idempotent, not duplicated)
    expect(run2?.successful).toBe(true);
  });

  it('non-retryable definition/integrity diagnostics do not create an automatic retry loop', async () => {
    const list = vi.fn(async () => okList(['bad']));
    const materialize = vi.fn(async () => ({ ok: false, kind: 'definition', reason: 'discontinued_series' } as SeriesMaterializationResult));
    const { deps } = makeDeps({ listActiveOwnerSeries: list as never, materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.successful).toBe(true); // diagnostic-only issue never blocks the week
    const retry = await coord.attempt('visibility'); // same week — no auto-retry loop
    expect(retry).toBeNull();
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('no immediate retry occurs after a failure without an explicit new signal', async () => {
    vi.useFakeTimers();
    try {
      const materialize = vi.fn(async () => { throw new Error('unavailable'); });
      const { deps } = makeDeps({ materialize: materialize as never });
      const coord = createOwnSeriesMaterializationCoordinator(deps);
      coord.setOwner('rune@x');
      await coord.attempt('startup');
      expect(materialize).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_000); // no internal retry timer exists
      expect(materialize).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports skipped inactive/malformed definitions from the reader', async () => {
    const list = vi.fn(async () => okList(['s1'], 3));
    const { deps } = makeDeps({ listActiveOwnerSeries: list as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.seriesActive).toBe(1);
    expect(run?.seriesSkipped).toBe(3);
  });

  it('one malformed/discontinued series does not block valid series', async () => {
    const list = vi.fn(async () => okList(['bad', 'good']));
    const materialize = vi.fn(async (req: { seriesId: string }) =>
      req.seriesId === 'bad'
        ? ({ ok: false, kind: 'definition', reason: 'discontinued_series' } as SeriesMaterializationResult)
        : okMaterialize(['g']),
    );
    const { deps } = makeDeps({ listActiveOwnerSeries: list as never, materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.definitionIssues).toContainEqual({ seriesId: 'bad', reason: 'discontinued_series' });
    expect(run?.totalCreated).toBe(1); // good still ran
    expect(run?.successful).toBe(true); // a diagnostic-only issue does not block the week
  });

  it('one series that throws does not block the others', async () => {
    const list = vi.fn(async () => okList(['boom', 'ok']));
    const materialize = vi.fn(async (req: { seriesId: string }) => {
      if (req.seriesId === 'boom') throw new Error('permission-denied');
      return okMaterialize(['x']);
    });
    const { deps } = makeDeps({ listActiveOwnerSeries: list as never, materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.infraFailures).toBe(1);
    expect(run?.totalCreated).toBe(1);
  });

  it('keeps data-integrity conflicts distinguishable from infra failures', async () => {
    const materialize = vi.fn(async (): Promise<SeriesMaterializationResult> => ({
      ok: true,
      totalCreated: 0,
      weeks: [
        { weekKey: 'week_2', ok: false, kind: 'planner', reason: 'active_occurrence_with_suppression', occurrenceDateISO: '2026-01-12' },
        { weekKey: 'week_3', ok: false, kind: 'transaction', error: new Error('net') },
      ],
    }));
    const { deps } = makeDeps({ materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.integrityConflicts).toEqual([{ seriesId: 's1', reason: 'active_occurrence_with_suppression', occurrenceDateISO: '2026-01-12' }]);
    expect(run?.infraFailures).toBe(1);
    expect(run?.successful).toBe(false); // the co-occurring infra failure keeps this week retryable
  });

  it('aggregates partial week success accurately', async () => {
    const materialize = vi.fn(async (): Promise<SeriesMaterializationResult> => ({
      ok: true,
      totalCreated: 2,
      weeks: [
        { weekKey: 'week_2', ok: true, created: ['a'] },
        { weekKey: 'week_3', ok: true, created: ['b'] },
        { weekKey: 'week_4', ok: false, kind: 'planner', reason: 'duplicate_occurrence_for_date', occurrenceDateISO: '2026-01-26' },
      ],
    }));
    const { deps } = makeDeps({ materialize: materialize as never });
    const coord = createOwnSeriesMaterializationCoordinator(deps);
    coord.setOwner('rune@x');
    const run = await coord.attempt('startup');
    expect(run?.totalCreated).toBe(2);
    expect(run?.integrityConflicts).toHaveLength(1);
    expect(run?.successful).toBe(true); // an integrity conflict alone (no infra failure) never blocks the week
  });
});

describe('msUntilNextISOWeekBoundary', () => {
  it('is always a positive duration ending on a Monday 00:00 local', () => {
    for (const iso of ['2026-01-05T09:00:00', '2026-01-11T23:59:00', '2026-01-07T12:00:00']) {
      const now = new Date(iso);
      const ms = msUntilNextISOWeekBoundary(now);
      expect(ms).toBeGreaterThan(0);
      const boundary = new Date(now.getTime() + ms);
      expect(boundary.getDay()).toBe(1); // Monday
      expect(boundary.getHours()).toBe(0);
      expect(boundary.getMinutes()).toBe(0);
    }
  });

  it('on a Monday schedules the FOLLOWING Monday (never zero)', () => {
    const monday = new Date('2026-01-05T00:00:01');
    const ms = msUntilNextISOWeekBoundary(monday);
    expect(ms).toBeGreaterThan(6 * 24 * 3600 * 1000);
  });
});

describe('useOwnSeriesMaterialization — hook wiring', () => {
  const asUser = (email: string | null): User => ({ email } as User);

  it('derives the owner from user.email and materializes once on startup', async () => {
    const { deps, materialize } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), deps }));
    await waitFor(() => expect(materialize).toHaveBeenCalledTimes(1));
    expect(materialize).toHaveBeenCalledWith({ fighterKey: 'rune@x', seriesId: 's1' });
  });

  it('uses San\'s email for San', async () => {
    const { deps, materialize } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('san@x'), deps }));
    await waitFor(() => expect(materialize).toHaveBeenCalledWith({ fighterKey: 'san@x', seriesId: 's1' }));
  });

  it('does nothing when auth is not ready (user null)', async () => {
    const { deps, list, materialize } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: null, deps }));
    await act(async () => { await Promise.resolve(); });
    expect(list).not.toHaveBeenCalled();
    expect(materialize).not.toHaveBeenCalled();
  });

  it('does nothing when the authenticated user has no email', async () => {
    const { deps, materialize } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser(null), deps }));
    await act(async () => { await Promise.resolve(); });
    expect(materialize).not.toHaveBeenCalled();
  });

  it('does nothing when access is denied or the browser is blocked', async () => {
    const a = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), accessDenied: true, deps: a.deps }));
    const b = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), isBrowserBlocked: true, deps: b.deps }));
    await act(async () => { await Promise.resolve(); });
    expect(a.materialize).not.toHaveBeenCalled();
    expect(b.materialize).not.toHaveBeenCalled();
  });

  it('an ordinary rerender with the same user does not retrigger', async () => {
    const { deps, materialize } = makeDeps();
    const { rerender } = renderHook((props: { n: number }) => {
      useOwnSeriesMaterialization({ user: asUser('rune@x'), deps });
      return props.n;
    }, { initialProps: { n: 1 } });
    await waitFor(() => expect(materialize).toHaveBeenCalledTimes(1));
    rerender({ n: 2 }); // unrelated parent state change (e.g. active-fighter switch)
    rerender({ n: 3 });
    await act(async () => { await Promise.resolve(); });
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('React Strict Mode double-invoked effects do not double-materialize', async () => {
    const { deps, materialize } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), deps }), {
      wrapper: ({ children }) => React.createElement(React.StrictMode, null, children),
    });
    await waitFor(() => expect(materialize).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('a visibility event in the same week does not retrigger', async () => {
    const { deps, materialize } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), deps }));
    await waitFor(() => expect(materialize).toHaveBeenCalledTimes(1));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it('a visibility event after the ISO week advances triggers one new attempt', async () => {
    const { deps, materialize, setWeek } = makeDeps();
    renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), deps }));
    await waitFor(() => expect(materialize).toHaveBeenCalledTimes(1));
    setWeek(3);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(materialize).toHaveBeenCalledTimes(2);
  });

  it('schedules exactly one week-boundary timer and clears it on unmount', async () => {
    vi.useFakeTimers();
    try {
      const setSpy = vi.spyOn(global, 'setTimeout');
      const clearSpy = vi.spyOn(global, 'clearTimeout');
      const { deps } = makeDeps();
      const { unmount } = renderHook(() => useOwnSeriesMaterialization({ user: asUser('rune@x'), deps }));
      const timerCalls = setSpy.mock.calls.filter(([, ms]) => typeof ms === 'number' && ms > 0);
      expect(timerCalls.length).toBe(1); // one pending timer, no polling loop
      unmount();
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
