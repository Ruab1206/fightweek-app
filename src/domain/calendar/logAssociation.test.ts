/**
 * logAssociation.test.ts — pure selector: TrainingLogs → matching calendar
 * occurrence. No Firestore, no React.
 */
import { describe, it, expect } from 'vitest';
import { selectLogsForCalendarOccurrence, classifyOccurrenceLogAssociation } from './logAssociation';
import type { CompletedSelfPostedTrainingLog } from './types';

function makeLog(
  id: string,
  overrides: Partial<CompletedSelfPostedTrainingLog> = {},
  occurrenceOverrides: Partial<CompletedSelfPostedTrainingLog['occurrence']> = {},
): CompletedSelfPostedTrainingLog {
  return {
    id,
    occurrence: {
      id: `occ-${id}`,
      seriesId: null,
      type: 'self_posted_training',
      title: 'MMA Sparring',
      startDateTime: '2026-08-14T18:00:00',
      endDateTime: '2026-08-14T19:00:00',
      status: 'completed',
      hasLogs: true,
      ...occurrenceOverrides,
    },
    calendarEntry: { id: `cal-${id}`, occurrenceId: `occ-${id}`, status: 'completed' },
    log: { id: `log-${id}`, occurrenceId: `occ-${id}`, userId: 'fighter@example.com', attended: true },
    createdAt: '2026-08-14T19:05:00.000Z',
    updatedAt: '2026-08-14T19:05:00.000Z',
    ...overrides,
  };
}

const OCCURRENCE = { sessionId: 'sess_1', occurrenceDateISO: '2026-08-14' };

describe('selectLogsForCalendarOccurrence', () => {
  it('returns no matches for an empty log list', () => {
    expect(selectLogsForCalendarOccurrence([], OCCURRENCE)).toEqual([]);
  });

  it('returns no match for a standalone log without origin', () => {
    const standalone = makeLog('1');
    expect(selectLogsForCalendarOccurrence([standalone], OCCURRENCE)).toEqual([]);
  });

  it('returns no match for a different origin type', () => {
    const other = makeLog('1', {
      origin: { type: 'some_other_origin', sessionId: 'sess_1', occurrenceDateISO: '2026-08-14' } as any,
    });
    expect(selectLogsForCalendarOccurrence([other], OCCURRENCE)).toEqual([]);
  });

  it('returns no match for a different sessionId', () => {
    const other = makeLog('1', {
      origin: { type: 'self_posted_calendar_session', sessionId: 'sess_2', occurrenceDateISO: '2026-08-14' },
    });
    expect(selectLogsForCalendarOccurrence([other], OCCURRENCE)).toEqual([]);
  });

  it('returns no match for a different occurrenceDateISO', () => {
    const other = makeLog('1', {
      origin: { type: 'self_posted_calendar_session', sessionId: 'sess_1', occurrenceDateISO: '2026-08-15' },
    });
    expect(selectLogsForCalendarOccurrence([other], OCCURRENCE)).toEqual([]);
  });

  it('returns exactly one matching calendar-originated log', () => {
    const match = makeLog('1', {
      origin: { type: 'self_posted_calendar_session', sessionId: 'sess_1', occurrenceDateISO: '2026-08-14' },
    });
    const unrelated = makeLog('2');
    const result = selectLogsForCalendarOccurrence([match, unrelated], OCCURRENCE);
    expect(result).toEqual([match]);
  });

  it('returns every exact match when multiple logs share the same provenance', () => {
    const origin = { type: 'self_posted_calendar_session' as const, sessionId: 'sess_1', occurrenceDateISO: '2026-08-14' };
    const first = makeLog('1', { origin }, { startDateTime: '2026-08-14T18:00:00', endDateTime: '2026-08-14T19:00:00' });
    const second = makeLog('2', { origin }, { startDateTime: '2026-08-14T20:00:00', endDateTime: '2026-08-14T21:00:00' });
    const result = selectLogsForCalendarOccurrence([first, second], OCCURRENCE);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(['1', '2']);
  });

  it('does not match by identical title/date/time when provenance differs or is absent', () => {
    const noOrigin = makeLog('1', {}, { title: 'MMA Sparring', startDateTime: '2026-08-14T18:00:00', endDateTime: '2026-08-14T19:00:00' });
    const differentOrigin = makeLog('2', {
      origin: { type: 'self_posted_calendar_session', sessionId: 'sess_OTHER', occurrenceDateISO: '2026-08-14' },
    }, { title: 'MMA Sparring', startDateTime: '2026-08-14T18:00:00', endDateTime: '2026-08-14T19:00:00' });
    const result = selectLogsForCalendarOccurrence([noOrigin, differentOrigin], OCCURRENCE);
    expect(result).toEqual([]);
  });

  it('does not mutate the input logs', () => {
    const origin = { type: 'self_posted_calendar_session' as const, sessionId: 'sess_1', occurrenceDateISO: '2026-08-14' };
    const logs = [makeLog('1', { origin }), makeLog('2')];
    const snapshot = JSON.parse(JSON.stringify(logs));
    selectLogsForCalendarOccurrence(logs, OCCURRENCE);
    expect(logs).toEqual(snapshot);
  });

  it('uses deterministic ordering regardless of input order', () => {
    const origin = { type: 'self_posted_calendar_session' as const, sessionId: 'sess_1', occurrenceDateISO: '2026-08-14' };
    const early = makeLog('a', { origin }, { startDateTime: '2026-08-14T06:00:00', endDateTime: '2026-08-14T07:00:00' });
    const mid = makeLog('b', { origin }, { startDateTime: '2026-08-14T12:00:00', endDateTime: '2026-08-14T13:00:00' });
    const late = makeLog('c', { origin }, { startDateTime: '2026-08-14T20:00:00', endDateTime: '2026-08-14T21:00:00' });

    const resultA = selectLogsForCalendarOccurrence([late, early, mid], OCCURRENCE);
    const resultB = selectLogsForCalendarOccurrence([mid, late, early], OCCURRENCE);

    expect(resultA.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(resultB.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('classifyOccurrenceLogAssociation', () => {
  it('classifies idle as loading', () => {
    expect(classifyOccurrenceLogAssociation('idle', [])).toEqual({ kind: 'loading' });
  });

  it('classifies loading as loading', () => {
    expect(classifyOccurrenceLogAssociation('loading', [])).toEqual({ kind: 'loading' });
  });

  it('classifies error as error, regardless of any matches already held', () => {
    expect(classifyOccurrenceLogAssociation('error', [])).toEqual({ kind: 'error' });
    expect(classifyOccurrenceLogAssociation('error', [makeLog('1')])).toEqual({ kind: 'error' });
  });

  it('classifies a resolved load with zero matches as none', () => {
    expect(classifyOccurrenceLogAssociation('loaded', [])).toEqual({ kind: 'none' });
  });

  it('classifies a resolved load with exactly one match as one, carrying exactly that log', () => {
    const match = makeLog('1');
    const result = classifyOccurrenceLogAssociation('loaded', [match]);
    expect(result).toEqual({ kind: 'one', log: match });
  });

  it('classifies a resolved load with multiple matches as conflict, carrying every log', () => {
    const first = makeLog('1');
    const second = makeLog('2');
    const result = classifyOccurrenceLogAssociation('loaded', [first, second]);
    expect(result).toEqual({ kind: 'conflict', logs: [first, second] });
  });

  it('returns a defensive copy of matches for the conflict payload, not the same array reference', () => {
    const matches = [makeLog('1'), makeLog('2')];
    const result = classifyOccurrenceLogAssociation('loaded', matches);
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.logs).toEqual(matches);
      expect(result.logs).not.toBe(matches);
    }
  });

  it('does not mutate the input matches array', () => {
    const matches = [makeLog('1'), makeLog('2')];
    const snapshot = JSON.parse(JSON.stringify(matches));
    classifyOccurrenceLogAssociation('loaded', matches);
    expect(matches).toEqual(snapshot);
  });

  it('only classifies as none when creation should be enabled — every other kind is a distinct, non-none value', () => {
    const creationEligibleKinds = ['idle', 'loading', 'error'].map((status) =>
      classifyOccurrenceLogAssociation(status as any, []).kind,
    );
    expect(creationEligibleKinds.every((kind) => kind !== 'none')).toBe(true);
    expect(classifyOccurrenceLogAssociation('loaded', [makeLog('1')]).kind).not.toBe('none');
    expect(classifyOccurrenceLogAssociation('loaded', [makeLog('1'), makeLog('2')]).kind).not.toBe('none');
    expect(classifyOccurrenceLogAssociation('loaded', []).kind).toBe('none');
  });
});
