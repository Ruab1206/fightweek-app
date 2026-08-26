/**
 * legacySessionSummaryAdapter.ts — pure source adapter mapping a legacy
 * self-posted `TrainingSession` (`users/{fighterKey}/weeks/week_{n}`) to the
 * smaller `CalendarItemSummary` rendering read contract (see
 * `calendarItemSummary.ts`).
 *
 * TRANSITIONAL source adapter. Shares the exact opaque `itemKey` format
 * with `legacySessionDetailAdapter.ts` (`self_posted_legacy:{week}:{date}:
 * {sessionId}`) so a later intent can resolve either contract's identity to
 * the same underlying item. Never fabricates `occurrenceId`/
 * `calendarEntryId` — a legacy session has no canonical identity yet.
 * Retirement condition: retire once legacy self-posted sessions are
 * represented as canonical `EventOccurrence`/`CalendarEntry` records and a
 * canonical-source summary adapter replaces this one.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `session`/
 * `context`. Constructs no `EventOccurrence`, no `CalendarEntry`. Reuses the
 * existing `toDateTime` timing helper exactly, rather than reimplementing
 * it.
 */
import { toDateTime } from './adapters';
import type { TrainingSession } from '../../types/common';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { CalendarItemKey } from './calendarItemDetail';

/** Placement context the caller already has today — not derivable from `session` alone. */
export interface LegacySessionSummaryContext {
  weekNumber: number;
  dateISO: string;
}

function buildItemKey(session: TrainingSession, context: LegacySessionSummaryContext): CalendarItemKey {
  const sessionId = session.id !== undefined ? String(session.id) : 'unsaved';
  return `self_posted_legacy:${context.weekNumber}:${context.dateISO}:${sessionId}` as CalendarItemKey;
}

/**
 * Map one legacy `TrainingSession` + its placement context into the smaller
 * `CalendarItemSummary` rendering contract.
 */
export function mapLegacySessionToCalendarItemSummary(
  session: TrainingSession,
  context: LegacySessionSummaryContext,
): CalendarItemSummary {
  const summary: CalendarItemSummary = {
    itemKey: buildItemKey(session, context),
    source: 'self_posted_legacy',
    title: session.name,
    dateISO: context.dateISO,
    startDateTime: toDateTime(context.dateISO, session.start),
    endDateTime: toDateTime(context.dateISO, session.end),
    availability:
      session.status === 'cancelled'
        ? {
            status: 'cancelled',
            ...(session.cancellationReason !== undefined ? { cancellationReason: session.cancellationReason } : {}),
          }
        : { status: 'active' },
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty for absent optional fields.
  if (session.location) summary.location = session.location;
  if (session.category) summary.category = session.category;

  return summary;
}
