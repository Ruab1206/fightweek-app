/**
 * durableSeriesDeleteFlow — pure orchestration for the seriesId-based durable
 * "delete this and all future trainings" side-effect ordering. Framework-free
 * and Firestore-free so the ordering contract is unit-testable.
 *
 * Contract (corrects the audited ordering defect): the durable delete
 * transaction runs FIRST; the invitation side-effect (`cancelInvitations`) runs
 * ONLY after the transaction returns success. On any delete failure (planner
 * rejection, stale anchor, permission, or transaction error — all surfaced as a
 * non-ok persist result) no invitation change is attempted and no success is
 * reported. If the delete succeeds but the invitation side-effect fails, the
 * destructive deletion is NOT retried and a DISTINCT partial-side-effect outcome
 * is returned — the deletion is not pretended to have rolled back.
 */
export type DurableSeriesDeleteOutcome<R> =
  /** Delete committed and the invitation side-effect completed. */
  | { kind: 'deleted'; result: R }
  /** Delete committed but the invitation side-effect failed (partial). */
  | { kind: 'deleted_invitations_failed'; result: R; error: unknown }
  /** Delete did not commit; no invitation change was attempted. */
  | { kind: 'delete_failed'; result: R };

export async function coordinateDurableSeriesDelete<R extends { ok: boolean }>(deps: {
  persist: () => Promise<R>;
  cancelInvitations: () => Promise<void>;
}): Promise<DurableSeriesDeleteOutcome<R>> {
  const result = await deps.persist();
  if (!result.ok) return { kind: 'delete_failed', result }; // no invitation change

  try {
    await deps.cancelInvitations();
  } catch (error) {
    // Delete already committed — never retry it; surface the partial state.
    return { kind: 'deleted_invitations_failed', result, error };
  }
  return { kind: 'deleted', result };
}
