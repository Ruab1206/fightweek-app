// @vitest-environment jsdom
/**
 * TrainingLogDetailSheet.test.ts — read-only detail view of one TrainingLog.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrainingLogDetailSheet } from './TrainingLogDetailSheet';
import type { TrainingHistoryItem } from '../domain/calendar/types';

const item: TrainingHistoryItem = {
  id: 'record-1',
  title: 'MMA Sparring',
  type: 'self_posted_training',
  discipline: 'MMA',
  startDateTime: '2026-08-14T18:00:00',
  endDateTime: '2026-08-14T19:00:00',
  durationMinutes: 60,
  location: 'Klub A',
  notes: 'Felt strong',
  intensity: 4,
};

describe('TrainingLogDetailSheet', () => {
  it('renders the log snapshot read-only, with no edit or delete controls', () => {
    render(<TrainingLogDetailSheet item={item} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('MMA Sparring')).toBeTruthy();
    expect(screen.getByText('MMA')).toBeTruthy();
    expect(screen.getByText(/60 min/)).toBeTruthy();
    expect(screen.getByText('Klub A')).toBeTruthy();
    expect(screen.getByText(/Intensitet: 4\/5/)).toBeTruthy();
    expect(screen.getByText('Felt strong')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /slet/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /rediger/i })).toBeNull();
  });

  it('calls onClose without any other side effect when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<TrainingLogDetailSheet item={item} onClose={onClose} />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<TrainingLogDetailSheet item={item} onClose={onClose} />);

    const backdrop = container.querySelector('.bg-black\\/40');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
