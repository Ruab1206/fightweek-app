/**
 * legacySessionDetailAdapter.test.ts — pure adapter mapping a legacy
 * self-posted `TrainingSession` to the shared `CalendarItemDetail`/
 * `CalendarItemCapabilities` read contract. No Firebase, no React.
 */
import { describe, it, expect } from 'vitest';
import {
  mapLegacySessionToCalendarItemDetail,
  type LegacySessionAdapterContext,
} from './legacySessionDetailAdapter';
import type { OccurrenceLogAssociation } from './logAssociation';
import type { TrainingSession } from '../../types/common';

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'sess_1',
    day: 'Mandag',
    name: 'MMA Sparring',
    category: 'MMA',
    start: '17:00',
    end: '18:30',
    location: 'Rumble Sports',
    status: 'active',
    ...overrides,
  };
}

function makeContext(overrides: Partial<LegacySessionAdapterContext> = {}): LegacySessionAdapterContext {
  return {
    weekNumber: 34,
    dateISO: '2026-08-24',
    ...overrides,
  };
}

describe('mapLegacySessionToCalendarItemDetail', () => {
  // 1. Preserves legacy identity without inventing occurrenceId.
  it('builds an opaque itemKey from the legacy identity and does not fabricate an occurrenceId or calendarEntryId', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(typeof detail.itemKey).toBe('string');
    expect(detail.itemKey.length).toBeGreaterThan(0);
    expect('occurrenceId' in detail && detail.occurrenceId !== undefined).toBe(false);
    expect('calendarEntryId' in detail && detail.calendarEntryId !== undefined).toBe(false);
  });

  it('produces a different itemKey for a different session id, week, or date (source identity preserved, not collapsed)', () => {
    const base = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    const otherId = mapLegacySessionToCalendarItemDetail(makeSession({ id: 'sess_2' }), makeContext());
    const otherWeek = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext({ weekNumber: 35 }));
    const otherDate = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext({ dateISO: '2026-08-25' }));
    expect(base.detail.itemKey).not.toBe(otherId.detail.itemKey);
    expect(base.detail.itemKey).not.toBe(otherWeek.detail.itemKey);
    expect(base.detail.itemKey).not.toBe(otherDate.detail.itemKey);
  });

  // 2. Title, date and timing map from the legacy source.
  it('maps title, dateISO, and local-safe start/end timing from the legacy session', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(detail.title).toBe('MMA Sparring');
    expect(detail.dateISO).toBe('2026-08-24');
    expect(detail.startDateTime).toBe('2026-08-24T17:00:00');
    expect(detail.endDateTime).toBe('2026-08-24T18:30:00');
    expect(detail.source).toBe('self_posted_legacy');
  });

  // 3. Location, description, category map where present.
  it('maps location and category when present', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(detail.location).toBe('Rumble Sports');
    expect(detail.category).toBe('MMA');
  });

  it('omits location rather than assigning an empty/undefined placeholder when absent', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(makeSession({ location: '' }), makeContext());
    expect('location' in detail).toBe(false);
  });

  // 4. Recurrence context is preserved.
  it('represents recurrence context when the session is recurring', () => {
    const { detail, capabilities } = mapLegacySessionToCalendarItemDetail(
      makeSession({ isRecurring: true, recurrenceInterval: 1 }),
      makeContext(),
    );
    expect(detail.recurrenceContext).toEqual({ isRecurring: true, intervalWeeks: 1 });
    expect(capabilities.recurringEditScope).toBe('this_and_following');
  });

  it('omits recurrence context for a non-recurring session', () => {
    const { detail, capabilities } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect('recurrenceContext' in detail).toBe(false);
    expect(capabilities.recurringEditScope).toBeUndefined();
  });

  // 5. Cancellation state is preserved.
  it('represents cancellation state including reason and time', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(
      makeSession({ status: 'cancelled', cancellationReason: 'Injured', cancellationTime: '2026-08-20T10:00:00.000Z' }),
      makeContext(),
    );
    expect(detail.availability).toEqual({
      status: 'cancelled',
      cancellationReason: 'Injured',
      cancellationTime: '2026-08-20T10:00:00.000Z',
    });
  });

  it('represents active availability without cancellation fields', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(detail.availability).toEqual({ status: 'active' });
  });

  // 6. Edit and delete capabilities match current legacy self-posted behaviour.
  it('is editable and deletable for a genuinely self-posted session (no catalogueClassId)', () => {
    const { capabilities } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(capabilities.editable).toBe(true);
    expect(capabilities.deletable).toBe(true);
  });

  it('is not editable when the session is catalogue-linked (legitimate source-specific restriction, same TrainingSession shape)', () => {
    const { capabilities } = mapLegacySessionToCalendarItemDetail(
      makeSession({ catalogueClassId: 'class_1' }),
      makeContext(),
    );
    expect(capabilities.editable).toBe(false);
    // Deletion remains available even for a catalogue-linked entry — evidenced restriction is on core-field editing only.
    expect(capabilities.deletable).toBe(true);
  });

  // 7. Delete-this-and-following capability is represented where currently supported.
  it('represents this_and_following recurring edit scope only when the session is recurring', () => {
    const recurring = mapLegacySessionToCalendarItemDetail(
      makeSession({ isRecurring: true, recurrenceInterval: 2 }),
      makeContext(),
    );
    const nonRecurring = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(recurring.capabilities.recurringEditScope).toBe('this_and_following');
    expect(nonRecurring.capabilities.recurringEditScope).toBeUndefined();
  });

  // 8. Invitation and series-invitation capabilities are represented where currently supported.
  it('passes invitation and series-invitation capability through from explicit context, never fabricated from the session alone', () => {
    const withInvite = mapLegacySessionToCalendarItemDetail(
      makeSession(),
      makeContext({ canInvite: true, canSeriesInvite: true }),
    );
    const withoutInvite = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(withInvite.capabilities.canInvite).toBe(true);
    expect(withInvite.capabilities.canSeriesInvite).toBe(true);
    expect(withoutInvite.capabilities.canInvite).toBe(false);
    expect(withoutInvite.capabilities.canSeriesInvite).toBe(false);
  });

  // 9. Note support is represented explicitly.
  it('represents note support explicitly with a note key for a saved session', () => {
    const { capabilities } = mapLegacySessionToCalendarItemDetail(makeSession({ id: 'sess_1' }), makeContext());
    expect(capabilities.noteState.supported).toBe(true);
    expect(capabilities.noteState.noteKey).toBe('s_2026-08-24_sess_1');
  });

  it('represents note support as unsupported (no key) for an unsaved session (no id)', () => {
    const { capabilities } = mapLegacySessionToCalendarItemDetail(makeSession({ id: undefined }), makeContext());
    expect(capabilities.noteState.supported).toBe(false);
    expect(capabilities.noteState.noteKey).toBeUndefined();
  });

  // 10. TrainingLog none/one/conflict state is passed through as status only.
  it('passes the existing TrainingLog association through unchanged as a status projection, never recomputing kind', () => {
    const association: OccurrenceLogAssociation = { kind: 'conflict', logs: [] };
    const { capabilities } = mapLegacySessionToCalendarItemDetail(
      makeSession(),
      makeContext({ trainingLogAssociation: association }),
    );
    expect(capabilities.trainingLogAssociation).toBe(association);
  });

  it('leaves TrainingLog association absent when the caller has not supplied one (never defaults to a fabricated status)', () => {
    const { capabilities } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(capabilities.trainingLogAssociation).toBeUndefined();
  });

  it('passes canLogTraining through from context, defaulting to false rather than inferring availability', () => {
    const withLog = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext({ canLogTraining: true }));
    const withoutLog = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(withLog.capabilities.canLogTraining).toBe(true);
    expect(withoutLog.capabilities.canLogTraining).toBe(false);
  });

  // 11. No Participation is inferred.
  it('does not include any Participation-shaped field', () => {
    const record = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect('participation' in record.detail).toBe(false);
    expect('participation' in record.capabilities).toBe(false);
  });

  // 12. No capability is inferred by a presentation component from source — proven here by construction:
  // every capability field traces to an explicit session field or explicit context input, never to `detail.source`.
  it('capabilities are fully determined by session/context inputs, not by the source discriminator alone', () => {
    // Two records sharing the same source but different session/context inputs must diverge on capabilities.
    const a = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    const b = mapLegacySessionToCalendarItemDetail(makeSession({ catalogueClassId: 'c1' }), makeContext());
    expect(a.detail.source).toBe(b.detail.source);
    expect(a.capabilities.editable).not.toBe(b.capabilities.editable);
  });

  // 13. Input objects are not mutated.
  it('does not mutate the session or context inputs', () => {
    const session = makeSession({ isRecurring: true, recurrenceInterval: 1 });
    const context = makeContext({ canInvite: true });
    const sessionSnapshot = JSON.parse(JSON.stringify(session));
    const contextSnapshot = JSON.parse(JSON.stringify(context));

    mapLegacySessionToCalendarItemDetail(session, context);

    expect(session).toEqual(sessionSnapshot);
    expect(context).toEqual(contextSnapshot);
  });

  // 14. No EventOccurrence or CalendarEntry is constructed.
  it('constructs no EventOccurrence- or CalendarEntry-shaped object (detail carries only optional bare ids, no nested occurrence/calendarEntry record)', () => {
    const { detail } = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect('occurrence' in detail).toBe(false);
    expect('calendarEntry' in detail).toBe(false);
  });

  // 15. The contract can be consumed independently of React and Firestore — proven structurally: this test
  // file imports no 'react' or 'firebase/firestore' module, and the adapter runs synchronously with plain data.
  it('runs synchronously on plain data with no async/Firestore/React dependency', () => {
    const result = mapLegacySessionToCalendarItemDetail(makeSession(), makeContext());
    expect(result).toBeDefined();
    expect(result).not.toBeInstanceOf(Promise);
  });
});
