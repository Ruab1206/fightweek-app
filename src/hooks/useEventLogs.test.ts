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
import { buildUnplannedTrainingRecords } from '../domain/calendar/unplannedTrainingCoordinator';
import { persistUnplannedTrainingAtomically } from '../services/unplannedTrainingService';
import type { CompletedSelfPostedTrainingLog } from '../domain/calendar/types';
import type { CompletedSelfPostedTrainingInput } from '../domain/calendar/selfPostedTraining';

vi.mock('../domain/calendar/logCoordinator', () => ({
  addCompletedTrainingLog: vi.fn(),
}));

vi.mock('../services/eventLogService', () => ({
  addCompletedSelfPostedTrainingLog: vi.fn(),
  listCompletedSelfPostedTrainingLogs: vi.fn(),
}));

vi.mock('../domain/calendar/unplannedTrainingCoordinator', () => ({
  buildUnplannedTrainingRecords: vi.fn(),
}));

vi.mock('../services/unplannedTrainingService', () => ({
  persistUnplannedTrainingAtomically: vi.fn(),
}));

const mockedAddCompletedTrainingLog = vi.mocked(addCompletedTrainingLog);
const mockedListLogs = vi.mocked(listCompletedSelfPostedTrainingLogs);
const mockedAddPersist = vi.mocked(addCompletedSelfPostedTrainingLog);
const mockedBuildUnplannedTrainingRecords = vi.mocked(buildUnplannedTrainingRecords);
const mockedPersistAtomically = vi.mocked(persistUnplannedTrainingAtomically);

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
    expect(result.current.status).toBe('idle');
  });

  it('reports a loading status (not a loaded-empty result) before the initial request resolves', () => {
    mockedListLogs.mockImplementationOnce(() => new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));

    expect(result.current.status).toBe('loading');
    expect(result.current.logs).toEqual([]);
  });

  it('reaches a loaded status with an empty result after a successful empty load', async () => {
    mockedListLogs.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.logs).toEqual([]);
  });

  it('reaches an error status distinguishable from a loaded-empty result on failure', async () => {
    const err = new Error('Firestore read failed');
    mockedListLogs.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.logs).toEqual([]);
    expect(result.current.error).toBe(err);
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

// ──────────────────────────────────────────────
// addUnplannedTraining / resetUnplannedAttempt — Checkpoint B pendingIdsRef
// lifecycle. Mocks the pure coordinator and atomic persistence adapter, same
// isolation approach as addLog's tests above.
// ──────────────────────────────────────────────

function makeAggregateFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agg1',
    userId: 'fighter@example.com',
    occurrence: { id: 'occ1', seriesId: null, type: 'self_posted_training', title: 'Unplanned', startDateTime: '2026-08-14T06:00:00', endDateTime: '2026-08-14T07:00:00', status: 'completed' },
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed', userId: 'fighter@example.com' },
    createdAt: '2026-08-14T07:05:00.000Z',
    updatedAt: '2026-08-14T07:05:00.000Z',
    schemaVersion: 1 as const,
    logRecordId: 'log1',
    ...overrides,
  };
}

function makeLogRecordFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log1',
    occurrence: { id: 'occ1', seriesId: null, type: 'self_posted_training', title: 'Unplanned', startDateTime: '2026-08-14T06:00:00', endDateTime: '2026-08-14T07:00:00', status: 'completed' },
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed' },
    log: { id: 'evlog1', occurrenceId: 'occ1', userId: 'fighter@example.com', attended: true },
    origin: { type: 'new_model_calendar_entry', aggregateId: 'agg1', occurrenceId: 'occ1' },
    createdAt: '2026-08-14T07:05:00.000Z',
    updatedAt: '2026-08-14T07:05:00.000Z',
    ...overrides,
  };
}

const unplannedInput: CompletedSelfPostedTrainingInput = {
  title: 'Solo run',
  dateISO: '2026-08-14',
  start: '06:00',
  durationMinutes: 60,
};

describe('useEventLogs — addUnplannedTraining / resetUnplannedAttempt', () => {
  beforeEach(() => {
    mockedBuildUnplannedTrainingRecords.mockImplementation((input, ids) => ({
      aggregate: makeAggregateFixture({ id: ids.aggregateId, logRecordId: ids.logRecordId, userId: input.userId }),
      logRecord: makeLogRecordFixture({ id: ids.logRecordId }),
    }));
  });

  it('mints a shared id bundle on the first submit and persists atomically, then refreshes', async () => {
    mockedListLogs.mockResolvedValueOnce([]); // initial load
    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([makeLog('new')]); // refresh after add

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });

    expect(mockedBuildUnplannedTrainingRecords).toHaveBeenCalledTimes(1);
    const [, idsArg] = mockedBuildUnplannedTrainingRecords.mock.calls[0];
    expect(idsArg.aggregateId).toEqual(expect.any(String));
    expect(idsArg.occurrenceId).toEqual(expect.any(String));
    expect(idsArg.calendarEntryId).toEqual(expect.any(String));
    expect(idsArg.logRecordId).toEqual(expect.any(String));
    expect(mockedPersistAtomically).toHaveBeenCalledWith('fighter@example.com', expect.anything(), expect.anything());
    expect(mockedListLogs).toHaveBeenCalledTimes(2); // initial + post-success refresh
  });

  it('sets input.userId to the resolved fighterKey regardless of caller-supplied value', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addUnplannedTraining({ ...unplannedInput, userId: 'someone-else@x' });
    });

    const [inputArg] = mockedBuildUnplannedTrainingRecords.mock.calls[0];
    expect(inputArg.userId).toBe('fighter@example.com');
  });

  it('retains the SAME id bundle for a retry after a failed persist', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const persistErr = new Error('network error');
    mockedPersistAtomically.mockRejectedValueOnce(persistErr);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.addUnplannedTraining(unplannedInput)).rejects.toBe(persistErr);
    });
    const firstIds = mockedBuildUnplannedTrainingRecords.mock.calls[0][1];

    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const secondIds = mockedBuildUnplannedTrainingRecords.mock.calls[1][1];

    expect(secondIds).toEqual(firstIds);
  });

  it('mints a FRESH id bundle for the next attempt after a successful creation', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const firstIds = mockedBuildUnplannedTrainingRecords.mock.calls[0][1];

    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const secondIds = mockedBuildUnplannedTrainingRecords.mock.calls[1][1];

    expect(secondIds).not.toEqual(firstIds);
  });

  it('mints a FRESH id bundle after resetUnplannedAttempt(), even without success or failure in between', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const persistErr = new Error('network error');
    mockedPersistAtomically.mockRejectedValueOnce(persistErr);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.addUnplannedTraining(unplannedInput)).rejects.toBe(persistErr);
    });
    const firstIds = mockedBuildUnplannedTrainingRecords.mock.calls[0][1];

    act(() => {
      result.current.resetUnplannedAttempt();
    });

    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const secondIds = mockedBuildUnplannedTrainingRecords.mock.calls[1][1];

    expect(secondIds).not.toEqual(firstIds);
  });

  it('resetUnplannedAttempt does not trigger a logs reload by itself', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.resetUnplannedAttempt();
    });

    expect(mockedListLogs).toHaveBeenCalledTimes(1); // only the initial load
  });

  it('an ordinary rerender with the same fighterKey does not reset an in-progress attempt', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const persistErr = new Error('network error');
    mockedPersistAtomically.mockRejectedValueOnce(persistErr);

    const { result, rerender } = renderHook(
      ({ fighterKey }) => useEventLogs(fighterKey),
      { initialProps: { fighterKey: 'fighter@example.com' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.addUnplannedTraining(unplannedInput)).rejects.toBe(persistErr);
    });
    const firstIds = mockedBuildUnplannedTrainingRecords.mock.calls[0][1];

    rerender({ fighterKey: 'fighter@example.com' }); // same key — no reset expected

    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const secondIds = mockedBuildUnplannedTrainingRecords.mock.calls[1][1];

    expect(secondIds).toEqual(firstIds);
  });

  it('a normal logs refresh() does not reset an in-progress attempt', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const persistErr = new Error('network error');
    mockedPersistAtomically.mockRejectedValueOnce(persistErr);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.addUnplannedTraining(unplannedInput)).rejects.toBe(persistErr);
    });
    const firstIds = mockedBuildUnplannedTrainingRecords.mock.calls[0][1];

    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.refresh();
    });

    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const secondIds = mockedBuildUnplannedTrainingRecords.mock.calls[1][1];

    expect(secondIds).toEqual(firstIds);
  });

  it('clears the pending bundle when the fighter key changes', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const persistErr = new Error('network error');
    mockedPersistAtomically.mockRejectedValueOnce(persistErr);

    const { result, rerender } = renderHook(
      ({ fighterKey }) => useEventLogs(fighterKey),
      { initialProps: { fighterKey: 'fighterA@example.com' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.addUnplannedTraining(unplannedInput)).rejects.toBe(persistErr);
    });
    const firstIds = mockedBuildUnplannedTrainingRecords.mock.calls[0][1];

    mockedListLogs.mockResolvedValueOnce([]);
    rerender({ fighterKey: 'fighterB@example.com' });
    await waitFor(() => expect(mockedListLogs).toHaveBeenCalledTimes(2));

    mockedPersistAtomically.mockResolvedValueOnce(undefined);
    mockedListLogs.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.addUnplannedTraining(unplannedInput);
    });
    const secondIds = mockedBuildUnplannedTrainingRecords.mock.calls[1][1];

    expect(secondIds).not.toEqual(firstIds);
  });

  it('rejects addUnplannedTraining when fighter key is missing, without minting ids or persisting', async () => {
    const { result } = renderHook(() => useEventLogs(''));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.addUnplannedTraining(unplannedInput);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(mockedBuildUnplannedTrainingRecords).not.toHaveBeenCalled();
    expect(mockedPersistAtomically).not.toHaveBeenCalled();
  });

  it('does not refresh logs when persistence fails', async () => {
    mockedListLogs.mockResolvedValueOnce([]);
    const persistErr = new Error('network error');
    mockedPersistAtomically.mockRejectedValueOnce(persistErr);

    const { result } = renderHook(() => useEventLogs('fighter@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.addUnplannedTraining(unplannedInput)).rejects.toBe(persistErr);
    });

    expect(mockedListLogs).toHaveBeenCalledTimes(1); // only the initial load, no refresh
    expect(result.current.error).toBe(persistErr);
  });
});
