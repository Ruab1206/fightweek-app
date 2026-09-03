/**
 * invitationSummaryAdapter.ts — pure adapter mapping the merged invitation
 * calendar session (`useInvitationMerge.ts`'s `InvitationSession` — a
 * virtual per-day card, never persisted) to the smaller `CalendarItemSummary`
 * rendering read contract (see `calendarItemSummary.ts`).
 *
 * TRANSITIONAL, and scoped to exactly the fields already justified by
 * current common rendering (title/timing/category/location/availability),
 * plus the inviter/response indicators now needed for production wiring
 * (see `CalendarItemIndicator` in `calendarItemSummary.ts`) — translated
 * into generic, source-neutral badges, never a raw `invitedByName`/
 * `invitationResponse` pair on the shared contract itself. Never fabricates
 * `occurrenceId`/`calendarEntryId` — an invitation has no canonical
 * occurrence/CalendarEntry identity. Retirement condition: retire once
 * invitations are represented as canonical `EventOccurrence`/
 * `CalendarEntry`-linked records and a canonical-source summary adapter
 * replaces this one.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `session`/
 * `context`. Reuses the existing `toDateTime` timing helper exactly.
 */
import { toDateTime } from './adapters';
import { invitationBadge } from '../../types/invitation';
import type { InvitationSession } from '../../hooks/useInvitationMerge';
import type { CalendarItemSummary, CalendarItemIndicator } from './calendarItemSummary';
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

  const indicators: CalendarItemIndicator[] = [
    { kind: 'invitation_inviter', label: session.invitedByName ? `Fra ${session.invitedByName}` : 'Invitation' },
  ];
  // Matches current rendering: the response badge is only shown while the
  // invitation is still active — once cancelled, only the "Aflyst" state matters.
  if (!session.invitationCancelled) {
    const badge = invitationBadge(session.invitationResponse);
    indicators.push({
      kind: 'invitation_response',
      label: badge.label,
      tone: badge.tone === 'positive' ? 'positive' : 'attention',
    });
  }
  summary.indicators = indicators;

  return summary;
}
