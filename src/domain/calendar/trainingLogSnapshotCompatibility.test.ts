import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  classifyTrainingLogDateTimeFormat,
  buildTrainingLogHistoryItem,
} from './trainingLogSnapshotCompatibility';
import type { CompletedSelfPostedTrainingLog } from './types';

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

function makeRecord(overrides: {
  startDateTime: string;
  endDateTime: string;
  hasLogs?: boolean;
  calendarEntryUserId?: string;
  origin?: CompletedSelfPostedTrainingLog['origin'];
}): CompletedSelfPostedTrainingLog {
  const occurrence: CompletedSelfPostedTrainingLog['occurrence'] = {
    id: 'occ-1',
    seriesId: null,
    type: 'self_posted_training',
    title: 'MMA Sparring',
    discipline: 'MMA',
    startDateTime: overrides.startDateTime,
    endDateTime: overrides.endDateTime,
    location: 'Klub A',
    status: 'completed',
  };
  if (overrides.hasLogs !== undefined) occurrence.hasLogs = overrides.hasLogs;

  const calendarEntry: CompletedSelfPostedTrainingLog['calendarEntry'] = {
    id: 'cal-1',
    occurrenceId: 'occ-1',
    status: 'completed',
  };
  if (overrides.calendarEntryUserId !== undefined) calendarEntry.userId = overrides.calendarEntryUserId;

  const record: CompletedSelfPostedTrainingLog = {
    id: 'record-1',
    occurrence,
    calendarEntry,
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
  };
  if (overrides.origin !== undefined) record.origin = overrides.origin;
  return record;
}

const TIMEZONES = ['UTC', 'Europe/Copenhagen', 'America/New_York'];

afterEach(() => {
  vi.unstubAllEnvs();
});

// ──────────────────────────────────────────────
// classifyTrainingLogDateTimeFormat
// ──────────────────────────────────────────────

describe('classifyTrainingLogDateTimeFormat', () => {
  it('classifies an offset-free local datetime with seconds as local', () => {
    expect(classifyTrainingLogDateTimeFormat('2026-07-30T17:00:00')).toBe('local');
  });

  it('classifies an offset-free local datetime without seconds as local', () => {
    expect(classifyTrainingLogDateTimeFormat('2026-07-30T17:00')).toBe('local');
  });

  it('classifies a UTC-Z instant as absolute', () => {
    expect(classifyTrainingLogDateTimeFormat('2026-07-30T16:30:00.000Z')).toBe('absolute');
  });

  it('classifies a UTC-Z instant without milliseconds as absolute', () => {
    expect(classifyTrainingLogDateTimeFormat('2026-07-30T16:30:00Z')).toBe('absolute');
  });

  it('classifies an explicit numeric-offset instant as absolute', () => {
    expect(classifyTrainingLogDateTimeFormat('2026-07-30T18:30:00+02:00')).toBe('absolute');
  });

  it('classifies an offset instant with milliseconds as absolute', () => {
    expect(classifyTrainingLogDateTimeFormat('2026-07-30T18:30:00.123+02:00')).toBe('absolute');
  });

  it('classifies a malformed string as invalid', () => {
    expect(classifyTrainingLogDateTimeFormat('not-a-date')).toBe('invalid');
  });

  it('classifies an empty string as invalid', () => {
    expect(classifyTrainingLogDateTimeFormat('')).toBe('invalid');
  });

  it('classifies undefined as invalid', () => {
    expect(classifyTrainingLogDateTimeFormat(undefined)).toBe('invalid');
  });

  it('gives the identical classification under every tested runtime timezone', () => {
    const samples: Array<[string, ReturnType<typeof classifyTrainingLogDateTimeFormat>]> = [
      ['2026-07-30T17:00:00', 'local'],
      ['2026-07-30T16:30:00.000Z', 'absolute'],
      ['2026-07-30T18:30:00+02:00', 'absolute'],
      ['not-a-date', 'invalid'],
    ];
    for (const tz of TIMEZONES) {
      vi.stubEnv('TZ', tz);
      for (const [value, expected] of samples) {
        expect(classifyTrainingLogDateTimeFormat(value)).toBe(expected);
      }
    }
  });
});

// ──────────────────────────────────────────────
// buildTrainingLogHistoryItem — exact (local/local)
// ──────────────────────────────────────────────

describe('buildTrainingLogHistoryItem — exact local/local records', () => {
  it('classifies an ordinary explicit-end local record as exact, with the correct duration', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(90);
    expect(item.endDateTime).toBe('2026-07-30T18:30:00');
    expect(item.startDateTime).toBe('2026-07-30T17:00:00');
  });

  it('computes exact duration across a midnight crossing', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T23:30:00', endDateTime: '2026-07-31T00:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(60);
  });

  it('computes exact duration across a represented DST spring-forward boundary (wall-clock fields only)', () => {
    // 2026-03-29 is the EU DST spring-forward date; these are pure wall-clock
    // fields, not real elapsed time under any specific zone's DST rule.
    const record = makeRecord({ startDateTime: '2026-03-29T01:30:00', endDateTime: '2026-03-29T03:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(120);
  });

  it('computes exact duration across a represented DST fall-back boundary (wall-clock fields only)', () => {
    // 2026-10-25 is the EU DST fall-back date.
    const record = makeRecord({ startDateTime: '2026-10-25T02:00:00', endDateTime: '2026-10-25T02:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(30);
  });

  it('classifies a record without seconds in the local strings as exact', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00', endDateTime: '2026-07-30T18:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.durationMinutes).toBe(60);
  });

  it('produces the identical exact result under every tested runtime timezone', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    for (const tz of TIMEZONES) {
      vi.stubEnv('TZ', tz);
      const item = buildTrainingLogHistoryItem(record);
      expect(item.durationCertainty).toBe('exact');
      expect(item.durationMinutes).toBe(90);
      expect(item.startDateTime).toBe('2026-07-30T17:00:00');
    }
  });
});

// ──────────────────────────────────────────────
// buildTrainingLogHistoryItem — ambiguous (UTC-Z / offset legacy end)
// ──────────────────────────────────────────────

describe('buildTrainingLogHistoryItem — ambiguous legacy UTC-Z/offset end', () => {
  it('classifies a duration-derived UTC-Z legacy end as ambiguous, without a fabricated duration', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('ambiguous');
    expect(item.durationMinutes).toBeUndefined();
    expect(item.endDateTime).toBeUndefined();
  });

  it('classifies an explicit numeric-offset legacy end as ambiguous', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00+02:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('ambiguous');
    expect(item.durationMinutes).toBeUndefined();
  });

  it('preserves the deterministic start display even when the end is ambiguous', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.startDateTime).toBe('2026-07-30T17:00:00');
  });

  it('produces the identical ambiguous classification under every tested runtime timezone (never derives a runtime-dependent duration)', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' });
    for (const tz of TIMEZONES) {
      vi.stubEnv('TZ', tz);
      const item = buildTrainingLogHistoryItem(record);
      expect(item.durationCertainty).toBe('ambiguous');
      expect(item.durationMinutes).toBeUndefined();
      expect(item.startDateTime).toBe('2026-07-30T17:00:00');
    }
  });

  it('never produces a negative duration for a DST-boundary ambiguous case under any tested timezone', () => {
    const record = makeRecord({ startDateTime: '2026-10-25T02:30:00', endDateTime: '2026-10-25T01:30:00.000Z' });
    for (const tz of TIMEZONES) {
      vi.stubEnv('TZ', tz);
      const item = buildTrainingLogHistoryItem(record);
      expect(item.durationCertainty).toBe('ambiguous');
      expect(item.durationMinutes).toBeUndefined();
    }
  });
});

// ──────────────────────────────────────────────
// buildTrainingLogHistoryItem — unavailable (missing/malformed)
// ──────────────────────────────────────────────

describe('buildTrainingLogHistoryItem — unavailable time', () => {
  it('classifies a malformed start as unavailable while preserving other historical fields', () => {
    const record = makeRecord({ startDateTime: 'not-a-date', endDateTime: '2026-07-30T18:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('unavailable');
    expect(item.durationMinutes).toBeUndefined();
    expect(item.endDateTime).toBeUndefined();
    expect(item.title).toBe('MMA Sparring');
    expect(item.discipline).toBe('MMA');
    expect(item.location).toBe('Klub A');
    expect(item.notes).toBe('Felt strong');
    expect(item.intensity).toBe(4);
  });

  it('classifies a malformed end as unavailable while start remains deterministic', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: 'not-a-date' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('unavailable');
    expect(item.startDateTime).toBe('2026-07-30T17:00:00');
  });

  it('classifies a missing (empty) end as unavailable', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('unavailable');
  });

  it('classifies a local/local record where end precedes start as unavailable rather than showing a negative duration', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T18:00:00', endDateTime: '2026-07-30T17:00:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('unavailable');
    expect(item.durationMinutes).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// buildTrainingLogHistoryItem — shape/provenance/compatibility
// ──────────────────────────────────────────────

describe('buildTrainingLogHistoryItem — shape and compatibility', () => {
  it('builds an item for a standalone log without provenance', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item.title).toBe('MMA Sparring');
  });

  it('builds an item for a self_posted_calendar_session-originated log without letting provenance select interpretation', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T16:30:00.000Z', // ambiguous by FORMAT, regardless of origin type
      origin: { type: 'self_posted_calendar_session', sessionId: 'sess-1', occurrenceDateISO: '2026-07-30' },
    });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('ambiguous');
  });

  it('builds an item for a new_model_calendar_entry-originated log without letting provenance select interpretation', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00', // exact by FORMAT, regardless of origin type
      origin: { type: 'new_model_calendar_entry', aggregateId: 'agg-1', occurrenceId: 'occ-1' },
    });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
  });

  it('ignores occurrence.hasLogs when present', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00', hasLogs: true });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item).not.toHaveProperty('hasLogs');
  });

  it('ignores occurrence.hasLogs when absent', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
  });

  it('tolerates a missing embedded calendarEntry.userId', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    expect(record.calendarEntry.userId).toBeUndefined();

    const item = buildTrainingLogHistoryItem(record);
    expect(item.durationCertainty).toBe('exact');
  });

  it('tolerates a present embedded calendarEntry.userId without exposing it in the read model', () => {
    const record = makeRecord({
      startDateTime: '2026-07-30T17:00:00',
      endDateTime: '2026-07-30T18:30:00',
      calendarEntryUserId: 'fighter@example.com',
    });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.durationCertainty).toBe('exact');
    expect(item).not.toHaveProperty('userId');
  });

  it('preserves optional location, notes and intensity', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    const item = buildTrainingLogHistoryItem(record);

    expect(item.location).toBe('Klub A');
    expect(item.notes).toBe('Felt strong');
    expect(item.intensity).toBe(4);
  });

  it('does not mutate the input record', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T16:30:00.000Z' });
    const before = JSON.parse(JSON.stringify(record));

    buildTrainingLogHistoryItem(record);

    expect(record).toEqual(before);
  });

  it('does not require any source occurrence or CalendarEntry document beyond the passed-in record', () => {
    const record = makeRecord({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
    // No external lookup is possible in this pure unit test — a passing call
    // with only `record` proves the adapter is self-contained.
    expect(() => buildTrainingLogHistoryItem(record)).not.toThrow();
  });
});
