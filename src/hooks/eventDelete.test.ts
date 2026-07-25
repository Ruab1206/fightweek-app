import { describe, it, expect } from 'vitest';
import { buildEventNoteKey, decideEventDeletion, isEventCancelled } from './eventDelete';
import { eventNoteKey } from './noteKeys';

// Phase 2b Step 3 — event log protection (pure helpers only; see plan for why
// DOM/component badge rendering is not tested here: no jsdom env in the repo).

describe('buildEventNoteKey (pins the existing e_{eventId} convention)', () => {
  it('builds e_{id} and delegates to eventNoteKey', () => {
    const { key, canResolveKey } = buildEventNoteKey('evt_1');
    expect(canResolveKey).toBe(true);
    expect(key).toBe('e_evt_1');
    expect(key).toBe(eventNoteKey('evt_1'));
  });

  it('fails safe (canResolveKey=false) when the id is missing/empty', () => {
    expect(buildEventNoteKey(undefined)).toEqual({ key: null, canResolveKey: false });
    expect(buildEventNoteKey(null)).toEqual({ key: null, canResolveKey: false });
    expect(buildEventNoteKey('')).toEqual({ key: null, canResolveKey: false });
  });
});

describe('decideEventDeletion', () => {
  it('#1 returns soft-cancel for an event with an e_{id} note', () => {
    const getNote = (k: string) => (k === 'e_evt_1' ? 'DM result: 2-1 win' : '');
    expect(decideEventDeletion({ eventId: 'evt_1', getNote })).toBe('soft-cancel');
  });

  it('#2 returns hard-delete for an event without a note', () => {
    const getNote = () => '';
    expect(decideEventDeletion({ eventId: 'evt_1', getNote })).toBe('hard-delete');
  });

  it('#3 returns soft-cancel (fail-safe) when the event id is missing/empty', () => {
    const getNote = () => '';
    expect(decideEventDeletion({ eventId: undefined, getNote })).toBe('soft-cancel');
    expect(decideEventDeletion({ eventId: '', getNote })).toBe('soft-cancel');
  });
});

describe('isEventCancelled', () => {
  it('#5 is true only when status === "cancelled"', () => {
    expect(isEventCancelled({ status: 'cancelled' })).toBe(true);
    expect(isEventCancelled({ status: 'active' })).toBe(false);
    expect(isEventCancelled({})).toBe(false);
    expect(isEventCancelled(undefined)).toBe(false);
    expect(isEventCancelled(null)).toBe(false);
  });
});
