/**
 * eventDetailAdapter.test.ts — pure adapter mapping a Fightweek `FightweekEvent`
 * (tournament/seminar/social/other) to the shared `CalendarItemDetail`/
 * `CalendarItemCapabilities` read contract. No Firebase, no React, no routing.
 */
import { describe, it, expect } from 'vitest';
import { mapEventToCalendarItemDetail, type EventAdapterContext } from './eventDetailAdapter';
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
    description: 'Danmarksmesterskab i brydning.',
    organiser: 'Dansk Brydeforbund',
    url: 'https://example.org/dm-brydning',
    cost: '250 kr',
    signups: {},
    createdBy: 'admin@example.com',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<EventAdapterContext> = {}): EventAdapterContext {
  return {
    ...overrides,
  };
}

describe('mapEventToCalendarItemDetail', () => {
  // 1. Event identity maps to an opaque itemKey without fabricating occurrenceId.
  it('builds an opaque itemKey from the event id and does not fabricate an occurrenceId', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(typeof detail.itemKey).toBe('string');
    expect(detail.itemKey.length).toBeGreaterThan(0);
    expect('occurrenceId' in detail && detail.occurrenceId !== undefined).toBe(false);
  });

  it('produces a different itemKey for a different event id', () => {
    const a = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    const b = mapEventToCalendarItemDetail(makeEvent({ id: 'ev_2' }), makeContext());
    expect(a.detail.itemKey).not.toBe(b.detail.itemKey);
  });

  // 2. No calendarEntryId is fabricated.
  it('does not fabricate a calendarEntryId', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect('calendarEntryId' in detail && detail.calendarEntryId !== undefined).toBe(false);
  });

  // 3. Title and event type are preserved.
  it('preserves title and event type, and sets source to event', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(detail.title).toBe('DM i Brydning 2026');
    expect(detail.eventType).toBe('tournament');
    expect(detail.source).toBe('event');
  });

  // 4. Date and timing are mapped from the existing event source.
  it('maps dateISO and local-safe start/end timing from the event date/startTime/endTime', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(detail.dateISO).toBe('2026-09-12');
    expect(detail.startDateTime).toBe('2026-09-12T09:00:00');
    expect(detail.endDateTime).toBe('2026-09-12T18:00:00');
  });

  it('uses endDate for a multi-day event end timing', () => {
    const { detail } = mapEventToCalendarItemDetail(
      makeEvent({ date: '2026-09-12', endDate: '2026-09-14', startTime: '09:00', endTime: '17:00' }),
      makeContext(),
    );
    expect(detail.startDateTime).toBe('2026-09-12T09:00:00');
    expect(detail.endDateTime).toBe('2026-09-14T17:00:00');
  });

  // 5. Location, description, organiser, URL and cost are preserved where supplied.
  it('preserves location, description, organiser, url and cost when present', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(detail.location).toBe('Brøndby Hallen');
    expect(detail.description).toBe('Danmarksmesterskab i brydning.');
    expect(detail.organiser).toBe('Dansk Brydeforbund');
    expect(detail.url).toBe('https://example.org/dm-brydning');
    expect(detail.cost).toBe('250 kr');
  });

  // 6. Missing optional event fields remain absent rather than fabricated.
  it('omits location, description, organiser, url and cost when absent rather than assigning empty/undefined placeholders', () => {
    const { detail } = mapEventToCalendarItemDetail(
      makeEvent({ location: undefined, description: undefined, organiser: undefined, url: undefined, cost: undefined }),
      makeContext(),
    );
    expect('location' in detail).toBe(false);
    expect('description' in detail).toBe(false);
    expect('organiser' in detail).toBe(false);
    expect('url' in detail).toBe(false);
    expect('cost' in detail).toBe(false);
  });

  // 7. Note support or note identity is represented from the existing event mechanism.
  it('represents note support with the existing eventNoteKey convention', () => {
    const { capabilities } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(capabilities.noteState).toEqual({ supported: true, noteKey: 'e_ev_1' });
  });

  // 8. The event's native signup state is NOT projected into the shared contract.
  // signed-up/interested/declined map to distinct future concepts (CalendarEntry,
  // Favorite, and an undecided target respectively) — none of them may be
  // smuggled into this cross-source contract as a status/response field.
  it.each([
    ['signed-up' as const],
    ['interested' as const],
    ['declined' as const],
  ])('does not project the native signup state "%s" into capabilities', (status) => {
    const { capabilities } = mapEventToCalendarItemDetail(
      makeEvent({ signups: { Karl: status } }),
      makeContext(),
    );
    expect(capabilities).not.toHaveProperty('eventSignup');
  });

  it('does not fabricate a Favorite, CalendarEntry-inclusion, or generic response/RSVP projection', () => {
    const { detail, capabilities } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(capabilities).not.toHaveProperty('eventSignup');
    expect(capabilities).not.toHaveProperty('favorite');
    expect(capabilities).not.toHaveProperty('isFavorite');
    expect(capabilities).not.toHaveProperty('calendarInclusion');
    expect(capabilities).not.toHaveProperty('inCalendar');
    expect(capabilities).not.toHaveProperty('response');
    expect(capabilities).not.toHaveProperty('rsvp');
    expect(capabilities).not.toHaveProperty('myStatus');
    expect(detail).not.toHaveProperty('favorite');
    expect(detail).not.toHaveProperty('calendarInclusion');
  });

  // 10. Admin edit capability matches the current repository rule or supplied context.
  it('is editable and deletable when the context marks the viewer as admin', () => {
    const { capabilities } = mapEventToCalendarItemDetail(makeEvent(), makeContext({ isAdmin: true }));
    expect(capabilities.editable).toBe(true);
    expect(capabilities.deletable).toBe(true);
  });

  // 11. Non-admin users are not made editable.
  it('is not editable or deletable for a non-admin viewer', () => {
    const { capabilities } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(capabilities.editable).toBe(false);
    expect(capabilities.deletable).toBe(false);
  });

  it('is not editable when isAdmin is omitted from context (fail-safe default)', () => {
    const { capabilities } = mapEventToCalendarItemDetail(makeEvent(), {});
    expect(capabilities.editable).toBe(false);
    expect(capabilities.deletable).toBe(false);
  });

  // 12. Signup is not represented as canonical Participation, and no
  // response/RSVP-shaped field replaces it.
  it('does not include any Participation- or response-shaped field', () => {
    const record = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect('participation' in record.detail).toBe(false);
    expect('participation' in record.capabilities).toBe(false);
    expect('eventSignup' in record.capabilities).toBe(false);
    expect('response' in record.capabilities).toBe(false);
    expect('rsvp' in record.capabilities).toBe(false);
  });

  // 13. No attendance or completion state is inferred.
  it('does not infer attendance or completion from a signed-up status', () => {
    const { capabilities } = mapEventToCalendarItemDetail(
      makeEvent({ signups: { Karl: 'signed-up' } }),
      makeContext(),
    );
    expect(capabilities).not.toHaveProperty('attended');
    expect(capabilities).not.toHaveProperty('completed');
  });

  // 14. No TrainingLog association is invented.
  it('leaves trainingLogAssociation absent (no repository evidence of event TrainingLog support)', () => {
    const { capabilities } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(capabilities.trainingLogAssociation).toBeUndefined();
  });

  // 15. No capability is inferred later from source by presentation — proven by construction:
  // two records sharing source 'event' diverge on capability solely due to explicit context/event fields.
  it('capabilities are determined by event/context inputs, not by the source discriminator alone', () => {
    const admin = mapEventToCalendarItemDetail(makeEvent(), makeContext({ isAdmin: true }));
    const nonAdmin = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(admin.detail.source).toBe(nonAdmin.detail.source);
    expect(admin.capabilities.editable).not.toBe(nonAdmin.capabilities.editable);
  });

  // 16. Event input and context are not mutated.
  it('does not mutate the event or context inputs', () => {
    const event = makeEvent({ signups: { Karl: 'interested' } });
    const context = makeContext({ isAdmin: true });
    const eventSnapshot = JSON.parse(JSON.stringify(event));
    const contextSnapshot = JSON.parse(JSON.stringify(context));

    mapEventToCalendarItemDetail(event, context);

    expect(event).toEqual(eventSnapshot);
    expect(context).toEqual(contextSnapshot);
  });

  // 17. No EventOccurrence or CalendarEntry is constructed.
  it('constructs no EventOccurrence- or CalendarEntry-shaped object', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect('occurrence' in detail).toBe(false);
    expect('calendarEntry' in detail).toBe(false);
  });

  // 18. The adapter is independent of React, Firestore and routing — proven structurally:
  // this test file imports no 'react'/'firebase/firestore' module, and the adapter runs synchronously.
  it('runs synchronously on plain data with no async/Firestore/React dependency', () => {
    const result = mapEventToCalendarItemDetail(makeEvent(), makeContext());
    expect(result).toBeDefined();
    expect(result).not.toBeInstanceOf(Promise);
  });

  // Cancellation/availability (reuses the existing shared `availability` field — no new field required).
  it('represents cancellation state including reason and cancelledAt via the existing availability field', () => {
    const { detail } = mapEventToCalendarItemDetail(
      makeEvent({ status: 'cancelled', cancellationReason: 'Aflyst pga. vejr', cancelledAt: '2026-09-01T08:00:00.000Z' }),
      makeContext(),
    );
    expect(detail.availability).toEqual({
      status: 'cancelled',
      cancellationReason: 'Aflyst pga. vejr',
      cancellationTime: '2026-09-01T08:00:00.000Z',
    });
  });

  it('represents active availability for legacy events with no status field (undefined = active)', () => {
    const { detail } = mapEventToCalendarItemDetail(makeEvent({ status: undefined }), makeContext());
    expect(detail.availability).toEqual({ status: 'active' });
  });
});
