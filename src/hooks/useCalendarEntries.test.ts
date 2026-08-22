// @vitest-environment jsdom
/**
 * useCalendarEntries.test.ts — focused hook tests. Mocks calendarEntryService
 * — no Firebase, no emulator.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCalendarEntries } from './useCalendarEntries';
import { listCalendarEntries } from '../services/calendarEntryService';
import type { NewModelCalendarAggregate } from '../domain/calendar/types';

vi.mock('../services/calendarEntryService', () => ({
  listCalendarEntries: vi.fn(),
}));

const mockedList = vi.mocked(listCalendarEntries);

function makeAggregate(id: string, startDateTime = '2026-08-14T18:00:00'): NewModelCalendarAggregate {
  return {
    id,
    userId: 'fighter@example.com',
    occurrence: { id: `occ-${id}`, seriesId: null, type: 'self_posted_training', title: 'Solo run', startDateTime, endDateTime: startDateTime, status: 'completed' },
    calendarEntry: { id: `entry-${id}`, occurrenceId: `occ-${id}`, status: 'completed' },
    createdAt: startDateTime,
    updatedAt: startDateTime,
    schemaVersion: 1,
    logRecordId: `log-${id}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCalendarEntries', () => {
  it('does not load when fighter key is empty', () => {
    const { result } = renderHook(() => useCalendarEntries(''));
    expect(mockedList).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
    expect(result.current.issues).toEqual([]);
    expect(result.current.status).toBe('idle');
  });

  it('reports loading before the initial request resolves', () => {
    mockedList.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderHook(() => useCalendarEntries('fighter@example.com'));
    expect(result.current.status).toBe('loading');
  });

  it('reaches loaded with valid entries and empty issues', async () => {
    mockedList.mockResolvedValueOnce({ entries: [makeAggregate('a1')], issues: [] });
    const { result } = renderHook(() => useCalendarEntries('fighter@example.com'));
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.issues).toEqual([]);
  });

  it('stays loaded when valid entries and structured issues coexist (per policy)', async () => {
    mockedList.mockResolvedValueOnce({
      entries: [makeAggregate('a1')],
      issues: [{ id: 'bad1', reason: 'invalid_record' }],
    });
    const { result } = renderHook(() => useCalendarEntries('fighter@example.com'));
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.issues).toEqual([{ id: 'bad1', reason: 'invalid_record' }]);
  });

  it('reaches error status on failure, distinguishable from loaded-empty', async () => {
    const err = new Error('Firestore read failed');
    mockedList.mockRejectedValueOnce(err);
    const { result } = renderHook(() => useCalendarEntries('fighter@example.com'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toBe(err);
  });

  it('ignores a stale response from a previous fighter key', async () => {
    let resolveFirst!: (v: { entries: NewModelCalendarAggregate[]; issues: [] }) => void;
    const firstPromise = new Promise<{ entries: NewModelCalendarAggregate[]; issues: [] }>((resolve) => {
      resolveFirst = resolve;
    });
    mockedList.mockImplementationOnce(() => firstPromise as any);
    mockedList.mockResolvedValueOnce({ entries: [makeAggregate('b1')], issues: [] });

    const { result, rerender } = renderHook(
      ({ fighterKey }) => useCalendarEntries(fighterKey),
      { initialProps: { fighterKey: 'fighterA@example.com' } },
    );
    rerender({ fighterKey: 'fighterB@example.com' });
    await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['b1']));

    await act(async () => {
      resolveFirst({ entries: [makeAggregate('stale')], issues: [] });
    });
    expect(result.current.entries.map((e) => e.id)).toEqual(['b1']);
  });

  it('refresh() re-issues the read', async () => {
    mockedList.mockResolvedValueOnce({ entries: [], issues: [] });
    const { result } = renderHook(() => useCalendarEntries('fighter@example.com'));
    await waitFor(() => expect(result.current.status).toBe('loaded'));

    mockedList.mockResolvedValueOnce({ entries: [makeAggregate('a1')], issues: [] });
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockedList).toHaveBeenCalledTimes(2);
    expect(result.current.entries).toHaveLength(1);
  });

  it('never performs a write (no realtime listener; one-shot read only)', async () => {
    mockedList.mockResolvedValueOnce({ entries: [], issues: [] });
    renderHook(() => useCalendarEntries('fighter@example.com'));
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));
  });
});
