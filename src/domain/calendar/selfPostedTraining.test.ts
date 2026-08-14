import { describe, it, expect } from 'vitest';
import {
  buildCompletedSelfPostedTrainingLog,
  buildLogContext,
  logToHistoryItem,
  validateCompletedSelfPostedTrainingInput,
  type CompletedSelfPostedTrainingInput,
} from './selfPostedTraining';

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

function makeInput(
  overrides: Partial<CompletedSelfPostedTrainingInput> = {},
): CompletedSelfPostedTrainingInput {
  return {
    title: 'MMA Sparring',
    discipline: 'MMA',
    dateISO: '2026-07-30',
    start: '17:00',
    end: '18:30',
    location: 'Rumble Sports',
    notes: 'Good rounds, worked clinch',
    intensity: 3,
    ...overrides,
  };
}

let idCounter = 0;
function deterministicDeps() {
  idCounter = 0;
  return {
    generateId: () => `id_${++idCounter}`,
    nowISO: () => '2026-07-30T20:00:00.000Z',
  };
}

// ──────────────────────────────────────────────
// buildCompletedSelfPostedTrainingLog
// ──────────────────────────────────────────────

describe('buildCompletedSelfPostedTrainingLog', () => {
  it('creates a self-contained record with occurrence, calendarEntry and log', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());

    expect(record.occurrence).toBeDefined();
    expect(record.calendarEntry).toBeDefined();
    expect(record.log).toBeDefined();
    expect(record.calendarEntry.occurrenceId).toBe(record.occurrence.id);
    expect(record.log.occurrenceId).toBe(record.occurrence.id);
    expect(record.log.calendarEntryId).toBe(record.calendarEntry.id);
  });

  it('preserves title, type, discipline, date/time, location and reference ids', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());

    expect(record.occurrence.title).toBe('MMA Sparring');
    expect(record.occurrence.type).toBe('self_posted_training');
    expect(record.occurrence.discipline).toBe('MMA');
    expect(record.occurrence.startDateTime).toBe('2026-07-30T17:00:00');
    expect(record.occurrence.endDateTime).toBe('2026-07-30T18:30:00');
    expect(record.occurrence.location).toBe('Rumble Sports');
    expect(record.occurrence.id).toBeTruthy();
    expect(record.calendarEntry.id).toBeTruthy();
  });

  it('sets status/lifecycle state appropriate for logged-after-the-fact training', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());

    expect(record.occurrence.status).toBe('completed');
    expect(record.occurrence.hasLogs).toBe(true);
    expect(record.calendarEntry.status).toBe('completed');
    expect(record.log.attended).toBe(true);
  });

  it('derives endDateTime/duration from durationMinutes when end is not given', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ end: undefined, durationMinutes: 45 }),
      deterministicDeps(),
    );

    expect(record.occurrence.startDateTime).toBe('2026-07-30T17:00:00');
    const item = logToHistoryItem(record);
    expect(item.durationMinutes).toBe(45);
  });

  it('omits location when not provided', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ location: undefined }),
      deterministicDeps(),
    );

    expect(record.occurrence.location).toBeUndefined();
  });

  it('is renderable as a history item even when calendarEntry visibility/status is not active', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());
    // Simulate the calendar entry later becoming hidden/removed/cancelled.
    const detached = { ...record, calendarEntry: { ...record.calendarEntry, status: 'cancelled' as const } };

    const item = logToHistoryItem(detached);

    expect(item.title).toBe('MMA Sparring');
    expect(item.discipline).toBe('MMA');
    expect(item.notes).toBe('Good rounds, worked clinch');
    expect(item.durationMinutes).toBe(90);
  });

  it('marks the log completed/attended even when no free-text notes are supplied — completion comes from the explicit log-completed-training flow, not from a note', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput({ notes: undefined }), deterministicDeps());

    expect(record.occurrence.status).toBe('completed');
    expect(record.occurrence.hasLogs).toBe(true);
    expect(record.calendarEntry.status).toBe('completed');
    expect(record.log.attended).toBe(true);
    expect(record.log.notes).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// buildLogContext
// ──────────────────────────────────────────────

describe('buildLogContext', () => {
  it('builds occurrence context from input, independent of calendar/log data', () => {
    const context = buildLogContext(makeInput(), 'occ_1');

    expect(context.id).toBe('occ_1');
    expect(context.seriesId).toBeNull();
    expect(context.type).toBe('self_posted_training');
    expect(context.title).toBe('MMA Sparring');
    expect(context.startDateTime).toBe('2026-07-30T17:00:00');
    expect(context.endDateTime).toBe('2026-07-30T18:30:00');
  });
});

// ──────────────────────────────────────────────
// logToHistoryItem
// ──────────────────────────────────────────────

describe('logToHistoryItem', () => {
  it('builds the history row only from the log/context record, not weekly calendar/session data', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());
    const item = logToHistoryItem(record);

    expect(item).toEqual({
      id: record.id,
      title: 'MMA Sparring',
      type: 'self_posted_training',
      discipline: 'MMA',
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
      durationMinutes: 90,
      location: 'Rumble Sports',
      notes: 'Good rounds, worked clinch',
      intensity: 3,
    });
  });

  it('derives duration from start/end when both are present', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ start: '06:00', end: '07:15' }),
      deterministicDeps(),
    );

    expect(logToHistoryItem(record).durationMinutes).toBe(75);
  });

  it('renders an empty notes string (not an error state) when no note was supplied', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput({ notes: undefined }), deterministicDeps());
    const item = logToHistoryItem(record);

    expect(item.notes).toBe('');
    expect(item.title).toBe('MMA Sparring');
  });

  it('preserves the supplied note as additional context when one is given', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ notes: 'Felt strong today' }),
      deterministicDeps(),
    );

    expect(logToHistoryItem(record).notes).toBe('Felt strong today');
  });
});

// ──────────────────────────────────────────────
// validateCompletedSelfPostedTrainingInput
// ──────────────────────────────────────────────

describe('validateCompletedSelfPostedTrainingInput', () => {
  it('accepts a fully valid input with no errors', () => {
    expect(validateCompletedSelfPostedTrainingInput(makeInput())).toEqual([]);
  });

  it('accepts optional fields being absent (discipline, location, intensity) when end is given', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ discipline: undefined, location: undefined, intensity: undefined }),
    );
    expect(errors).toEqual([]);
  });

  it('accepts a completed training log with no free-text notes — completion comes from the explicit log-completed-training flow, not from a note', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ notes: undefined }));
    expect(errors).toEqual([]);
  });

  it('accepts durationMinutes in place of end', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ end: undefined, durationMinutes: 60 }),
    );
    expect(errors).toEqual([]);
  });

  it('rejects an empty title', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ title: '   ' }));
    expect(errors).toContain('title is required');
  });

  it('rejects a missing date', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ dateISO: '' }));
    expect(errors).toContain('dateISO is required and must be YYYY-MM-DD');
  });

  it('rejects an invalid time', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ start: '25:99' }));
    expect(errors).toContain('start must be a valid HH:mm time');
  });

  it('rejects when neither a valid end time nor a positive durationMinutes is given', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ end: undefined, durationMinutes: undefined }),
    );
    expect(errors).toContain('either a valid end time or a positive durationMinutes is required');
  });

  it('rejects intensity outside 1–5', () => {
    expect(validateCompletedSelfPostedTrainingInput(makeInput({ intensity: 0 })))
      .toContain('intensity must be between 1 and 5');
    expect(validateCompletedSelfPostedTrainingInput(makeInput({ intensity: 6 })))
      .toContain('intensity must be between 1 and 5');
  });
});
