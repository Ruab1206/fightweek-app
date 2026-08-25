/**
 * eventDetailAdapter.ts — pure source adapter mapping a Fightweek
 * `FightweekEvent` (`public/data/events/{id}` — tournament/seminar/social/
 * other) to the shared `CalendarItemDetail`/`CalendarItemCapabilities` read
 * contract (see `calendarItemDetail.ts` and
 * `/docs/self_posted_lifecycle_and_invariants.md` Section I step 4).
 *
 * TRANSITIONAL source adapter, and the SECOND proof source for the shared
 * contract (after `legacySessionDetailAdapter.ts`): events have their own
 * globally-unique `id` and no per-fighter placement context — proving the
 * contract's source-neutrality across two materially different sources via
 * shared detail meaning (identity, timing, type, availability, notes), not
 * via shared signup/response semantics. Never fabricates `occurrenceId`/
 * `calendarEntryId` — an event is not a persisted per-fighter `CalendarEntry`.
 * Retirement condition: retire once events are represented as canonical
 * `EventOccurrence`/`CalendarEntry` records and a canonical-source adapter
 * replaces this one.
 *
 * Deliberately does NOT project the event's native `signups` map
 * (`interested`/`signed-up`/`declined`) into the shared contract. Those
 * values target distinct future concepts (`Favorite`, `CalendarEntry`) that
 * are documented but not yet implemented, and `declined` has no approved
 * durable target — projecting any of them here would smuggle a retiring,
 * source-specific status model into cross-source read contract. Current
 * production signup behaviour (`EventDetail`, `useEventMerge`) is untouched
 * and keeps reading `event.signups` directly.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `event`/`context`.
 * Constructs no `EventOccurrence`, no `CalendarEntry`. Reuses the existing
 * `toDateTime` timing helper, `eventNoteKey` convention, and `isEventCancelled`
 * classification exactly (all already pure, Firebase-free) rather than
 * reimplementing them. Admin-edit eligibility is never inferred here — it is
 * explicit supporting context the caller already computes today (mirrors
 * `EventDetail`'s own `isAdmin` prop).
 */
import { toDateTime } from './adapters';
import { eventNoteKey } from '../../hooks/noteKeys';
import { isEventCancelled } from '../../hooks/eventDelete';
import type { FightweekEvent } from '../../types/event';
import type {
  CalendarItemDetail,
  CalendarItemCapabilities,
  CalendarItemDetailRecord,
  CalendarItemKey,
} from './calendarItemDetail';

/**
 * Explicit supporting context the caller already has today. None of this is
 * derivable from `event` alone.
 */
export interface EventAdapterContext {
  /** Whether the viewer is an administrator (drives edit/delete). Defaults to false — never inferred. */
  isAdmin?: boolean;
}

function buildItemKey(event: FightweekEvent): CalendarItemKey {
  return `event:${event.id}` as CalendarItemKey;
}

/**
 * Map one `FightweekEvent` + its explicit supporting context into the shared
 * `CalendarItemDetail`/`CalendarItemCapabilities` read contract.
 */
export function mapEventToCalendarItemDetail(
  event: FightweekEvent,
  context: EventAdapterContext,
): CalendarItemDetailRecord {
  const detail: CalendarItemDetail = {
    itemKey: buildItemKey(event),
    source: 'event',
    title: event.title,
    eventType: event.type,
    dateISO: event.date,
    startDateTime: toDateTime(event.date, event.startTime),
    endDateTime: toDateTime(event.endDate ?? event.date, event.endTime ?? event.startTime),
    availability: isEventCancelled(event)
      ? {
          status: 'cancelled',
          ...(event.cancellationReason !== undefined ? { cancellationReason: event.cancellationReason } : {}),
          ...(event.cancelledAt !== undefined ? { cancellationTime: event.cancelledAt } : {}),
        }
      : { status: 'active' },
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty for absent optional fields.
  if (event.location) detail.location = event.location;
  if (event.description) detail.description = event.description;
  if (event.organiser) detail.organiser = event.organiser;
  if (event.url) detail.url = event.url;
  if (event.cost) detail.cost = event.cost;

  const capabilities: CalendarItemCapabilities = {
    editable: context.isAdmin === true,
    deletable: context.isAdmin === true,
    noteState: { supported: true, noteKey: eventNoteKey(event.id) },
    canLogTraining: false,
    canInvite: false,
    canSeriesInvite: false,
  };

  return { detail, capabilities };
}
