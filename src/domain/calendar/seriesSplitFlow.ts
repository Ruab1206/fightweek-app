/**
 * seriesSplitFlow — pure orchestration for the App.tsx "this and all future
 * trainings" edit dispatch. Mirrors `durableSeriesDeleteFlow.ts`'s shape for
 * the analogous durable delete operation. Framework-free and Firestore-free
 * so the sequencing contract (eligibility gates the persist call; persist
 * runs at most once; the raw result is never touched) is unit-testable
 * without React or a Firestore mock.
 *
 * Contract: `persist` is invoked if and only if `eligibility.eligible` is
 * true, and is invoked AT MOST ONCE. An ineligible dispatch never calls
 * `persist` and never fabricates a persist result — it returns a distinct
 * `'ineligible'` outcome carrying only the already-computed reason.
 */
import type { ThisAndFollowingEligibility } from './seriesEditScopeEligibility';

export type ThisAndFollowingEditOutcome<R> =
  /** The occurrence was not eligible — `persist` was never called. */
  | { kind: 'ineligible'; reason: Extract<ThisAndFollowingEligibility, { eligible: false }>['reason'] }
  /** Eligible — `persist` ran exactly once; `result` is its raw, untouched outcome. */
  | { kind: 'split'; result: R };

export async function coordinateThisAndFollowingEdit<R>(deps: {
  eligibility: ThisAndFollowingEligibility;
  persist: () => Promise<R>;
}): Promise<ThisAndFollowingEditOutcome<R>> {
  if (!deps.eligibility.eligible) return { kind: 'ineligible', reason: deps.eligibility.reason };
  const result = await deps.persist();
  return { kind: 'split', result };
}

/**
 * Modal-lifecycle gate for App.tsx's this-and-following dispatch: the edit
 * flow may close ONLY after a CONFIRMED persistence success. Every other
 * outcome (ineligible, planner rejection, stale anchor, transaction failure —
 * or any future outcome shape this has never seen) keeps the modal open with
 * the user's submitted values intact; it never reports success and never
 * silently discards the attempted edit.
 */
export function shouldCloseThisAndFollowingModal<R extends { ok: boolean }>(
  outcome: ThisAndFollowingEditOutcome<R>,
): boolean {
  return outcome.kind === 'split' && outcome.result.ok === true;
}
