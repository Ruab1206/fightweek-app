/**
 * eventSummaryAdapter.ts — pure source adapter mapping a Fightweek
 * `FightweekEvent` (`public/data/events/{id}` — tournament/seminar/social/
 * other) to the smaller `CalendarItemSummary` rendering read contract (see
 * `calendarItemSummary.ts`).
 *
 * TRANSITIONAL source adapter, and the SECOND proof source for the summary
 * contract (after `legacySessionSummaryAdapter.ts`). Shares the exact opaque
 * `itemKey` format with `eventDetailAdapter.ts` (`event:{id}`). Never
 * fabricates `occurrenceId`/`calendarEntryId` — an event is not a persisted
 * per-fighter `CalendarEntry`. Deliberately does NOT project the event's
 * native `signups` map into this contract, for the same reason
 * `eventDetailAdapter.ts` excludes it (see that file's doc comment and
 * decision \u00a727): `interested`/`signed-up`/`declined` target distinct future
 * concepts (`Favorite`, `CalendarEntry`) that remain unimplemented.
 * Retirement condition: retire once events are represented as canonical
 * `EventOccurrence`/`CalendarEntry` records and a canonical-source summary
 * adapter replaces this one.
 *
 * No explicit context parameter: unlike the legacy adapter (which needs
 * caller-supplied week/day placement) or the event *detail* adapter (which
 * needs caller-supplied `isAdmin` for edit/delete capabilities), none of the
 * fields this summary carries require anything beyond the event itself —
 * this contract carries no capabilities, so there is nothing to compute
 * from context.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `event`. Reuses
 * the existing `toDateTime` timing helper, `isEventCancelled`
 * classification, and `disciplineToCategory` category mapping exactly (all
 * already pure) rather than reimplementing them — the category and
 * location-fallback values match the same computation the current virtual
 * calendar-card session already uses (`useEventMerge.ts`).
 */
import { toDateTime } from './adapters';
import { isEventCancelled } from '../../hooks/eventDelete';
import { disciplineToCategory } from '../../components/InlineCataloguePicker';
import type { FightweekEvent } from '../../types/event';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { CalendarItemKey } from './calendarItemDetail';

function buildItemKey(event: FightweekEvent): CalendarItemKey {
  return `event:${event.id}` as CalendarItemKey;
}

/**
 * Map one `FightweekEvent` into the smaller `CalendarItemSummary` rendering
 * contract.
 */
export function mapEventToCalendarItemSummary(event: FightweekEvent): CalendarItemSummary {
  const summary: CalendarItemSummary = {
    itemKey: buildItemKey(event),
    source: 'event',
    title: event.title,
    dateISO: event.date,
    startDateTime: toDateTime(event.date, event.startTime),
    endDateTime: toDateTime(event.endDate ?? event.date, event.endTime ?? event.startTime),
    availability: isEventCancelled(event)
      ? {
          status: 'cancelled',
          ...(event.cancellationReason !== undefined ? { cancellationReason: event.cancellationReason } : {}),
        }
      : { status: 'active' },
    // Matches the existing virtual-card computation exactly (useEventMerge.ts).
    category: event.discipline ? disciplineToCategory(event.discipline) : 'Andet',
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty.
  // Matches the existing virtual-card fallback exactly (useEventMerge.ts).
  if (event.location || event.address) summary.location = event.location || event.address;

  return summary;
}
