/**
 * seriesSplitObservability — pure classification + distinguishable feedback
 * for the "this and all future trainings" durable series split (App.tsx).
 * Mirrors `durableDeleteObservability.ts`'s shape for the analogous durable
 * delete operation. Diagnostic-only: it never performs persistence itself and
 * never returns a success toast for a non-ok persist result.
 *
 * `describeSeriesSplitOutcome` maps a `SeriesSplitPersistResult` (the ONLY
 * result of `persistSeriesSplitAtomically`, already confirmed-committed by
 * the time this is called) to (a) a concise user-facing toast and (b) a
 * structured, no-PII diagnostic (ids/reason codes only).
 *
 * `describeThisAndFollowingIneligible` is a defense-in-depth mapping for the
 * (should-never-be-reached, since `SessionModal` already gates the button via
 * the same `evaluateThisAndFollowingEligibility` contract) case where a
 * historical/legacy/non-recurring dispatch is attempted anyway — it never
 * calls or duplicates the eligibility rule itself, only describes an already-
 * computed `ThisAndFollowingIneligibleReason`.
 */
import type { SeriesSplitPersistResult } from '../../services/seriesSplitService';
import type { SplitPlanFailureReason } from './seriesSplitPlan';
import type { ThisAndFollowingIneligibleReason } from './seriesEditScopeEligibility';

/** Short, user-facing phrase per structured planner rejection reason. */
const REASON_MESSAGES: Record<SplitPlanFailureReason, string> = {
  missing_series_id: 'serien matcher ikke',
  missing_definition: 'serien kunne ikke findes',
  selected_before_definition_start: 'ligger før seriens start',
  unsupported_legacy_occurrence: 'understøtter ikke seriedeling',
  invalid_occurrence_date: 'ugyldig dato',
  conflicting_occurrence_and_suppression: 'konflikt i seriens data',
  anchor_is_deleted: 'træningen er allerede slettet',
};

const INELIGIBLE_MESSAGES: Record<ThisAndFollowingIneligibleReason, string> = {
  not_recurring: 'gælder kun gentagende træninger',
  historical: 'kan ikke bruges på en tidligere træning',
  no_durable_series: 'kun tilgængelig for nyere gentagende træninger',
};

export interface SeriesSplitDiagnostic {
  path: 'series-split';
  outcome: 'split' | 'rejected' | 'ineligible';
  persistKind?: 'planner' | 'stale' | 'transaction';
  reason?: SplitPlanFailureReason | 'anchor_not_found' | ThisAndFollowingIneligibleReason;
  /** Sanitized Firestore error code (e.g. 'permission-denied') for a transaction
   *  failure only — 'unknown' when absent/unrecognized. Never the raw message
   *  (which can echo document paths) and never an occurrence/series identifier. */
  firestoreErrorCode?: string;
}

export interface SeriesSplitFeedback {
  toastMessage: string;
  toastType: 'success' | 'error';
  diagnostic: SeriesSplitDiagnostic;
}

/** The complete, finite set of gRPC-derived status codes the real
 *  `@firebase/firestore` client SDK actually assigns to `FirestoreError.code`
 *  (verified against the installed SDK's own `Code` enum) — always a bare
 *  lowercase-hyphenated token, never namespace-prefixed like Auth's
 *  'auth/xxx' convention. An allow-list (rather than a length/shape regex) is
 *  possible precisely because this set is fixed and small; anything outside
 *  it — including a prefixed form such as 'firestore/permission-denied', an
 *  excessively long value, or arbitrary text — is not a real Firestore code
 *  and safely collapses to 'unknown'. */
const KNOWN_FIRESTORE_ERROR_CODES = new Set([
  'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found',
  'already-exists', 'permission-denied', 'unauthenticated', 'resource-exhausted',
  'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal',
  'unavailable', 'data-loss',
]);

/** Extracts and sanitizes `error.code` for a transaction failure. Anything
 *  not on the known-code allow-list (missing, wrong type, unrecognized, or
 *  malformed) collapses to 'unknown' so arbitrary server error text can
 *  never leak into a diagnostic. */
export function sanitizeFirestoreErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string' && KNOWN_FIRESTORE_ERROR_CODES.has(code)) return code;
  return 'unknown';
}

export function describeSeriesSplitOutcome(
  result: SeriesSplitPersistResult,
  context: { name: string },
): SeriesSplitFeedback {
  const base = { path: 'series-split' as const };

  if (result.ok) {
    return { toastMessage: `${context.name} opdelt fra i dag`, toastType: 'success', diagnostic: { ...base, outcome: 'split' } };
  }
  if (result.kind === 'stale') {
    return {
      toastMessage: 'Træningen blev ændret et andet sted — prøv igen.',
      toastType: 'error',
      diagnostic: { ...base, outcome: 'rejected', persistKind: 'stale', reason: 'anchor_not_found' },
    };
  }
  if (result.kind === 'transaction') {
    return {
      toastMessage: 'Kunne ikke opdatere den gentagende træning — prøv igen.',
      toastType: 'error',
      diagnostic: { ...base, outcome: 'rejected', persistKind: 'transaction', firestoreErrorCode: sanitizeFirestoreErrorCode(result.error) },
    };
  }
  // result.kind === 'planner'
  const reasonMessage = REASON_MESSAGES[result.reason];
  return {
    toastMessage: `Kunne ikke opdatere den gentagende træning (${reasonMessage}).`,
    toastType: 'error',
    diagnostic: { ...base, outcome: 'rejected', persistKind: 'planner', reason: result.reason },
  };
}

export function describeThisAndFollowingIneligible(reason: ThisAndFollowingIneligibleReason): SeriesSplitFeedback {
  return {
    toastMessage: `Denne og alle fremtidige træninger er ${INELIGIBLE_MESSAGES[reason]}.`,
    toastType: 'error',
    diagnostic: { path: 'series-split', outcome: 'ineligible', reason },
  };
}
