/**
 * projectedCalendarEntrySummaryAdapter.test.ts — pure adapter mapping the
 * existing `ProjectedNewModelCalendarEntry` read model (see
 * newModelCalendarAggregate.ts / newModelCalendarMerge.ts) to the smaller
 * `CalendarItemSummary` rendering contract. No Firebase, no React, no
 * routing.
 */
import { describe, it, expect } from 'vitest';
import { mapProjectedCalendarEntryToCalendarItemSummary } from './projectedCalendarEntrySummaryAdapter';
import type { ProjectedNewModelCalendarEntry } from './types';

function makeEntry(overrides: Partial<ProjectedNewModelCalendarEntry> = {}): ProjectedNewModelCalendarEntry {
  return {
    type: 'calendar_entry',
    readOnly: true,
    aggregateId: 'agg_1',
    occurrenceId: 'occ_1',
    calendarEntryId: 'ce_1',
    name: 'Solo run',
    category: 'MMA',
    start: '17:00',
    end: '18:30',
    location: 'Klub A',
    status: 'active',
    ...overrides,
  };
}

const context = { dateISO: '2026-08-17' };

describe('mapProjectedCalendarEntryToCalendarItemSummary', () => {
  it('builds an opaque itemKey from the aggregate id', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry({ aggregateId: 'agg_42' }), context);
    expect(summary.itemKey).toBe('calendar_entry:agg_42');
  });

  it('produces a different itemKey for a different aggregate id', () => {
    const a = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry({ aggregateId: 'a' }), context);
    const b = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry({ aggregateId: 'b' }), context);
    expect(a.itemKey).not.toBe(b.itemKey);
  });

  // Genuine canonical identity — preserved, never fabricated.
  it('preserves the genuine occurrenceId and calendarEntryId from the source', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(
      makeEntry({ occurrenceId: 'occ_9', calendarEntryId: 'ce_9' }), context,
    );
    expect(summary.occurrenceId).toBe('occ_9');
    expect(summary.calendarEntryId).toBe('ce_9');
  });

  it('preserves title, timing, category and location', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(
      makeEntry({ name: 'Morning run', category: 'Strength/conditioning', start: '06:00', end: '07:00', location: 'Parken' }),
      { dateISO: '2026-08-17' },
    );
    expect(summary.title).toBe('Morning run');
    expect(summary.category).toBe('Strength/conditioning');
    expect(summary.dateISO).toBe('2026-08-17');
    expect(summary.startDateTime).toBe('2026-08-17T06:00:00');
    expect(summary.endDateTime).toBe('2026-08-17T07:00:00');
    expect(summary.location).toBe('Parken');
  });

  it('omits location when absent', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry({ location: undefined }), context);
    expect('location' in summary).toBe(false);
  });

  it('represents cancellation state', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry({ status: 'cancelled' }), context);
    expect(summary.availability).toEqual({ status: 'cancelled' });
  });

  it('represents active availability for a non-cancelled entry', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry({ status: 'active' }), context);
    expect(summary.availability).toEqual({ status: 'active' });
  });

  it('does not add TrainingLog, Participation, Favorite or action state', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry(), context) as Record<string, unknown>;
    expect(summary).not.toHaveProperty('trainingLogAssociation');
    expect(summary).not.toHaveProperty('participation');
    expect(summary).not.toHaveProperty('favorite');
    expect(summary).not.toHaveProperty('editable');
    expect(summary).not.toHaveProperty('deletable');
  });

  it('does not mutate the entry or context inputs', () => {
    const entry = makeEntry();
    const ctx = { ...context };
    const entrySnapshot = JSON.parse(JSON.stringify(entry));
    const ctxSnapshot = JSON.parse(JSON.stringify(ctx));

    mapProjectedCalendarEntryToCalendarItemSummary(entry, ctx);

    expect(entry).toEqual(entrySnapshot);
    expect(ctx).toEqual(ctxSnapshot);
  });

  it('constructs no new EventOccurrence- or CalendarEntry-shaped object beyond the preserved ids', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(makeEntry(), context);
    expect('occurrence' in summary).toBe(false);
    expect('calendarEntry' in summary).toBe(false);
  });
});
