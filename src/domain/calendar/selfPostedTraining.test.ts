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

/** Recursively fails if any `undefined` value exists anywhere in the object graph. */
function assertNoUndefinedDeep(value: unknown, path = 'record'): void {
  if (value === undefined) {
    throw new Error(`Unexpected undefined at ${path}`);
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoUndefinedDeep(item, `${path}[${i}]`));
    return;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    assertNoUndefinedDeep(val, `${path}.${key}`);
  }
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

  it('mints all ids internally when deps.ids is omitted (existing callers unchanged)', () => {
    let calls = 0;
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), {
      generateId: () => `id_${++calls}`,
      nowISO: () => '2026-07-30T20:00:00.000Z',
    });
    // occurrenceId, calendarEntryId, logId, recordId — 4 generator calls.
    expect(calls).toBe(4);
    expect(record.occurrence.id).toBe('id_1');
    expect(record.calendarEntry.id).toBe('id_2');
    expect(record.log.id).toBe('id_3');
    expect(record.id).toBe('id_4');
  });

  it('uses supplied deps.ids for occurrenceId/calendarEntryId/recordId (Checkpoint B pairing)', () => {
    let calls = 0;
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), {
      generateId: () => `gen_${++calls}`,
      nowISO: () => '2026-07-30T20:00:00.000Z',
      ids: { occurrenceId: 'occ_shared', calendarEntryId: 'entry_shared', recordId: 'record_shared' },
    });
    expect(record.occurrence.id).toBe('occ_shared');
    expect(record.calendarEntry.id).toBe('entry_shared');
    expect(record.id).toBe('record_shared');
    // The EventLog's own internal id is NOT part of the supplied bundle —
    // it still comes from generateId(), called exactly once here.
    expect(record.log.id).toBe('gen_1');
    expect(calls).toBe(1);
  });

  it('supplied ids keep calendarEntry.occurrenceId and log.occurrenceId/calendarEntryId consistent with the shared identities', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), {
      nowISO: () => '2026-07-30T20:00:00.000Z',
      ids: { occurrenceId: 'occ_shared', calendarEntryId: 'entry_shared', recordId: 'record_shared' },
    });
    expect(record.calendarEntry.occurrenceId).toBe('occ_shared');
    expect(record.log.occurrenceId).toBe('occ_shared');
    expect(record.log.calendarEntryId).toBe('entry_shared');
  });
});

// ──────────────────────────────────────────────
// buildCompletedSelfPostedTrainingLog — Firestore-safe record construction.
// `setDoc()` rejects any field whose value is `undefined`, so an absent
// optional field must be an OMITTED property, never a present property set
// to `undefined`. See the "Function setDoc() called with invalid data"
// production defect this guards against.
// ──────────────────────────────────────────────

describe('buildCompletedSelfPostedTrainingLog — Firestore-safe optional fields', () => {
  it('builds successfully without location and omits the property entirely', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ location: undefined }),
      deterministicDeps(),
    );

    expect('location' in record.occurrence).toBe(false);
    assertNoUndefinedDeep(record);
  });

  it('builds successfully without notes and omits the property entirely', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ notes: undefined }),
      deterministicDeps(),
    );

    expect('notes' in record.log).toBe(false);
    assertNoUndefinedDeep(record);
  });

  it('builds successfully without intensity and omits the property entirely', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ intensity: undefined }),
      deterministicDeps(),
    );

    expect('intensity' in record.log).toBe(false);
    assertNoUndefinedDeep(record);
  });

  it('contains no undefined values anywhere in the record when every optional field is omitted', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ location: undefined, notes: undefined, intensity: undefined }),
      deterministicDeps(),
    );

    expect('location' in record.occurrence).toBe(false);
    expect('notes' in record.log).toBe(false);
    expect('intensity' in record.log).toBe(false);
    assertNoUndefinedDeep(record);
  });

  it('preserves supplied location, notes and intensity exactly', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ location: 'Rumble Sports', notes: 'Good rounds', intensity: 4 }),
      deterministicDeps(),
    );

    expect(record.occurrence.location).toBe('Rumble Sports');
    expect(record.log.notes).toBe('Good rounds');
    expect(record.log.intensity).toBe(4);
    assertNoUndefinedDeep(record);
  });

  it('renders correctly via logToHistoryItem when optional fields are absent, with no notes placeholder introduced', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ location: undefined, notes: undefined, intensity: undefined }),
      deterministicDeps(),
    );
    const item = logToHistoryItem(record);

    expect(item.location).toBeUndefined();
    expect(item.notes).toBe('');
    expect(item.intensity).toBeUndefined();
  });

  it('keeps required context unchanged when optional fields are omitted (regression)', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({ location: undefined, notes: undefined, intensity: undefined }),
      deterministicDeps(),
    );

    expect(record.occurrence.title).toBe('MMA Sparring');
    expect(record.occurrence.discipline).toBe('MMA');
    expect(record.occurrence.startDateTime).toBe('2026-07-30T17:00:00');
    expect(record.occurrence.endDateTime).toBe('2026-07-30T18:30:00');
    expect(record.occurrence.status).toBe('completed');
    expect(record.occurrence.id).toBeTruthy();
    expect(record.calendarEntry.id).toBeTruthy();
    expect(record.calendarEntry.occurrenceId).toBe(record.occurrence.id);
    expect(record.log.id).toBeTruthy();
    expect(record.log.occurrenceId).toBe(record.occurrence.id);
    expect(record.log.calendarEntryId).toBe(record.calendarEntry.id);
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
// buildCompletedSelfPostedTrainingLog — optional origin
// (Phase 3 calendar-originated slice; backward-compat with standalone logs)
// ──────────────────────────────────────────────

describe('buildCompletedSelfPostedTrainingLog — optional origin', () => {
  it('omits origin entirely for a standalone (non-calendar-originated) input — unchanged from before', () => {
    const record = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());

    expect('origin' in record).toBe(false);
    assertNoUndefinedDeep(record);
  });

  it('attaches the provided origin unchanged when supplied', () => {
    const record = buildCompletedSelfPostedTrainingLog(
      makeInput({
        origin: {
          type: 'self_posted_calendar_session',
          sessionId: 'sess_1',
          occurrenceDateISO: '2026-07-30',
        },
      }),
      deterministicDeps(),
    );

    expect(record.origin).toEqual({
      type: 'self_posted_calendar_session',
      sessionId: 'sess_1',
      occurrenceDateISO: '2026-07-30',
    });
    assertNoUndefinedDeep(record);
  });

  it('does not require origin to render — snapshot fields remain self-sufficient either way', () => {
    const withOrigin = buildCompletedSelfPostedTrainingLog(
      makeInput({
        origin: { type: 'self_posted_calendar_session', sessionId: 'sess_1', occurrenceDateISO: '2026-07-30' },
      }),
      deterministicDeps(),
    );
    const withoutOrigin = buildCompletedSelfPostedTrainingLog(makeInput(), deterministicDeps());

    const itemWithOrigin = logToHistoryItem(withOrigin);
    const itemWithoutOrigin = logToHistoryItem(withoutOrigin);

    expect(itemWithOrigin.title).toBe(itemWithoutOrigin.title);
    expect(itemWithOrigin.durationMinutes).toBe(itemWithoutOrigin.durationMinutes);
  });

  // Task #6: multiple explicit logs for the same calendar origin are allowed
  // (temporary, least-assumptive behavior) — no uniqueness is enforced here.
  it('builds two distinct log ids for two logs sharing identical origin provenance (duplicates allowed, not prevented)', () => {
    const sameOrigin = {
      type: 'self_posted_calendar_session' as const,
      sessionId: 'sess_1',
      occurrenceDateISO: '2026-07-30',
    };
    const first = buildCompletedSelfPostedTrainingLog(makeInput({ origin: sameOrigin }));
    const second = buildCompletedSelfPostedTrainingLog(makeInput({ origin: sameOrigin }));

    expect(first.id).not.toBe(second.id);
    expect(first.origin).toEqual(sameOrigin);
    expect(second.origin).toEqual(sameOrigin);
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

  it('accepts optional fields being absent (location, intensity) when end is given', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ location: undefined, intensity: undefined }),
    );
    expect(errors).toEqual([]);
  });

  it('rejects a missing discipline — required for the completed self-posted training flow', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ discipline: undefined }));
    expect(errors).toContain('discipline is required');
  });

  it('rejects a blank discipline', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ discipline: '   ' }));
    expect(errors).toContain('discipline is required');
  });

  it('accepts a valid discipline from the existing category vocabulary', () => {
    const errors = validateCompletedSelfPostedTrainingInput(makeInput({ discipline: 'MMA' }));
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

// ──────────────────────────────────────────────
// validateCompletedSelfPostedTrainingInput — completed training cannot be
// logged in the future (date AND time-of-day). Uses a fixed injected clock
// so results never depend on the real system clock.
// ──────────────────────────────────────────────

describe('validateCompletedSelfPostedTrainingInput — future rejection', () => {
  // Fixed local "now": 2026-07-30 18:00 local time. Constructed via the
  // local Date constructor (not an ISO/UTC string) so it lines up with how
  // dateISO/start are parsed (local time, see toDateTime/diffMinutes above).
  const NOW = new Date(2026, 6, 30, 18, 0, 0);
  const clock = { now: () => NOW };

  it('accepts a training on a past date', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-29', start: '10:00', end: '11:00' }),
      clock,
    );
    expect(errors).toEqual([]);
  });

  it('accepts a training earlier today', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: '11:00' }),
      clock,
    );
    expect(errors).toEqual([]);
  });

  it('accepts a training starting exactly at the injected current time', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '18:00', end: '19:00' }),
      clock,
    );
    expect(errors).toEqual([]);
  });

  it('rejects a training starting later today', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '19:00', end: '20:00' }),
      clock,
    );
    expect(errors).toContain('dateISO/start must not be in the future');
  });

  it('rejects a training on a future date', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-31', start: '08:00', end: '09:00' }),
      clock,
    );
    expect(errors).toContain('dateISO/start must not be in the future');
  });

  it('accepts start time plus a positive duration (no end given)', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: undefined, durationMinutes: 45 }),
      clock,
    );
    expect(errors).toEqual([]);
  });

  it('rejects when neither end nor durationMinutes is given', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: undefined, durationMinutes: undefined }),
      clock,
    );
    expect(errors).toContain('either a valid end time or a positive durationMinutes is required');
  });

  it('rejects zero or negative durationMinutes', () => {
    const zero = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: undefined, durationMinutes: 0 }),
      clock,
    );
    expect(zero).toContain('either a valid end time or a positive durationMinutes is required');

    const negative = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: undefined, durationMinutes: -10 }),
      clock,
    );
    expect(negative).toContain('either a valid end time or a positive durationMinutes is required');
  });

  it('still accepts explicit start/end input (existing support unchanged)', () => {
    const errors = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: '11:30' }),
      clock,
    );
    expect(errors).toEqual([]);
  });

  it('remains independent of free-text notes when checking the future rule', () => {
    const withoutNotes = validateCompletedSelfPostedTrainingInput(
      makeInput({ dateISO: '2026-07-30', start: '10:00', end: '11:00', notes: undefined }),
      clock,
    );
    expect(withoutNotes).toEqual([]);
  });

  it('defaults to the real clock when no now dependency is injected', () => {
    // No clock override: relies on dateISO fixtures already being in the
    // past relative to any real run of this suite.
    const errors = validateCompletedSelfPostedTrainingInput(makeInput());
    expect(errors).toEqual([]);
  });
});
