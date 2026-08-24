/**
 * unplannedTrainingService.test.ts — Firebase-aware atomic persistence
 * adapter: mocked `firebase/firestore` (no real Firestore/emulator).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn((..._args: unknown[]) => ({ __ref: _args.join('/') }));
const mockWriteBatch = vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));
vi.mock('../config/firebase', () => ({ db: {} }));

import { persistUnplannedTrainingAtomically, persistIndependentCalendarEntry } from './unplannedTrainingService';
import {
  createSelfPostedOccurrence,
  addOccurrenceToFighterCalendar,
} from '../domain/calendar/selfPostedOperations';
import { assembleNewModelCalendarAggregate } from '../domain/calendar/newModelCalendarAggregate';
import type { NewModelCalendarAggregate, CompletedSelfPostedTrainingLog } from '../domain/calendar/types';

function makeAggregate(overrides: Partial<NewModelCalendarAggregate> = {}): NewModelCalendarAggregate {
  return {
    id: 'agg1',
    userId: 'fighter@example.com',
    occurrence: {
      id: 'occ1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'Solo run',
      startDateTime: '2026-08-14T18:00:00',
      endDateTime: '2026-08-14T19:00:00',
      status: 'completed',
    },
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed', userId: 'fighter@example.com' },
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    schemaVersion: 1,
    logRecordId: 'log1',
    ...overrides,
  };
}

function makeLogRecord(overrides: Partial<CompletedSelfPostedTrainingLog> = {}): CompletedSelfPostedTrainingLog {
  return {
    id: 'log1',
    occurrence: {
      id: 'occ1',
      seriesId: null,
      type: 'self_posted_training',
      title: 'Solo run',
      startDateTime: '2026-08-14T18:00:00',
      endDateTime: '2026-08-14T19:00:00',
      status: 'completed',
    },
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed' },
    log: { id: 'evlog1', occurrenceId: 'occ1', userId: 'fighter@example.com', attended: true },
    origin: { type: 'new_model_calendar_entry', aggregateId: 'agg1', occurrenceId: 'occ1' },
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    ...overrides,
  };
}

function snap(exists: boolean, data?: unknown) {
  return { exists: () => exists, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((..._args: unknown[]) => ({ __ref: _args.join('/') }));
  mockWriteBatch.mockImplementation(() => ({ set: mockBatchSet, commit: mockBatchCommit }));
});

describe('persistUnplannedTrainingAtomically', () => {
  it('requires fighterKey', async () => {
    await expect(
      persistUnplannedTrainingAtomically('', makeAggregate(), makeLogRecord()),
    ).rejects.toThrow(/fighterKey is required/);
  });

  it('requires aggregate.id', async () => {
    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate({ id: '' as unknown as string }), makeLogRecord()),
    ).rejects.toThrow(/aggregate.id is required/);
  });

  it('requires logRecord.id', async () => {
    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord({ id: '' })),
    ).rejects.toThrow(/logRecord.id is required/);
  });

  it('writes exactly the aggregate + log via one batch and commits once', async () => {
    mockBatchCommit.mockResolvedValueOnce(undefined);
    await persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord());

    expect(mockWriteBatch).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('never performs a retry-verification read on a normal successful commit', async () => {
    mockBatchCommit.mockResolvedValueOnce(undefined);
    await persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord());
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('on commit failure, treats an already-persisted identical pair (found by exact id, not a query) as success', async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error('network error'));
    mockGetDoc
      .mockResolvedValueOnce(snap(true, makeAggregate()))
      .mockResolvedValueOnce(snap(true, makeLogRecord()));

    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord()),
    ).resolves.toBeUndefined();

    // Exactly two reads, by the two known document refs — never a collection query.
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it('on commit failure, rethrows if the aggregate does not exist yet', async () => {
    const commitError = new Error('permission-denied');
    mockBatchCommit.mockRejectedValueOnce(commitError);
    mockGetDoc
      .mockResolvedValueOnce(snap(false))
      .mockResolvedValueOnce(snap(true, makeLogRecord()));

    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord()),
    ).rejects.toBe(commitError);
  });

  it('on commit failure, rethrows if the log does not exist yet', async () => {
    const commitError = new Error('permission-denied');
    mockBatchCommit.mockRejectedValueOnce(commitError);
    mockGetDoc
      .mockResolvedValueOnce(snap(true, makeAggregate()))
      .mockResolvedValueOnce(snap(false));

    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord()),
    ).rejects.toBe(commitError);
  });

  it('on commit failure, rethrows when the same ids carry DIFFERENT content (a genuinely different attempt, not idempotent retry)', async () => {
    const commitError = new Error('permission-denied');
    mockBatchCommit.mockRejectedValueOnce(commitError);
    // Existing persisted pair has a different title than what this call intended to write.
    mockGetDoc
      .mockResolvedValueOnce(snap(true, makeAggregate({ occurrence: { ...makeAggregate().occurrence, title: 'DIFFERENT TITLE' } })))
      .mockResolvedValueOnce(snap(true, makeLogRecord({ occurrence: { ...makeLogRecord().occurrence, title: 'DIFFERENT TITLE' } })));

    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord()),
    ).rejects.toBe(commitError);
  });

  it('on commit failure, rethrows when the identity ids themselves do not match (defensive)', async () => {
    const commitError = new Error('permission-denied');
    mockBatchCommit.mockRejectedValueOnce(commitError);
    mockGetDoc
      .mockResolvedValueOnce(snap(true, makeAggregate({ occurrence: { ...makeAggregate().occurrence, id: 'occ_OTHER' } })))
      .mockResolvedValueOnce(snap(true, makeLogRecord()));

    await expect(
      persistUnplannedTrainingAtomically('fighter@example.com', makeAggregate(), makeLogRecord()),
    ).rejects.toBe(commitError);
  });

  it('does not mutate the aggregate or logRecord passed in', async () => {
    mockBatchCommit.mockResolvedValueOnce(undefined);
    const aggregate = makeAggregate();
    const logRecord = makeLogRecord();
    const aggSnapshot = JSON.parse(JSON.stringify(aggregate));
    const logSnapshot = JSON.parse(JSON.stringify(logRecord));
    await persistUnplannedTrainingAtomically('fighter@example.com', aggregate, logRecord);
    expect(aggregate).toEqual(aggSnapshot);
    expect(logRecord).toEqual(logSnapshot);
  });
});

// ──────────────────────────────────────────────
// Independent CalendarEntry persistence (persisted I2): persist an
// already-assembled, LOG-LESS aggregate to calendarEntries only — no eventLogs,
// no batch, no domain construction. Aggregates are built via the canonical
// operations, not reconstructed here.
// ──────────────────────────────────────────────

/** Build a log-less aggregate from the canonical operations (no reconstruction here). */
function makeIndependentAggregateViaCanonicalOps(userId = 'fighter@example.com'): NewModelCalendarAggregate {
  const occurrence = createSelfPostedOccurrence(
    { title: 'Solo run', discipline: 'Fysisk træning', dateISO: '2026-08-14', start: '18:00', end: '19:00' },
    'occ1',
  );
  const calendarEntry = addOccurrenceToFighterCalendar(occurrence, 'entry1', 'completed', userId);
  return assembleNewModelCalendarAggregate({
    aggregateId: 'agg1',
    userId,
    occurrence,
    calendarEntry,
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
  });
}

describe('persistIndependentCalendarEntry', () => {
  it('writes exactly one calendarEntries document (single setDoc, no batch, no eventLogs)', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await persistIndependentCalendarEntry('fighter@example.com', makeIndependentAggregateViaCanonicalOps());
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockWriteBatch).not.toHaveBeenCalled();
    expect(mockBatchSet).not.toHaveBeenCalled();
    // The doc ref was built for the calendarEntries subcollection, never eventLogs.
    const refArgs = mockDoc.mock.calls[mockDoc.mock.calls.length - 1].join('/');
    expect(refArgs).toContain('calendarEntries');
    expect(refArgs).not.toContain('eventLogs');
  });

  it('the written aggregate has no logRecordId', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const aggregate = makeIndependentAggregateViaCanonicalOps();
    await persistIndependentCalendarEntry('fighter@example.com', aggregate);
    const written = mockSetDoc.mock.calls[0][1] as NewModelCalendarAggregate;
    expect('logRecordId' in written).toBe(false);
  });

  it('the document path uses the supplied fighterKey and aggregate id', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await persistIndependentCalendarEntry('fighter@example.com', makeIndependentAggregateViaCanonicalOps());
    const refArgs = mockDoc.mock.calls[mockDoc.mock.calls.length - 1].join('/');
    expect(refArgs).toContain('fighter@example.com');
    expect(refArgs).toContain('calendarEntries/agg1');
  });

  it('persists the EXACT already-built aggregate (same occurrence and CalendarEntry references, not reconstructed)', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const aggregate = makeIndependentAggregateViaCanonicalOps();
    await persistIndependentCalendarEntry('fighter@example.com', aggregate);
    const written = mockSetDoc.mock.calls[0][1] as NewModelCalendarAggregate;
    expect(written).toBe(aggregate);
    expect(written.occurrence).toBe(aggregate.occurrence);
    expect(written.calendarEntry).toBe(aggregate.calendarEntry);
  });

  it('does not mutate the input aggregate', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const aggregate = makeIndependentAggregateViaCanonicalOps();
    const snapshot = JSON.parse(JSON.stringify(aggregate));
    await persistIndependentCalendarEntry('fighter@example.com', aggregate);
    expect(aggregate).toEqual(snapshot);
  });

  it('requires fighterKey', async () => {
    await expect(
      persistIndependentCalendarEntry('', makeIndependentAggregateViaCanonicalOps()),
    ).rejects.toThrow(/fighterKey is required/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('requires aggregate.id', async () => {
    const agg = makeIndependentAggregateViaCanonicalOps();
    await expect(
      persistIndependentCalendarEntry('fighter@example.com', { ...agg, id: '' }),
    ).rejects.toThrow(/aggregate.id is required/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects an aggregate whose userId does not match the fighterKey (fail-fast owner check)', async () => {
    const agg = makeIndependentAggregateViaCanonicalOps('someone-else@example.com');
    await expect(
      persistIndependentCalendarEntry('fighter@example.com', agg),
    ).rejects.toThrow(/userId must match fighterKey/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects an aggregate carrying logRecordId (cannot use the independent path)', async () => {
    const agg = { ...makeIndependentAggregateViaCanonicalOps(), logRecordId: 'log1' };
    await expect(
      persistIndependentCalendarEntry('fighter@example.com', agg),
    ).rejects.toThrow(/must not carry logRecordId/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
