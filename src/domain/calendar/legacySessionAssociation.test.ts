import { describe, it, expect } from 'vitest';
import {
  dayNameForOccurrenceDateISO,
  legacyWeekNumberForOccurrenceDateISO,
  findSessionByExactId,
  adaptLegacySessionTiming,
  resolveLegacySessionTimingFromWeekData,
} from './legacySessionAssociation';
import type { TrainingSession } from '../../types/common';

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'sess-1',
    day: 'Torsdag',
    name: 'MMA Sparring',
    category: 'MMA',
    start: '17:00',
    end: '18:30',
    location: 'Klub A',
    status: 'active',
    ...overrides,
  };
}

describe('dayNameForOccurrenceDateISO', () => {
  it('resolves a Thursday date to Torsdag', () => {
    // 2026-07-30 is a Thursday.
    expect(dayNameForOccurrenceDateISO('2026-07-30')).toBe('Torsdag');
  });

  it('resolves a Sunday date to Søndag', () => {
    // 2026-08-02 is a Sunday.
    expect(dayNameForOccurrenceDateISO('2026-08-02')).toBe('Søndag');
  });

  it('resolves a Monday date to Mandag', () => {
    // 2026-08-03 is a Monday.
    expect(dayNameForOccurrenceDateISO('2026-08-03')).toBe('Mandag');
  });

  it('returns null for a malformed date', () => {
    expect(dayNameForOccurrenceDateISO('not-a-date')).toBeNull();
  });
});

describe('findSessionByExactId', () => {
  it('finds the session with an exact string id match', () => {
    const sessions = [makeSession({ id: 'sess-1' }), makeSession({ id: 'sess-2' })];
    expect(findSessionByExactId(sessions, 'sess-2')?.id).toBe('sess-2');
  });

  it('matches a numeric session id against a string identity', () => {
    const sessions = [makeSession({ id: 42 })];
    expect(findSessionByExactId(sessions, '42')?.id).toBe(42);
  });

  it('returns null when no session matches (never fuzzy)', () => {
    const sessions = [makeSession({ id: 'sess-1' })];
    expect(findSessionByExactId(sessions, 'sess-OTHER')).toBeNull();
  });

  it('returns null for a missing/undefined day-sessions array', () => {
    expect(findSessionByExactId(undefined, 'sess-1')).toBeNull();
    expect(findSessionByExactId(null, 'sess-1')).toBeNull();
  });

  it('does not match by title, time, or discipline when id differs', () => {
    const sessions = [makeSession({ id: 'sess-1', name: 'MMA Sparring', start: '17:00', category: 'MMA' })];
    expect(findSessionByExactId(sessions, 'sess-DIFFERENT')).toBeNull();
  });
});

describe('adaptLegacySessionTiming', () => {
  it('derives local start/end from the session and occurrence date', () => {
    const timing = adaptLegacySessionTiming(makeSession({ start: '17:00', end: '18:30' }), '2026-07-30');
    expect(timing).toEqual({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
  });
});

describe('legacyWeekNumberForOccurrenceDateISO', () => {
  it('resolves the ISO week number for a date', () => {
    expect(legacyWeekNumberForOccurrenceDateISO('2026-07-30')).toBe(31);
  });

  it('resolves two dates in the same ISO week to the same week number', () => {
    const a = legacyWeekNumberForOccurrenceDateISO('2026-07-27'); // Monday
    const b = legacyWeekNumberForOccurrenceDateISO('2026-07-30'); // Thursday, same week
    expect(a).toBe(b);
  });

  it('returns null for a malformed date', () => {
    expect(legacyWeekNumberForOccurrenceDateISO('not-a-date')).toBeNull();
  });
});

describe('resolveLegacySessionTimingFromWeekData', () => {
  const weekData = {
    Torsdag: [
      { id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30', category: 'MMA', location: 'Klub A', status: 'active' },
      { id: 'sess-2', name: 'Grappling', start: '19:00', end: '20:00', category: 'BJJ', location: 'Klub A', status: 'active' },
    ],
  };

  it('resolves exact timing for a session found by exact id on the correct day', () => {
    const timing = resolveLegacySessionTimingFromWeekData(weekData, '2026-07-30', 'sess-1');
    expect(timing).toEqual({ startDateTime: '2026-07-30T17:00:00', endDateTime: '2026-07-30T18:30:00' });
  });

  it('resolves a different session in the same already-loaded week document', () => {
    const timing = resolveLegacySessionTimingFromWeekData(weekData, '2026-07-30', 'sess-2');
    expect(timing).toEqual({ startDateTime: '2026-07-30T19:00:00', endDateTime: '2026-07-30T20:00:00' });
  });

  it('returns null when no session matches the exact id (never fuzzy)', () => {
    expect(resolveLegacySessionTimingFromWeekData(weekData, '2026-07-30', 'sess-OTHER')).toBeNull();
  });

  it('returns null for a session on a different day of the same week (exact day only)', () => {
    expect(resolveLegacySessionTimingFromWeekData({ Fredag: weekData.Torsdag }, '2026-07-30', 'sess-1')).toBeNull();
  });

  it('returns null for a missing week document', () => {
    expect(resolveLegacySessionTimingFromWeekData(null, '2026-07-30', 'sess-1')).toBeNull();
    expect(resolveLegacySessionTimingFromWeekData(undefined, '2026-07-30', 'sess-1')).toBeNull();
  });

  it('returns null for a malformed occurrenceDateISO', () => {
    expect(resolveLegacySessionTimingFromWeekData(weekData, 'not-a-date', 'sess-1')).toBeNull();
  });

  it('returns null when the day has no session array', () => {
    expect(resolveLegacySessionTimingFromWeekData({ Torsdag: undefined }, '2026-07-30', 'sess-1')).toBeNull();
  });
});
