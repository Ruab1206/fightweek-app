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

// Dynamic, never hardcoded — this suite runs indefinitely into the future and
// must not silently start exercising the wrong (historical) eligibility branch.
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}
const TOMORROW = daysFromNow(1);
const YESTERDAY = daysFromNow(-1);

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

// A durable seriesId is what distinguishes an eligible this-and-following
// occurrence from the legacy (tuple-matched, no seriesId) case above.
const durableRecurringInitialData = {
  ...recurringInitialData,
  seriesId: 'series-abc',
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
      date={TOMORROW}
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

  it('"Denne og alle fremtidige træninger" is disabled with a concise explanation for a legacy recurring occurrence (no durable seriesId)', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    const futureBtn = screen.getByText('Denne og alle fremtidige træninger').closest('button')!;
    expect((futureBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(futureBtn);
    expect(onRecurringEditScope).not.toHaveBeenCalled();
    expect(screen.getByText('Kun tilgængelig for nyere gentagende træninger.')).toBeTruthy();
  });

  it('enables "Denne og alle fremtidige træninger" and emits this_and_following for a durable-series occurrence in the future', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ initialData: durableRecurringInitialData, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    const futureBtn = screen.getByText('Denne og alle fremtidige træninger').closest('button')!;
    expect((futureBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(futureBtn);

    expect(onRecurringEditScope).toHaveBeenCalledTimes(1);
    const [scope, original, submitted] = onRecurringEditScope.mock.calls[0];
    expect(scope).toBe('this_and_following');
    expect(original).toMatchObject({ name: 'MMA Sparring', seriesId: 'series-abc' });
    expect(submitted).toMatchObject({ name: 'MMA Sparring (ny)' });
  });

  it('after dispatching this_and_following, the submitted edit remains rendered — SessionModal never resets itself while the parent\'s async result is pending (modal-close/reset is the parent\'s decision alone)', () => {
    // onRecurringEditScope is fire-and-forget from SessionModal's perspective —
    // it is never awaited here, mirroring the real App.tsx call site.
    const onRecurringEditScope = vi.fn();
    renderModal({ initialData: durableRecurringInitialData, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));
    fireEvent.click(screen.getByText('Denne og alle fremtidige træninger').closest('button')!);

    expect(screen.getByDisplayValue('MMA Sparring (ny)')).toBeTruthy();
  });

  it('enables "Denne og alle fremtidige træninger" for a durable-series occurrence dated exactly today', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ date: daysFromNow(0), initialData: durableRecurringInitialData, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    const futureBtn = screen.getByText('Denne og alle fremtidige træninger').closest('button')!;
    expect((futureBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not render "Denne og alle fremtidige træninger" at all for a historical occurrence, even with a durable seriesId', () => {
    const onRecurringEditScope = vi.fn();
    renderModal({ date: YESTERDAY, initialData: durableRecurringInitialData, onRecurringEditScope });

    fireEvent.change(screen.getByPlaceholderText('F.eks. MMA Sparring'), { target: { value: 'MMA Sparring (ny)' } });
    fireEvent.click(screen.getByText('Gem'));

    expect(screen.getByText('Kun denne træning')).toBeTruthy();
    expect(screen.queryByText('Denne og alle fremtidige træninger')).toBeNull();
    expect(screen.getByText('Annuller')).toBeTruthy();
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
