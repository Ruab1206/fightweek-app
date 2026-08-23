/**
 * selfPostedOperations.test.ts — canonical pure operations
 * (createSelfPostedOccurrence, addOccurrenceToFighterCalendar) and the
 * TRANSITIONAL current-snapshot log adapter
 * (buildTransitionalSelfPostedTrainingLog). No React, no Firebase.
 */
import { describe, it, expect } from 'vitest';
import {
  createSelfPostedOccurrence,
  addOccurrenceToFighterCalendar,
  buildTransitionalSelfPostedTrainingLog,
  toSelfPostedOccurrenceInput,
  type SelfPostedOccurrenceInput,
} from './selfPostedOperations';
import type { CompletedSelfPostedTrainingInput } from './selfPostedTraining';

/** Narrow occurrence-only input — deliberately carries NO log/CalendarEntry/id fields. */
function makeOccurrenceInput(
  overrides: Partial<SelfPostedOccurrenceInput> = {},
): SelfPostedOccurrenceInput {
  return {
    title: 'MMA Sparring',
    discipline: 'MMA',
    dateISO: '2026-07-30',
    start: '17:00',
    end: '18:30',
    location: 'Rumble Sports',
    ...overrides,
  };
}

function makeFormInput(
  overrides: Partial<CompletedSelfPostedTrainingInput> = {},
): CompletedSelfPostedTrainingInput {
  return {
    title: 'MMA Sparring',
    discipline: 'MMA',
    dateISO: '2026-07-30',
    start: '17:00',
    end: '18:30',
    location: 'Rumble Sports',
    userId: 'fighter@example.com',
    intensity: 4,
    notes: 'Good rounds',
    ...overrides,
  };
}

describe('createSelfPostedOccurrence', () => {
  it('accepts a narrow occurrence input with no log fields, no cast, no placeholder log values', () => {
    // Type-level proof: this object literal has no intensity/notes/origin/id fields.
    const input: SelfPostedOccurrenceInput = {
      title: 'Solo Run',
      discipline: 'Fysisk træning',
      dateISO: '2026-07-30',
      start: '07:00',
      end: '08:00',
    };
    const occurrence = createSelfPostedOccurrence(input, 'occ_1');
    expect(occurrence.title).toBe('Solo Run');
  });

  it('creates an EventOccurrence with no CalendarEntry-shaped fields', () => {
    const occurrence = createSelfPostedOccurrence(makeOccurrenceInput(), 'occ_1');
    expect('occurrenceId' in occurrence).toBe(false);
    expect('calendarEntry' in occurrence).toBe(false);
  });

  it('creates an EventOccurrence with no TrainingLog-shaped fields', () => {
    const occurrence = createSelfPostedOccurrence(makeOccurrenceInput(), 'occ_1');
    expect('log' in occurrence).toBe(false);
    expect('notes' in occurrence).toBe(false);
    expect('intensity' in occurrence).toBe(false);
  });

  it('uses the supplied stable occurrence id', () => {
    const occurrence = createSelfPostedOccurrence(makeOccurrenceInput(), 'occ_stable_1');
    expect(occurrence.id).toBe('occ_stable_1');
  });

  it('derives the end time from an explicit end (matching current aggregate semantics)', () => {
    const occurrence = createSelfPostedOccurrence(makeOccurrenceInput({ start: '17:00', end: '18:30' }), 'occ_1');
    expect(occurrence.startDateTime).toBe('2026-07-30T17:00:00');
    expect(occurrence.endDateTime).toBe('2026-07-30T18:30:00');
  });

  it('derives the end time from durationMinutes using local-safe addition (no UTC round-trip)', () => {
    const occurrence = createSelfPostedOccurrence(
      makeOccurrenceInput({ start: '23:30', end: undefined, durationMinutes: 90 }),
      'occ_1',
    );
    // Crosses local midnight — a UTC round-trip could shift the date; local-safe math must not.
    expect(occurrence.startDateTime).toBe('2026-07-30T23:30:00');
    expect(occurrence.endDateTime).toBe('2026-07-31T01:00:00');
  });

  it('does not set hasLogs (matching current aggregate occurrence shape)', () => {
    const occurrence = createSelfPostedOccurrence(makeOccurrenceInput(), 'occ_1');
    expect('hasLogs' in occurrence).toBe(false);
  });

  it('omits absent optional discipline/location rather than assigning undefined', () => {
    const occurrence = createSelfPostedOccurrence(makeOccurrenceInput({ discipline: undefined, location: undefined }), 'occ_1');
    expect('discipline' in occurrence).toBe(false);
    expect('location' in occurrence).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = makeOccurrenceInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    createSelfPostedOccurrence(input, 'occ_1');
    expect(input).toEqual(snapshot);
  });
});

describe('toSelfPostedOccurrenceInput', () => {
  it('drops log-only fields (intensity, notes, origin, userId) and keeps occurrence fields', () => {
    const narrow = toSelfPostedOccurrenceInput(makeFormInput({
      origin: { type: 'new_model_calendar_entry', aggregateId: 'a1', occurrenceId: 'o1' },
    }));
    expect(narrow).toEqual({
      title: 'MMA Sparring',
      discipline: 'MMA',
      dateISO: '2026-07-30',
      start: '17:00',
      end: '18:30',
      location: 'Rumble Sports',
    });
    expect('intensity' in narrow).toBe(false);
    expect('notes' in narrow).toBe(false);
    expect('origin' in narrow).toBe(false);
    expect('userId' in narrow).toBe(false);
  });

  it('omits absent optional occurrence fields rather than assigning undefined', () => {
    const narrow = toSelfPostedOccurrenceInput({
      title: 'Solo Run',
      dateISO: '2026-07-30',
      start: '07:00',
      durationMinutes: 60,
    });
    expect('discipline' in narrow).toBe(false);
    expect('end' in narrow).toBe(false);
    expect('location' in narrow).toBe(false);
  });
});

describe('addOccurrenceToFighterCalendar', () => {
  const occurrence = createSelfPostedOccurrence(makeOccurrenceInput(), 'occ_1');

  it('creates a CalendarEntry without any TrainingLog input', () => {
    const entry = addOccurrenceToFighterCalendar(occurrence, 'ce_1', 'completed', 'fighter@example.com');
    expect(entry).toEqual({
      id: 'ce_1',
      occurrenceId: 'occ_1',
      status: 'completed',
      userId: 'fighter@example.com',
    });
  });

  it('requires no logRecordId parameter to build a CalendarEntry', () => {
    const entry = addOccurrenceToFighterCalendar(occurrence, 'ce_1', 'completed');
    expect('logRecordId' in entry).toBe(false);
  });

  it('refers to the supplied occurrence id', () => {
    const entry = addOccurrenceToFighterCalendar(occurrence, 'ce_1', 'completed');
    expect(entry.occurrenceId).toBe(occurrence.id);
  });

  it('uses the supplied stable CalendarEntry id', () => {
    const entry = addOccurrenceToFighterCalendar(occurrence, 'ce_stable_1', 'completed');
    expect(entry.id).toBe('ce_stable_1');
  });

  it('does not infer Participation or a Note', () => {
    const entry = addOccurrenceToFighterCalendar(occurrence, 'ce_1', 'completed', 'fighter@example.com');
    expect('participation' in entry).toBe(false);
    expect('note' in entry).toBe(false);
    expect('personalNote' in entry).toBe(false);
  });

  it('omits userId when not supplied, rather than assigning undefined', () => {
    const entry = addOccurrenceToFighterCalendar(occurrence, 'ce_1', 'completed');
    expect('userId' in entry).toBe(false);
  });

  it('does not mutate the occurrence input', () => {
    const snapshot = JSON.parse(JSON.stringify(occurrence));
    addOccurrenceToFighterCalendar(occurrence, 'ce_1', 'completed', 'fighter@example.com');
    expect(occurrence).toEqual(snapshot);
  });
});

describe('buildTransitionalSelfPostedTrainingLog (TRANSITIONAL current-snapshot adapter)', () => {
  const deterministicDeps = () => ({
    nowISO: () => '2026-07-30T20:00:00.000Z',
    ids: { occurrenceId: 'occ_1', calendarEntryId: 'ce_1', recordId: 'log_1' },
  });

  it('creates a self-contained TrainingLog from form input', () => {
    const record = buildTransitionalSelfPostedTrainingLog(makeFormInput(), deterministicDeps());
    expect(record.occurrence.title).toBe('MMA Sparring');
    expect(record.log).toBeDefined();
    expect(record.calendarEntry).toBeDefined();
  });

  it('uses the supplied stable record id', () => {
    const record = buildTransitionalSelfPostedTrainingLog(makeFormInput(), deterministicDeps());
    expect(record.id).toBe('log_1');
  });

  it('snapshot remains readable independently of any live occurrence/calendar lookup', () => {
    const record = buildTransitionalSelfPostedTrainingLog(makeFormInput(), deterministicDeps());
    expect(record.occurrence.startDateTime).toBeDefined();
    expect(record.occurrence.endDateTime).toBeDefined();
    expect(record.occurrence.title).toBeDefined();
  });

  it('does not derive CalendarEntry identity from the record id — uses the supplied calendarEntryId', () => {
    const record = buildTransitionalSelfPostedTrainingLog(makeFormInput(), deterministicDeps());
    expect(record.calendarEntry.id).toBe('ce_1');
    expect(record.calendarEntry.id).not.toBe(record.id);
  });

  it('does not create Participation', () => {
    const record = buildTransitionalSelfPostedTrainingLog(makeFormInput(), deterministicDeps());
    expect('participation' in record).toBe(false);
  });

  it('retains the current divergent snapshot: log.occurrence sets hasLogs and log.calendarEntry omits userId', () => {
    const record = buildTransitionalSelfPostedTrainingLog(makeFormInput(), deterministicDeps());
    // Documented TRANSITIONAL divergence vs the aggregate (contract Section E).
    expect(record.occurrence.hasLogs).toBe(true);
    expect('userId' in record.calendarEntry).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = makeFormInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    buildTransitionalSelfPostedTrainingLog(input, deterministicDeps());
    expect(input).toEqual(snapshot);
  });
});
