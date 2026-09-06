/**
 * seriesSplitFlow.test.ts — pure App.tsx dispatch sequencing. No Firebase,
 * no React. Mirrors durableSeriesDeleteFlow.test.ts's style.
 */
import { describe, it, expect, vi } from 'vitest';
import { coordinateThisAndFollowingEdit } from './seriesSplitFlow';

describe('coordinateThisAndFollowingEdit', () => {
  it('calls persist exactly once and returns its raw result when eligible', async () => {
    const persist = vi.fn().mockResolvedValue({ ok: true, newSeriesId: 'new-1', counts: { total: 1 } });
    const outcome = await coordinateThisAndFollowingEdit({ eligibility: { eligible: true }, persist });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ kind: 'split', result: { ok: true, newSeriesId: 'new-1', counts: { total: 1 } } });
  });

  it('never calls persist for a historical occurrence', async () => {
    const persist = vi.fn();
    const outcome = await coordinateThisAndFollowingEdit({ eligibility: { eligible: false, reason: 'historical' }, persist });
    expect(persist).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'ineligible', reason: 'historical' });
  });

  it('never calls persist for a legacy occurrence without a durable seriesId', async () => {
    const persist = vi.fn();
    const outcome = await coordinateThisAndFollowingEdit({ eligibility: { eligible: false, reason: 'no_durable_series' }, persist });
    expect(persist).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'ineligible', reason: 'no_durable_series' });
  });

  it('passes through a failed persist result unchanged — never invents or hides a failure', async () => {
    const persist = vi.fn().mockResolvedValue({ ok: false, kind: 'stale', reason: 'anchor_not_found' });
    const outcome = await coordinateThisAndFollowingEdit({ eligibility: { eligible: true }, persist });
    expect(outcome).toEqual({ kind: 'split', result: { ok: false, kind: 'stale', reason: 'anchor_not_found' } });
  });

  it('propagates a persist rejection instead of swallowing it', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('transaction boom'));
    await expect(coordinateThisAndFollowingEdit({ eligibility: { eligible: true }, persist })).rejects.toThrow('transaction boom');
  });
});
