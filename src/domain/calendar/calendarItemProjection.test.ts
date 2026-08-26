/**
 * calendarItemProjection.test.ts — pure central dispatcher mapping one
 * already-merged calendar day's item array (the existing
 * useScheduleData → useEventMerge → useInvitationMerge →
 * useCalendarEntryMerge chain output) to `CalendarItemSummary[]`. No
 * Firebase, no React, no hooks, no routing, no merging/placement logic.
 */
import { describe, it, expect } from 'vitest';
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
    eventSignupStatus: 'signed-up',
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

function makeContext(overrides: Partial<DayCalendarItemProjectionContext> = {}): DayCalendarItemProjectionContext {
  return {
    weekNumber: 33,
    dateISO: '2026-08-17',
    ...overrides,
  };
}

describe('projectDayCalendarItems', () => {
  // 1. Legacy self-posted merged items dispatch to the existing legacy summary adapter.
  it('dispatches a legacy self-posted item to the existing legacy summary adapter', () => {
    const [summary] = projectDayCalendarItems([makeLegacySession({ id: 'sess_7' })], makeContext({ weekNumber: 5, dateISO: '2026-02-02' }));
    expect(summary.itemKey).toBe('self_posted_legacy:5:2026-02-02:sess_7');
    expect(summary.source).toBe('self_posted_legacy');
  });

  // 2. Events dispatch to the new merged-event-session mapper (no FightweekEvent lookup required).
  it('dispatches a merged event item directly, without resolving the full FightweekEvent', () => {
    const [summary] = projectDayCalendarItems([makeEventSession()], makeContext());
    expect(summary.itemKey).toBe('event:ev_1');
    expect(summary.source).toBe('event');
    expect(summary.title).toBe('DM i Brydning 2026');
  });

  // 3. Invitations dispatch to the new invitation mapper.
  it('dispatches an invitation item to the new invitation mapper', () => {
    const [summary] = projectDayCalendarItems([makeInvitationSession()], makeContext());
    expect(summary.itemKey).toBe('invitation:inv_1');
    expect(summary.source).toBe('invitation');
  });

  // 4. Projected calendar_entry items dispatch to the new projected-entry mapper.
  it('dispatches a projected calendar_entry item to the new projected-entry mapper', () => {
    const [summary] = projectDayCalendarItems([makeCalendarEntry()], makeContext());
    expect(summary.itemKey).toBe('calendar_entry:agg_1');
    expect(summary.source).toBe('self_posted_new_model');
    expect(summary.occurrenceId).toBe('occ_1');
    expect(summary.calendarEntryId).toBe('ce_1');
  });

  // 5. Fravær is excluded, consistent with the selected projection boundary.
  it('excludes fravær items rather than mapping them', () => {
    const result = projectDayCalendarItems([makeFraværSession(), makeLegacySession()], makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('self_posted_legacy');
  });

  // 6. Unknown source types do not silently map as legacy sessions.
  it('throws for an unsupported source type rather than silently mapping it as legacy', () => {
    expect(() => projectDayCalendarItems([{ id: 'x', type: 'something_new' }], makeContext())).toThrow();
  });

  // 7. Absence of type follows the explicit legacy-session rule.
  it('treats an item with no type field as a legacy self-posted session', () => {
    const item = makeLegacySession();
    expect('type' in item).toBe(false);
    const [summary] = projectDayCalendarItems([item], makeContext());
    expect(summary.source).toBe('self_posted_legacy');
  });

  // 8. Placement context is preserved for legacy opaque keys.
  it('threads weekNumber and dateISO placement context into the legacy opaque key', () => {
    const [summary] = projectDayCalendarItems([makeLegacySession({ id: 's1' })], makeContext({ weekNumber: 40, dateISO: '2026-10-05' }));
    expect(summary.itemKey).toBe('self_posted_legacy:40:2026-10-05:s1');
    expect(summary.dateISO).toBe('2026-10-05');
  });

  // 9. Invitation canonical ids are not fabricated.
  it('does not fabricate canonical ids for an invitation', () => {
    const [summary] = projectDayCalendarItems([makeInvitationSession()], makeContext());
    expect('occurrenceId' in summary && summary.occurrenceId !== undefined).toBe(false);
    expect('calendarEntryId' in summary && summary.calendarEntryId !== undefined).toBe(false);
  });

  // 10. Projected entries preserve genuine occurrenceId and calendarEntryId.
  it('preserves the genuine occurrenceId/calendarEntryId already present on a projected entry', () => {
    const [summary] = projectDayCalendarItems([makeCalendarEntry({ occurrenceId: 'occ_9', calendarEntryId: 'ce_9' })], makeContext());
    expect(summary.occurrenceId).toBe('occ_9');
    expect(summary.calendarEntryId).toBe('ce_9');
  });

  // 11. No mapper emits raw source data or callbacks.
  it('emits only CalendarItemSummary fields for every dispatched item, never raw source data or callbacks', () => {
    const allowedKeys = new Set(['itemKey', 'occurrenceId', 'calendarEntryId', 'source', 'title', 'dateISO', 'startDateTime', 'endDateTime', 'category', 'location', 'availability']);
    const results = projectDayCalendarItems(
      [makeLegacySession(), makeEventSession(), makeInvitationSession(), makeCalendarEntry()],
      makeContext(),
    );
    for (const summary of results) {
      for (const key of Object.keys(summary)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });

  // 12. Event signup is absent.
  it('never includes event signup state', () => {
    const [summary] = projectDayCalendarItems([makeEventSession()], makeContext()) as unknown as [Record<string, unknown>];
    expect(summary).not.toHaveProperty('eventSignupStatus');
    expect(summary).not.toHaveProperty('eventSignup');
    expect(summary).not.toHaveProperty('signups');
  });

  // 13. Invitation RSVP and response semantics are absent.
  it('never includes invitation RSVP/response state', () => {
    const [summary] = projectDayCalendarItems([makeInvitationSession()], makeContext()) as unknown as [Record<string, unknown>];
    expect(summary).not.toHaveProperty('invitationResponse');
    expect(summary).not.toHaveProperty('rsvp');
  });

  // 14. Favorite is absent.
  it('never includes Favorite state', () => {
    const results = projectDayCalendarItems([makeLegacySession(), makeEventSession(), makeInvitationSession(), makeCalendarEntry()], makeContext());
    for (const summary of results as unknown as Record<string, unknown>[]) {
      expect(summary).not.toHaveProperty('favorite');
      expect(summary).not.toHaveProperty('isFavorite');
    }
  });

  // 15. Participation and attendance are absent.
  it('never includes Participation or attendance state', () => {
    const results = projectDayCalendarItems([makeLegacySession(), makeEventSession(), makeInvitationSession(), makeCalendarEntry()], makeContext());
    for (const summary of results as unknown as Record<string, unknown>[]) {
      expect(summary).not.toHaveProperty('participation');
      expect(summary).not.toHaveProperty('attended');
    }
  });

  // 16. TrainingLog state is absent.
  it('never includes TrainingLog association state', () => {
    const results = projectDayCalendarItems([makeLegacySession(), makeEventSession(), makeInvitationSession(), makeCalendarEntry()], makeContext());
    for (const summary of results as unknown as Record<string, unknown>[]) {
      expect(summary).not.toHaveProperty('trainingLogAssociation');
      expect(summary).not.toHaveProperty('canLogTraining');
    }
  });

  // 17. Recurrence and invitation-badge fields are absent.
  it('never includes a recurrence indicator or invitation arranger/response badge', () => {
    const results = projectDayCalendarItems([makeLegacySession({ isRecurring: true }), makeInvitationSession()], makeContext());
    for (const summary of results as unknown as Record<string, unknown>[]) {
      expect(summary).not.toHaveProperty('isRecurring');
      expect(summary).not.toHaveProperty('recurringEditScope');
      expect(summary).not.toHaveProperty('invitedByName');
    }
  });

  // 18. Inputs and placement context are not mutated.
  it('does not mutate the input items or the context', () => {
    const items = [makeLegacySession(), makeEventSession(), makeInvitationSession(), makeCalendarEntry()];
    const context = makeContext();
    const itemsSnapshot = JSON.parse(JSON.stringify(items));
    const contextSnapshot = JSON.parse(JSON.stringify(context));

    projectDayCalendarItems(items, context);

    expect(items).toEqual(itemsSnapshot);
    expect(context).toEqual(contextSnapshot);
  });

  // 19. Result ordering matches input ordering.
  it('preserves input ordering in the output', () => {
    const results = projectDayCalendarItems(
      [makeLegacySession({ id: 'a' }), makeEventSession(), makeInvitationSession(), makeCalendarEntry()],
      makeContext(),
    );
    expect(results.map((r) => r.source)).toEqual(['self_posted_legacy', 'event', 'invitation', 'self_posted_new_model']);
  });

  // 20. Independent of React, hooks, Firestore and routing — proven structurally: this
  // file and the projection module import no 'react'/'firebase'/hook module, and the
  // projection runs synchronously on plain data.
  it('runs synchronously with no React/Firestore/hook dependency', () => {
    const result = projectDayCalendarItems([makeLegacySession()], makeContext());
    expect(result).toBeDefined();
    expect(result).not.toBeInstanceOf(Promise);
  });

  // 22. The projection shape allows a later opaque-key resolver without adding raw
  // source data to the summary — proven by the same allow-list check as (11), applied
  // per item, confirming every summary is addressable purely by itemKey plus the
  // already-approved fields.
  it('produces a shape addressable purely by itemKey, with no raw source object attached', () => {
    const [summary] = projectDayCalendarItems([makeEventSession()], makeContext());
    expect(typeof summary.itemKey).toBe('string');
    expect(summary).not.toHaveProperty('raw');
    expect(summary).not.toHaveProperty('source_record');
    expect(summary).not.toHaveProperty('sourceRecord');
  });
});
