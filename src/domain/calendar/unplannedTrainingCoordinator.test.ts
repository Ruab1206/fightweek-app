/**
 * unplannedTrainingCoordinator.test.ts — pure coordinator: shared-id
 * calendar aggregate + TrainingLog record construction. No Firebase.
 */
import { describe, it, expect } from 'vitest';
import { buildUnplannedTrainingRecords } from './unplannedTrainingCoordinator';
import { mintUnplannedTrainingCreationIds } from './newModelCalendarAggregate';
import type { CompletedSelfPostedTrainingInput } from './selfPostedTraining';

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

function makeIds(prefix = 'id') {
  let n = 0;
  return mintUnplannedTrainingCreationIds(() => `${prefix}_${++n}`);
}

const deterministicDeps = () => ({
  nowISO: () => '2026-07-30T20:00:00.000Z',
  now: () => new Date('2026-12-31T23:59:59.000Z'),
});

describe('buildUnplannedTrainingRecords', () => {
  it('builds both an aggregate and a log record', () => {
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(
      makeInput(),
      makeIds(),
      deterministicDeps(),
    );
    expect(aggregate).toBeDefined();
    expect(logRecord).toBeDefined();
  });

  it('shares the same occurrence id between aggregate and log', () => {
    const ids = makeIds();
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    expect(aggregate.occurrence.id).toBe(ids.occurrenceId);
    expect(logRecord.occurrence.id).toBe(ids.occurrenceId);
    expect(aggregate.occurrence.id).toBe(logRecord.occurrence.id);
  });

  it('shares the same calendarEntry id between aggregate and log', () => {
    const ids = makeIds();
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    expect(aggregate.calendarEntry.id).toBe(ids.calendarEntryId);
    expect(logRecord.calendarEntry.id).toBe(ids.calendarEntryId);
    expect(aggregate.calendarEntry.id).toBe(logRecord.calendarEntry.id);
  });

  it('sets logRecord.id to ids.logRecordId and aggregate.logRecordId to the same value', () => {
    const ids = makeIds();
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    expect(logRecord.id).toBe(ids.logRecordId);
    expect(aggregate.logRecordId).toBe(ids.logRecordId);
  });

  it('sets aggregate.id to ids.aggregateId', () => {
    const ids = makeIds();
    const { aggregate } = buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    expect(aggregate.id).toBe(ids.aggregateId);
  });

  it("attaches a new_model_calendar_entry origin containing only aggregateId and occurrenceId", () => {
    const ids = makeIds();
    const { logRecord } = buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    expect(logRecord.origin).toEqual({
      type: 'new_model_calendar_entry',
      aggregateId: ids.aggregateId,
      occurrenceId: ids.occurrenceId,
    });
  });

  it('does not generate two unrelated occurrence identities for the same training', () => {
    const ids = makeIds();
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    // Exactly one occurrence identity shared by both records — not two independent ones.
    expect(new Set([aggregate.occurrence.id, logRecord.occurrence.id]).size).toBe(1);
    expect(new Set([aggregate.calendarEntry.id, logRecord.calendarEntry.id]).size).toBe(1);
  });

  it('propagates title/discipline/date/time/location into both records', () => {
    const ids = makeIds();
    const input = makeInput({ title: 'Solo Run', discipline: 'Fysisk træning', location: 'Park' });
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(input, ids, deterministicDeps());
    expect(aggregate.occurrence.title).toBe('Solo Run');
    expect(logRecord.occurrence.title).toBe('Solo Run');
    expect(aggregate.occurrence.discipline).toBe('Fysisk træning');
    expect(logRecord.occurrence.discipline).toBe('Fysisk træning');
    expect(aggregate.occurrence.location).toBe('Park');
    expect(logRecord.occurrence.location).toBe('Park');
  });

  it('does not mutate the input', () => {
    const input = makeInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    buildUnplannedTrainingRecords(input, makeIds(), deterministicDeps());
    expect(input).toEqual(snapshot);
  });

  it('does not mutate the ids bundle', () => {
    const ids = makeIds();
    const snapshot = { ...ids };
    buildUnplannedTrainingRecords(makeInput(), ids, deterministicDeps());
    expect(ids).toEqual(snapshot);
  });

  it('rejects a future completed-training timestamp using existing validation (propagated from the aggregate builder)', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureDateISO = future.toISOString().slice(0, 10);
    expect(() =>
      buildUnplannedTrainingRecords(
        makeInput({ dateISO: futureDateISO }),
        makeIds(),
        { now: () => new Date() },
      ),
    ).toThrow(/validation failed/);
  });

  it('omits absent optional location on both records', () => {
    const ids = makeIds();
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(
      makeInput({ location: undefined }),
      ids,
      deterministicDeps(),
    );
    expect('location' in aggregate.occurrence).toBe(false);
    expect('location' in logRecord.occurrence).toBe(false);
  });

  it('does not attach origin to standalone input that already carries an unrelated origin (coordinator always uses the new-model origin)', () => {
    const ids = makeIds();
    const inputWithLegacyOrigin = makeInput({
      origin: { type: 'self_posted_calendar_session', sessionId: 's1', occurrenceDateISO: '2026-07-30' },
    });
    const { logRecord } = buildUnplannedTrainingRecords(inputWithLegacyOrigin, ids, deterministicDeps());
    expect(logRecord.origin).toEqual({
      type: 'new_model_calendar_entry',
      aggregateId: ids.aggregateId,
      occurrenceId: ids.occurrenceId,
    });
  });
});

// ──────────────────────────────────────────────
// Direct current-shape parity — pins the exact persisted semantic output,
// including the deliberately DIVERGENT aggregate vs TrainingLog snapshots
// (contract Section E). This must FAIL if any persisted field silently
// changes. Duration-only input (as the real "Log træning" form produces).
// ──────────────────────────────────────────────

describe('buildUnplannedTrainingRecords — current-shape parity (duration-only, real-flow)', () => {
  const NOW = '2026-07-30T20:00:00.000Z';
  const parityDeps = () => ({ nowISO: () => NOW, now: () => new Date('2026-12-31T23:59:59.000Z') });

  function fixedIds() {
    return { aggregateId: 'agg_1', occurrenceId: 'occ_1', calendarEntryId: 'ce_1', logRecordId: 'log_1' };
  }

  function durationInput(): CompletedSelfPostedTrainingInput {
    return {
      title: 'Solo Run',
      discipline: 'Fysisk træning',
      dateISO: '2026-07-30',
      start: '17:00',
      durationMinutes: 90,
      location: 'Park',
      userId: 'fighter@example.com',
      intensity: 3,
      notes: 'Tempo intervals',
    };
  }

  it('aggregate: canonical local-safe occurrence, no hasLogs, CalendarEntry WITH userId', () => {
    const { aggregate } = buildUnplannedTrainingRecords(durationInput(), fixedIds(), parityDeps());
    expect(aggregate).toEqual({
      id: 'agg_1',
      userId: 'fighter@example.com',
      occurrence: {
        id: 'occ_1',
        seriesId: null,
        type: 'self_posted_training',
        title: 'Solo Run',
        startDateTime: '2026-07-30T17:00:00',
        endDateTime: '2026-07-30T18:30:00', // local-safe
        status: 'completed',
        discipline: 'Fysisk træning',
        location: 'Park',
      },
      calendarEntry: {
        id: 'ce_1',
        occurrenceId: 'occ_1',
        status: 'completed',
        userId: 'fighter@example.com', // present on the aggregate
      },
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
      logRecordId: 'log_1',
    });
    expect('hasLogs' in aggregate.occurrence).toBe(false);
  });

  it('TrainingLog: retains its current divergent snapshot (UTC end, hasLogs, CalendarEntry WITHOUT userId)', () => {
    const { logRecord } = buildUnplannedTrainingRecords(durationInput(), fixedIds(), parityDeps());
    // Expected UTC end computed the same way the current builder does — TZ-independent.
    const expectedLogEnd = new Date(new Date('2026-07-30T17:00:00').getTime() + 90 * 60000).toISOString();

    expect(logRecord.id).toBe('log_1');
    expect(logRecord.occurrence.id).toBe('occ_1');
    expect(logRecord.occurrence.startDateTime).toBe('2026-07-30T17:00:00');
    expect(logRecord.occurrence.endDateTime).toBe(expectedLogEnd); // UTC/ISO — divergent from aggregate
    expect(logRecord.occurrence.hasLogs).toBe(true); // divergent from aggregate
    expect(logRecord.occurrence.discipline).toBe('Fysisk træning');
    expect(logRecord.occurrence.location).toBe('Park');

    expect(logRecord.calendarEntry).toEqual({ id: 'ce_1', occurrenceId: 'occ_1', status: 'completed' });
    expect('userId' in logRecord.calendarEntry).toBe(false); // divergent from aggregate

    expect(logRecord.log.intensity).toBe(3);
    expect(logRecord.log.notes).toBe('Tempo intervals');
    expect(logRecord.log.discipline).toBe('Fysisk træning');
    expect(logRecord.origin).toEqual({ type: 'new_model_calendar_entry', aggregateId: 'agg_1', occurrenceId: 'occ_1' });
    expect(logRecord.createdAt).toBe(NOW);
    expect(logRecord.updatedAt).toBe(NOW);
  });

  it('proves the divergence explicitly: aggregate end is local, log end is UTC, and they differ', () => {
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(durationInput(), fixedIds(), parityDeps());
    expect(aggregate.occurrence.endDateTime.endsWith('Z')).toBe(false);
    expect(logRecord.occurrence.endDateTime.endsWith('Z')).toBe(true);
    expect(aggregate.occurrence.endDateTime).not.toBe(logRecord.occurrence.endDateTime);
    expect('hasLogs' in aggregate.occurrence).toBe(false);
    expect(logRecord.occurrence.hasLogs).toBe(true);
    expect('userId' in aggregate.calendarEntry).toBe(true);
    expect('userId' in logRecord.calendarEntry).toBe(false);
  });

  it('omits undefined optional fields on both records (no location supplied)', () => {
    const { aggregate, logRecord } = buildUnplannedTrainingRecords(
      { ...durationInput(), location: undefined },
      fixedIds(),
      parityDeps(),
    );
    expect('location' in aggregate.occurrence).toBe(false);
    expect('location' in logRecord.occurrence).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = durationInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    buildUnplannedTrainingRecords(input, fixedIds(), parityDeps());
    expect(input).toEqual(snapshot);
  });
});
