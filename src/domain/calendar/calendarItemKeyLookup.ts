/**
 * calendarItemKeyLookup.ts — smallest application-level assembly pairing
 * `CalendarItemSummary` values with the exact raw merged item each one came
 * from, so an opaque `CalendarItemKey` can be resolved back to the existing
 * raw item without re-deriving any key format or reimplementing dispatch/
 * placement/merging.
 *
 * Calls `dispatchCalendarItem` — the SAME single per-item admission/dispatch
 * decision `projectDayCalendarItems` itself uses — exactly once per raw item,
 * pairing each summary directly with the raw item that produced it in one
 * pass. There is no separate admission filter to keep in sync and no
 * positional zipping between two independently produced arrays: admission,
 * ordering and unknown-type handling can never diverge from
 * `projectDayCalendarItems` because both share the same underlying decision.
 *
 * The resulting lookup is a plain, transient `Map` — never persisted, never
 * exported as part of `CalendarItemSummary`, never given to presentation.
 * It exists purely so the application layer (not presentation) can resolve
 * a clicked `CalendarItemKey` back to the raw item its existing
 * source-specific routing already knows how to open.
 *
 * Fails fast on a duplicate `itemKey` within one call rather than silently
 * overwriting an unrelated raw item — an unsafe open intent is worse than a
 * loud, immediate error during construction.
 */
import { dispatchCalendarItem, type DayCalendarItemProjectionContext } from './calendarItemProjection';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { CalendarItemKey } from './calendarItemDetail';

export interface ProjectedDayCalendarItems {
  summaries: CalendarItemSummary[];
  /** Transient, in-memory only. Never persist, never expose to presentation. */
  rawByKey: Map<CalendarItemKey, unknown>;
}

/**
 * Project one already-merged calendar day's item array into
 * `CalendarItemSummary[]` plus an in-memory `CalendarItemKey → raw item`
 * lookup for the same admitted items, in the same order, via the single
 * shared `dispatchCalendarItem` decision.
 */
export function projectDayCalendarItemsWithLookup(
  items: readonly unknown[],
  context: DayCalendarItemProjectionContext,
): ProjectedDayCalendarItems {
  const summaries: CalendarItemSummary[] = [];
  const rawByKey = new Map<CalendarItemKey, unknown>();

  for (const raw of items) {
    const summary = dispatchCalendarItem(raw, context);
    if (!summary) continue;

    if (rawByKey.has(summary.itemKey)) {
      throw new Error(`projectDayCalendarItemsWithLookup: duplicate CalendarItemKey "${summary.itemKey}" — refusing to silently overwrite a different raw item.`);
    }

    summaries.push(summary);
    rawByKey.set(summary.itemKey, raw);
  }

  return { summaries, rawByKey };
}

