// @vitest-environment jsdom
/**
 * LogTrainingSheet.test.tsx — isolated bottom-sheet form for logging
 * completed training after the fact.
 *
 * The component owns no Firestore/fighter-key/hook knowledge — it only
 * calls the injected `onSubmit`. Domain validation (including the future
 * date/time rule) is exercised through the real, unmocked
 * `validateCompletedSelfPostedTrainingInput` — a fake system clock (vitest
 * fake timers) makes those cases deterministic instead of relying on the
 * real current date/time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogTrainingSheet } from './LogTrainingSheet';
import { CATEGORIES } from '../config/constants';

// Fixed local "now" used by every test that cares about date/time: 2026-07-30
// 18:00 local time. Chosen to match the domain's own test fixtures.
const FIXED_NOW = new Date(2026, 6, 30, 18, 0, 0);

beforeEach(() => {
  // Only fake Date — leave setTimeout/microtasks real so RTL's waitFor
  // (which polls via real timers) keeps working normally.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function fillValidRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
  fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
  fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText(/Disciplin/i), { target: { value: 'MMA' } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /gem træning/i }));
}

describe('LogTrainingSheet — closed state', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <LogTrainingSheet open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('LogTrainingSheet — required fields', () => {
  it('blocks an empty submit, does not call onSubmit, and shows validation feedback', () => {
    const onSubmit = vi.fn();
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Titel er påkrævet')).toBeTruthy();
  });
});

describe('LogTrainingSheet — valid structured training', () => {
  it('accepts a valid submit without notes and calls onSubmit once', async () => {
    const onSubmit = vi.fn().mockResolvedValue('log-1');
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0];
    expect(input.notes).toBeUndefined();
    expect(input.title).toBe('MMA Sparring');
    expect(input.discipline).toBe('MMA');
  });

  it('includes optional notes when supplied', async () => {
    const onSubmit = vi.fn().mockResolvedValue('log-1');
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    fireEvent.change(screen.getByLabelText(/Noter/i), { target: { value: 'Felt strong today' } });
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].notes).toBe('Felt strong today');
  });
});

describe('LogTrainingSheet — start plus duration', () => {
  it('submits exact start and numeric duration, never inventing an end time', async () => {
    const onSubmit = vi.fn().mockResolvedValue('log-1');
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0];
    expect(input.start).toBe('10:00');
    expect(input.durationMinutes).toBe(60);
    expect(input.end).toBeUndefined();
  });
});

describe('LogTrainingSheet — future date/time rejection', () => {
  it('blocks a future date and does not call onSubmit', () => {
    const onSubmit = vi.fn();
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    fireEvent.change(screen.getByLabelText(/Dato/i), { target: { value: '2026-07-31' } });
    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Træningen kan ikke logges i fremtiden')).toBeTruthy();
  });

  it('blocks a start time later today and does not call onSubmit', () => {
    const onSubmit = vi.fn();
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    // FIXED_NOW is 18:00 local today — 19:00 is later today.
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '19:00' } });
    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Træningen kan ikke logges i fremtiden')).toBeTruthy();
  });
});

describe('LogTrainingSheet — successful save', () => {
  it('shows a saving state, prevents duplicate submission, closes and resets before next opening', async () => {
    let resolveSubmit: (value: string) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<string>((resolve) => { resolveSubmit = resolve; }));
    const onClose = vi.fn();

    const { rerender } = render(<LogTrainingSheet open onClose={onClose} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    submit();

    expect(screen.getByRole('button', { name: /gemmer/i })).toBeTruthy();
    expect((screen.getByRole('button', { name: /gemmer/i }) as HTMLButtonElement).disabled).toBe(true);

    // Duplicate click while pending must not call onSubmit again.
    fireEvent.click(screen.getByRole('button', { name: /gemmer/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit('log-1');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    // Simulate the parent closing then reopening the sheet for a new entry.
    rerender(<LogTrainingSheet open={false} onClose={onClose} onSubmit={onSubmit} />);
    rerender(<LogTrainingSheet open onClose={onClose} onSubmit={onSubmit} />);

    expect((screen.getByLabelText(/Titel/i) as HTMLInputElement).value).toBe('');
  });
});

describe('LogTrainingSheet — save failure', () => {
  it('keeps the sheet open, preserves entered values, shows an error, and allows a retry', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('Kunne ikke gemme'));
    const onClose = vi.fn();
    render(<LogTrainingSheet open onClose={onClose} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    submit();

    await waitFor(() => expect(screen.getByText('Kunne ikke gemme')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Titel/i) as HTMLInputElement).value).toBe('MMA Sparring');

    // Retry succeeds.
    onSubmit.mockResolvedValueOnce('log-1');
    submit();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('LogTrainingSheet — close behavior', () => {
  it('calls onClose from the close button, and via Escape only when idle', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(() => new Promise<string>(() => {})); // never resolves
    render(<LogTrainingSheet open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fillValidRequiredFields();
    submit(); // now saving, pending forever

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1); // unchanged — not called again while saving
  });

  it('calls onClose from the close button when idle', () => {
    const onClose = vi.fn();
    render(<LogTrainingSheet open onClose={onClose} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Luk' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('LogTrainingSheet — discipline options', () => {
  it('reuses the existing CATEGORIES list and introduces no separate taxonomy', () => {
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);

    const select = screen.getByLabelText(/Disciplin/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);

    expect(values).toEqual(['', ...CATEGORIES.map((c) => c.label)]);
  });
});

describe('LogTrainingSheet — discipline is required (domain-enforced only)', () => {
  it('blocks submission when discipline is left unselected, via domain validation', () => {
    const onSubmit = vi.fn();
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    // Fill everything except discipline.
    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    // Exactly the domain validator's message — no separate/duplicated
    // component-level discipline rule or wording exists.
    expect(screen.getByText('Vælg en disciplin/kategori')).toBeTruthy();
  });

  it('displays the discipline error under the discipline selector', () => {
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Titel/i), { target: { value: 'MMA Sparring' } });
    fireEvent.change(screen.getByLabelText(/Starttidspunkt/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Varighed/i), { target: { value: '60' } });
    submit();

    const select = screen.getByLabelText(/Disciplin/i);
    const message = screen.getByText('Vælg en disciplin/kategori');
    expect(select.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('submits the selected discipline unchanged when provided', async () => {
    const onSubmit = vi.fn().mockResolvedValue('log-1');
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={onSubmit} />);

    fillValidRequiredFields();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].discipline).toBe('MMA');
  });
});

describe('LogTrainingSheet — accessibility', () => {
  it('exposes all fields by label and controls by accessible name', () => {
    render(<LogTrainingSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/Titel/i)).toBeTruthy();
    expect(screen.getByLabelText(/Dato/i)).toBeTruthy();
    expect(screen.getByLabelText(/Starttidspunkt/i)).toBeTruthy();
    expect(screen.getByLabelText(/Varighed/i)).toBeTruthy();
    expect(screen.getByLabelText(/Disciplin/i)).toBeTruthy();
    expect(screen.getByLabelText(/Lokation/i)).toBeTruthy();
    expect(screen.getByLabelText(/Intensitet/i)).toBeTruthy();
    expect(screen.getByLabelText(/Noter/i)).toBeTruthy();

    expect(screen.getByRole('button', { name: /gem træning/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Luk' })).toBeTruthy();
  });
});
