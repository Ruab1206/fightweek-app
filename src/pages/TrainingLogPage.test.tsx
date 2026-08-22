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
import type { CompletedSelfPostedTrainingLog } from '../domain/calendar/types';

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

beforeEach(() => {
  mockedUseEventLogs.mockReset();
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
