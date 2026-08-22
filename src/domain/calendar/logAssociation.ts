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

/** Explicit identity of a new-model `NewModelCalendarAggregate`/occurrence pair. */
export interface NewModelCalendarEntryIdentity {
  aggregateId: string;
  occurrenceId: string;
}

/**
 * Return every log whose `origin` exactly matches the given new-model
 * calendar-aggregate identity (Checkpoint A — see
 * `/docs/fightweek_refactoring_plan.md`). Sibling to
 * `selectLogsForCalendarOccurrence` above; matches only the
 * `'new_model_calendar_entry'` origin variant on `aggregateId` +
 * `occurrenceId` — never on mutable snapshot fields (title/discipline/time/
 * location/notes/intensity/duration), and never on the legacy
 * `'self_posted_calendar_session'` variant. A log without `origin` (a
 * standalone log) never matches. Pure — does not mutate `logs`. Ordering
 * matches `selectLogsForCalendarOccurrence`: ascending by the log's own
 * saved occurrence start time, with the log id as a stable tiebreaker.
 */
export function selectLogsForNewModelCalendarEntry(
  logs: readonly CompletedSelfPostedTrainingLog[],
  identity: NewModelCalendarEntryIdentity,
): CompletedSelfPostedTrainingLog[] {
  const matches = logs.filter((record) => {
    const origin = record.origin;
    if (!origin) return false;
    if (origin.type !== 'new_model_calendar_entry') return false;
    if (origin.aggregateId !== identity.aggregateId) return false;
    if (origin.occurrenceId !== identity.occurrenceId) return false;
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

// ──────────────────────────────────────────────
// Slice A: read-side integrity classification (none/one/conflict)
// ──────────────────────────────────────────────

/**
 * Structural shape of the `useEventLogs` load status, kept as a local type so
 * this module has no React/hook dependency. Matches `EventLogsStatus` in
 * `src/hooks/useEventLogs.ts` field-for-field.
 */
export type AssociationLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Read-side integrity classification of the exact matches returned by
 * `selectLogsForCalendarOccurrence` for one calendar occurrence (Phase 3,
 * Slice A — see `/docs/fightweek_refactoring_plan.md`).
 *
 * Describes TrainingLog ASSOCIATION INTEGRITY ONLY: it must never be read as
 * attendance, completion, Participation, registration, interest, favorite
 * state, or calendar status. `'conflict'` means more than one TrainingLog
 * exists for the same occurrence — a data-integrity condition, not a normal
 * list — and selects no log as canonical. Only `'none'` may enable creating
 * a new calendar-originated TrainingLog; `'loading'` and `'error'` must never
 * be treated as `'none'`.
 *
 * This is a read-side classification only. It does not provide atomic
 * concurrency protection: two clients that both observe `'none'` before
 * either writes may still create two logs for the same occurrence until a
 * separate atomic persistence slice (Slice B) is implemented.
 */
export type OccurrenceLogAssociation =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'none' }
  | { kind: 'one'; log: CompletedSelfPostedTrainingLog }
  | { kind: 'conflict'; logs: CompletedSelfPostedTrainingLog[] };

/**
 * Classify the exact-match result of `selectLogsForCalendarOccurrence`
 * against the load status it came from. Pure — no React, no Firestore, no
 * mutation of `matches`; the `'conflict'` payload is a defensive copy.
 */
export function classifyOccurrenceLogAssociation(
  status: AssociationLoadStatus,
  matches: readonly CompletedSelfPostedTrainingLog[],
): OccurrenceLogAssociation {
  if (status === 'error') return { kind: 'error' };
  if (status === 'idle' || status === 'loading') return { kind: 'loading' };

  if (matches.length === 0) return { kind: 'none' };
  if (matches.length === 1) return { kind: 'one', log: matches[0] };
  return { kind: 'conflict', logs: matches.slice() };
}
