/**
 * newModelCalendarMerge — Checkpoint B: pure merge of projected new-model
 * calendar entries (via the committed `projectNewModelCalendarAggregate`)
 * into the current week/day calendar shape. No Firebase, no React, no
 * mutation of `multiWeekData`/`aggregates`. Does NOT implement a merge hook
 * itself — see the thin `useCalendarEntryMerge` wrapper for that.
 *
 * Never writes to legacy weeks: this function only returns a new in-memory
 * object for rendering; persistence is handled entirely elsewhere.
 */
import { projectNewModelCalendarAggregate } from './newModelCalendarAggregate';
import type { NewModelCalendarAggregate, ProjectedNewModelCalendarEntry } from './types';

interface Placement {
  weekNumber: number;
  dayName: string;
  entry: ProjectedNewModelCalendarEntry;
}

/**
 * Merge `aggregates` into `multiWeekData`, projecting each into a read-only
 * `calendar_entry` card at its correct week/day. Pure — returns a new
 * top-level object with new per-week objects and new day arrays; never
 * mutates `multiWeekData` or `aggregates`.
 *
 * - Removes any prior `type === 'calendar_entry'` entries from every day
 *   before inserting the current projection set (mirrors the existing
 *   invitation-merge stripping pattern).
 * - De-duplicates by `aggregateId`, keeping the first occurrence.
 * - Deterministic ordering among projected entries on the same day: by
 *   `start`, then `aggregateId`.
 * - An aggregate that fails to project (invalid/impossible date, etc.) is
 *   safely excluded rather than crashing the merge — consistent with the
 *   read-side structured-issue policy in `calendarEntryService`.
 */
export function mergeNewModelCalendarEntries(
  multiWeekData: Record<number, any>,
  aggregates: readonly NewModelCalendarAggregate[],
): Record<number, any> {
  const seenAggregateIds = new Set<string>();
  const deduped: NewModelCalendarAggregate[] = [];
  for (const aggregate of aggregates) {
    if (seenAggregateIds.has(aggregate.id)) continue;
    seenAggregateIds.add(aggregate.id);
    deduped.push(aggregate);
  }

  const placements: Placement[] = [];
  for (const aggregate of deduped) {
    try {
      placements.push(projectNewModelCalendarAggregate(aggregate));
    } catch {
      // Invalid aggregate — excluded safely, never crashes the merge.
    }
  }

  placements.sort((a, b) => {
    const cmp = a.entry.start.localeCompare(b.entry.start);
    if (cmp !== 0) return cmp;
    return a.entry.aggregateId.localeCompare(b.entry.aggregateId);
  });

  const affectedWeeks = new Set<number>(placements.map((p) => p.weekNumber));
  const allWeeks = new Set<number>([
    ...Object.keys(multiWeekData).map(Number),
    ...affectedWeeks,
  ]);

  const merged: Record<number, any> = {};
  for (const weekNum of allWeeks) {
    const weekData: Record<string, any> = { ...(multiWeekData[weekNum] || {}) };
    for (const dayName of Object.keys(weekData)) {
      if (Array.isArray(weekData[dayName])) {
        weekData[dayName] = weekData[dayName].filter((s: any) => s?.type !== 'calendar_entry');
      }
    }
    merged[weekNum] = weekData;
  }

  for (const { weekNumber, dayName, entry } of placements) {
    if (!merged[weekNumber]) merged[weekNumber] = {};
    const existing = Array.isArray(merged[weekNumber][dayName]) ? merged[weekNumber][dayName] : [];
    merged[weekNumber][dayName] = [...existing, entry];
  }

  return merged;
}
