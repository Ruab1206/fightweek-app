/**
 * calendarEntryService.test.ts — one-shot owner-scoped read of new-model
 * calendar aggregates, with structured load issues. Mocked Firestore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => ({ __col: _args.join('/') }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
vi.mock('../config/firebase', () => ({ db: {} }));

import { listCalendarEntries } from './calendarEntryService';
import type { NewModelCalendarAggregate } from '../domain/calendar/types';

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
    calendarEntry: { id: 'entry1', occurrenceId: 'occ1', status: 'completed' },
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    schemaVersion: 1,
    logRecordId: 'log1',
    ...overrides,
  };
}

function fakeSnap(docs: Array<{ id: string; data: unknown }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listCalendarEntries', () => {
  it('requires fighterKey', async () => {
    await expect(listCalendarEntries('')).rejects.toThrow(/fighterKey is required/);
  });

  it('returns valid entries with no issues', async () => {
    mockGetDocs.mockResolvedValueOnce(fakeSnap([{ id: 'agg1', data: makeAggregate() }]));
    const result = await listCalendarEntries('fighter@example.com');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('agg1');
    expect(result.issues).toEqual([]);
  });

  it('classifies an unsupported schemaVersion as a structured issue, not an entry', async () => {
    mockGetDocs.mockResolvedValueOnce(fakeSnap([
      { id: 'agg1', data: makeAggregate() },
      { id: 'agg_old', data: makeAggregate({ id: 'agg_old', schemaVersion: 2 as any }) },
    ]));
    const result = await listCalendarEntries('fighter@example.com');
    expect(result.entries.map((e) => e.id)).toEqual(['agg1']);
    expect(result.issues).toEqual([{ id: 'agg_old', reason: 'unsupported_schema_version' }]);
  });

  it('classifies a missing schemaVersion as a structured issue', async () => {
    const { schemaVersion: _omit, ...withoutVersion } = makeAggregate({ id: 'agg_no_version' });
    mockGetDocs.mockResolvedValueOnce(fakeSnap([{ id: 'agg_no_version', data: withoutVersion }]));
    const result = await listCalendarEntries('fighter@example.com');
    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([{ id: 'agg_no_version', reason: 'unsupported_schema_version' }]);
  });

  it('classifies a structurally malformed record (missing occurrence) as invalid_record', async () => {
    const malformed = { ...makeAggregate({ id: 'agg_malformed' }), occurrence: undefined };
    mockGetDocs.mockResolvedValueOnce(fakeSnap([{ id: 'agg_malformed', data: malformed }]));
    const result = await listCalendarEntries('fighter@example.com');
    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([{ id: 'agg_malformed', reason: 'invalid_record' }]);
  });

  it('never renders an invalid record while valid entries remain usable', async () => {
    mockGetDocs.mockResolvedValueOnce(fakeSnap([
      { id: 'agg1', data: makeAggregate({ id: 'agg1' }) },
      { id: 'agg_bad', data: { ...makeAggregate({ id: 'agg_bad' }), occurrence: null } },
      { id: 'agg2', data: makeAggregate({ id: 'agg2', occurrence: { ...makeAggregate().occurrence, startDateTime: '2026-08-15T06:00:00' } }) },
    ]));
    const result = await listCalendarEntries('fighter@example.com');
    expect(result.entries.map((e) => e.id).sort()).toEqual(['agg1', 'agg2']);
    expect(result.issues).toEqual([{ id: 'agg_bad', reason: 'invalid_record' }]);
  });

  it('sorts entries deterministically by occurrence.startDateTime ascending', async () => {
    mockGetDocs.mockResolvedValueOnce(fakeSnap([
      { id: 'agg_later', data: makeAggregate({ id: 'agg_later', occurrence: { ...makeAggregate().occurrence, startDateTime: '2026-08-20T06:00:00' } }) },
      { id: 'agg_earlier', data: makeAggregate({ id: 'agg_earlier', occurrence: { ...makeAggregate().occurrence, startDateTime: '2026-08-10T06:00:00' } }) },
    ]));
    const result = await listCalendarEntries('fighter@example.com');
    expect(result.entries.map((e) => e.id)).toEqual(['agg_earlier', 'agg_later']);
  });

  it('does not perform a write', async () => {
    mockGetDocs.mockResolvedValueOnce(fakeSnap([]));
    await listCalendarEntries('fighter@example.com');
    // Only collection+getDocs are mocked/imported — no setDoc/writeBatch present.
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });
});
