// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarEntryMerge } from './useCalendarEntryMerge';
import type { NewModelCalendarAggregate } from '../domain/calendar/types';

function makeAggregate(id: string): NewModelCalendarAggregate {
  return {
    id,
    userId: 'fighter@example.com',
    occurrence: { id: `occ-${id}`, seriesId: null, type: 'self_posted_training', title: 'Solo run', startDateTime: '2026-08-22T06:00:00', endDateTime: '2026-08-22T07:00:00', status: 'completed' },
    calendarEntry: { id: `entry-${id}`, occurrenceId: `occ-${id}`, status: 'completed' },
    createdAt: '2026-08-22T07:05:00.000Z',
    updatedAt: '2026-08-22T07:05:00.000Z',
    schemaVersion: 1,
    logRecordId: `log-${id}`,
  };
}

describe('useCalendarEntryMerge', () => {
  it('merges when status is loaded', () => {
    const { result } = renderHook(() => useCalendarEntryMerge({}, [makeAggregate('a1')], 'loaded'));
    expect(result.current[34]?.['Lørdag']).toHaveLength(1);
  });

  it('returns the input unchanged when status is loading', () => {
    const input = { 34: { Lørdag: [] } };
    const { result } = renderHook(() => useCalendarEntryMerge(input, [makeAggregate('a1')], 'loading'));
    expect(result.current).toBe(input);
  });

  it('returns the input unchanged when status is error', () => {
    const input = { 34: { Lørdag: [] } };
    const { result } = renderHook(() => useCalendarEntryMerge(input, [makeAggregate('a1')], 'error'));
    expect(result.current).toBe(input);
  });

  it('returns the input unchanged when status is idle', () => {
    const input = { 34: { Lørdag: [] } };
    const { result } = renderHook(() => useCalendarEntryMerge(input, [], 'idle'));
    expect(result.current).toBe(input);
  });
});
