import { describe, it, expect } from 'vitest';
import { decideDeletionWithLog, type TrainingLogSignal } from '../domain/calendar/logProtection';
import { deletionLogSignalFor } from '../domain/calendar/logAssociation';
import { decideOccurrenceDeletionWithLog } from './useSessionHandlers';
import { sessionNoteKey } from './noteKeys';
import { getDateForWeekDay } from '../utils/dateUtils';

// Slice 2a deletion-protection correction: single-occurrence delete honours
// BOTH the activity Note AND the independent TrainingLog/EventLog store.

describe('decideDeletionWithLog (pure decision matrix)', () => {
  const cases: Array<[boolean, string, TrainingLogSignal, 'hard-delete' | 'soft-cancel']> = [
    // canResolveKey, note, trainingLog, expected
    [true, '', 'none', 'hard-delete'],          // no note, no log → hard-delete
    [true, 'reflection', 'none', 'soft-cancel'], // note, no log → tombstone
    [true, '', 'present', 'soft-cancel'],        // no note, log present → tombstone
    [true, 'reflection', 'present', 'soft-cancel'], // both → tombstone
    [true, '', 'indeterminate', 'soft-cancel'],  // log status unknown → fail closed
    [false, '', 'none', 'soft-cancel'],          // unresolvable note key → fail closed
    [false, '', 'indeterminate', 'soft-cancel'], // both unresolvable → fail closed
  ];
  for (const [canResolveKey, note, trainingLog, expected] of cases) {
    it(`canResolveKey=${canResolveKey} note=${note ? 'y' : 'n'} log=${trainingLog} → ${expected}`, () => {
      expect(decideDeletionWithLog({ canResolveKey, note, trainingLog })).toBe(expected);
    });
  }

  it('never hard-deletes when a TrainingLog is present, even with an empty note', () => {
    expect(decideDeletionWithLog({ canResolveKey: true, note: '', trainingLog: 'present' })).toBe('soft-cancel');
  });
});

describe('deletionLogSignalFor (classification → delete signal)', () => {
  it("'one' and 'conflict' → present (protect)", () => {
    expect(deletionLogSignalFor({ kind: 'one', log: {} as any })).toBe('present');
    expect(deletionLogSignalFor({ kind: 'conflict', logs: [] })).toBe('present');
  });
  it("'none' → none", () => {
    expect(deletionLogSignalFor({ kind: 'none' })).toBe('none');
  });
  it("'loading' and 'error' → indeterminate (fail closed)", () => {
    expect(deletionLogSignalFor({ kind: 'loading' })).toBe('indeterminate');
    expect(deletionLogSignalFor({ kind: 'error' })).toBe('indeterminate');
  });
});

describe('decideOccurrenceDeletionWithLog (note-key + log composition)', () => {
  const weekNum = 40;
  const day = 'Mandag';
  const noteKeyFor = (id: string) => {
    const dateISO = getDateForWeekDay(weekNum, day)!.toISOString().slice(0, 10);
    return sessionNoteKey(dateISO, id);
  };

  it('hard-deletes an un-noted, un-logged, resolvable occurrence', () => {
    const mode = decideOccurrenceDeletionWithLog({ weekNum, dayName: day, entry: { id: 's1' }, getNote: () => '', trainingLog: 'none' });
    expect(mode).toBe('hard-delete');
  });

  it('soft-cancels when a TrainingLog is present even with no note', () => {
    const mode = decideOccurrenceDeletionWithLog({ weekNum, dayName: day, entry: { id: 's1' }, getNote: () => '', trainingLog: 'present' });
    expect(mode).toBe('soft-cancel');
  });

  it('soft-cancels when only a note exists (existing behavior preserved)', () => {
    const key = noteKeyFor('s1');
    const mode = decideOccurrenceDeletionWithLog({ weekNum, dayName: day, entry: { id: 's1' }, getNote: (k) => (k === key ? 'note' : ''), trainingLog: 'none' });
    expect(mode).toBe('soft-cancel');
  });

  it('soft-cancels when the log signal is indeterminate (fail closed)', () => {
    const mode = decideOccurrenceDeletionWithLog({ weekNum, dayName: day, entry: { id: 's1' }, getNote: () => '', trainingLog: 'indeterminate' });
    expect(mode).toBe('soft-cancel');
  });

  it('soft-cancels when the note key cannot be resolved (unchanged fail-safe)', () => {
    const mode = decideOccurrenceDeletionWithLog({ weekNum, dayName: 'NotADay', entry: { id: 's1' }, getNote: () => '', trainingLog: 'none' });
    expect(mode).toBe('soft-cancel');
  });
});
