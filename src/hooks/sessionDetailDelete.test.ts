import { describe, it, expect } from 'vitest';
import {
  computeSessionDetailDeleteThis,
  computeSessionDetailDeleteThisAndFuture,
} from './sessionDetailDelete';
import { sessionNoteKey } from './noteKeys';
import { getDateForWeekDay } from '../utils/dateUtils';

// Phase 2b bug fix: SessionDetailSheet (mobile bottom sheet) previously did its
// own raw `.filter()` delete, bypassing log protection entirely. Manual
// verification (Test 3) found a noted FUTURE occurrence was hard-deleted by
// "this and future". These tests reproduce that failure and pin the fix:
// SessionDetailSheet must route through the same protected-delete decision as
// useSessionHandlers (decideOccurrenceDeletion + applyProtectedDelete).

function noteKeyFor(weekNum: number, dayName: string, sessionId: string): string {
  const dateISO = getDateForWeekDay(weekNum, dayName)!.toISOString().slice(0, 10);
  return sessionNoteKey(dateISO, sessionId);
}

describe('computeSessionDetailDeleteThis (single "this" delete)', () => {
  it('soft-cancels (preserves) a noted session instead of removing it', () => {
    const weekNum = 30;
    const day = 'Mandag';
    const noted = { id: 's1', name: 'Muay Thai', start: '18:00', status: 'active' };
    const multiWeekData = { [weekNum]: { [day]: [noted] } };
    const key = noteKeyFor(weekNum, day, 's1');
    const getNote = (k: string) => (k === key ? 'Great sparring session' : '');

    const result = computeSessionDetailDeleteThis({ multiWeekData, day, weekNum, sessionId: 's1', getNote });

    expect(result).not.toBeNull();
    expect(result!.entries).toHaveLength(1);
    expect(result!.entries[0]).toMatchObject({ id: 's1', name: 'Muay Thai', start: '18:00', status: 'cancelled' });
    // note key linkage remains valid — same key still resolves the note
    expect(getNote(noteKeyFor(weekNum, day, result!.entries[0].id))).toBe('Great sparring session');
  });

  it('removes an unnoted session as before', () => {
    const weekNum = 30;
    const day = 'Mandag';
    const unnoted = { id: 's2', name: 'BJJ', start: '19:00', status: 'active' };
    const multiWeekData = { [weekNum]: { [day]: [unnoted] } };
    const getNote = () => '';

    const result = computeSessionDetailDeleteThis({ multiWeekData, day, weekNum, sessionId: 's2', getNote });

    expect(result).not.toBeNull();
    expect(result!.entries).toHaveLength(0);
  });
});

describe('computeSessionDetailDeleteThisAndFuture (mobile "this and future" delete)', () => {
  it('preserves a noted FUTURE occurrence and removes unnoted matching future occurrences; past untouched', () => {
    const fromWeek = 30;
    const pastWeek = 29;
    const futureNotedWeek = 32;
    const futureUnnotedWeek = 33;
    const day = 'Mandag';
    const name = 'Muay Thai';
    const start = '18:00';

    const mkEntry = (id: string) => ({ id, name, start, status: 'active' });

    const multiWeekData: Record<number, any> = {
      [pastWeek]: { [day]: [mkEntry('past1')] },
      [fromWeek]: { [day]: [mkEntry('from1')] },
      [futureNotedWeek]: { [day]: [mkEntry('noted1')] },
      [futureUnnotedWeek]: { [day]: [mkEntry('unnoted1')] },
    };

    const notedKey = noteKeyFor(futureNotedWeek, day, 'noted1');
    const getNote = (k: string) => (k === notedKey ? 'Logged this training' : '');

    const { changes, deletedCount, preservedCount } = computeSessionDetailDeleteThisAndFuture({
      multiWeekData, day, weekNum: fromWeek, nameLC: name.toLowerCase(), startTime: start, getNote,
    });

    // Past week must never appear in the results at all.
    expect(changes.find(r => r.weekNum === pastWeek)).toBeUndefined();

    // The starting week's occurrence (unnoted) is hard-deleted (removed).
    const fromResult = changes.find(r => r.weekNum === fromWeek);
    expect(fromResult).toBeDefined();
    expect(fromResult!.entries).toHaveLength(0);

    // The noted future occurrence is preserved and soft-cancelled, NOT removed.
    const notedResult = changes.find(r => r.weekNum === futureNotedWeek);
    expect(notedResult).toBeDefined();
    expect(notedResult!.entries).toHaveLength(1);
    expect(notedResult!.entries[0]).toMatchObject({ id: 'noted1', status: 'cancelled' });

    // The unnoted future occurrence is removed as before.
    const unnotedResult = changes.find(r => r.weekNum === futureUnnotedWeek);
    expect(unnotedResult).toBeDefined();
    expect(unnotedResult!.entries).toHaveLength(0);

    // Counts: 2 unnoted removed (from1 + unnoted1), 1 noted preserved (noted1).
    expect(deletedCount).toBe(2);
    expect(preservedCount).toBe(1);
  });

  it('reports deletedCount with preservedCount 0 when no occurrence is noted', () => {
    const fromWeek = 30;
    const futureWeek = 31;
    const day = 'Mandag';
    const name = 'Muay Thai';
    const start = '18:00';
    const mkEntry = (id: string) => ({ id, name, start, status: 'active' });
    const multiWeekData: Record<number, any> = {
      [fromWeek]: { [day]: [mkEntry('a')] },
      [futureWeek]: { [day]: [mkEntry('b')] },
    };
    const getNote = () => '';

    const { changes, deletedCount, preservedCount } = computeSessionDetailDeleteThisAndFuture({
      multiWeekData, day, weekNum: fromWeek, nameLC: name.toLowerCase(), startTime: start, getNote,
    });

    expect(changes.every(r => r.entries.length === 0)).toBe(true);
    expect(deletedCount).toBe(2);
    expect(preservedCount).toBe(0);
  });

  it('is a no-op (no changed weeks, zero counts) when there is nothing to delete', () => {
    const weekNum = 30;
    const day = 'Mandag';
    const multiWeekData = { [weekNum]: { [day]: [{ id: 'x', name: 'Other class', start: '17:00', status: 'active' }] } };
    const getNote = () => '';

    const { changes, deletedCount, preservedCount } = computeSessionDetailDeleteThisAndFuture({
      multiWeekData, day, weekNum, nameLC: 'muay thai', startTime: '18:00', getNote,
    });

    expect(changes).toHaveLength(0);
    expect(deletedCount).toBe(0);
    expect(preservedCount).toBe(0);
  });
});
