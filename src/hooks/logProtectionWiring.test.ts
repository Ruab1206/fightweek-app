import { describe, it, expect, vi } from 'vitest';
import {
  buildSessionNoteKey,
  decideOccurrenceDeletion,
  softCancelEntry,
  applyProtectedDelete,
  decideFraværGroupProtection,
} from './useSessionHandlers';
import { sessionNoteKey } from './noteKeys';
import { getDateForWeekDay } from '../utils/dateUtils';

// Phase 2b Step 2 — log protection wired into session/fravær delete paths.
// These test the PURE helpers the handlers delegate to (same pattern as the
// existing computeDeleteFutureWeeks / resolveWeekSourceData helper tests).

// ──────────────────────────────────────────────
// #7 Pin the note-key date format (getDateForWeekDay(...).toISOString().slice(0,10))
// ──────────────────────────────────────────────

describe('buildSessionNoteKey (pins the existing note-key convention)', () => {
  it('uses s_{getDateForWeekDay(...).toISOString().slice(0,10)}_{id}', () => {
    const weekNum = 25;
    const dayName = 'Mandag';
    const dateISO = getDateForWeekDay(weekNum, dayName)!.toISOString().slice(0, 10);
    const { key, canResolveKey } = buildSessionNoteKey({ weekNum, dayName, sessionId: 'abc' });
    expect(canResolveKey).toBe(true);
    expect(key).toBe(`s_${dateISO}_abc`);
    // and it delegates to the shared sessionNoteKey builder
    expect(key).toBe(sessionNoteKey(dateISO, 'abc'));
  });

  it('fails safe (canResolveKey=false) when the id is missing', () => {
    expect(buildSessionNoteKey({ weekNum: 25, dayName: 'Mandag', sessionId: undefined }))
      .toEqual({ key: null, canResolveKey: false });
    expect(buildSessionNoteKey({ weekNum: 25, dayName: 'Mandag', sessionId: '' }))
      .toEqual({ key: null, canResolveKey: false });
  });

  it('fails safe (canResolveKey=false) when the day cannot be resolved to a date', () => {
    expect(buildSessionNoteKey({ weekNum: 25, dayName: 'NotADay', sessionId: 'abc' }))
      .toEqual({ key: null, canResolveKey: false });
  });
});

// ──────────────────────────────────────────────
// decideOccurrenceDeletion — soft-cancel vs hard-delete
// ──────────────────────────────────────────────

describe('decideOccurrenceDeletion', () => {
  const weekNum = 25;
  const dayName = 'Mandag';
  const dateISO = getDateForWeekDay(weekNum, dayName)!.toISOString().slice(0, 10);

  it('#1 soft-cancels a session that has a note', () => {
    const getNote = (k: string) => (k === sessionNoteKey(dateISO, 's1') ? 'Sparred well' : '');
    const mode = decideOccurrenceDeletion({ weekNum, dayName, entry: { id: 's1' }, getNote });
    expect(mode).toBe('soft-cancel');
  });

  it('#2 hard-deletes a session with no note', () => {
    const getNote = () => '';
    const mode = decideOccurrenceDeletion({ weekNum, dayName, entry: { id: 's1' }, getNote });
    expect(mode).toBe('hard-delete');
  });

  it('#3 soft-cancels when the id is missing (unresolvable key, fail-safe)', () => {
    const getNote = () => '';
    const mode = decideOccurrenceDeletion({ weekNum, dayName, entry: { id: undefined }, getNote });
    expect(mode).toBe('soft-cancel');
  });

  it('#3b soft-cancels when the day cannot resolve a date (fail-safe)', () => {
    const getNote = () => '';
    const mode = decideOccurrenceDeletion({ weekNum, dayName: 'NotADay', entry: { id: 's1' }, getNote });
    expect(mode).toBe('soft-cancel');
  });
});

// ──────────────────────────────────────────────
// softCancelEntry — preserve the FULL object (invariants 4, 5, 7, 8)
// ──────────────────────────────────────────────

describe('softCancelEntry', () => {
  it('sets status/cancellationTime and preserves every other field', () => {
    const entry = {
      id: 's1',
      day: 'Mandag',
      name: 'MMA Elite',
      category: 'MMA',
      start: '17:00',
      end: '18:30',
      location: 'Fightworld',
      status: 'active',
      catalogueClassId: 'cls_1',
      isRecurring: true,
      sessionDate: '2026-06-15T15:00:00.000Z',
      description: 'keep me',
      customMeta: { foo: 'bar' },
    };
    const out = softCancelEntry(entry, '2026-07-24T10:00:00.000Z');
    expect(out).toEqual({
      ...entry,
      status: 'cancelled',
      cancellationReason: 'Aflyst',
      cancellationTime: '2026-07-24T10:00:00.000Z',
    });
    // original not mutated
    expect(entry.status).toBe('active');
  });

  it('keeps an existing cancellationReason rather than overwriting it', () => {
    const entry = { id: 's1', status: 'active', cancellationReason: 'Skadet' };
    const out = softCancelEntry(entry, '2026-07-24T10:00:00.000Z');
    expect(out.cancellationReason).toBe('Skadet');
  });
});

// ──────────────────────────────────────────────
// applyProtectedDelete — session single + this-and-future array behavior
// ──────────────────────────────────────────────

describe('applyProtectedDelete', () => {
  const now = '2026-07-24T10:00:00.000Z';

  it('#1 retains + soft-cancels a noted target, leaving non-targets untouched', () => {
    const other = { id: 'x', name: 'BJJ', status: 'active' };
    const target = { id: 's1', name: 'MMA', status: 'active', description: 'keep' };
    const { entries, changed } = applyProtectedDelete({
      entries: [other, target],
      isTarget: (s) => s.id === 's1',
      decide: () => 'soft-cancel',
      cancellationTime: now,
    });
    expect(changed).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toBe(other); // untouched reference
    expect(entries[1]).toMatchObject({ id: 's1', status: 'cancelled', description: 'keep' });
  });

  it('#2 removes an unnoted target (hard-delete) as before', () => {
    const target = { id: 's1', name: 'MMA', status: 'active' };
    const { entries, changed } = applyProtectedDelete({
      entries: [target],
      isTarget: (s) => s.id === 's1',
      decide: () => 'hard-delete',
      cancellationTime: now,
    });
    expect(changed).toBe(true);
    expect(entries).toHaveLength(0);
  });

  it('#4 this-and-future: soft-cancels noted occurrences and removes unnoted matched ones', () => {
    const notedWeek = { id: 'a', name: 'MMA', start: '17:00', status: 'active' };
    const unnotedWeek = { id: 'b', name: 'MMA', start: '17:00', status: 'active' };
    const restDay = { id: 'r', isRestDay: true };
    const decide = (s: any) => (s.id === 'a' ? 'soft-cancel' : 'hard-delete');
    const { entries } = applyProtectedDelete({
      entries: [notedWeek, unnotedWeek, restDay],
      isTarget: (s) => !s.isRestDay && (s.name || '').toLowerCase() === 'mma' && s.start === '17:00',
      decide,
      cancellationTime: now,
    });
    // noted occurrence kept + cancelled; unnoted removed; rest day preserved
    expect(entries.map((e: any) => e.id)).toEqual(['a', 'r']);
    expect(entries[0]).toMatchObject({ id: 'a', status: 'cancelled' });
  });

  it('does not double-cancel an already-cancelled target (no change)', () => {
    const target = { id: 's1', status: 'cancelled', cancellationTime: 'earlier' };
    const { entries, changed } = applyProtectedDelete({
      entries: [target],
      isTarget: (s) => s.id === 's1',
      decide: () => 'soft-cancel',
      cancellationTime: now,
    });
    expect(changed).toBe(false);
    expect(entries[0]).toBe(target);
  });
});

// ──────────────────────────────────────────────
// decideFraværGroupProtection — whole-group semantics
// ──────────────────────────────────────────────

describe('decideFraværGroupProtection', () => {
  const weekNum = 25;
  const dayName = 'Mandag';
  const dateISO = getDateForWeekDay(weekNum, dayName)!.toISOString().slice(0, 10);

  it('#5 protects the whole group when ANY day has a note', () => {
    const getNote = vi.fn((k: string) => (k === sessionNoteKey(dateISO, 'd2') ? 'logged' : ''));
    const matches = [
      { weekNum, dayName, entry: { id: 'd1' } },
      { weekNum, dayName, entry: { id: 'd2' } },
    ];
    expect(decideFraværGroupProtection({ matches, getNote })).toBe(true);
  });

  it('#6 does not protect a group with no notes and all keys resolvable', () => {
    const getNote = () => '';
    const matches = [
      { weekNum, dayName, entry: { id: 'd1' } },
      { weekNum, dayName, entry: { id: 'd2' } },
    ];
    expect(decideFraværGroupProtection({ matches, getNote })).toBe(false);
  });

  it('protects (fail-safe) when any matched day has an unresolvable note key', () => {
    const getNote = () => '';
    const matches = [
      { weekNum, dayName, entry: { id: 'd1' } },
      { weekNum, dayName, entry: { id: undefined } }, // unresolvable
    ];
    expect(decideFraværGroupProtection({ matches, getNote })).toBe(true);
  });
});
