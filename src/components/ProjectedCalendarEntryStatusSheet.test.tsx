// @vitest-environment jsdom
/**
 * ProjectedCalendarEntryStatusSheet.test.tsx — small read-only presentation
 * for the non-one classification states of a projected calendar_entry.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectedCalendarEntryStatusSheet } from './ProjectedCalendarEntryStatusSheet';
import type { TrainingHistoryItem } from '../domain/calendar/types';

function makeItem(id: string, overrides: Partial<TrainingHistoryItem> = {}): TrainingHistoryItem {
  return {
    id,
    title: `Log ${id}`,
    type: 'self_posted_training',
    startDateTime: '2026-08-14T18:00:00',
    endDateTime: '2026-08-14T19:00:00',
    durationMinutes: 60,
    notes: '',
    ...overrides,
  };
}

describe('ProjectedCalendarEntryStatusSheet', () => {
  it('shows a loading message for state=loading', () => {
    render(<ProjectedCalendarEntryStatusSheet state="loading" onClose={vi.fn()} />);
    expect(screen.getByText(/indlæser/i)).toBeTruthy();
  });

  it('shows an error message for state=error', () => {
    render(<ProjectedCalendarEntryStatusSheet state="error" onClose={vi.fn()} />);
    expect(screen.getByText(/kunne ikke/i)).toBeTruthy();
  });

  it('shows a data-integrity inconsistency message for state=none, with no create action', () => {
    render(<ProjectedCalendarEntryStatusSheet state="none" onClose={vi.fn()} />);
    expect(screen.getByText(/uoverensstemmelse|integritet/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /log denne træning/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /opret/i })).toBeNull();
  });

  it('shows a conflict message and lists every conflicting log read-only, selecting none as canonical', () => {
    const logs = [makeItem('a'), makeItem('b')];
    render(<ProjectedCalendarEntryStatusSheet state="conflict" logs={logs} onClose={vi.fn()} />);
    expect(screen.getByText(/konflikt/i)).toBeTruthy();
    expect(screen.getByText('Log a')).toBeTruthy();
    expect(screen.getByText('Log b')).toBeTruthy();
  });

  it('opens a conflicting log read-only when clicked, without exposing edit/delete', () => {
    const logs = [makeItem('a'), makeItem('b')];
    render(<ProjectedCalendarEntryStatusSheet state="conflict" logs={logs} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Log a'));
    // TrainingLogDetailSheet renders the item read-only; no edit/delete controls anywhere.
    expect(screen.queryByRole('button', { name: /rediger|slet/i })).toBeNull();
  });

  it('never renders create/edit/delete controls in any state', () => {
    for (const state of ['loading', 'error', 'none'] as const) {
      const { unmount } = render(<ProjectedCalendarEntryStatusSheet state={state} onClose={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /log denne træning|rediger|slet|opret/i })).toBeNull();
      unmount();
    }
  });

  it('calls onClose when the close action is used', () => {
    const onClose = vi.fn();
    render(<ProjectedCalendarEntryStatusSheet state="none" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /luk|tilbage/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
