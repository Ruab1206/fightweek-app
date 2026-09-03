/**
 * calendarItemProjection.ts — pure central dispatcher mapping one
 * already-merged calendar day's item array (the existing
 * `useScheduleData` → `useEventMerge` → `useInvitationMerge` →
 * `useCalendarEntryMerge` chain output — see App.tsx's composition) into
 * `CalendarItemSummary[]` (see calendarItemSummary.ts and the full-calendar
 * readiness checkpoint in `/docs/fightweek_refactoring_plan.md`).
 *
 * This module performs REPRESENTATION only, never PLACEMENT: it assumes the
 * merge chain has already decided which day/week an item belongs to, and
 * only maps each item's own fields to the shared rendering contract via the
 * existing pure per-source mappers. It does not iterate weeks/days itself,
 * does not merge, does not sort beyond preserving input order, does not
 * resolve open intents, and does not decide capabilities — those remain
 * entirely outside this module, exactly as before.
 *
 * TRANSITIONAL, source-agnostic dispatch layer over source vocabulary that
 * already exists in this merge chain today (`fravær` / `event` /
 * `invitation` / `calendar_entry` / absent-`type` self-posted). An
 * unrecognised `type` throws rather than silently falling through to the
 * legacy-session mapper — silently mapping an unknown source as legacy would
 * be exactly the kind of undetected drift this contract exists to prevent.
 * Legacy `{ id, isRestDay: true }` markers are excluded the same way as
 * fravær — every current presentation already filters them out before
 * rendering (see this file's admission checks).
 *
 * Pure — no Firebase, no React, no hooks, no routing, no mutation of
 * `items`/`context`. Delegates entirely to the existing, unchanged
 * `legacySessionSummaryAdapter`/`eventSessionSummaryAdapter`/
 * `invitationSummaryAdapter`/`projectedCalendarEntrySummaryAdapter` — each
 * mapper consumes only the already-merged per-day item it is given; none
 * requires a lookup back to a separate source collection.
 */
import { mapLegacySessionToCalendarItemSummary, type LegacySessionSummaryContext } from './legacySessionSummaryAdapter';
import { mapEventSessionToCalendarItemSummary } from './eventSessionSummaryAdapter';
import { mapInvitationSessionToCalendarItemSummary } from './invitationSummaryAdapter';
import { mapProjectedCalendarEntryToCalendarItemSummary } from './projectedCalendarEntrySummaryAdapter';
import type { CalendarItemSummary } from './calendarItemSummary';
import type { TrainingSession } from '../../types/common';
import type { EventSession } from '../../hooks/useEventMerge';
import type { InvitationSession } from '../../hooks/useInvitationMerge';
import type { ProjectedNewModelCalendarEntry } from './types';

/** Placement context for the whole day, shared by every source this projection dispatches. */
export type DayCalendarItemProjectionContext = LegacySessionSummaryContext;

/**
 * Single per-item admission + dispatch decision, shared by
 * `projectDayCalendarItems` and `calendarItemKeyLookup.ts`'s
 * `projectDayCalendarItemsWithLookup` — the ONE place that decides which
 * items are admitted and how each maps to a summary, so both consumers can
 * never diverge on admission/ordering/unknown-type handling. Returns `null`
 * for an explicitly excluded item (fravær, legacy rest-day marker); throws
 * for an unsupported `type` rather than silently treating it as any other
 * source.
 */
export function dispatchCalendarItem(
  raw: unknown,
  context: DayCalendarItemProjectionContext,
): CalendarItemSummary | null {
  const item = raw as { type?: unknown; isRestDay?: unknown };

  // Fravær is explicitly out of scope for this projection: PersonalSchedule
  // and MobileScrollView already render it in a structurally separate
  // block, never mixed into the generic card list this projection serves.
  if (item.type === 'fravær') return null;

  // Legacy rest-day markers ({ id, isRestDay: true }) are leftover data
  // with no name/time/type — every current presentation already filters
  // them out (`!s.isRestDay`) before rendering. Admitting one here would
  // produce a broken summary (undefined title, midnight fallback time),
  // not a real card, so this projection excludes them the same way.
  if (item.isRestDay) return null;

  if (item.type === 'calendar_entry') {
    return mapProjectedCalendarEntryToCalendarItemSummary(
      raw as ProjectedNewModelCalendarEntry,
      { dateISO: context.dateISO },
    );
  }

  if (item.type === 'invitation') {
    return mapInvitationSessionToCalendarItemSummary(
      raw as InvitationSession,
      { weekNumber: context.weekNumber, dateISO: context.dateISO },
    );
  }

  if (item.type === 'event') {
    return mapEventSessionToCalendarItemSummary(
      raw as EventSession,
      { dateISO: context.dateISO },
    );
  }

  // Explicit legacy-session discriminator rule: this merge chain gives
  // only self-posted training sessions no `type` field at all — every
  // other current source ('fravær'/'event'/'invitation'/'calendar_entry')
  // sets one explicitly (mirrors the same rule already relied on in
  // src/domain/calendar/adapters.ts). Anything else is unsupported.
  if (item.type === undefined) {
    return mapLegacySessionToCalendarItemSummary(
      raw as TrainingSession,
      { weekNumber: context.weekNumber, dateISO: context.dateISO },
    );
  }

  throw new Error(`projectDayCalendarItems: unsupported calendar item type "${String(item.type)}"`);
}

/**
 * Map one already-merged calendar day's item array into
 * `CalendarItemSummary[]`, dispatching each item by its existing `type`
 * discriminant to the matching pure source mapper via `dispatchCalendarItem`.
 * `fravær` is explicitly excluded (out of scope — see module doc comment);
 * an unrecognised `type` throws rather than being silently treated as any
 * other source.
 */
export function projectDayCalendarItems(
  items: readonly unknown[],
  context: DayCalendarItemProjectionContext,
): CalendarItemSummary[] {
  const results: CalendarItemSummary[] = [];

  for (const raw of items) {
    const summary = dispatchCalendarItem(raw, context);
    if (summary) results.push(summary);
  }

  return results;
}
