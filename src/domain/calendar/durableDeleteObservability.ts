/**
 * durableDeleteObservability — pure classification + distinguishable feedback
 * for the durable-vs-legacy "delete this and all future trainings" dispatch
 * (App.tsx). Diagnostic-only: makes an EXISTING decision and an EXISTING
 * outcome observable and testable. It never invents a new deletion meaning,
 * never decides authorization, and never itself performs persistence.
 *
 * `classifyDeleteThisAndFollowingDispatch` is the single source of truth for
 * the durable/legacy routing decision (previously inlined in App.tsx), so the
 * decision can be exercised against a REALISTIC occurrence shape in tests
 * instead of only a hand-built service fixture. The decision depends only on
 * the occurrence's own persisted shape (`seriesId` / `catalogueClassId`) —
 * never on which user is authenticated or which fighter is being viewed.
 *
 * `describeDurableDeleteOutcome` is the single point that turns a
 * `coordinateDurableSeriesDelete` outcome into (a) a concise user-facing toast
 * and (b) a structured, no-PII diagnostic (ids/reason codes only) suitable for
 * a console/log sink. It NEVER returns a success toast for a non-ok persist
 * result — the enforcement point for "do not present a failed persistence
 * operation as success".
 */
import type { DurableSeriesDeleteOutcome } from './durableSeriesDeleteFlow';
import type { SeriesDeletePersistResult } from '../../services/seriesDeleteService';
import type { SeriesDeleteFailureReason } from './seriesDeletePlan';

export type DeleteThisAndFollowingDispatch = 'durable' | 'legacy';

export function classifyDeleteThisAndFollowingDispatch(
  session: { seriesId?: string; catalogueClassId?: string } | null | undefined,
): DeleteThisAndFollowingDispatch {
  return !!session?.seriesId && !session?.catalogueClassId ? 'durable' : 'legacy';
}

/** Short, user-facing phrase per structured planner rejection reason. */
const REASON_MESSAGES: Record<SeriesDeleteFailureReason, string> = {
  unsupported_legacy_occurrence: 'understøtter ikke seriesletning',
  invalid_occurrence_date: 'ugyldig dato',
  missing_definition: 'serien kunne ikke findes',
  not_series_member: 'ikke længere del af serien',
  selected_before_definition_start: 'ligger før seriens start',
  definition_not_active: 'serien er allerede afsluttet',
  selected_after_definition_end: 'ligger efter seriens slutdato',
  selected_off_cadence: 'passer ikke med seriens gentagelse',
  selected_occurrence_not_found: 'kunne ikke findes i serien',
  already_deleted: 'allerede slettet',
  duplicate_occurrence_for_date: 'flere træninger på samme dato',
  conflicting_occurrence_and_suppression: 'konflikt i seriens data',
};

export interface DurableDeleteDiagnostic {
  path: 'durable';
  outcome: 'deleted' | 'deleted_invitations_failed' | 'delete_failed';
  persistKind?: 'planner' | 'transaction';
  reason?: SeriesDeleteFailureReason;
  occurrenceDateISO?: string;
  seriesId?: string;
}

export interface DurableDeleteFeedback {
  toastMessage: string;
  toastType: 'success' | 'error';
  diagnostic: DurableDeleteDiagnostic;
}

export function describeDurableDeleteOutcome(
  outcome: DurableSeriesDeleteOutcome<SeriesDeletePersistResult>,
  context: { name: string; seriesId?: string },
): DurableDeleteFeedback {
  const base = { path: 'durable' as const, seriesId: context.seriesId };

  if (outcome.kind === 'deleted') {
    return { toastMessage: `${context.name} fjernet`, toastType: 'success', diagnostic: { ...base, outcome: 'deleted' } };
  }
  if (outcome.kind === 'deleted_invitations_failed') {
    return {
      toastMessage: 'Træningen blev slettet, men invitationerne kunne ikke opdateres.',
      toastType: 'error',
      diagnostic: { ...base, outcome: 'deleted_invitations_failed' },
    };
  }

  // kind === 'delete_failed' — the persist result was not ok. Defensive fallback
  // (result.ok true here cannot happen per coordinateDurableSeriesDelete's own
  // contract) still resolves to an error toast, never success.
  const result = outcome.result;
  if (result.ok) {
    return { toastMessage: 'Kunne ikke slette den gentagende træning — prøv igen.', toastType: 'error', diagnostic: { ...base, outcome: 'delete_failed' } };
  }
  const reasonMessage = result.kind === 'planner' ? REASON_MESSAGES[result.reason] : undefined;
  return {
    toastMessage: reasonMessage
      ? `Kunne ikke slette den gentagende træning (${reasonMessage}).`
      : 'Kunne ikke slette den gentagende træning — prøv igen.',
    toastType: 'error',
    diagnostic: {
      ...base,
      outcome: 'delete_failed',
      persistKind: result.kind,
      reason: result.kind === 'planner' ? result.reason : undefined,
      occurrenceDateISO: result.kind === 'planner' ? result.occurrenceDateISO : undefined,
    },
  };
}
