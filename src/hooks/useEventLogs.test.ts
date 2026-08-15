// @vitest-environment jsdom
/**
 * useEventLogs.test.ts — focused hook tests.
 *
 * Mocks the pure coordinator and eventLogService — no Firebase, no emulator.
 * Verifies the hook's own state-coordination responsibilities only (loading,
 * stale-request protection, error propagation, add-then-refresh) since
 * validation/build/persistence logic is already covered by
 * logCoordinator.test.ts and selfPostedTraining.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEventLogs } from './useEventLogs';
import { addCompletedTrainingLog } from '../domain/calendar/logCoordinator';
import {
  addCompletedSelfPostedTrainingLog,
  listCompletedSelfPostedTrainingLogs,
} from '../services/eventLogService';
import type { CompletedSelfPostedTrainingLog } from '../domain/calendar/types';
import type { CompletedSelfPostedTrainingInput } from '../domain/calendar/selfPostedTraining';

vi.mock('../domain/calendar/logCoordinator', () => ({
  addCompletedTrainingLog: vi.fn(),
}));

vi.mock('../services/eventLogService', () => ({
  addCompletedSelfPostedTrainingLog: vi.fn(),
  listCompletedSelfPostedTrainingLogs: vi.fn(),
}));

const mockedAddCompletedTrainingLog = vi.mocked(addCompletedTrainingLog);
const mockedListLogs = vi.mocked(listCompletedSelfPostedTrainingLogs);
const mockedAddPersist = vi.mocked(addCompletedSelfPostedTrainingLog);

function makeLog(id: string, startDateTime = '2026-08-14T18:00:00.000Z'): CompletedSelfPostedTrainingLog {
  return {
    id,
    occurrence: {
      id: `occ-${id}`,
      seriesId: null,
      type: 'self_posted_training',
      title: 'Training',
      startDateTime,
      endDateTime: startDateTime,
      status: 'completed',
      hasLogs: true,
    },
    calendarEntry: { id: `cal-${id}`, occurrenceId: `occ-${id}`, status: 'completed' },
    log: { id: `log-${id}`, occurrenceId: `occ-${id}`, userId: 'fighter@example.com', attended: true },
    createdAt: startDateTime,
    updatedAt: startDateTime,
  };
}

const validInput: CompletedSelfPostedTrainingInput = {
  title: 'Boxing training',
  dateISO: '2026-08-14',
  start: '18:00',
  end: '19:00',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEventLogs', () => {
  it('does not load when fighter key is empty', () => {
    const { result } = renderHook(() => useEventLogs(''));

    expect(mockedListLogs).not.toHaveBeenCalled();
    expect(result.current.logs).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loads logs for a valid fighter key', async () => {
    const logs = [makeLog('1')];
    mockedListLogs.mockResolvedValueOnce(logs);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedListLogs).toHaveBeenCalledWith('fighter@example.com');
    expect(result.current.logs).toEqual(logs);
  });

  it('reloads logs when the fighter key changes', async () => {
    const logsA = [makeLog('a')];
    const logsB = [makeLog('b')];
    mockedListLogs.mockResolvedValueOnce(logsA);

    const { result, rerender } = renderHook(
      ({ fighterKey }) => useEventLogs(fighterKey),
      { initialProps: { fighterKey: 'fighterA@example.com' } },
    );

    await waitFor(() => expect(result.current.logs).toEqual(logsA));

    mockedListLogs.mockResolvedValueOnce(logsB);
    rerender({ fighterKey: 'fighterB@example.com' });

    await waitFor(() => expect(result.current.logs).toEqual(logsB));
    expect(mockedListLogs).toHaveBeenNthCalledWith(2, 'fighterB@example.com');
  });

  it('ignores a stale response from a previous fighter key', async () => {
    let resolveFirst!: (value: CompletedSelfPostedTrainingLog[]) => void;
    const firstPromise = new Promise<CompletedSelfPostedTrainingLog[]>((resolve) => {
      resolveFirst = resolve;
    });
    const logsB = [makeLog('b')];

    mockedListLogs.mockImplementationOnce(() => firstPromise);
    mockedListLogs.mockResolvedValueOnce(logsB);

    const { result, rerender } = renderHook(
      ({ fighterKey }) => useEventLogs(fighterKey),
      { initialProps: { fighterKey: 'fighterA@example.com' } },
    );

    rerender({ fighterKey: 'fighterB@example.com' });

    await waitFor(() => expect(result.current.logs).toEqual(logsB));

    // Resolve the stale first-fighter request AFTER the second has already resolved.
    await act(async () => {
      resolveFirst([makeLog('stale')]);
    });

    expect(result.current.logs).toEqual(logsB);
  });

  it('adds a log and refreshes state on success', async () => {
    mockedListLogs.mockResolvedValueOnce([]); // initial load
    mockedAddCompletedTrainingLog.mockResolvedValueOnce('new-log-id');
    const refreshedLogs = [makeLog('new-log-id')];
    mockedListLogs.mockResolvedValueOnce(refreshedLogs); // refresh after add

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returnedId = '';
    await act(async () => {
      returnedId = await result.current.addLog(validInput);
    });

    expect(returnedId).toBe('new-log-id');
    expect(mockedAddCompletedTrainingLog).toHaveBeenCalledWith(
      validInput,
      'fighter@example.com',
      expect.objectContaining({ persist: mockedAddPersist }),
    );
    expect(mockedListLogs).toHaveBeenCalledTimes(2);
    expect(result.current.logs).toEqual(refreshedLogs);
  });

  it('accepts valid completed training input without notes', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    mockedAddCompletedTrainingLog.mockResolvedValueOnce('id-no-notes');
    mockedListLogs.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.addLog(validInput); // no `notes` field
      }),
    ).resolves.not.toThrow();

    // `validInput` has no `notes` key at all — confirms the hook neither
    // requires nor injects one before delegating to the coordinator.
    expect(mockedAddCompletedTrainingLog).toHaveBeenCalledWith(
      validInput,
      'fighter@example.com',
      expect.anything(),
    );
  });

  it('sets error state and ends loading when the load fails', async () => {
    const err = new Error('Firestore read failed');
    mockedListLogs.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(err);
  });

  it('clears a previous loading error after a successful load', async () => {
    const err = new Error('Firestore read failed');
    mockedListLogs.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.error).toBe(err));

    const logs = [makeLog('1')];
    mockedListLogs.mockResolvedValueOnce(logs);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.logs).toEqual(logs);
  });

  it('propagates add failures without a false success and without refreshing', async () => {
    mockedListLogs.mockResolvedValueOnce([]); // initial load
    const err = new Error('Persistence failed');
    mockedAddCompletedTrainingLog.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.addLog(validInput);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBe(err);
    expect(result.current.error).toBe(err);
    expect(mockedListLogs).toHaveBeenCalledTimes(1); // no refresh after failed persist
  });

  it('refreshes on manual call', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const logs = [makeLog('refreshed')];
    mockedListLogs.mockResolvedValueOnce(logs);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockedListLogs).toHaveBeenCalledTimes(2);
    expect(result.current.logs).toEqual(logs);
  });

  it('rejects addLog when fighter key is missing, without calling coordinator or persistence', async () => {
    const { result } = renderHook(() => useEventLogs(''));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.addLog(validInput);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(mockedAddCompletedTrainingLog).not.toHaveBeenCalled();
    expect(mockedAddPersist).not.toHaveBeenCalled();
  });
});
