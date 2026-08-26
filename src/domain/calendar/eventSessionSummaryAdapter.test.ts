/**
 * eventSessionSummaryAdapter.test.ts — pure adapter mapping the merged event
 * calendar session (see useEventMerge.ts's `EventSession` — a virtual
 * per-day card, never persisted) to the smaller `CalendarItemSummary`
 * rendering contract. No Firebase, no React, no routing.
 */
import { describe, it, expect } from 'vitest';
import { mapEventSessionToCalendarItemSummary } from './eventSessionSummaryAdapter';
import type { EventSession } from '../../hooks/useEventMerge';

function makeSession(overrides: Partial<EventSession> = {}): EventSession {
  return {
    id: 'event_ev_1_2026-08-17',
    name: 'DM i Brydning 2026',
    category: 'MMA',
    start: '09:00',
    end: '18:00',
    location: 'Brøndby Hallen',
    status: 'active',
    type: 'event',
    eventId: 'ev_1',
    eventSignupStatus: 'signed-up',
    ...overrides,
  };
}

const context = { dateISO: '2026-08-17' };

describe('mapEventSessionToCalendarItemSummary', () => {
  it('builds an opaque itemKey from the merged session\'s own eventId, matching the event detail-adapter convention', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession({ eventId: 'ev_42' }), context);
    expect(summary.itemKey).toBe('event:ev_42');
  });

  it('produces a different itemKey for a different eventId', () => {
    const a = mapEventSessionToCalendarItemSummary(makeSession({ eventId: 'a' }), context);
    const b = mapEventSessionToCalendarItemSummary(makeSession({ eventId: 'b' }), context);
    expect(a.itemKey).not.toBe(b.itemKey);
  });

  it('does not fabricate an occurrenceId', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession(), context);
    expect('occurrenceId' in summary && summary.occurrenceId !== undefined).toBe(false);
  });

  it('does not fabricate a calendarEntryId', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession(), context);
    expect('calendarEntryId' in summary && summary.calendarEntryId !== undefined).toBe(false);
  });

  it('preserves title, timing, category and location from the merged session', () => {
    const summary = mapEventSessionToCalendarItemSummary(
      makeSession({ name: 'Nordic Open 2026', category: 'BJJ', start: '10:00', end: '16:00', location: 'Boxen' }),
      { dateISO: '2026-09-12' },
    );
    expect(summary.title).toBe('Nordic Open 2026');
    expect(summary.category).toBe('BJJ');
    expect(summary.dateISO).toBe('2026-09-12');
    expect(summary.startDateTime).toBe('2026-09-12T10:00:00');
    expect(summary.endDateTime).toBe('2026-09-12T16:00:00');
    expect(summary.location).toBe('Boxen');
  });

  it('omits location when absent', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession({ location: '' }), context);
    expect('location' in summary).toBe(false);
  });

  // The merged session's own `status` is always 'active' (see useEventMerge.ts's
  // buildEventSession) — current event cards never display cancellation.
  // Preserving that directly, rather than resolving the full FightweekEvent to
  // compute real cancellation, matches existing card behaviour exactly.
  it('represents availability as active, matching the merged session\'s own status field', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession({ status: 'active' }), context);
    expect(summary.availability).toEqual({ status: 'active' });
  });

  it('does not include event signup, calendar-inclusion, RSVP, Favorite, Participation or TrainingLog state', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession(), context) as Record<string, unknown>;
    expect(summary).not.toHaveProperty('eventSignupStatus');
    expect(summary).not.toHaveProperty('eventSignup');
    expect(summary).not.toHaveProperty('signups');
    expect(summary).not.toHaveProperty('rsvp');
    expect(summary).not.toHaveProperty('favorite');
    expect(summary).not.toHaveProperty('participation');
    expect(summary).not.toHaveProperty('trainingLogAssociation');
  });

  it('does not mutate the session or context inputs', () => {
    const session = makeSession();
    const ctx = { ...context };
    const sessionSnapshot = JSON.parse(JSON.stringify(session));
    const ctxSnapshot = JSON.parse(JSON.stringify(ctx));

    mapEventSessionToCalendarItemSummary(session, ctx);

    expect(session).toEqual(sessionSnapshot);
    expect(ctx).toEqual(ctxSnapshot);
  });

  it('constructs no EventOccurrence- or CalendarEntry-shaped object', () => {
    const summary = mapEventSessionToCalendarItemSummary(makeSession(), context);
    expect('occurrence' in summary).toBe(false);
    expect('calendarEntry' in summary).toBe(false);
  });

  it('requires no FightweekEvent lookup — operates on the merged session alone', () => {
    // Structural proof: the function signature accepts exactly (session, context).
    expect(mapEventSessionToCalendarItemSummary.length).toBe(2);
  });
});
