/**
 * eventSummaryAdapter.test.ts — pure adapter mapping a `FightweekEvent` to
 * the smaller `CalendarItemSummary` rendering contract (see
 * calendarItemSummary.ts). No Firebase, no React, no routing.
 */
import { describe, it, expect } from 'vitest';
import { mapEventToCalendarItemSummary } from './eventSummaryAdapter';
import type { FightweekEvent } from '../../types/event';

function makeEvent(overrides: Partial<FightweekEvent> = {}): FightweekEvent {
  return {
    id: 'ev_1',
    title: 'DM i Brydning 2026',
    type: 'tournament',
    date: '2026-09-12',
    startTime: '09:00',
    endTime: '18:00',
    location: 'Brøndby Hallen',
    discipline: 'Brydning',
    signups: {},
    createdBy: 'admin@example.com',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('mapEventToCalendarItemSummary', () => {
  // 16. Event identity is preserved through an opaque item key.
  it('builds the same opaque itemKey format as the event detail adapter', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ id: 'ev_42' }));
    expect(summary.itemKey).toBe('event:ev_42');
  });

  it('produces a different itemKey for a different event id', () => {
    const a = mapEventToCalendarItemSummary(makeEvent({ id: 'ev_1' }));
    const b = mapEventToCalendarItemSummary(makeEvent({ id: 'ev_2' }));
    expect(a.itemKey).not.toBe(b.itemKey);
  });

  // 17. No occurrenceId is fabricated.
  it('does not fabricate an occurrenceId', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent());
    expect('occurrenceId' in summary && summary.occurrenceId !== undefined).toBe(false);
  });

  // 18. No calendarEntryId is fabricated.
  it('does not fabricate a calendarEntryId', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent());
    expect('calendarEntryId' in summary && summary.calendarEntryId !== undefined).toBe(false);
  });

  // 19. Current title, time, event type/category and location are preserved where rendered.
  it('preserves title, timing, discipline-derived category and location', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({
      title: 'Nordic Open 2026', startTime: '10:00', endTime: '16:00', discipline: 'MMA', location: 'Boxen',
    }));
    expect(summary.title).toBe('Nordic Open 2026');
    expect(summary.dateISO).toBe('2026-09-12');
    expect(summary.startDateTime).toBe('2026-09-12T10:00:00');
    expect(summary.endDateTime).toBe('2026-09-12T16:00:00');
    expect(summary.category).toBe('MMA');
    expect(summary.location).toBe('Boxen');
  });

  it('falls back to the address for location, matching current card behaviour, when location is absent', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ location: undefined, address: 'Hovedgaden 1' }));
    expect(summary.location).toBe('Hovedgaden 1');
  });

  it('defaults category to "Andet" when no discipline is supplied, matching current card behaviour', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ discipline: undefined }));
    expect(summary.category).toBe('Andet');
  });

  // 20. Current cancellation state is preserved.
  it('represents cancellation state including reason via the existing isEventCancelled classification', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ status: 'cancelled', cancellationReason: 'Vejr' }));
    expect(summary.availability).toEqual({ status: 'cancelled', cancellationReason: 'Vejr' });
  });

  it('represents active availability for a non-cancelled event', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ status: undefined }));
    expect(summary.availability).toEqual({ status: 'active' });
  });

  // 21. No event signup or calendar-inclusion state is projected.
  it('does not project event signup or calendar-inclusion state', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ signups: { Karl: 'signed-up' } })) as Record<string, unknown>;
    expect(summary).not.toHaveProperty('signups');
    expect(summary).not.toHaveProperty('eventSignup');
    expect(summary).not.toHaveProperty('calendarInclusion');
  });

  // 22. Tournament and seminar use the same summary contract.
  it.each([
    ['tournament' as const],
    ['seminar' as const],
  ])('produces the same summary shape for event type "%s"', (type) => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ type }));
    expect(summary.source).toBe('event');
    expect(typeof summary.title).toBe('string');
  });

  // 23. Input is not mutated. (No separate context object is needed for
  // events — see the adapter's own doc comment for why.)
  it('does not mutate the event input', () => {
    const event = makeEvent({ signups: { Karl: 'interested' } });
    const snapshot = JSON.parse(JSON.stringify(event));

    mapEventToCalendarItemSummary(event);

    expect(event).toEqual(snapshot);
  });

  it('constructs no EventOccurrence- or CalendarEntry-shaped object', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent());
    expect('occurrence' in summary).toBe(false);
    expect('calendarEntry' in summary).toBe(false);
  });

  it('uses endDate for a multi-day event end timing, matching the detail adapter', () => {
    const summary = mapEventToCalendarItemSummary(makeEvent({ date: '2026-09-12', endDate: '2026-09-14', startTime: '09:00', endTime: '17:00' }));
    expect(summary.startDateTime).toBe('2026-09-12T09:00:00');
    expect(summary.endDateTime).toBe('2026-09-14T17:00:00');
  });
});
