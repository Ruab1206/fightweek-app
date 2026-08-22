/**
 * logAssociation — pure read-side association from a selected self-posted
 * calendar occurrence to its existing calendar-originated TrainingLogs
 * (Phase 3 strangler slice — see `/docs/fightweek_refactoring_plan.md`,
 * "Next Planned Slice").
 *
 * This module is PURE — no Firestore, no React, no side effects — and
 * intentionally does not decide product meaning for zero, one, or many
 * matches; it only selects and orders. Callers render whatever comes back.
 *
 * Matching is exact on the optional `TrainingLogOrigin` provenance
 * (`origin.type` + `origin.sessionId` + `origin.occurrenceDateISO`) only —
 * never on mutable snapshot fields (title/discipline/time/location/notes/
 * intensity), so association survives an edited or deleted source session.
 * A log without `origin` (a standalone log) never matches.
 */
import type { CompletedSelfPostedTrainingLog } from './types';

/** Explicit identity of the selected self-posted calendar occurrence. */
export interface CalendarOccurrenceIdentity {
  sessionId: string;
  occurrenceDateISO: string;
}

/**
 * Return every log whose `origin` exactly matches the given calendar
 * occurrence identity. Pure — does not mutate `logs`. Ordering is
 * deterministic: ascending by the log's own saved occurrence start time
 * (its snapshot, not a live lookup), with the log id as a stable tiebreaker,
 * regardless of input order.
 */
export function selectLogsForCalendarOccurrence(
  logs: readonly CompletedSelfPostedTrainingLog[],
  occurrence: CalendarOccurrenceIdentity,
): CompletedSelfPostedTrainingLog[] {
  const matches = logs.filter((record) => {
    const origin = record.origin;
    if (!origin) return false;
    if (origin.type !== 'self_posted_calendar_session') return false;
    if (origin.sessionId !== occurrence.sessionId) return false;
    if (origin.occurrenceDateISO !== occurrence.occurrenceDateISO) return false;
    return true;
  });

  return matches
    .slice()
    .sort((a, b) => {
      const cmp = a.occurrence.startDateTime.localeCompare(b.occurrence.startDateTime);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });
}
