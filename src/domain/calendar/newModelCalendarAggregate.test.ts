/**
 * newModelCalendarAggregate.test.ts — Checkpoint A: pure new-model calendar
 * aggregate builder, creation-id minting, and read-only calendar projection.
 * No Firestore, no React.
 */
import { describe, it, expect } from 'vitest';
import {
  mintUnplannedTrainingCreationIds,
  buildNewModelCalendarAggregate,
  projectNewModelCalendarAggregate,
  type UnplannedTrainingCreationIds,
} from './newModelCalendarAggregate';
import type { CompletedSelfPostedTrainingInput } from './selfPostedTraining';
import type { NewModelCalendarAggregate } from './types';

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
    userId: 'fighter@example.com',
    ...overrides,
  };
}

function makeIds(prefix = 'id'): UnplannedTrainingCreationIds {
  return {
    aggregateId: `${prefix}_aggregate`,
    occurrenceId: `${prefix}_occurrence`,
    calendarEntryId: `${prefix}_entry`,
    logRecordId: `${prefix}_log`,
  };
}

const FIXED_NOW_ISO = '2026-07-30T20:00:00.000Z';
// Deliberately far past every fixture's dateISO/start (regardless of the
// local timezone the test runner happens to use), so validation's
// future-timestamp rule never spuriously trips on a fixture that isn't
// actually testing that rule.
const deterministicDeps = () => ({
  nowISO: () => FIXED_NOW_ISO,
  now: () => new Date('2026-12-31T23:59:59.000Z'),
});

/** Recursively fails if any `undefined` value exists anywhere in the object graph. */
function assertNoUndefinedDeep(value: unknown, path = 'record'): void {
  if (value === undefined) throw new Error(`Unexpected undefined at ${path}`);
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
// mintUnplannedTrainingCreationIds
// ──────────────────────────────────────────────

describe('mintUnplannedTrainingCreationIds', () => {
  it('generates exactly four ids', () => {
    let calls = 0;
    mintUnplannedTrainingCreationIds(() => {
      calls += 1;
      return `id_${calls}`;
    });
    expect(calls).toBe(4);
  });

  it('uses the injected generator', () => {
    const generateId = () => 'fixed-id';
    const ids = mintUnplannedTrainingCreationIds(generateId);
    expect(ids.aggregateId).toBe('fixed-id');
    expect(ids.occurrenceId).toBe('fixed-id');
    expect(ids.calendarEntryId).toBe('fixed-id');
    expect(ids.logRecordId).toBe('fixed-id');
  });

  it('deterministic generator produces predictable, distinct ids', () => {
    let counter = 0;
    const ids = mintUnplannedTrainingCreationIds(() => `id_${++counter}`);
    expect(ids).toEqual({
      aggregateId: 'id_1',
      occurrenceId: 'id_2',
      calendarEntryId: 'id_3',
      logRecordId: 'id_4',
    });
  });

  it('does not derive ids from input values (the function takes no training input)', () => {
    // mintUnplannedTrainingCreationIds intentionally has no parameter for
    // title/date/time/discipline/location — only the generator. Calling it
    // twice with the same deterministic generator sequence proves ids come
    // purely from the generator, never from training content.
    let counter = 0;
    const gen = () => `id_${++counter}`;
    const first = mintUnplannedTrainingCreationIds(gen);
    const second = mintUnplannedTrainingCreationIds(gen);
    expect(first).not.toEqual(second);
  });
});

// ──────────────────────────────────────────────
// buildNewModelCalendarAggregate
// ──────────────────────────────────────────────

describe('buildNewModelCalendarAggregate', () => {
  it('uses all supplied ids correctly', () => {
    const ids = makeIds('a');
    const aggregate = buildNewModelCalendarAggregate(makeInput(), ids, deterministicDeps());
    expect(aggregate.id).toBe(ids.aggregateId);
    expect(aggregate.occurrence.id).toBe(ids.occurrenceId);
    expect(aggregate.calendarEntry.id).toBe(ids.calendarEntryId);
    expect(aggregate.logRecordId).toBe(ids.logRecordId);
  });

  it('sets occurrence.seriesId to null', () => {
    const aggregate = buildNewModelCalendarAggregate(makeInput(), makeIds(), deterministicDeps());
    expect(aggregate.occurrence.seriesId).toBeNull();
  });

  it("sets occurrence.type to 'self_posted_training'", () => {
    const aggregate = buildNewModelCalendarAggregate(makeInput(), makeIds(), deterministicDeps());
    expect(aggregate.occurrence.type).toBe('self_posted_training');
  });

  it("sets occurrence.status to 'completed'", () => {
    const aggregate = buildNewModelCalendarAggregate(makeInput(), makeIds(), deterministicDeps());
    expect(aggregate.occurrence.status).toBe('completed');
  });

  it("sets calendarEntry.status to 'completed'", () => {
    const aggregate = buildNewModelCalendarAggregate(makeInput(), makeIds(), deterministicDeps());
    expect(aggregate.calendarEntry.status).toBe('completed');
  });

  it('sets calendarEntry.occurrenceId equal to occurrence.id', () => {
    const aggregate = buildNewModelCalendarAggregate(makeInput(), makeIds(), deterministicDeps());
    expect(aggregate.calendarEntry.occurrenceId).toBe(aggregate.occurrence.id);
  });

  it('sets calendarEntry.userId to match the aggregate owner where supported', () => {
    const aggregate = buildNewModelCalendarAggregate(
      makeInput({ userId: 'fighter@example.com' }),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate.calendarEntry.userId).toBe('fighter@example.com');
    expect(aggregate.userId).toBe('fighter@example.com');
  });

  it('sets schemaVersion to 1', () => {
    const aggregate = buildNewModelCalendarAggregate(makeInput(), makeIds(), deterministicDeps());
    expect(aggregate.schemaVersion).toBe(1);
  });

  it('maps title, discipline, date, time, and location correctly', () => {
    const aggregate = buildNewModelCalendarAggregate(
      makeInput({ title: 'Solo Run', discipline: 'Conditioning', dateISO: '2026-08-10', start: '06:00', location: 'Park' }),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate.occurrence.title).toBe('Solo Run');
    expect(aggregate.occurrence.discipline).toBe('Conditioning');
    expect(aggregate.occurrence.startDateTime).toBe('2026-08-10T06:00:00');
    expect(aggregate.occurrence.location).toBe('Park');
  });

  it('maps an explicit end time correctly', () => {
    const aggregate = buildNewModelCalendarAggregate(
      makeInput({ start: '17:00', end: '18:30' }),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate.occurrence.endDateTime).toBe('2026-07-30T18:30:00');
  });

  it('derives end time from duration correctly', () => {
    const aggregate = buildNewModelCalendarAggregate(
      makeInput({ start: '17:00', end: undefined, durationMinutes: 45 }),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate.occurrence.startDateTime).toBe('2026-07-30T17:00:00');
    expect(aggregate.occurrence.endDateTime).toBe('2026-07-30T17:45:00');
  });

  it('derives end time from duration across a local midnight without UTC rollover', () => {
    const aggregate = buildNewModelCalendarAggregate(
      makeInput({ dateISO: '2026-07-30', start: '23:30', end: undefined, durationMinutes: 90 }),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate.occurrence.startDateTime).toBe('2026-07-30T23:30:00');
    expect(aggregate.occurrence.endDateTime).toBe('2026-07-31T01:00:00');
  });

  it('omits absent optional location', () => {
    const aggregate = buildNewModelCalendarAggregate(
      makeInput({ location: undefined }),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate.occurrence.location).toBeUndefined();
    expect('location' in aggregate.occurrence).toBe(false);
    assertNoUndefinedDeep(aggregate);
  });

  it('does not mutate input', () => {
    const input = makeInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    buildNewModelCalendarAggregate(input, makeIds(), deterministicDeps());
    expect(input).toEqual(snapshot);
  });

  it('rejects a future completed-training timestamp using existing validation', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureDateISO = future.toISOString().slice(0, 10);
    expect(() =>
      buildNewModelCalendarAggregate(
        makeInput({ dateISO: futureDateISO }),
        makeIds(),
        { now: () => new Date() },
      ),
    ).toThrow(/validation failed/);
  });

  it('rejects input missing required fields (e.g. missing title) via existing validation', () => {
    expect(() =>
      buildNewModelCalendarAggregate(
        makeInput({ title: '' }),
        makeIds(),
        deterministicDeps(),
      ),
    ).toThrow(/validation failed/);
  });
});

// ──────────────────────────────────────────────
// projectNewModelCalendarAggregate
// ──────────────────────────────────────────────

function makeAggregate(
  overrides: Partial<NewModelCalendarAggregate> = {},
  occurrenceOverrides: Partial<NewModelCalendarAggregate['occurrence']> = {},
  calendarEntryOverrides: Partial<NewModelCalendarAggregate['calendarEntry']> = {},
): NewModelCalendarAggregate {
  return {
    id: 'agg_1',
    userId: 'fighter@example.com',
    occurrence: {
      id: 'occ_1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'MMA Sparring',
      discipline: 'MMA',
      startDateTime: '2026-08-22T17:00:00',
      endDateTime: '2026-08-22T18:30:00',
      location: 'Rumble Sports',
      status: 'completed',
      ...occurrenceOverrides,
    },
    calendarEntry: {
      id: 'entry_1',
      occurrenceId: 'occ_1',
      userId: 'fighter@example.com',
      status: 'completed',
      ...calendarEntryOverrides,
    },
    createdAt: '2026-08-22T19:00:00.000Z',
    updatedAt: '2026-08-22T19:00:00.000Z',
    schemaVersion: 1,
    logRecordId: 'log_1',
    ...overrides,
  };
}

describe('projectNewModelCalendarAggregate', () => {
  it("produces type 'calendar_entry'", () => {
    const { entry } = projectNewModelCalendarAggregate(makeAggregate());
    expect(entry.type).toBe('calendar_entry');
  });

  it('produces readOnly true', () => {
    const { entry } = projectNewModelCalendarAggregate(makeAggregate());
    expect(entry.readOnly).toBe(true);
  });

  it('retains aggregateId, occurrenceId, and calendarEntryId', () => {
    const { entry } = projectNewModelCalendarAggregate(
      makeAggregate({ id: 'agg_x' }, { id: 'occ_x' }, { id: 'entry_x', occurrenceId: 'occ_x' }),
    );
    expect(entry.aggregateId).toBe('agg_x');
    expect(entry.occurrenceId).toBe('occ_x');
    expect(entry.calendarEntryId).toBe('entry_x');
  });

  it('maps title, discipline, start, end, and location', () => {
    const { entry } = projectNewModelCalendarAggregate(
      makeAggregate({}, {
        title: 'Solo Run',
        discipline: 'Conditioning',
        startDateTime: '2026-08-22T06:00:00',
        endDateTime: '2026-08-22T07:00:00',
        location: 'Park',
      }),
    );
    expect(entry.name).toBe('Solo Run');
    expect(entry.category).toBe('Conditioning');
    expect(entry.start).toBe('06:00');
    expect(entry.end).toBe('07:00');
    expect(entry.location).toBe('Park');
  });

  it('places the entry in the correct ISO week and weekday (Saturday 2026-08-22 → week 34, Lørdag)', () => {
    const { weekNumber, dayName } = projectNewModelCalendarAggregate(
      makeAggregate({}, { startDateTime: '2026-08-22T17:00:00', endDateTime: '2026-08-22T18:00:00' }),
    );
    const expectedDate = new Date('2026-08-22T00:00:00');
    expect(expectedDate.getDay()).toBe(6); // Saturday
    expect(weekNumber).toBe(34);
    expect(dayName).toBe('Lørdag');
  });

  it('preserves the local date for a time near local midnight (no rollover to the previous day)', () => {
    const { weekNumber, dayName } = projectNewModelCalendarAggregate(
      makeAggregate({}, { startDateTime: '2026-01-01T00:15:00', endDateTime: '2026-01-01T01:00:00' }),
    );
    // 2026-01-01 is a Thursday, ISO week 1 — regardless of the machine's local timezone.
    expect(weekNumber).toBe(1);
    expect(dayName).toBe('Torsdag');
  });

  it('does not use UTC rollover behavior for a late-night local time', () => {
    const { weekNumber, dayName } = projectNewModelCalendarAggregate(
      makeAggregate({}, { startDateTime: '2026-01-01T23:45:00', endDateTime: '2026-01-01T23:59:00' }),
    );
    // Still 2026-01-01 (Thursday, ISO week 1) — a naive `toISOString()`-based
    // date extraction could shift this to 2026-01-02 in some timezones.
    expect(weekNumber).toBe(1);
    expect(dayName).toBe('Torsdag');
  });

  it("maps a completed occurrence/entry to status 'active'", () => {
    const { entry } = projectNewModelCalendarAggregate(makeAggregate());
    expect(entry.status).toBe('active');
  });

  it("maps a cancelled occurrence to status 'cancelled'", () => {
    const { entry } = projectNewModelCalendarAggregate(
      makeAggregate({}, { status: 'cancelled' }),
    );
    expect(entry.status).toBe('cancelled');
  });

  it("maps a cancelled calendarEntry to status 'cancelled'", () => {
    const { entry } = projectNewModelCalendarAggregate(
      makeAggregate({}, {}, { status: 'cancelled' }),
    );
    expect(entry.status).toBe('cancelled');
  });

  it('omits absent location', () => {
    const { entry } = projectNewModelCalendarAggregate(
      makeAggregate({}, { location: undefined }),
    );
    expect(entry.location).toBeUndefined();
    expect('location' in entry).toBe(false);
  });

  it('rejects an invalid startDateTime', () => {
    expect(() =>
      projectNewModelCalendarAggregate(makeAggregate({}, { startDateTime: 'not-a-date' })),
    ).toThrow(/startDateTime/);
  });

  it('rejects an invalid endDateTime', () => {
    expect(() =>
      projectNewModelCalendarAggregate(makeAggregate({}, { endDateTime: 'not-a-date' })),
    ).toThrow(/endDateTime/);
  });

  it('does not mutate the aggregate', () => {
    const aggregate = makeAggregate();
    const snapshot = JSON.parse(JSON.stringify(aggregate));
    projectNewModelCalendarAggregate(aggregate);
    expect(aggregate).toEqual(snapshot);
  });

  it('maps a Monday to the correct ISO week/dayName (2026-01-05 → week 2, Mandag)', () => {
    const { weekNumber, dayName } = projectNewModelCalendarAggregate(
      makeAggregate({}, { startDateTime: '2026-01-05T09:00:00', endDateTime: '2026-01-05T10:00:00' }),
    );
    expect(new Date('2026-01-05T00:00:00').getDay()).toBe(1); // Monday
    expect(weekNumber).toBe(2);
    expect(dayName).toBe('Mandag');
  });

  it('maps a Sunday to the correct ISO week/dayName (2026-01-04 → week 1, Søndag)', () => {
    const { weekNumber, dayName } = projectNewModelCalendarAggregate(
      makeAggregate({}, { startDateTime: '2026-01-04T09:00:00', endDateTime: '2026-01-04T10:00:00' }),
    );
    expect(new Date('2026-01-04T00:00:00').getDay()).toBe(0); // Sunday
    expect(weekNumber).toBe(1);
    expect(dayName).toBe('Søndag');
  });

  it('maps a year-boundary date to its correct ISO week (2027-01-01 → ISO week 53 of 2026, Fredag)', () => {
    const { weekNumber, dayName } = projectNewModelCalendarAggregate(
      makeAggregate({}, { startDateTime: '2027-01-01T09:00:00', endDateTime: '2027-01-01T10:00:00' }),
    );
    expect(new Date('2027-01-01T00:00:00').getDay()).toBe(5); // Friday
    expect(weekNumber).toBe(53);
    expect(dayName).toBe('Fredag');
  });

  it('rejects an impossible calendar date: day-of-month overflow (2026-02-31)', () => {
    expect(() =>
      projectNewModelCalendarAggregate(
        makeAggregate({}, { startDateTime: '2026-02-31T17:00:00' }),
      ),
    ).toThrow(/not a valid calendar date/);
  });

  it('rejects an impossible calendar date: month 13 (2026-13-10)', () => {
    expect(() =>
      projectNewModelCalendarAggregate(
        makeAggregate({}, { startDateTime: '2026-13-10T17:00:00' }),
      ),
    ).toThrow(/not a valid calendar date/);
  });

  it('rejects an impossible calendar date: month 00 (2026-00-10)', () => {
    expect(() =>
      projectNewModelCalendarAggregate(
        makeAggregate({}, { startDateTime: '2026-00-10T17:00:00' }),
      ),
    ).toThrow(/not a valid calendar date/);
  });

  it('rejects an impossible calendar date on endDateTime too (2026-04-31)', () => {
    expect(() =>
      projectNewModelCalendarAggregate(
        makeAggregate({}, { endDateTime: '2026-04-31T18:00:00' }),
      ),
    ).toThrow(/not a valid calendar date/);
  });

  it('does not silently normalize an impossible date onto another day (never places 2026-02-31 on 2026-03-03)', () => {
    expect(() =>
      projectNewModelCalendarAggregate(
        makeAggregate({}, { startDateTime: '2026-02-31T17:00:00', endDateTime: '2026-02-31T18:00:00' }),
      ),
    ).toThrow();
  });

  it('rejects an end datetime before the start datetime, even on a directly constructed aggregate', () => {
    expect(() =>
      projectNewModelCalendarAggregate(
        makeAggregate({}, {
          startDateTime: '2026-08-22T18:00:00',
          endDateTime: '2026-08-22T17:00:00',
        }),
      ),
    ).toThrow(/must not be before/);
  });

  it('allows an end datetime that crosses local midnight after the start (not misclassified as "before")', () => {
    const { entry } = projectNewModelCalendarAggregate(
      makeAggregate({}, {
        startDateTime: '2026-08-22T23:30:00',
        endDateTime: '2026-08-23T01:00:00',
      }),
    );
    expect(entry.start).toBe('23:30');
    expect(entry.end).toBe('01:00');
  });
});
