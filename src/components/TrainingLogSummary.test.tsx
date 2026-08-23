// @vitest-environment jsdom
/**
 * TrainingLogSummary.test.tsx — shared read-only presentation of one
 * TrainingLog history/detail row, including the ambiguity-preserving
 * duration fallback (see `../domain/calendar/trainingLogSnapshotCompatibility`
 * and `/docs/fightweek_decisions.md` §24).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrainingLogSummary } from './TrainingLogSummary';
import type { TrainingHistoryItem } from '../domain/calendar/types';

function makeItem(overrides: Partial<TrainingHistoryItem> = {}): TrainingHistoryItem {
  return {
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
    ...overrides,
  };
}

describe('TrainingLogSummary — exact duration (unchanged behaviour)', () => {
  it('shows the exact duration when durationCertainty is exact', () => {
    render(<TrainingLogSummary item={makeItem({ durationCertainty: 'exact' })} isDark={false} />);
    expect(screen.getByText(/60 min/)).toBeTruthy();
  });

  it('shows the exact duration when durationCertainty is absent (legacy/unmodified logToHistoryItem items)', () => {
    render(<TrainingLogSummary item={makeItem({ durationCertainty: undefined })} isDark={false} />);
    expect(screen.getByText(/60 min/)).toBeTruthy();
  });
});

describe('TrainingLogSummary — ambiguous/unavailable duration fallback', () => {
  it('shows the neutral Danish fallback text when duration is ambiguous, with no fabricated number', () => {
    render(
      <TrainingLogSummary
        item={makeItem({ durationCertainty: 'ambiguous', durationMinutes: undefined, endDateTime: undefined })}
        isDark={false}
      />,
    );
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
    expect(screen.queryByText(/undefined min/)).toBeNull();
  });

  it('shows the same neutral fallback text when duration is unavailable', () => {
    render(
      <TrainingLogSummary
        item={makeItem({ durationCertainty: 'unavailable', durationMinutes: undefined, endDateTime: undefined })}
        isDark={false}
      />,
    );
    expect(screen.getByText(/Varighed ikke tilgængelig/)).toBeTruthy();
  });

  it('still preserves title, discipline, location, intensity and notes when duration is ambiguous', () => {
    render(
      <TrainingLogSummary
        item={makeItem({ durationCertainty: 'ambiguous', durationMinutes: undefined, endDateTime: undefined })}
        isDark={false}
      />,
    );
    expect(screen.getByText('MMA Sparring')).toBeTruthy();
    expect(screen.getByText('MMA')).toBeTruthy();
    expect(screen.getByText('Klub A')).toBeTruthy();
    expect(screen.getByText(/Intensitet: 4\/5/)).toBeTruthy();
    expect(screen.getByText('Felt strong')).toBeTruthy();
  });

  it('does not show a technical timezone warning in the normal UI', () => {
    render(
      <TrainingLogSummary
        item={makeItem({ durationCertainty: 'ambiguous', durationMinutes: undefined, endDateTime: undefined })}
        isDark={false}
      />,
    );
    expect(screen.queryByText(/timezone/i)).toBeNull();
    expect(screen.queryByText(/UTC/)).toBeNull();
  });
});
