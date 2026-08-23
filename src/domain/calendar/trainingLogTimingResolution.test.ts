import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveTrainingLogHistoryItem } from './trainingLogTimingResolution';
import type { CompletedSelfPostedTrainingLog } from './types';

const TIMEZONES = ['UTC', 'Europe/Copenhagen', 'America/New_York'];

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeRecord(overrides: {
  startDateTime: string;
  endDateTime: string;
  origin?: CompletedSelfPostedTrainingLog['origin'];
}): CompletedSelfPostedTrainingLog {
  return {
    id: 'record-1',
    occurrence: {
      id: 'occ-1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'MMA Sparring',
      discipline: 'MMA',
      startDateTime: overrides.startDateTime,
      endDateTime: overrides.endDateTime,
      location: 'Klub A',
      status: 'completed',
    },
    calendarEntry: { id: 'cal-1', occurrenceId: 'occ-1', status: 'completed' },
    log: {
      id: 'log-1',
      occurrenceId: 'occ-1',
      calendarEntryId: 'cal-1',
      userId: 'fighter@example.com',
      attended: true,
      actualStartDateTime: overrides.startDateTime,
      actualEndDateTime: overrides.endDateTime,
      intensity: 4,
      discipline: 'MMA',
      notes: 'Felt strong',
    },
    createdAt: '2026-07-30T20:00:00.000Z',
    updatedAt: '2026-07-30T20:00:00.000Z',
    ...(overrides.origin !== undefined ? { origin: overrides.origin } : {}),
  };
}

describe('resolveTrainingLogHistoryItem — exact associated occurrence takes priority', () => {
  it('uses the exact associated aggregate-occurrence duration for a new-model log, even when the snapshot end is ambiguous', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T16:30:00.000Z', // ambiguous snapshot end
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
    });

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(90);
    expect(item.startDateTime).toBe('2026-07-30T17:00:00');
    expect(item.endDateTime).toBe('2026-07-30T18:30:00');
  });

  it('uses the exact adapted legacy-session duration, even when the snapshot end is ambiguous', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T16:30:00.000Z',
      origin: { type: 'self_posted_calendar_session', sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:00:00',
    });

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(60);
  });

  it('prefers the associated occurrence timing even when the snapshot itself is already exact', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:00:00', // exact but different from the associated occurrence
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
    });

    expect(item.durationMinutes).toBe(90);
  });

  it('supports midnight crossing via the associated occurrence', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T23:00:00',
      endDateTime: '2026-07-30T22:30:00.000Z',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T23:30:00',
      endDateTime: '2026-07-31T00:15:00',
    });

    expect(item.durationMinutes).toBe(45);
  });

  it('is timezone-independent', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T16:30:00.000Z',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    for (const tz of TIMEZONES) {
      vi.stubEnv('TZ', tz);
      const item = resolveTrainingLogHistoryItem(record, {
        startDateTime: '2026-07-30T17:00:00',
        endDateTime: '2026-07-30T18:30:00',
      });
      expect(item.durationMinutes).toBe(90);
      vi.unstubAllEnvs();
    }
  });

  it('preserves safe content (title, discipline, location, notes, intensity) from the log snapshot', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T16:30:00.000Z',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
    });

    expect(item.title).toBe('MMA Sparring');
    expect(item.discipline).toBe('MMA');
    expect(item.location).toBe('Klub A');
    expect(item.notes).toBe('Felt strong');
    expect(item.intensity).toBe(4);
  });
});

describe('resolveTrainingLogHistoryItem — fallback to the compatibility reader', () => {
  it('falls back when no associated occurrence timing is supplied (standalone log)', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' });

    const item = resolveTrainingLogHistoryItem(record, null);

    expect(item.durationCertainty).toBe('ambiguous');
    expect(item.durationMinutes).toBeUndefined();
  });

  it('falls back when no associated occurrence timing is supplied (undefined)', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });

    const item = resolveTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(90);
  });

  it('falls back to the compatibility reader when the associated occurrence end is a UTC-Z/offset instant', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:00:00.000Z', // supplied occurrence timing is itself ambiguous
    });

    // Falls back to the log's own snapshot (which happens to be exact here).
    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(90);
  });

  it('falls back when the associated occurrence timing is missing/invalid', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, { startDateTime: 'not-a-date', endDateTime: 'not-a-date' });

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(90);
  });

  it('falls back when the associated occurrence has a negative duration (never guesses)', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });

    const item = resolveTrainingLogHistoryItem(record, {
      startDateTime: '2026-07-30T18:30:00',
      endDateTime: '2026-07-30T17:00:00',
    });

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(90);
  });
});

describe('resolveTrainingLogHistoryItem — read-only, no mutation', () => {
  it('does not mutate the input record', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T16:30:00.000Z',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });
    const before = JSON.parse(JSON.stringify(record));

    resolveTrainingLogHistoryItem(record, { startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });

    expect(record).toEqual(before);
  });

  it('does not mutate the supplied associated occurrence timing', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });
    const timing = { startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' };
    const before = JSON.parse(JSON.stringify(timing));

    resolveTrainingLogHistoryItem(record, timing);

    expect(timing).toEqual(before);
  });
});
