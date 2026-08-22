// @vitest-environment jsdom
/**
 * SessionModal.test.tsx — read-side TrainingLog association section
 * (Phase 3 strangler slice). Eligibility gating (catalogue/frav\u00e6r/event/
 * invitation/cancelled/rest-day/unsaved) is decided entirely by the parent
 * via the already-tested `isEligibleSelfPostedCalendarSession` predicate
 * (see `src/domain/calendar/adapters.test.ts`) \u2014 SessionModal itself only
 * reacts to whether `associatedTrainingLogsStatus` is provided at all, which
 * is what these tests exercise.
 *
 * Existing SessionModal behavior (recurrence, invites, delete, notes) is
 * intentionally not re-tested here \u2014 only the new association-section
 * props/rendering are covered.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionModal from './SessionModal';
import type { TrainingHistoryItem } from '../domain/calendar/types';

const baseInitialData = {
  id: 'sess_1',
  name: 'MMA Sparring',
  category: 'MMA',
  start: '17:00',
  end: '18:30',
  location: 'Klub A',
  status: 'active',
  cancellationReason: '',
  cancellationTime: null,
};

function renderModal(overrides: Record<string, unknown> = {}) {
  return render(
    <SessionModal
      day="Mandag"
      weekNum={33}
      date={new Date('2026-08-17T00:00:00')}
      initialData={baseInitialData as any}
      existingSessions={[]}
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onDeleteThisAndFuture={vi.fn()}
      onRecurrenceSave={vi.fn()}
      onFeedback={vi.fn()}
      getNote={() => ''}
      saveNote={vi.fn()}
      {...overrides}
    />,
  );
}

const oneItem: TrainingHistoryItem = {
  id: 'record-1',
  title: 'MMA Sparring',
  type: 'self_posted_training',
  discipline: 'MMA',
  startDateTime: '2026-08-17T17:00:00',
  endDateTime: '2026-08-17T18:30:00',
  durationMinutes: 90,
  location: 'Klub A',
  notes: '',
  intensity: undefined,
};

const otherItem: TrainingHistoryItem = {
  ...oneItem,
  id: 'record-2',
  title: 'MMA Sparring (second log)',
};

describe('SessionModal — read-side TrainingLog association section', () => {
  it('renders nothing for the section when the parent supplies no status (session type not eligible)', () => {
    renderModal({ associatedTrainingLogsStatus: undefined, associatedTrainingLogs: undefined });

    expect(screen.queryByText('Træningslogs')).toBeNull();
  });

  it('shows nothing (no empty list, no "Ikke logget") for zero matching logs, but keeps "Log denne træning"', () => {
    renderModal({
      canLogTraining: true,
      onLogTraining: vi.fn(),
      associatedTrainingLogsStatus: 'loaded',
      associatedTrainingLogs: [],
    });

    expect(screen.queryByText('Træningslogs')).toBeNull();
    expect(screen.queryByText(/ikke logget/i)).toBeNull();
    expect(screen.getByText('Log denne træning')).toBeTruthy();
  });

  it('shows a compact loading indicator while the association is loading, not an empty state', () => {
    renderModal({
      associatedTrainingLogsStatus: 'loading',
      associatedTrainingLogs: [],
    });

    expect(screen.getByText(/Indlæser træningslogs/i)).toBeTruthy();
    expect(screen.queryByText(/ikke logget/i)).toBeNull();
  });

  it('shows a compact error indicator on a failed association load, distinct from empty', () => {
    renderModal({
      associatedTrainingLogsStatus: 'error',
      associatedTrainingLogs: [],
    });

    expect(screen.getByText(/Kunne ikke hente træningslogs/i)).toBeTruthy();
  });

  it('shows exactly one matching log and keeps "Log denne træning" available', () => {
    renderModal({
      canLogTraining: true,
      onLogTraining: vi.fn(),
      associatedTrainingLogsStatus: 'loaded',
      associatedTrainingLogs: [oneItem],
    });

    expect(screen.getByText('Træningslogs')).toBeTruthy();
    expect(screen.getByText('Log denne træning')).toBeTruthy();
  });

  it('shows every matching log when there are multiple, without ranking or a duplicate warning', () => {
    renderModal({
      canLogTraining: true,
      onLogTraining: vi.fn(),
      associatedTrainingLogsStatus: 'loaded',
      associatedTrainingLogs: [oneItem, otherItem],
    });

    expect(screen.getByText('MMA Sparring')).toBeTruthy();
    expect(screen.getByText('MMA Sparring (second log)')).toBeTruthy();
    expect(screen.queryByText(/duplikat/i)).toBeNull();
    expect(screen.queryByText(/fejl/i)).toBeNull();
  });

  it('opens the read-only detail view when a displayed log is selected', () => {
    const onOpenTrainingLogDetail = vi.fn();
    renderModal({
      associatedTrainingLogsStatus: 'loaded',
      associatedTrainingLogs: [oneItem],
      onOpenTrainingLogDetail,
    });

    fireEvent.click(screen.getByText('MMA Sparring').closest('button')!);

    expect(onOpenTrainingLogDetail).toHaveBeenCalledWith(oneItem);
  });

  it('shows the association section for a read-only viewer without exposing create behavior', () => {
    renderModal({
      canLogTraining: false,
      onLogTraining: undefined,
      associatedTrainingLogsStatus: 'loaded',
      associatedTrainingLogs: [oneItem],
    });

    expect(screen.getByText('Træningslogs')).toBeTruthy();
    expect(screen.queryByText('Log denne træning')).toBeNull();
  });

  it('renders the log from its own snapshot, not the currently edited session fields', () => {
    const snapshotItem: TrainingHistoryItem = {
      ...oneItem,
      title: 'Original snapshot title',
    };
    renderModal({
      initialData: { ...baseInitialData, name: 'Edited title in form' },
      associatedTrainingLogsStatus: 'loaded',
      associatedTrainingLogs: [snapshotItem],
    });

    expect(screen.getByText('Original snapshot title')).toBeTruthy();
  });
});
