// @vitest-environment jsdom
/**
 * SessionModalEditScope.test.tsx — explicit edit-scope prompt for editing an
 * EXISTING self-posted recurring training (edit-scope slice).
 *
 * Covers ONLY the new scope-prompt trigger/interaction. Existing SessionModal
 * behavior (recurrence-creation, delete, notes, TrainingLog association
 * section) is covered by SessionModal.test.tsx and shouldApplyRecurrence.test.ts
 * and is intentionally not re-tested here.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionModal from './SessionModal';

const recurringInitialData = {
  id: 'sess_1',
  name: 'MMA Sparring',
  category: 'MMA',
  start: '17:00',
  end: '18:30',
  location: 'Klub A',
  status: 'active',
  cancellationReason: '',
  cancellationTime: null,
  isRecurring: true,
};

const nonRecurringInitialData = {
  ...recurringInitialData,
  id: 'sess_2',
  isRecurring: false,
};

function renderModal(overrides: Record<string, unknown> = {}) {
  return render(
    <SessionModal
      day="Mandag"
      weekNum={33}
      date={new Date('2026-08-17T00:00:00')}
      initialData={recurringInitialData as any}
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

describe('SessionModal — explicit edit-scope prompt', () => {
  it('no actual change: Save calls onClose directly — no scope prompt, no persistence', () => {
    const onSave = vi.fn();
    const onRecurringEditScope = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSave, onRecurringEditScope, onClose });

    fireEvent.click(screen.getByText('Gem'));

    expect(screen.queryByText('Kun denne træning')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onRecurringEditScope).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('non-recurring existing session: current direct save behaviour remains (no prompt)', () => {
    const onSave = vi.fn();
    const onRecurringEditScope = vi.fn();
    renderModal({ initialData: nonRecurringInitialData, onSave, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'Ny aktivitet' } });
    fireEvent.click(screen.getByText('Gem'));

    expect(onRecurringEditScope).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ny aktivitet' }));
  });

  it('new session (no initialData): current recurrence-creation flow remains, no edit-scope prompt', () => {
    const onRecurrenceSave = vi.fn();
    const onRecurringEditScope = vi.fn();
    renderModal({ initialData: null, onRecurrenceSave, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'Ny træning' } });
    fireEvent.change(screen.getByDisplayValue('Gentag ikke'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Gem'));

    expect(onRecurringEditScope).not.toHaveBeenCalled();
    expect(onRecurrenceSave).toHaveBeenCalled();
  });

  it('existing recurring edit with an actual change: shows the scope prompt and does not persist before a choice', () => {
    const onSave = vi.fn();
    const onRecurringEditScope = vi.fn();
    renderModal({ onSave, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    expect(screen.getByText('Kun denne træning')).toBeTruthy();
    expect(screen.getByText('Denne og alle fremtidige træninger')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    expect(onRecurringEditScope).not.toHaveBeenCalled();
  });

  it('cancel: hides the prompt without persisting; edited form remains (current modal convention)', () => {
    const onSave = vi.fn();
    const onRecurringEditScope = vi.fn();
    renderModal({ onSave, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));
    fireEvent.click(screen.getByText('Annuller'));

    expect(screen.queryByText('Kun denne træning')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onRecurringEditScope).not.toHaveBeenCalled();
    // the edit is still in the input — recoverable, not reverted
    expect(screen.getByDisplayValue('MMA Sparring (ny)')).toBeTruthy();
  });

  it('"Kun denne træning" emits this_occurrence with the original and submitted values', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));
    fireEvent.click(screen.getByText('Kun denne træning'));

    expect(onRecurringEditScope).toHaveBeenCalledTimes(1);
    const [scope, original, submitted] = onRecurringEditScope.mock.calls[0];
    expect(scope).toBe('this_occurrence');
    expect(original).toMatchObject({ name: 'MMA Sparring' });
    expect(submitted).toMatchObject({ name: 'MMA Sparring (ny)' });
  });

  it('"Denne og alle fremtidige træninger" is DISABLED in Slice 1 and never emits', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    const futureBtn = screen.getByText('Denne og alle fremtidige træninger').closest('button')!;
    expect((futureBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(futureBtn);
    expect(onRecurringEditScope).not.toHaveBeenCalled();
    expect(screen.getByText('Ikke tilgængelig endnu.')).toBeTruthy();
  });

  it('never offers an "all trainings" option', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    expect(screen.queryByText(/^Alle træninger/)).toBeNull();
    expect(screen.queryByText(/tidligere og fremtidige/i)).toBeNull();
  });
});
