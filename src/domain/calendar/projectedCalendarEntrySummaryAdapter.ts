/**
 * projectedCalendarEntrySummaryAdapter.ts — pure adapter mapping the
 * existing, already-canonical `ProjectedNewModelCalendarEntry` read model
 * (`newModelCalendarAggregate.ts`'s `projectNewModelCalendarAggregate`,
 * merged in by `newModelCalendarMerge.ts`) to the smaller
 * `CalendarItemSummary` rendering read contract (see
 * `calendarItemSummary.ts`).
 *
 * Unlike the other two summary adapters, this source ALREADY carries
 * genuine canonical `occurrenceId`/`calendarEntryId` — this adapter only
 * ever preserves those existing values; it never synthesises or falls back
 * to a substitute identity. The input is itself a read-only projection
 * (`readOnly: true`, enforced upstream), not a new domain aggregate — this
 * adapter treats it as such and adds no capability, action, or history
 * state (`TrainingLog`, `Participation`, `Favorite`).
 *
 * Pure — no Firebase, no React, no routing, no mutation of `entry`/
 * `context`. Reuses the existing `toDateTime` timing helper exactly.
 */
import { toDateTime } from './adapters';
import type { ProjectedNewModelCalendarEntry } from './types';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { CalendarItemKey } from './calendarItemDetail';

/**
 * Placement context the caller already has today. `dateISO` is not stored on
 * the projected entry itself (only local HH:mm `start`/`end`) — it is the
 * date the current merge already placed this entry under.
 */
export interface ProjectedCalendarEntrySummaryContext {
  dateISO: string;
}

function buildItemKey(entry: ProjectedNewModelCalendarEntry): CalendarItemKey {
  return `calendar_entry:${entry.aggregateId}` as CalendarItemKey;
}

/**
 * Map one `ProjectedNewModelCalendarEntry` + its placement context into the
 * smaller `CalendarItemSummary` rendering contract.
 */
export function mapProjectedCalendarEntryToCalendarItemSummary(
  entry: ProjectedNewModelCalendarEntry,
  context: ProjectedCalendarEntrySummaryContext,
): CalendarItemSummary {
  const summary: CalendarItemSummary = {
    itemKey: buildItemKey(entry),
    // Preserved, never fabricated: this source already has genuine identity.
    occurrenceId: entry.occurrenceId,
    calendarEntryId: entry.calendarEntryId,
    source: 'self_posted_new_model',
    title: entry.name,
    dateISO: context.dateISO,
    startDateTime: toDateTime(context.dateISO, entry.start),
    endDateTime: toDateTime(context.dateISO, entry.end),
    availability: entry.status === 'cancelled' ? { status: 'cancelled' } : { status: 'active' },
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty for absent optional fields.
  if (entry.location) summary.location = entry.location;
  if (entry.category) summary.category = entry.category;

  return summary;
}
