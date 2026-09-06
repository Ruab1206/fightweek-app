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

/** A Firestore error `code` is a short lowercase-hyphenated token (e.g.
 *  'permission-denied', 'resource-exhausted', 'aborted'). Anything else
 *  (missing, wrong type, or an unexpected shape) collapses to 'unknown' so
 *  arbitrary server error text can never leak into a diagnostic. */
export function sanitizeFirestoreErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string' && /^[a-z][a-z0-9-]*$/.test(code)) return code;
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
