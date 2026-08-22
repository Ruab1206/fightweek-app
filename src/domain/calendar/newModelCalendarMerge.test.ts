/**
 * newModelCalendarMerge.test.ts — pure merge of projected new-model calendar
 * entries into the current week/day calendar shape. No Firebase, no React.
 */
import { describe, it, expect } from 'vitest';
import { mergeNewModelCalendarEntries } from './newModelCalendarMerge';
import type { NewModelCalendarAggregate } from './types';

function makeAggregate(
  id: string,
  overrides: Partial<NewModelCalendarAggregate> = {},
  occurrenceOverrides: Partial<NewModelCalendarAggregate['occurrence']> = {},
): NewModelCalendarAggregate {
  return {
    id,
    userId: 'fighter@example.com',
    occurrence: {
      id: `occ-${id}`,
      seriesId: null,
      type: 'self_posted_training',
      title: 'Solo run',
      discipline: 'Fysisk træning',
      startDateTime: '2026-08-22T06:00:00',
      endDateTime: '2026-08-22T07:00:00',
      status: 'completed',
      ...occurrenceOverrides,
    },
    calendarEntry: { id: `entry-${id}`, occurrenceId: `occ-${id}`, status: 'completed' },
    createdAt: '2026-08-22T07:05:00.000Z',
    updatedAt: '2026-08-22T07:05:00.000Z',
    schemaVersion: 1,
    logRecordId: `log-${id}`,
    ...overrides,
  };
}

describe('mergeNewModelCalendarEntries', () => {
  it('inserts a projected entry into the correct week/day', () => {
    // 2026-08-22 is a Saturday, ISO week 34.
    const merged = mergeNewModelCalendarEntries({}, [makeAggregate('a1')]);
    expect(merged[34]?.['Lørdag']).toHaveLength(1);
    expect(merged[34]['Lørdag'][0]).toMatchObject({ type: 'calendar_entry', aggregateId: 'a1', name: 'Solo run' });
  });

  it('does not mutate the input multiWeekData', () => {
    const input: Record<number, any> = { 34: { Lørdag: [{ id: 1, name: 'MMA', type: 'training' }] } };
    const snapshot = JSON.parse(JSON.stringify(input));
    mergeNewModelCalendarEntries(input, [makeAggregate('a1')]);
    expect(input).toEqual(snapshot);
  });

  it('preserves existing non-projected entries on the same day', () => {
    const input: Record<number, any> = { 34: { Lørdag: [{ id: 1, name: 'MMA', type: 'training' }] } };
    const merged = mergeNewModelCalendarEntries(input, [makeAggregate('a1')]);
    expect(merged[34]['Lørdag']).toHaveLength(2);
    expect(merged[34]['Lørdag'][0]).toMatchObject({ name: 'MMA' });
  });

  it('removes prior calendar_entry projections before re-merging', () => {
    const input: Record<number, any> = {
      34: { Lørdag: [{ id: 1, name: 'Stale projection', type: 'calendar_entry' }] },
    };
    const merged = mergeNewModelCalendarEntries(input, [makeAggregate('a1')]);
    expect(merged[34]['Lørdag'].filter((s: any) => s.type === 'calendar_entry')).toHaveLength(1);
    expect(merged[34]['Lørdag'][0].name).not.toBe('Stale projection');
  });

  it('de-duplicates by aggregateId, keeping the first', () => {
    const first = makeAggregate('dup1', {}, { title: 'First' });
    const second = makeAggregate('dup1', {}, { title: 'Second' });
    const merged = mergeNewModelCalendarEntries({}, [first, second]);
    expect(merged[34]['Lørdag']).toHaveLength(1);
    expect(merged[34]['Lørdag'][0].name).toBe('First');
  });

  it('produces deterministic ordering (by start, then aggregateId) among projected entries on the same day', () => {
    const later = makeAggregate('z_agg', {}, { startDateTime: '2026-08-22T18:00:00', endDateTime: '2026-08-22T19:00:00' });
    const earlier = makeAggregate('a_agg', {}, { startDateTime: '2026-08-22T06:00:00', endDateTime: '2026-08-22T07:00:00' });
    const mergedA = mergeNewModelCalendarEntries({}, [later, earlier]);
    const mergedB = mergeNewModelCalendarEntries({}, [earlier, later]);
    expect(mergedA[34]['Lørdag'].map((e: any) => e.aggregateId)).toEqual(['a_agg', 'z_agg']);
    expect(mergedB[34]['Lørdag'].map((e: any) => e.aggregateId)).toEqual(['a_agg', 'z_agg']);
  });

  it('safely excludes an invalid aggregate (projection throws) instead of crashing the merge', () => {
    const valid = makeAggregate('valid1');
    const invalid = makeAggregate('invalid1', {}, { startDateTime: 'not-a-date' });
    const merged = mergeNewModelCalendarEntries({}, [valid, invalid]);
    expect(merged[34]['Lørdag']).toHaveLength(1);
    expect(merged[34]['Lørdag'][0].aggregateId).toBe('valid1');
  });

  it('returns the original data unchanged in shape when there are no aggregates', () => {
    const input: Record<number, any> = { 34: { Lørdag: [{ id: 1, type: 'training' }] } };
    const merged = mergeNewModelCalendarEntries(input, []);
    expect(merged[34]['Lørdag']).toEqual(input[34]['Lørdag']);
  });

  it('handles a ISO year-boundary aggregate correctly (2027-01-01 -> week 53)', () => {
    const agg = makeAggregate('boundary1', {}, { startDateTime: '2027-01-01T09:00:00', endDateTime: '2027-01-01T10:00:00' });
    const merged = mergeNewModelCalendarEntries({}, [agg]);
    expect(merged[53]?.['Fredag']).toHaveLength(1);
  });

  it('preserves non-array fields (e.g. lastUpdated) on affected weeks', () => {
    const input: Record<number, any> = { 34: { lastUpdated: '2026-08-01T00:00:00Z', Lørdag: [] } };
    const merged = mergeNewModelCalendarEntries(input, [makeAggregate('a1')]);
    expect(merged[34].lastUpdated).toBe('2026-08-01T00:00:00Z');
  });
});
