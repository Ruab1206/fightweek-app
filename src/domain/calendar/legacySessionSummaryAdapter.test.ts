/**
 * legacySessionSummaryAdapter.test.ts — pure adapter mapping a legacy
 * self-posted `TrainingSession` to the smaller `CalendarItemSummary`
 * rendering contract (see calendarItemSummary.ts). No Firebase, no React,
 * no routing.
 */
import { describe, it, expect } from 'vitest';
import { mapLegacySessionToCalendarItemSummary, type LegacySessionSummaryContext } from './legacySessionSummaryAdapter';
import type { TrainingSession } from '../../types/common';

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'sess_1',
    day: 'Mandag',
    name: 'MMA Sparring',
    category: 'MMA',
    start: '17:00',
    end: '18:30',
    location: 'Klub A',
    status: 'active',
    ...overrides,
  };
}

function makeContext(overrides: Partial<LegacySessionSummaryContext> = {}): LegacySessionSummaryContext {
  return { weekNumber: 33, dateISO: '2026-08-17', ...overrides };
}

describe('mapLegacySessionToCalendarItemSummary', () => {
  // 9. Legacy identity is preserved through an opaque item key.
  it('builds the same opaque itemKey format as the legacy detail adapter', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession({ id: 'sess_7' }), makeContext({ weekNumber: 5, dateISO: '2026-02-02' }));
    expect(summary.itemKey).toBe('self_posted_legacy:5:2026-02-02:sess_7');
  });

  it('produces a different itemKey for a different session id', () => {
    const a = mapLegacySessionToCalendarItemSummary(makeSession({ id: 'a' }), makeContext());
    const b = mapLegacySessionToCalendarItemSummary(makeSession({ id: 'b' }), makeContext());
    expect(a.itemKey).not.toBe(b.itemKey);
  });

  // 10. No occurrenceId is fabricated.
  it('does not fabricate an occurrenceId', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession(), makeContext());
    expect('occurrenceId' in summary && summary.occurrenceId !== undefined).toBe(false);
  });

  // 11. No calendarEntryId is fabricated.
  it('does not fabricate a calendarEntryId', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession(), makeContext());
    expect('calendarEntryId' in summary && summary.calendarEntryId !== undefined).toBe(false);
  });

  // 12. Current title, time and category/visual input are preserved.
  it('preserves title, timing and category', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      makeSession({ name: 'BJJ Fundamentals', category: 'BJJ', start: '18:00', end: '19:30' }),
      makeContext({ dateISO: '2026-08-17' }),
    );
    expect(summary.title).toBe('BJJ Fundamentals');
    expect(summary.category).toBe('BJJ');
    expect(summary.dateISO).toBe('2026-08-17');
    expect(summary.startDateTime).toBe('2026-08-17T18:00:00');
    expect(summary.endDateTime).toBe('2026-08-17T19:30:00');
  });

  // 13. Current location is preserved where rendered.
  it('preserves location when present', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession({ location: 'Klub B' }), makeContext());
    expect(summary.location).toBe('Klub B');
  });

  it('omits location when absent rather than assigning an empty placeholder', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession({ location: '' }), makeContext());
    expect('location' in summary).toBe(false);
  });

  // 14. Current cancellation state is preserved.
  it('represents cancellation state including reason', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      makeSession({ status: 'cancelled', cancellationReason: 'Skade' }), makeContext(),
    );
    expect(summary.availability).toEqual({ status: 'cancelled', cancellationReason: 'Skade' });
  });

  it('represents active availability for a non-cancelled session', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession({ status: 'active' }), makeContext());
    expect(summary.availability).toEqual({ status: 'active' });
  });

  // 15. Input and placement context are not mutated.
  it('does not mutate the session or context inputs', () => {
    const session = makeSession();
    const context = makeContext();
    const sessionSnapshot = JSON.parse(JSON.stringify(session));
    const contextSnapshot = JSON.parse(JSON.stringify(context));

    mapLegacySessionToCalendarItemSummary(session, context);

    expect(session).toEqual(sessionSnapshot);
    expect(context).toEqual(contextSnapshot);
  });

  it('constructs no EventOccurrence- or CalendarEntry-shaped object', () => {
    const summary = mapLegacySessionToCalendarItemSummary(makeSession(), makeContext());
    expect('occurrence' in summary).toBe(false);
    expect('calendarEntry' in summary).toBe(false);
  });
});
