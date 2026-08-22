// @vitest-environment jsdom
/**
 * SessionModal.test.tsx — read-side TrainingLog association section
 * (Phase 3 strangler slice, Slice A: read-side integrity classification).
 *
 * SessionModal consumes an already-classified `trainingLogAssociation`
 * (`TrainingLogAssociationView` — loading/error/none/one/conflict) from the
 * parent; it renders purely by `kind` and never reconstructs none/one/
 * conflict from a raw log count itself. Eligibility gating (catalogue/
 * fravær/event/invitation/cancelled/rest-day/unsaved) is decided entirely by
 * the parent via the already-tested `isEligibleSelfPostedCalendarSession`
 * predicate (see `src/domain/calendar/adapters.test.ts`) — SessionModal
 * itself only reacts to whether `trainingLogAssociation` is provided at all,
 * which is what the first test below exercises.
 *
 * Existing SessionModal behavior (recurrence, invites, delete, notes) is
 * intentionally not re-tested here — only the association-section
 * props/rendering are covered.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionModal, { type TrainingLogAssociationView } from './SessionModal';
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

const none: TrainingLogAssociationView = { kind: 'none' };
const loading: TrainingLogAssociationView = { kind: 'loading' };
const error: TrainingLogAssociationView = { kind: 'error' };
const one: TrainingLogAssociationView = { kind: 'one', log: oneItem };
const conflict: TrainingLogAssociationView = { kind: 'conflict', logs: [oneItem, otherItem] };

describe('SessionModal — read-side TrainingLog association section (Slice A)', () => {
  it('renders nothing for the section when the parent supplies no association (session type not eligible)', () => {
    renderModal({ trainingLogAssociation: undefined, canLogTraining: false, onLogTraining: undefined });

    expect(screen.queryByText('Træningslogs')).toBeNull();
    expect(screen.queryByText('Log denne træning')).toBeNull();
  });

  it('none: shows "Log denne træning" for an eligible owner, with no empty "Træningslogs" section', () => {
    renderModal({
      canLogTraining: true,
      onLogTraining: vi.fn(),
      trainingLogAssociation: none,
    });

    expect(screen.queryByText('Træningslogs')).toBeNull();
    expect(screen.queryByText(/ikke logget/i)).toBeNull();
    expect(screen.getByText('Log denne træning')).toBeTruthy();
  });

  it('loading: shows a neutral loading line; the parent never supplies creation eligibility for this kind', () => {
    renderModal({
      canLogTraining: false,
      onLogTraining: undefined,
      trainingLogAssociation: loading,
    });

    expect(screen.getByText(/Indlæser træningslogs/i)).toBeTruthy();
    expect(screen.queryByText('Log denne træning')).toBeNull();
  });

  it('error: shows a neutral error line; the parent never supplies creation eligibility for this kind', () => {
    renderModal({
      canLogTraining: false,
      onLogTraining: undefined,
      trainingLogAssociation: error,
    });

    expect(screen.getByText(/Kunne ikke hente træningslogs/i)).toBeTruthy();
    expect(screen.queryByText('Log denne træning')).toBeNull();
  });

  it('one: shows the existing log under singular "Træningslog" (not the plural heading) and hides "Log denne træning"', () => {
    renderModal({
      canLogTraining: false,
      onLogTraining: undefined,
      trainingLogAssociation: one,
    });

    expect(screen.getByText('Træningslog', { exact: true })).toBeTruthy();
    expect(screen.queryByText('Træningslogs')).toBeNull();
    expect(screen.getByText('MMA Sparring')).toBeTruthy();
    expect(screen.queryByText('Log denne træning')).toBeNull();
  });

  it('one: exposes a clear accessible "Se træningslog" open action', () => {
    renderModal({
      trainingLogAssociation: one,
      onOpenTrainingLogDetail: vi.fn(),
    });

    expect(screen.getByRole('button', { name: /se træningslog/i })).toBeTruthy();
  });

  it('one: opens the existing log read-only when selected', () => {
    const onOpenTrainingLogDetail = vi.fn();
    renderModal({
      trainingLogAssociation: one,
      onOpenTrainingLogDetail,
    });

    fireEvent.click(screen.getByText('MMA Sparring').closest('button')!);

    expect(onOpenTrainingLogDetail).toHaveBeenCalledWith(oneItem);
  });

  it('conflict: shows the plural heading "Træningslogs"', () => {
    renderModal({
      trainingLogAssociation: conflict,
    });

    expect(screen.getByText('Træningslogs', { exact: true })).toBeTruthy();
  });

  it('conflict: hides "Log denne træning" and shows the neutral Danish integrity-conflict message', () => {
    renderModal({
      canLogTraining: false,
      onLogTraining: undefined,
      trainingLogAssociation: conflict,
    });

    expect(screen.queryByText('Log denne træning')).toBeNull();
    expect(
      screen.getByText('Der findes flere træningslogs for denne træning. Oprettelse af en ny log er deaktiveret, indtil konflikten er afklaret.'),
    ).toBeTruthy();
  });

  it('conflict: displays every conflicting log read-only, without selecting one as canonical', () => {
    const onOpenTrainingLogDetail = vi.fn();
    renderModal({
      trainingLogAssociation: conflict,
      onOpenTrainingLogDetail,
    });

    expect(screen.getByText('MMA Sparring')).toBeTruthy();
    expect(screen.getByText('MMA Sparring (second log)')).toBeTruthy();

    fireEvent.click(screen.getByText('MMA Sparring (second log)').closest('button')!);
    expect(onOpenTrainingLogDetail).toHaveBeenCalledWith(otherItem);
  });

  it('conflict: never labels the multiple result a duplicate or an error', () => {
    renderModal({ trainingLogAssociation: conflict });

    expect(screen.queryByText(/duplikat/i)).toBeNull();
    expect(screen.queryByText(/fejl/i)).toBeNull();
  });

  it('read-only viewing hides creation in every state, even when logs are shown', () => {
    for (const view of [none, loading, error, one, conflict]) {
      const { unmount } = renderModal({
        canLogTraining: false,
        onLogTraining: undefined,
        trainingLogAssociation: view,
      });
      expect(screen.queryByText('Log denne træning')).toBeNull();
      unmount();
    }
  });

  it('renders the log from its own snapshot, not the currently edited session fields', () => {
    const snapshotItem: TrainingHistoryItem = {
      ...oneItem,
      title: 'Original snapshot title',
    };
    renderModal({
      initialData: { ...baseInitialData, name: 'Edited title in form' },
      trainingLogAssociation: { kind: 'one', log: snapshotItem },
    });

    expect(screen.getByText('Original snapshot title')).toBeTruthy();
  });
});
