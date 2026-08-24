// @vitest-environment jsdom
/**
 * TrainingLogPage.test.tsx — isolated chronological training history page.
 *
 * `useEventLogs` is mocked so these tests never touch Firestore — the hook
 * itself is already covered by its own tests. `LogTrainingSheet` is the real
 * component; its own test suite covers domain validation/error mapping, so
 * here we only assert the page wires `onSubmit` to `addLog` and reacts to
 * success/failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingLogPage from './TrainingLogPage';
import { useEventLogs } from '../hooks/useEventLogs';
import type { UseEventLogsResult } from '../hooks/useEventLogs';
import { useCalendarEntries } from '../hooks/useCalendarEntries';
import type { UseCalendarEntriesResult } from '../hooks/useCalendarEntries';
import { loadLegacyWeekDocument } from '../services/legacySessionAssociationService';
import type { CompletedSelfPostedTrainingLog, NewModelCalendarAggregate } from '../domain/calendar/types';

vi.mock('../hooks/useCalendarEntries', () => ({
  useCalendarEntries: vi.fn(),
}));

const mockedUseCalendarEntries = vi.mocked(useCalendarEntries);

vi.mock('../services/legacySessionAssociationService', () => ({
  loadLegacyWeekDocument: vi.fn(),
}));

const mockedLoadLegacyWeekDocument = vi.mocked(loadLegacyWeekDocument);

vi.mock('../hooks/useEventLogs', () => ({
  useEventLogs: vi.fn(),
}));

const mockedUseEventLogs = vi.mocked(useEventLogs);

function fakeLog(overrides: Partial<CompletedSelfPostedTrainingLog['occurrence']> = {}): CompletedSelfPostedTrainingLog {
  return {
    id: 'record-1',
    occurrence: {
      id: 'occ-1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'MMA Sparring',
      discipline: 'MMA',
      startDateTime: '2026-07-30T10:00:00',
      endDateTime: '2026-07-30T11:00:00',
      location: 'Klub A',
      status: 'completed',
      hasLogs: true,
      ...overrides,
    },
    calendarEntry: { id: 'cal-1', occurrenceId: 'occ-1', status: 'completed' },
    log: {
      id: 'log-1',
      occurrenceId: 'occ-1',
      calendarEntryId: 'cal-1',
      userId: 'fighter@example.com',
      attended: true,
      actualStartDateTime: '2026-07-30T10:00:00',
      actualEndDateTime: '2026-07-30T11:00:00',
      intensity: 4,
      discipline: 'MMA',
      notes: 'Felt strong',
    },
    createdAt: '2026-07-30T11:05:00.000Z',
    updatedAt: '2026-07-30T11:05:00.000Z',
  };
}

function mockHookResult(overrides: Partial<UseEventLogsResult> = {}): UseEventLogsResult {
  return {
    logs: [],
    loading: false,
    error: null,
    status: 'loaded',
    addLog: vi.fn(),
    refresh: vi.fn(),
    addUnplannedTraining: vi.fn().mockResolvedValue({ aggregateId: 'agg1', occurrenceId: 'occ1', calendarEntryId: 'entry1', logRecordId: 'log-1' }),
    resetUnplannedAttempt: vi.fn(),
    ...overrides,
  };
}

function mockCalendarEntriesResult(overrides: Partial<UseCalendarEntriesResult> = {}): UseCalendarEntriesResult {
  return {
    entries: [],
    issues: [],
    status: 'loaded',
    error: null,
    refresh: vi.fn(),
    ...overrides,
  };
}

function makeAggregate(overrides: Partial<NewModelCalendarAggregate> = {}): NewModelCalendarAggregate {
  return {
    id: 'agg-1',
    userId: 'fighter@example.com',
    occurrence: {
      id: 'occ-1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'MMA Sparring',
      startDateTime: '2026-07-30T10:00:00',
      endDateTime: '2026-07-30T11:30:00',
      status: 'completed',
    },
    calendarEntry: { id: 'cal-1', occurrenceId: 'occ-1', status: 'completed' },
    createdAt: '2026-07-30T11:35:00.000Z',
    updatedAt: '2026-07-30T11:35:00.000Z',
    schemaVersion: 1,
    logRecordId: 'record-1',
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseEventLogs.mockReset();
  mockedUseCalendarEntries.mockReset();
  mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult());
  mockedLoadLegacyWeekDocument.mockReset();
  mockedLoadLegacyWeekDocument.mockResolvedValue(null);
});

describe('TrainingLogPage — loading fighter logs', () => {
  it('calls useEventLogs with the given fighterKey', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult());
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(mockedUseEventLogs).toHaveBeenCalledWith('fighter@example.com');
  });

  it('shows a loading state while logs are being fetched', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult({ loading: true }));
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(screen.getByText(/Indlæser/i)).toBeTruthy();
  });

  it('shows an error state with a retry action when loading fails', () => {
    const refresh = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ error: new Error('boom'), refresh }));
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    fireEvent.click(screen.getByRole('button', { name: /prøv igen/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shows an empty-state message when there are no logs', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [] }));
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(screen.getByText(/Ingen træning logget endnu/i)).toBeTruthy();
  });
});

describe('TrainingLogPage — chronological history', () => {
  it('renders each log as a history row, in the order returned by the hook', () => {
    const first = fakeLog({ title: 'MMA Sparring', startDateTime: '2026-07-30T10:00:00', endDateTime: '2026-07-30T11:00:00' });
    const second = fakeLog({ title: 'Grappling', startDateTime: '2026-07-28T09:00:00', endDateTime: '2026-07-28T10:00:00' });
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [first, second] }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['MMA Sparring', 'Grappling']);
  });

  it('renders discipline, duration, location, intensity and notes from the log', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [fakeLog()] }));
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(screen.getByText('MMA')).toBeTruthy();
    expect(screen.getByText(/60 min/)).toBeTruthy();
    expect(screen.getByText('Klub A')).toBeTruthy();
    expect(screen.getByText(/Intensitet: 4\/5/)).toBeTruthy();
    expect(screen.getByText('Felt strong')).toBeTruthy();
  });

  it('shows the neutral duration-unavailable fallback (not a fabricated duration) for a legacy UTC-Z duration-derived end', () => {
    const ambiguous = fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' });
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [ambiguous] }));
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
    expect(screen.getByText('MMA Sparring')).toBeTruthy();
    expect(screen.getByText('Klub A')).toBeTruthy();
  });

  it('uses the exact associated aggregate-occurrence duration for a new-model log, even when its own snapshot end is ambiguous', () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'new_model_calendar_entry' as const, aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({
      entries: [makeAggregate({ occurrence: { ...makeAggregate().occurrence, startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' } })],
    }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(screen.getByText(/90 min/)).toBeTruthy();
    expect(screen.queryByText(/Varighed ikke tilgængelig/)).toBeNull();
  });

  it('falls back to the compatibility reader when no matching aggregate is loaded for a new-model-origin log', () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'new_model_calendar_entry' as const, aggregateId: 'agg-OTHER', occurrenceId: 'occ-OTHER' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ entries: [makeAggregate()] }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
  });

  it('resolves the exact adapted legacy-session duration for a self_posted_calendar_session-origin log, even when its own snapshot end is ambiguous', async () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));
    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }],
    });

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    await waitFor(() => expect(screen.getByText(/90 min/)).toBeTruthy());
    expect(screen.queryByText(/Varighed ikke tilgængelig/)).toBeNull();
  });

  it('falls back to the compatibility reader when the legacy week has no session with a matching exact id (never guesses)', async () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-MISSING', occurrenceDateISO: '2026-07-30' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));
    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }],
    });

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    await waitFor(() => expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
  });

  it('does not match a session on a different day of the same week, even with the same id (occurrenceDateISO disambiguates, never fuzzy)', async () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' }, // Torsdag
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));
    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Fredag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }],
    });

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    await waitFor(() => expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
  });

  it('falls back without guessing when the legacy week read rejects', async () => {
    mockedLoadLegacyWeekDocument.mockRejectedValueOnce(new Error('network error'));
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    await waitFor(() => expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
  });

  it('performs no Firestore read for a malformed occurrenceDateISO', () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: 'not-a-date' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(mockedLoadLegacyWeekDocument).not.toHaveBeenCalled();
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
  });

  it('never calls the legacy week loader for a standalone log (no origin)', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [fakeLog()] }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(mockedLoadLegacyWeekDocument).not.toHaveBeenCalled();
  });

  it('never calls the legacy week loader for a new_model_calendar_entry-origin log', () => {
    const record = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'new_model_calendar_entry' as const, aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [record] }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ entries: [makeAggregate()] }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    expect(mockedLoadLegacyWeekDocument).not.toHaveBeenCalled();
  });
});

describe('TrainingLogPage — legacy week read efficiency', () => {
  it('reuses one week-document read for two different legacy sessions in the same fighter/week', async () => {
    const first = {
      ...fakeLog({ title: 'MMA Sparring', startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' }, // Torsdag
    };
    const second = {
      ...fakeLog({ title: 'Grappling', startDateTime: '2026-07-27T09:00:00', endDateTime: '2026-07-27T08:30:00.000Z' }),
      id: 'record-2',
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-2', occurrenceDateISO: '2026-07-27' }, // Mandag, same ISO week
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [first, second] }));
    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }],
      Mandag: [{ id: 'sess-2', name: 'Grappling', start: '09:00', end: '10:00' }],
    });

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    await waitFor(() => expect(screen.getByText(/90 min/)).toBeTruthy());
    expect(screen.getByText(/60 min/)).toBeTruthy();
    expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledTimes(1);
  });

  it('issues separate reads for legacy sessions in different weeks', async () => {
    const first = {
      ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' },
    };
    const second = {
      ...fakeLog({ startDateTime: '2026-08-13T09:00:00', endDateTime: '2026-08-13T08:30:00.000Z' }),
      id: 'record-2',
      origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-2', occurrenceDateISO: '2026-08-13' }, // two weeks later
    };
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [first, second] }));
    mockedLoadLegacyWeekDocument.mockResolvedValue(null);

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    await waitFor(() => expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledTimes(2));
    const weekNumbers = mockedLoadLegacyWeekDocument.mock.calls.map((call) => call[1]);
    expect(new Set(weekNumbers).size).toBe(2);
  });

  it('does not issue a duplicate week read while the first request for that week is still pending, even across a rerender', async () => {
    let resolvePending: (value: Record<string, unknown> | null) => void = () => {};
    mockedLoadLegacyWeekDocument.mockImplementationOnce(() => new Promise((resolve) => { resolvePending = resolve; }));

    const origin = { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' };
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{ ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }), origin }],
    }));
    const { rerender } = render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    // Force a second effect pass with a NEW logs array (same content) before the first request resolves.
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{ ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }), origin }],
    }));
    rerender(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    resolvePending({ Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }] });

    await waitFor(() => expect(screen.getByText(/90 min/)).toBeTruthy());
    expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledTimes(1);
  });
});

describe('TrainingLogPage — fighter-switch and unmount isolation', () => {
  it('ignores a pending fighter-A week request after switching to fighter B (no cross-fighter leak)', async () => {
    let resolveFighterA: (value: Record<string, unknown> | null) => void = () => {};
    mockedLoadLegacyWeekDocument.mockImplementationOnce(() => new Promise((resolve) => { resolveFighterA = resolve; }));

    const originA = { type: 'self_posted_calendar_session' as const, sessionId: 'sess-A', occurrenceDateISO: '2026-07-30' };
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{ ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }), origin: originA }],
    }));
    const { rerender } = render(<TrainingLogPage fighterKey="fighterA@example.com" canCreateLog />);

    // Switch to fighter B before fighter A's request resolves.
    const originB = { type: 'self_posted_calendar_session' as const, sessionId: 'sess-B', occurrenceDateISO: '2026-07-30' };
    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Torsdag: [{ id: 'sess-B', name: 'Fighter B session', start: '08:00', end: '09:00' }],
    });
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{ ...fakeLog({ title: 'Fighter B session', startDateTime: '2026-07-30T08:00:00', endDateTime: '2026-07-30T07:30:00.000Z' }), id: 'record-b', origin: originB }],
    }));
    rerender(<TrainingLogPage fighterKey="fighterB@example.com" canCreateLog />);

    await waitFor(() => expect(screen.getByText(/60 min/)).toBeTruthy());

    // Now resolve fighter A's stale pending request — it must never surface in fighter B's view.
    resolveFighterA({ Torsdag: [{ id: 'sess-A', name: 'MMA Sparring', start: '17:00', end: '18:30' }] });
    await Promise.resolve();

    expect(screen.queryByText(/90 min/)).toBeNull();
    expect(screen.getByText(/60 min/)).toBeTruthy();
  });

  it('an already-mounted fighter B instance resolves from its own data, not a stale fighter A cache', async () => {
    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Torsdag: [{ id: 'sess-A', name: 'Fighter A session', start: '17:00', end: '18:30' }],
    });
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{
        ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }),
        origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-A', occurrenceDateISO: '2026-07-30' },
      }],
    }));
    const { unmount } = render(<TrainingLogPage fighterKey="fighterA@example.com" canCreateLog />);
    await waitFor(() => expect(screen.getByText(/90 min/)).toBeTruthy());
    unmount();

    mockedLoadLegacyWeekDocument.mockResolvedValueOnce({
      Torsdag: [{ id: 'sess-B', name: 'Fighter B session', start: '08:00', end: '09:00' }],
    });
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{
        ...fakeLog({ startDateTime: '2026-07-30T08:00:00', endDateTime: '2026-07-30T07:30:00.000Z' }),
        id: 'record-b',
        origin: { type: 'self_posted_calendar_session' as const, sessionId: 'sess-B', occurrenceDateISO: '2026-07-30' },
      }],
    }));
    render(<TrainingLogPage fighterKey="fighterB@example.com" canCreateLog />);

    await waitFor(() => expect(screen.getByText(/60 min/)).toBeTruthy());
    expect(mockedLoadLegacyWeekDocument).toHaveBeenCalledWith('fighterB@example.com', expect.any(Number));
  });

  it('a pending week request completing after unmount causes no state update', async () => {
    let resolvePending: (value: Record<string, unknown> | null) => void = () => {};
    let pending: Promise<Record<string, unknown> | null>;
    mockedLoadLegacyWeekDocument.mockImplementationOnce(() => {
      pending = new Promise((resolve) => { resolvePending = resolve; });
      return pending;
    });
    const origin = { type: 'self_posted_calendar_session' as const, sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' };
    mockedUseEventLogs.mockReturnValue(mockHookResult({
      logs: [{ ...fakeLog({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' }), origin }],
    }));

    const { unmount } = render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);
    unmount();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolvePending({ Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }] });
    await pending!;
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('TrainingLogPage — owner can log completed training', () => {
  it('shows the "Log træning" action for the owner and opens LogTrainingSheet', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult());
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('resets the unplanned-training attempt when the sheet is opened (fresh attempt)', () => {
    const resetUnplannedAttempt = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ resetUnplannedAttempt }));
    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);

    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));
    expect(resetUnplannedAttempt).toHaveBeenCalledTimes(1);
  });

  it('calls addUnplannedTraining on submit and reports success', async () => {
    const addUnplannedTraining = vi.fn().mockResolvedValue({ aggregateId: 'agg1', occurrenceId: 'occ1', calendarEntryId: 'entry1', logRecordId: 'log-1' });
    const onSuccess = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));

    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
    fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));

    await waitFor(() => expect(addUnplannedTraining).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.any(String)));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('calls onUnplannedTrainingCreated once after a successful atomic creation, so a parent calendar can refresh', async () => {
    const addUnplannedTraining = vi.fn().mockResolvedValue({ aggregateId: 'agg1', occurrenceId: 'occ1', calendarEntryId: 'entry1', logRecordId: 'log-1' });
    const onUnplannedTrainingCreated = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog onUnplannedTrainingCreated={onUnplannedTrainingCreated} />);
    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));

    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
    fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));

    await waitFor(() => expect(onUnplannedTrainingCreated).toHaveBeenCalledTimes(1));
  });

  it('does not call onUnplannedTrainingCreated when addUnplannedTraining rejects', async () => {
    const addUnplannedTraining = vi.fn().mockRejectedValue(new Error('Kunne ikke gemme'));
    const onUnplannedTrainingCreated = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog onUnplannedTrainingCreated={onUnplannedTrainingCreated} onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));

    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
    fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));

    await waitFor(() => expect(addUnplannedTraining).toHaveBeenCalledTimes(1));
    expect(onUnplannedTrainingCreated).not.toHaveBeenCalled();
  });

  it('resets the attempt when the sheet is closed after a successful save (own onClose call)', async () => {
    const resetUnplannedAttempt = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ resetUnplannedAttempt }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);
    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));
    resetUnplannedAttempt.mockClear(); // clear the open-time reset call

    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
    fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(resetUnplannedAttempt).toHaveBeenCalledTimes(1);
  });

  it('reports failure and keeps the sheet open (retains the attempt) when addUnplannedTraining rejects', async () => {
    const addUnplannedTraining = vi.fn().mockRejectedValue(new Error('Kunne ikke gemme'));
    const resetUnplannedAttempt = vi.fn();
    const onError = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining, resetUnplannedAttempt }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));
    resetUnplannedAttempt.mockClear();

    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
    fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Kunne ikke gemme'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Failure must NOT reset the attempt — a retry needs the same ids.
    expect(resetUnplannedAttempt).not.toHaveBeenCalled();
  });
});

describe('TrainingLogPage — post-save calendar-entry refresh', () => {
  function fillAndSubmit() {
    fireEvent.click(screen.getByRole('button', { name: /log træning/i }));
    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
    fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));
  }

  it("refreshes this page's own calendar entries after a successful save, so the new log shows its exact duration without navigating to the calendar", async () => {
    const newAggregate = makeAggregate({
      id: 'agg1',
      occurrence: { ...makeAggregate().occurrence, id: 'occ1', startDateTime: '2020-01-01T10:00:00', endDateTime: '2020-01-01T11:00:00' },
    });
    const record = {
      ...fakeLog({ title: 'MMA Sparring', startDateTime: '2020-01-01T10:00:00', endDateTime: '2020-01-01T09:30:00.000Z' }),
      id: 'record-new',
      origin: { type: 'new_model_calendar_entry' as const, aggregateId: 'agg1', occurrenceId: 'occ1' },
    };
    const addUnplannedTraining = vi.fn().mockResolvedValue({ aggregateId: 'agg1', occurrenceId: 'occ1', calendarEntryId: 'entry1', logRecordId: 'record-new' });
    const refreshCalendarEntries = vi.fn().mockImplementation(async () => {
      mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ entries: [newAggregate], refresh: refreshCalendarEntries }));
    });
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining, logs: [record] }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ entries: [], refresh: refreshCalendarEntries }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);
    // Before save: no matching aggregate loaded yet, so the fallback shows.
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();

    fillAndSubmit();

    await waitFor(() => expect(refreshCalendarEntries).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText(/60 min/)).toBeTruthy();
    expect(screen.queryByText(/Varighed ikke tilgængelig/)).toBeNull();
  });

  it('calls refreshCalendarEntries exactly once for one successful save (no uncontrolled repeated reads)', async () => {
    const addUnplannedTraining = vi.fn().mockResolvedValue({ aggregateId: 'agg1', occurrenceId: 'occ1', calendarEntryId: 'entry1', logRecordId: 'log-1' });
    const refreshCalendarEntries = vi.fn().mockResolvedValue(undefined);
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ refresh: refreshCalendarEntries }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog />);
    fillAndSubmit();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(refreshCalendarEntries).toHaveBeenCalledTimes(1);
  });

  it('does not call refreshCalendarEntries when addUnplannedTraining rejects (a failed save must not refresh or invent state)', async () => {
    const addUnplannedTraining = vi.fn().mockRejectedValue(new Error('Kunne ikke gemme'));
    const refreshCalendarEntries = vi.fn().mockResolvedValue(undefined);
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ refresh: refreshCalendarEntries }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog onError={vi.fn()} />);
    fillAndSubmit();

    await waitFor(() => expect(addUnplannedTraining).toHaveBeenCalledTimes(1));
    expect(refreshCalendarEntries).not.toHaveBeenCalled();
  });

  it('awaits the calendar-entries refresh before reporting success (onSuccess only fires once the refresh has resolved)', async () => {
    const addUnplannedTraining = vi.fn().mockResolvedValue({ aggregateId: 'agg1', occurrenceId: 'occ1', calendarEntryId: 'entry1', logRecordId: 'log-1' });
    let resolveRefresh: () => void = () => {};
    const refreshCalendarEntries = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    const onSuccess = vi.fn();
    mockedUseEventLogs.mockReturnValue(mockHookResult({ addUnplannedTraining }));
    mockedUseCalendarEntries.mockReturnValue(mockCalendarEntriesResult({ refresh: refreshCalendarEntries }));

    render(<TrainingLogPage fighterKey="fighter@example.com" canCreateLog onSuccess={onSuccess} />);
    fillAndSubmit();

    await waitFor(() => expect(refreshCalendarEntries).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();

    resolveRefresh();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});

describe('TrainingLogPage — administrator viewing another fighter read-only', () => {
  it('hides the "Log træning" action and never renders LogTrainingSheet when canCreateLog is false', () => {
    mockedUseEventLogs.mockReturnValue(mockHookResult({ logs: [fakeLog()] }));
    render(<TrainingLogPage fighterKey="other-fighter@example.com" canCreateLog={false} />);

    expect(screen.queryByRole('button', { name: /log træning/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    // History remains visible read-only.
    expect(screen.getByText('MMA Sparring')).toBeTruthy();
  });
});
