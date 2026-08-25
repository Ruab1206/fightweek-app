/**
 * logExistingCalendarEntryCoordinator.test.ts — application-layer capability
 * for creating a TrainingLog against an already-existing independent
 * CalendarEntry aggregate. Pure — no Firebase, no React, no hooks. Injected
 * persistence is mocked; no Firestore mocks (the composition itself performs
 * no Firestore access).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  addTrainingLogForExistingCalendarEntry,
  type LogAgainstExistingCalendarEntryDeps,
} from './logExistingCalendarEntryCoordinator';
import { createSelfPostedOccurrence, addOccurrenceToFighterCalendar } from './selfPostedOperations';
import type { CompletedSelfPostedTrainingInput } from './selfPostedTraining';
import type { CompletedSelfPostedTrainingLog, NewModelCalendarAggregate } from './types';

const FIGHTER_KEY = 'fighter@example.com';

function makeExistingAggregate(overrides: Partial<NewModelCalendarAggregate> = {}): NewModelCalendarAggregate {
  const occurrence = createSelfPostedOccurrence(
    { title: 'Solo run', discipline: 'Fysisk træning', dateISO: '2026-08-14', start: '18:00', end: '19:00' },
    'occ_existing',
  );
  const calendarEntry = addOccurrenceToFighterCalendar(occurrence, 'entry_existing', 'completed', FIGHTER_KEY);
  return {
    id: 'agg_existing',
    userId: FIGHTER_KEY,
    occurrence,
    calendarEntry,
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    schemaVersion: 1,
    // no logRecordId — independent entry
    ...overrides,
  };
}

function makeInput(overrides: Partial<CompletedSelfPostedTrainingInput> = {}): CompletedSelfPostedTrainingInput {
  return {
    title: 'Reflecting on my run',
    dateISO: '2026-08-14',
    start: '18:00',
    end: '19:00',
    discipline: 'Fysisk træning',
    notes: 'Felt strong',
    intensity: 3,
    ...overrides,
  };
}

function createMockDeps(overrides?: Partial<LogAgainstExistingCalendarEntryDeps>) {
  const persist = vi.fn<[string, CompletedSelfPostedTrainingLog], Promise<string>>(
    async (_, record) => record.id,
  );
  return {
    persist,
    generateId: (() => {
      let n = 0;
      return () => `id_${++n}`;
    })(),
    nowISO: () => '2026-08-14T20:00:00.000Z',
    now: () => new Date('2026-12-31T23:59:59.000Z'),
    ...overrides,
  };
}

describe('addTrainingLogForExistingCalendarEntry', () => {
  it('supplies the exact aggregate occurrence to the TrainingLog builder path (same values, not reconstructed; hasLogs is the existing documented TrainingLog-snapshot marker)', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();

    await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    const record = deps.persist.mock.calls[0][1];
    // Formed directly from aggregate.occurrence (adding only the pre-existing hasLogs marker) — not reconstructed from form input.
    expect(record.occurrence).toEqual({ ...aggregate.occurrence, hasLogs: true });
    expect(record.occurrence.startDateTime).toBe(aggregate.occurrence.startDateTime);
    expect(record.occurrence.endDateTime).toBe(aggregate.occurrence.endDateTime);
  });

  it('uses aggregate.occurrence.id and aggregate.calendarEntry.id in the resulting snapshot', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();

    await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    const record = deps.persist.mock.calls[0][1];
    expect(record.occurrence.id).toBe(aggregate.occurrence.id);
    expect(record.calendarEntry.id).toBe(aggregate.calendarEntry.id);
  });

  it('creates origin using aggregate.id and aggregate.occurrence.id, matching the existing new_model_calendar_entry provenance shape', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();

    await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    const record = deps.persist.mock.calls[0][1];
    expect(record.origin).toEqual({
      type: 'new_model_calendar_entry',
      aggregateId: aggregate.id,
      occurrenceId: aggregate.occurrence.id,
    });
  });

  it('generates only TrainingLog-owned identity (record id and the internal EventLog id) — no aggregate/occurrence/calendarEntry id is minted', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();

    const logId = await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    const record = deps.persist.mock.calls[0][1];
    // Record id and the internal log.id are the only newly generated identities.
    expect(logId).toBe(record.id);
    expect(record.id).not.toBe(aggregate.id);
    expect(record.log.id).toBeDefined();
    expect(record.log.id).not.toBe(record.id);
    // Everything else traces back to the existing aggregate, never freshly minted.
    expect(record.occurrence.id).toBe(aggregate.occurrence.id);
    expect(record.calendarEntry.id).toBe(aggregate.calendarEntry.id);
  });

  it('rejects an aggregate carrying logRecordId before calling persist', async () => {
    const aggregate = makeExistingAggregate({ logRecordId: 'already_paired_log' });
    const deps = createMockDeps();

    await expect(
      addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps),
    ).rejects.toThrow(/logRecordId/);
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it('calls persist exactly once with the completed record', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();

    await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    expect(deps.persist).toHaveBeenCalledTimes(1);
    expect(deps.persist.mock.calls[0][0]).toBe(FIGHTER_KEY);
  });

  it('propagates a validation failure and never calls persist', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();
    const invalidInput = makeInput({ title: '' });

    await expect(
      addTrainingLogForExistingCalendarEntry(invalidInput, aggregate, FIGHTER_KEY, deps),
    ).rejects.toThrow(/validation failed/);
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it('does not mutate the form input', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();
    const input = makeInput();
    const snapshot = JSON.parse(JSON.stringify(input));

    await addTrainingLogForExistingCalendarEntry(input, aggregate, FIGHTER_KEY, deps);

    expect(input).toEqual(snapshot);
  });

  it('does not mutate the aggregate, its occurrence, or its calendarEntry', async () => {
    const aggregate = makeExistingAggregate();
    const snapshot = JSON.parse(JSON.stringify(aggregate));
    const deps = createMockDeps();

    await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    expect(aggregate).toEqual(snapshot);
  });

  it('reconstructs no EventOccurrence or CalendarEntry — snapshot fields trace to the aggregate, not to a fresh construction from form input', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();
    // Deliberately mismatched form-input timing — if the composition reconstructed
    // the occurrence from input instead of reusing the aggregate's, the snapshot
    // would reflect these different values.
    const input = makeInput({ start: '05:00', end: '06:00' });

    await addTrainingLogForExistingCalendarEntry(input, aggregate, FIGHTER_KEY, deps);

    const record = deps.persist.mock.calls[0][1];
    expect(record.occurrence.startDateTime).toBe(aggregate.occurrence.startDateTime);
    expect(record.occurrence.endDateTime).toBe(aggregate.occurrence.endDateTime);
  });

  it('performs no calendarEntries write (persist is called only for the TrainingLog; deps exposes no aggregate-write capability)', async () => {
    const aggregate = makeExistingAggregate();
    const deps = createMockDeps();

    await addTrainingLogForExistingCalendarEntry(makeInput(), aggregate, FIGHTER_KEY, deps);

    // The only injected capability is the TrainingLog persist function, called once.
    expect(deps.persist).toHaveBeenCalledTimes(1);
  });
});
