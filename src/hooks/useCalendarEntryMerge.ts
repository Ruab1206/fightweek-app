/**
 * useCalendarEntryMerge — thin `useMemo` wrapper around the pure
 * `mergeNewModelCalendarEntries`. Only merges when the read status is
 * `'loaded'`; `idle`/`loading`/`error` return `multiWeekData` unchanged, so a
 * not-yet-resolved or failed read never hides or corrupts the existing
 * calendar. No Firebase, no mutation.
 */
import { useMemo } from 'react';
import { mergeNewModelCalendarEntries } from '../domain/calendar/newModelCalendarMerge';
import type { NewModelCalendarAggregate } from '../domain/calendar/types';
import type { CalendarEntriesStatus } from './useCalendarEntries';

export function useCalendarEntryMerge(
  multiWeekData: Record<number, any>,
  entries: readonly NewModelCalendarAggregate[],
  status: CalendarEntriesStatus,
): Record<number, any> {
  return useMemo(() => {
    if (status !== 'loaded') return multiWeekData;
    return mergeNewModelCalendarEntries(multiWeekData, entries);
  }, [multiWeekData, entries, status]);
}
