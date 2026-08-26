/**
 * invitationSummaryAdapter.test.ts — pure adapter mapping the merged
 * invitation calendar session (see useInvitationMerge.ts) to the smaller
 * `CalendarItemSummary` rendering contract. No Firebase, no React, no
 * routing.
 */
import { describe, it, expect } from 'vitest';
import { mapInvitationSessionToCalendarItemSummary } from './invitationSummaryAdapter';
import type { InvitationSession } from '../../hooks/useInvitationMerge';

function makeSession(overrides: Partial<InvitationSession> = {}): InvitationSession {
  return {
    id: 'inv_sess_1',
    name: 'MMA Sparring',
    category: 'MMA',
    start: '17:00',
    end: '18:30',
    location: 'Klub A',
    status: 'active',
    type: 'invitation',
    invitationId: 'inv_1',
    invitationResponse: 'accepted',
    invitationCancelled: false,
    invitedByName: 'Karl',
    ...overrides,
  };
}

const context = { weekNumber: 33, dateISO: '2026-08-17' };

describe('mapInvitationSessionToCalendarItemSummary', () => {
  it('builds an opaque itemKey from the invitation id', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession({ invitationId: 'inv_42' }), context);
    expect(summary.itemKey).toBe('invitation:inv_42');
  });

  it('produces a different itemKey for a different invitation id', () => {
    const a = mapInvitationSessionToCalendarItemSummary(makeSession({ invitationId: 'a' }), context);
    const b = mapInvitationSessionToCalendarItemSummary(makeSession({ invitationId: 'b' }), context);
    expect(a.itemKey).not.toBe(b.itemKey);
  });

  it('does not fabricate an occurrenceId', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession(), context);
    expect('occurrenceId' in summary && summary.occurrenceId !== undefined).toBe(false);
  });

  it('does not fabricate a calendarEntryId', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession(), context);
    expect('calendarEntryId' in summary && summary.calendarEntryId !== undefined).toBe(false);
  });

  it('preserves title, timing and category', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(
      makeSession({ name: 'BJJ Fundamentals', category: 'BJJ', start: '18:00', end: '19:30' }),
      { weekNumber: 33, dateISO: '2026-08-17' },
    );
    expect(summary.title).toBe('BJJ Fundamentals');
    expect(summary.category).toBe('BJJ');
    expect(summary.dateISO).toBe('2026-08-17');
    expect(summary.startDateTime).toBe('2026-08-17T18:00:00');
    expect(summary.endDateTime).toBe('2026-08-17T19:30:00');
  });

  it('preserves location when present', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession({ location: 'Klub B' }), context);
    expect(summary.location).toBe('Klub B');
  });

  it('omits location when absent', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession({ location: '' }), context);
    expect('location' in summary).toBe(false);
  });

  it('represents a per-person cancelled invitation as cancelled availability', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession({ invitationCancelled: true }), context);
    expect(summary.availability).toEqual({ status: 'cancelled' });
  });

  it('represents active availability when not cancelled', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession({ invitationCancelled: false }), context);
    expect(summary.availability).toEqual({ status: 'active' });
  });

  it('does not include RSVP, response or arranger-badge fields', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession(), context) as Record<string, unknown>;
    expect(summary).not.toHaveProperty('invitationResponse');
    expect(summary).not.toHaveProperty('invitedByName');
    expect(summary).not.toHaveProperty('rsvp');
    expect(summary).not.toHaveProperty('response');
    expect(summary).not.toHaveProperty('invitees');
  });

  it('does not mutate the session or context inputs', () => {
    const session = makeSession();
    const ctx = { ...context };
    const sessionSnapshot = JSON.parse(JSON.stringify(session));
    const ctxSnapshot = JSON.parse(JSON.stringify(ctx));

    mapInvitationSessionToCalendarItemSummary(session, ctx);

    expect(session).toEqual(sessionSnapshot);
    expect(ctx).toEqual(ctxSnapshot);
  });

  it('constructs no EventOccurrence- or CalendarEntry-shaped object', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(makeSession(), context);
    expect('occurrence' in summary).toBe(false);
    expect('calendarEntry' in summary).toBe(false);
  });
});
