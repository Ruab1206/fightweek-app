/**
 * invitationSummaryAdapter.ts — pure adapter mapping the merged invitation
 * calendar session (`useInvitationMerge.ts`'s `InvitationSession` — a
 * virtual per-day card, never persisted) to the smaller `CalendarItemSummary`
 * rendering read contract (see `calendarItemSummary.ts`).
 *
 * TRANSITIONAL, and scoped to exactly the fields already justified by
 * current common rendering (title/timing/category/location/availability).
 * Deliberately excludes invitation response, arranger name, and invitee
 * data — those remain source-specific and, per the resolved product scope,
 * become mandatory contract additions only before adoption/production
 * wiring, not in this slice. Never fabricates `occurrenceId`/
 * `calendarEntryId` — an invitation has no canonical occurrence/CalendarEntry
 * identity. Retirement condition: retire once invitations are represented as
 * canonical `EventOccurrence`/`CalendarEntry`-linked records and a
 * canonical-source summary adapter replaces this one.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `session`/
 * `context`. Reuses the existing `toDateTime` timing helper exactly.
 */
import { toDateTime } from './adapters';
import type { InvitationSession } from '../../hooks/useInvitationMerge';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { CalendarItemKey } from './calendarItemDetail';

/** Placement context the caller already has today — not derivable from `session` alone. */
export interface InvitationSummaryContext {
  weekNumber: number;
  dateISO: string;
}

function buildItemKey(session: InvitationSession): CalendarItemKey {
  return `invitation:${session.invitationId}` as CalendarItemKey;
}

/**
 * Map one merged `InvitationSession` + its placement context into the
 * smaller `CalendarItemSummary` rendering contract.
 */
export function mapInvitationSessionToCalendarItemSummary(
  session: InvitationSession,
  context: InvitationSummaryContext,
): CalendarItemSummary {
  const summary: CalendarItemSummary = {
    itemKey: buildItemKey(session),
    source: 'invitation',
    title: session.name,
    dateISO: context.dateISO,
    startDateTime: toDateTime(context.dateISO, session.start),
    endDateTime: toDateTime(context.dateISO, session.end),
    availability: session.invitationCancelled ? { status: 'cancelled' } : { status: 'active' },
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty for absent optional fields.
  if (session.location) summary.location = session.location;
  if (session.category) summary.category = session.category;

  return summary;
}
