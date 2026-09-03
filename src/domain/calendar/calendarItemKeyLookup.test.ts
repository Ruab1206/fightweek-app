/**
 * calendarItemKeyLookup.test.ts — pairs `projectDayCalendarItems`'s
 * `CalendarItemSummary[]` output with the exact raw item each summary came
 * from. No Firebase, no React, no routing, no persistence.
 */
import { describe, it, expect } from 'vitest';
import { projectDayCalendarItemsWithLookup } from './calendarItemKeyLookup';
import { projectDayCalendarItems, type DayCalendarItemProjectionContext } from './calendarItemProjection';

function makeLegacySession(overrides: Record<string, unknown> = {}) {
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

function makeEventSession(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function makeInvitationSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv_sess_1',
    name: 'BJJ open mat',
    category: 'BJJ',
    start: '19:00',
    end: '20:00',
    location: 'Klub B',
    status: 'active',
    type: 'invitation',
    invitationId: 'inv_1',
    invitationResponse: 'accepted',
    invitationCancelled: false,
    invitedByName: 'Karl',
    ...overrides,
  };
}

function makeFraværSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fravaer_1',
    type: 'fravær',
    name: 'Ferie',
    category: 'Fravær',
    day: 'Mandag',
    start: '00:00',
    end: '23:59',
    status: 'active',
    ...overrides,
  };
}

function makeCalendarEntry(overrides: Record<string, unknown> = {}) {
  return {
    type: 'calendar_entry',
    readOnly: true,
    aggregateId: 'agg_1',
    occurrenceId: 'occ_1',
    calendarEntryId: 'ce_1',
    name: 'Solo run',
    category: 'MMA',
    start: '06:00',
    end: '07:00',
    location: 'Parken',
    status: 'active',
    ...overrides,
  };
}

function makeContext(overrides: Partial<DayCalendarItemProjectionContext> = {}): DayCalendarItemProjectionContext {
  return { weekNumber: 33, dateISO: '2026-08-17', ...overrides };
}

describe('projectDayCalendarItemsWithLookup', () => {
  it('produces one summary per admitted raw item', () => {
    const items = [makeLegacySession(), makeEventSession(), makeInvitationSession()];
    const { summaries } = projectDayCalendarItemsWithLookup(items, makeContext());
    expect(summaries).toHaveLength(3);
  });

  it('resolves each summary key back to the exact original raw item', () => {
    const legacy = makeLegacySession({ id: 'sess_9' });
    const event = makeEventSession({ eventId: 'ev_9' });
    const { summaries, rawByKey } = projectDayCalendarItemsWithLookup([legacy, event], makeContext());

    expect(rawByKey.get(summaries[0].itemKey)).toBe(legacy);
    expect(rawByKey.get(summaries[1].itemKey)).toBe(event);
  });

  it('excludes fravær from both the summaries and the lookup', () => {
    const fravaer = makeFraværSession();
    const legacy = makeLegacySession();
    const { summaries, rawByKey } = projectDayCalendarItemsWithLookup([fravaer, legacy], makeContext());

    expect(summaries).toHaveLength(1);
    expect(rawByKey.size).toBe(1);
    expect([...rawByKey.values()]).not.toContain(fravaer);
  });

  it('excludes legacy rest-day markers from both the summaries and the lookup', () => {
    const restDay = { id: 3, isRestDay: true };
    const legacy = makeLegacySession();
    const { summaries, rawByKey } = projectDayCalendarItemsWithLookup([restDay, legacy], makeContext());

    expect(summaries).toHaveLength(1);
    expect(rawByKey.size).toBe(1);
    expect([...rawByKey.values()]).not.toContain(restDay);
  });

  it('preserves input order across summaries and the lookup', () => {
    const first = makeLegacySession({ id: 'first' });
    const second = makeEventSession({ eventId: 'second' });
    const third = makeInvitationSession({ invitationId: 'third' });
    const { summaries } = projectDayCalendarItemsWithLookup([first, second, third], makeContext());

    expect(summaries.map((s) => s.itemKey)).toEqual([
      'self_posted_legacy:33:2026-08-17:first',
      'event:second',
      'invitation:third',
    ]);
  });

  it('never returns a lookup larger than the summaries array', () => {
    const items = [makeFraværSession(), { id: 1, isRestDay: true }, makeLegacySession(), makeEventSession()];
    const { summaries, rawByKey } = projectDayCalendarItemsWithLookup(items, makeContext());
    expect(rawByKey.size).toBe(summaries.length);
  });

  it('returns an empty lookup for an empty or all-excluded day', () => {
    const { summaries, rawByKey } = projectDayCalendarItemsWithLookup([makeFraværSession(), { id: 1, isRestDay: true }], makeContext());
    expect(summaries).toHaveLength(0);
    expect(rawByKey.size).toBe(0);
  });

  // Mixed ordered input covering every current source plus both exclusions,
  // proving excluded entries never shift later key-to-item correspondence.
  it('resolves every admitted item to its exact raw source in a mixed ordered day, unaffected by interleaved exclusions', () => {
    const fravaer = makeFraværSession();
    const restDay = { id: 9, isRestDay: true };
    const legacy = makeLegacySession({ id: 'mixed_legacy' });
    const event = makeEventSession({ eventId: 'mixed_event' });
    const invitation = makeInvitationSession({ invitationId: 'mixed_invitation' });
    const calendarEntry = makeCalendarEntry({ aggregateId: 'mixed_agg' });

    const items = [fravaer, legacy, restDay, event, invitation, calendarEntry];
    const { summaries, rawByKey } = projectDayCalendarItemsWithLookup(items, makeContext());

    expect(summaries.map((s) => s.itemKey)).toEqual([
      'self_posted_legacy:33:2026-08-17:mixed_legacy',
      'event:mixed_event',
      'invitation:mixed_invitation',
      'calendar_entry:mixed_agg',
    ]);
    expect(rawByKey.get(summaries[0].itemKey)).toBe(legacy);
    expect(rawByKey.get(summaries[1].itemKey)).toBe(event);
    expect(rawByKey.get(summaries[2].itemKey)).toBe(invitation);
    expect(rawByKey.get(summaries[3].itemKey)).toBe(calendarEntry);
    expect(rawByKey.size).toBe(4);
  });

  // Duplicate itemKey during one construction must fail fast, never silently
  // overwrite an unrelated raw item (an unsafe open intent otherwise).
  it('throws on a duplicate itemKey rather than silently overwriting the earlier raw item', () => {
    const first = makeLegacySession({ id: 'dup' });
    const second = makeLegacySession({ id: 'dup' }); // same day/week/id => identical itemKey
    expect(() => projectDayCalendarItemsWithLookup([first, second], makeContext())).toThrow(/duplicate/i);
  });

  // Unknown-type handling must be identical to projectDayCalendarItems —
  // both are backed by the same dispatchCalendarItem decision.
  it('throws for an unsupported type, consistent with projectDayCalendarItems', () => {
    const items = [{ id: 'x', type: 'something_new' }];
    expect(() => projectDayCalendarItemsWithLookup(items, makeContext())).toThrow();
    expect(() => projectDayCalendarItems(items, makeContext())).toThrow();
  });

  // A stale/unknown key (not produced by this call) resolves to nothing.
  it('resolves an unknown or stale key to undefined', () => {
    const { rawByKey } = projectDayCalendarItemsWithLookup([makeLegacySession()], makeContext());
    expect(rawByKey.get('event:does_not_exist' as any)).toBeUndefined();
  });

  // Structural proof: no persistence, no async — a plain synchronous Map.
  it('returns a plain, synchronous, in-memory Map — no persistence or async lookup', () => {
    const result = projectDayCalendarItemsWithLookup([makeLegacySession()], makeContext());
    expect(result.rawByKey).toBeInstanceOf(Map);
    expect(result).not.toHaveProperty('then');
  });
});
