/**
 * eventSessionSummaryAdapter.ts — pure adapter mapping the merged event
 * calendar session (`useEventMerge.ts`'s `EventSession` — a virtual per-day
 * card, never persisted) to the smaller `CalendarItemSummary` rendering
 * read contract (see `calendarItemSummary.ts`).
 *
 * Deliberately consumes the already-merged event card directly rather than
 * resolving the full `FightweekEvent` (unlike `eventSummaryAdapter.ts`,
 * which remains unchanged and valid for contexts that genuinely start from
 * a raw `FightweekEvent`, such as `EventDetail`). Every field this contract
 * needs for current calendar-card rendering is already present on the
 * merged session — including `eventId`, sufficient on its own to build the
 * same opaque `event:{id}` key used elsewhere — so no lookup, cache, or
 * missing-event failure mode is introduced. The merged session's own
 * `status` is always `'active'` (see `useEventMerge.ts`'s
 * `buildEventSession`) — current event cards never display cancellation —
 * so this adapter preserves that directly rather than computing real
 * cancellation from the full event, which would be EventDetail-only
 * correctness the card/summary path does not need.
 *
 * TRANSITIONAL source adapter. Retirement condition: retire once events are
 * represented as canonical `EventOccurrence`/`CalendarEntry` records and a
 * canonical-source summary adapter replaces this one.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `session`/
 * `context`. Reuses the existing `toDateTime` timing helper exactly.
 */
import { toDateTime } from './adapters';
import type { EventSession } from '../../hooks/useEventMerge';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { CalendarItemKey } from './calendarItemDetail';

/**
 * Placement context the caller already has today. `dateISO` is not stored
 * on the merged session itself (only local HH:mm `start`/`end`) — it is the
 * date the current merge already placed this session under.
 */
export interface EventSessionSummaryContext {
  dateISO: string;
}

function buildItemKey(session: EventSession): CalendarItemKey {
  return `event:${session.eventId}` as CalendarItemKey;
}

/**
 * Map one merged `EventSession` + its placement context into the smaller
 * `CalendarItemSummary` rendering contract.
 */
export function mapEventSessionToCalendarItemSummary(
  session: EventSession,
  context: EventSessionSummaryContext,
): CalendarItemSummary {
  const summary: CalendarItemSummary = {
    itemKey: buildItemKey(session),
    source: 'event',
    title: session.name,
    dateISO: context.dateISO,
    startDateTime: toDateTime(context.dateISO, session.start),
    endDateTime: toDateTime(context.dateISO, session.end),
    // The merged session's own `status` type is always 'active' — see this
    // file's doc comment for why that is preserved directly rather than
    // resolved from the full event.
    availability: { status: 'active' },
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty for absent optional fields.
  if (session.location) summary.location = session.location;
  if (session.category) summary.category = session.category;

  return summary;
}
