/**
 * durableSeriesDeleteFlow.test.ts — pure ordering/side-effect contract for the
 * durable delete-this-and-following invitation sequencing. No Firestore, no React.
 */
import { describe, it, expect, vi } from 'vitest';
import { coordinateDurableSeriesDelete } from './durableSeriesDeleteFlow';

type Persist = { ok: boolean; kind?: string; reason?: string; error?: unknown };

describe('coordinateDurableSeriesDelete — invitation ordering', () => {
  it('runs the delete first, then invitation removal, on success', async () => {
    const order: string[] = [];
    const persist = vi.fn(async () => { order.push('persist'); return { ok: true } as Persist; });
    const cancelInvitations = vi.fn(async () => { order.push('cancel'); });
    const outcome = await coordinateDurableSeriesDelete({ persist, cancelInvitations });
    expect(outcome).toEqual({ kind: 'deleted', result: { ok: true } });
    expect(order).toEqual(['persist', 'cancel']); // invitation removal AFTER delete
  });

  it('does NOT touch invitations on a planner failure', async () => {
    const cancelInvitations = vi.fn(async () => {});
    const outcome = await coordinateDurableSeriesDelete({
      persist: async () => ({ ok: false, kind: 'planner', reason: 'unsupported_legacy_occurrence' }),
      cancelInvitations,
    });
    expect(outcome).toMatchObject({ kind: 'delete_failed' });
    expect(cancelInvitations).not.toHaveBeenCalled();
  });

  it('does NOT touch invitations on a stale-anchor failure', async () => {
    const cancelInvitations = vi.fn(async () => {});
    const outcome = await coordinateDurableSeriesDelete({
      persist: async () => ({ ok: false, kind: 'planner', reason: 'selected_occurrence_not_found' }),
      cancelInvitations,
    });
    expect(outcome).toMatchObject({ kind: 'delete_failed' });
    expect(cancelInvitations).not.toHaveBeenCalled();
  });

  it('does NOT touch invitations on a transaction/permission failure', async () => {
    const cancelInvitations = vi.fn(async () => {});
    const outcome = await coordinateDurableSeriesDelete({
      persist: async () => ({ ok: false, kind: 'transaction', error: new Error('permission-denied') }),
      cancelInvitations,
    });
    expect(outcome).toMatchObject({ kind: 'delete_failed' });
    expect(cancelInvitations).not.toHaveBeenCalled();
  });

  it('reports a distinct partial-side-effect outcome and does not retry the delete when invitations fail', async () => {
    const persist = vi.fn(async () => ({ ok: true } as Persist));
    const err = new Error('invitation cancel failed');
    const outcome = await coordinateDurableSeriesDelete({
      persist,
      cancelInvitations: async () => { throw err; },
    });
    expect(outcome).toEqual({ kind: 'deleted_invitations_failed', result: { ok: true }, error: err });
    expect(persist).toHaveBeenCalledTimes(1); // destructive delete not repeated
  });
});
