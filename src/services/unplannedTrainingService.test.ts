/**
 * unplannedTrainingService.test.ts — Firebase-aware atomic persistence
 * adapter: mocked `firebase/firestore` (no real Firestore/emulator).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((..._args: unknown[]) => ({ __ref: _args.join('/') }));
const mockWriteBatch = vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));
vi.mock('../config/firebase', () => ({ db: {} }));

import { persistUnplannedTrainingAtomically } from './unplannedTrainingService';
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
