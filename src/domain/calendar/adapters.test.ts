import { describe, it, expect } from 'vitest';
import {
  catalogueClassToSeries,
  eventToOccurrence,
  fraværToOccurrence,
  sessionToOccurrenceAndEntry,
  isEligibleSelfPostedCalendarSession,
  isLoggableSelfPostedCalendarOccurrence,
  buildSelfPostedCalendarLogContext,
  decideLogTrainingSheetClose,
} from './adapters';
import type { CatalogueClass } from '../../types/catalogue';
import type { FightweekEvent } from '../../types/event';
import type { TrainingSession, FraværSession } from '../../types/common';

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

function makeClass(overrides: Partial<CatalogueClass> = {}): CatalogueClass {
  return {
    id: 'cls_1',
    title: 'Thaiboksning Elite',
    discipline: 'Muay Thai',
    level: 'Elite',
    gym: 'Fightworld',
    location: 'Fightworld København',
    address: 'Testvej 1',
    schedules: [
      { dayOfWeek: 1, startTime: '17:00', endTime: '18:30' },
      { dayOfWeek: 4, startTime: '18:00', endTime: '19:30' },
    ],
    showRatings: false,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<FightweekEvent> = {}): FightweekEvent {
  return {
    id: 'evt_1',
    title: 'DM i Brydning 2026',
    type: 'tournament',
    discipline: 'Brydning',
    date: '2026-05-16',
    signups: {},
    createdBy: 'coach@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeFravær(overrides: Partial<FraværSession> = {}): FraværSession {
  return {
    id: 'frv_1',
    type: 'fravær',
    name: 'Ferie',
    category: 'Fravær',
    day: 'Mandag',
    start: '00:00',
    end: '23:59',
    status: 'active',
    fraværTitel: 'Sommerferie',
    fraværBeskrivelse: 'Væk',
    fraværGroupId: 'grp_1',
    fraværDayIndex: 1,
    fraværTotalDays: 3,
    fraværStartDate: '2026-07-01',
    fraværEndDate: '2026-07-03',
    fraværStartTime: '08:00',
    fraværEndTime: '17:00',
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// catalogueClassToSeries
// ──────────────────────────────────────────────

describe('catalogueClassToSeries', () => {
  it('maps a Hold to an EventSeries of type "class" preserving timeslots', () => {
    const series = catalogueClassToSeries(makeClass());
    expect(series.type).toBe('class');
    expect(series.title).toBe('Thaiboksning Elite');
    expect(series.discipline).toBe('Muay Thai');
    expect(series.location).toBe('Fightworld København');
    expect(series.recurrence?.schedules).toEqual([
      { dayOfWeek: 1, startTime: '17:00', endTime: '18:30' },
      { dayOfWeek: 4, startTime: '18:00', endTime: '19:30' },
    ]);
  });

  it('handles a class with no schedules', () => {
    const series = catalogueClassToSeries(makeClass({ schedules: [] }));
    expect(series.recurrence?.schedules).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// eventToOccurrence
// ──────────────────────────────────────────────

describe('eventToOccurrence', () => {
  it('maps a tournament to an occurrence with null seriesId', () => {
    const occ = eventToOccurrence(
      makeEvent({ startTime: '09:00', endTime: '18:00' }),
    );
    expect(occ.seriesId).toBeNull();
    expect(occ.type).toBe('tournament');
    expect(occ.title).toBe('DM i Brydning 2026');
    expect(occ.startDateTime).toBe('2026-05-16T09:00:00');
    expect(occ.endDateTime).toBe('2026-05-16T18:00:00');
  });

  it('spans a multi-day event to its endDate', () => {
    const occ = eventToOccurrence(
      makeEvent({
        type: 'seminar',
        date: '2026-05-16',
        endDate: '2026-05-18',
        startTime: '10:00',
        endTime: '16:00',
      }),
    );
    expect(occ.type).toBe('seminar');
    expect(occ.startDateTime).toBe('2026-05-16T10:00:00');
    expect(occ.endDateTime).toBe('2026-05-18T16:00:00');
  });

  it('maps the current "social" type to target "other"', () => {
    const occ = eventToOccurrence(makeEvent({ type: 'social' }));
    expect(occ.type).toBe('other');
  });
});

// ──────────────────────────────────────────────
// fraværToOccurrence
// ──────────────────────────────────────────────

describe('fraværToOccurrence', () => {
  it('maps an absence to an occurrence of type "absence" with null seriesId', () => {
    const occ = fraværToOccurrence(makeFravær());
    expect(occ.seriesId).toBeNull();
    expect(occ.type).toBe('absence');
    expect(occ.title).toBe('Sommerferie');
    expect(occ.startDateTime).toBe('2026-07-01T08:00:00');
    expect(occ.endDateTime).toBe('2026-07-03T17:00:00');
  });
});

// ──────────────────────────────────────────────
// sessionToOccurrenceAndEntry
// ──────────────────────────────────────────────

describe('sessionToOccurrenceAndEntry', () => {
  const ctx = {
    dateISO: '2026-06-15',
    userId: 'fighter@example.com',
    calendarId: 'cal_1',
  };

  it('splits a catalogue-linked session into occurrence (class) + entry', () => {
    const session: TrainingSession = {
      id: 'sess_1',
      day: 'Mandag',
      name: 'MMA Elite',
      category: 'MMA',
      start: '17:00',
      end: '18:30',
      location: 'Fightworld',
      status: 'active',
      catalogueClassId: 'cls_1',
    };
    const { occurrence, entry } = sessionToOccurrenceAndEntry(session, ctx);

    expect(occurrence.type).toBe('class');
    expect(occurrence.seriesId).toBe('cls_1');
    expect(occurrence.title).toBe('MMA Elite');
    expect(occurrence.discipline).toBe('MMA');
    expect(occurrence.startDateTime).toBe('2026-06-15T17:00:00');
    expect(occurrence.endDateTime).toBe('2026-06-15T18:30:00');
    expect(occurrence.location).toBe('Fightworld');
    expect(occurrence.status).toBe('scheduled');

    expect(entry.occurrenceId).toBe(occurrence.id);
    expect(entry.userId).toBe('fighter@example.com');
    expect(entry.calendarId).toBe('cal_1');
    expect(entry.status).toBe('planned');
  });

  it('maps a manual session (no catalogue link) to self_posted_training with null seriesId', () => {
    const session: TrainingSession = {
      id: 'sess_2',
      day: 'Tirsdag',
      name: 'Egen løbetur',
      category: 'Fysisk træning',
      start: '07:00',
      end: '08:00',
      location: 'Fælledparken',
      status: 'active',
    };
    const { occurrence } = sessionToOccurrenceAndEntry(session, ctx);
    expect(occurrence.type).toBe('self_posted_training');
    expect(occurrence.seriesId).toBeNull();
  });

  it('reflects a cancelled session in both occurrence and entry status', () => {
    const session: TrainingSession = {
      id: 'sess_3',
      day: 'Onsdag',
      name: 'BJJ',
      category: 'Grappling',
      start: '18:00',
      end: '19:30',
      location: 'Gym',
      status: 'cancelled',
    };
    const { occurrence, entry } = sessionToOccurrenceAndEntry(session, ctx);
    expect(occurrence.status).toBe('cancelled');
    expect(entry.status).toBe('cancelled');
  });

  it('does not require calendarId', () => {
    const session: TrainingSession = {
      id: 'sess_4',
      day: 'Torsdag',
      name: 'Boksning',
      category: 'Boksning',
      start: '17:00',
      end: '18:00',
      location: 'Gym',
      status: 'active',
    };
    const { entry } = sessionToOccurrenceAndEntry(session, {
      dateISO: '2026-06-18',
      userId: 'fighter@example.com',
    });
    expect(entry.calendarId).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// No-loss of core fields across all adapters
// ──────────────────────────────────────────────

describe('core field preservation', () => {
  it('preserves title/type/start/end/location on every occurrence output', () => {
    const evtOcc = eventToOccurrence(makeEvent({ startTime: '09:00', endTime: '10:00' }));
    const frvOcc = fraværToOccurrence(makeFravær());
    const { occurrence } = sessionToOccurrenceAndEntry(
      {
        id: 's', day: 'Mandag', name: 'X', category: 'MMA',
        start: '17:00', end: '18:00', location: 'Gym', status: 'active',
      },
      { dateISO: '2026-06-15', userId: 'u@example.com' },
    );

    for (const occ of [evtOcc, frvOcc, occurrence]) {
      expect(occ.title).toBeTruthy();
      expect(occ.type).toBeTruthy();
      expect(occ.startDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(occ.endDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    }
  });
});

// ──────────────────────────────────────────────
// isEligibleSelfPostedCalendarSession (Phase 3 calendar-originated slice)
// ──────────────────────────────────────────────

describe('isEligibleSelfPostedCalendarSession', () => {
  it('is eligible for a persisted manual session (no catalogueClassId, no type)', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 'sess_1' })).toBe(true);
  });

  it('rejects a catalogue-linked session', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 'sess_1', catalogueClassId: 'cls_1' })).toBe(false);
  });

  it('rejects a fravær entry', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 'fravær_1', type: 'fravær' })).toBe(false);
  });

  it('rejects a virtual event session', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 'event_1_2026-06-15', type: 'event' })).toBe(false);
  });

  it('rejects a virtual invitation session', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 'invitation_1', type: 'invitation' })).toBe(false);
  });

  it('rejects a rest-day marker', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 1, isRestDay: true })).toBe(false);
  });

  it('rejects a cancelled self-posted session', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 'sess_1', status: 'cancelled' })).toBe(false);
  });

  it('rejects an unsaved new session with no id yet', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: undefined })).toBe(false);
    expect(isEligibleSelfPostedCalendarSession({})).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isEligibleSelfPostedCalendarSession(null)).toBe(false);
    expect(isEligibleSelfPostedCalendarSession(undefined)).toBe(false);
  });

  it('accepts a numeric legacy id', () => {
    expect(isEligibleSelfPostedCalendarSession({ id: 12345 })).toBe(true);
  });
});

// ──────────────────────────────────────────────
// isLoggableSelfPostedCalendarOccurrence (application-level eligibility;
// Phase 3 calendar-originated slice) — deterministic via injected
// referenceDateTime, never the system clock.
// ──────────────────────────────────────────────

describe('isLoggableSelfPostedCalendarOccurrence', () => {
  const referenceDateTime = new Date('2026-08-14T18:00:00');

  it('is loggable for a past occurrence of an eligible session', () => {
    expect(
      isLoggableSelfPostedCalendarOccurrence(
        { id: 'sess_1' },
        { occurrenceStartDateTime: '2026-08-14T10:00:00', referenceDateTime },
      ),
    ).toBe(true);
  });

  it('is loggable for an occurrence starting exactly at the reference instant', () => {
    expect(
      isLoggableSelfPostedCalendarOccurrence(
        { id: 'sess_1' },
        { occurrenceStartDateTime: '2026-08-14T18:00:00', referenceDateTime },
      ),
    ).toBe(true);
  });

  it('rejects a future occurrence, even for an otherwise-eligible session', () => {
    expect(
      isLoggableSelfPostedCalendarOccurrence(
        { id: 'sess_1' },
        { occurrenceStartDateTime: '2026-08-14T19:00:00', referenceDateTime },
      ),
    ).toBe(false);
  });

  it('rejects a future date entirely', () => {
    expect(
      isLoggableSelfPostedCalendarOccurrence(
        { id: 'sess_1' },
        { occurrenceStartDateTime: '2026-08-15T09:00:00', referenceDateTime },
      ),
    ).toBe(false);
  });

  it('still rejects a cancelled session even when its occurrence is in the past', () => {
    expect(
      isLoggableSelfPostedCalendarOccurrence(
        { id: 'sess_1', status: 'cancelled' },
        { occurrenceStartDateTime: '2026-08-14T10:00:00', referenceDateTime },
      ),
    ).toBe(false);
  });

  it('still rejects a catalogue-linked session even when its occurrence is in the past', () => {
    expect(
      isLoggableSelfPostedCalendarOccurrence(
        { id: 'sess_1', catalogueClassId: 'cls_1' },
        { occurrenceStartDateTime: '2026-08-14T10:00:00', referenceDateTime },
      ),
    ).toBe(false);
  });

  it('is deterministic — never reads the real system clock', () => {
    // Same session/occurrence, two different injected reference instants,
    // two different (correct) answers — proves no hidden `new Date()` call.
    const past = isLoggableSelfPostedCalendarOccurrence(
      { id: 'sess_1' },
      { occurrenceStartDateTime: '2026-08-14T10:00:00', referenceDateTime: new Date('2026-08-14T09:00:00') },
    );
    const future = isLoggableSelfPostedCalendarOccurrence(
      { id: 'sess_1' },
      { occurrenceStartDateTime: '2026-08-14T10:00:00', referenceDateTime: new Date('2026-08-14T11:00:00') },
    );
    expect(past).toBe(false);
    expect(future).toBe(true);
  });
});

// ──────────────────────────────────────────────
// buildSelfPostedCalendarLogContext (Phase 3 calendar-originated slice)
// ──────────────────────────────────────────────

describe('buildSelfPostedCalendarLogContext', () => {
  function makeSelfPostedSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
    return {
      id: 'sess_1',
      day: 'Mandag',
      name: 'Egen løbetur',
      category: 'Fysisk træning',
      start: '17:00',
      end: '18:30',
      location: 'Fælledparken',
      status: 'active',
      ...overrides,
    };
  }

  const ctx = { dateISO: '2026-08-14', userId: 'fighter@example.com' };

  it('throws for an ineligible (catalogue-linked) session', () => {
    expect(() =>
      buildSelfPostedCalendarLogContext(makeSelfPostedSession({ catalogueClassId: 'cls_1' }), ctx),
    ).toThrow(/not an eligible self-posted calendar session/);
  });

  it('does not mutate the input session', () => {
    const session = makeSelfPostedSession();
    const snapshot = { ...session };
    buildSelfPostedCalendarLogContext(session, ctx);
    expect(session).toEqual(snapshot);
  });

  it('returns only the prefill required by the caller — no unused occurrence/calendarEntry structures', () => {
    const prefill = buildSelfPostedCalendarLogContext(makeSelfPostedSession(), ctx);
    expect(prefill).not.toHaveProperty('occurrence');
    expect(prefill).not.toHaveProperty('calendarEntry');
  });

  it('prefills title, discipline, dateISO, start, location and computed duration', () => {
    const prefill = buildSelfPostedCalendarLogContext(makeSelfPostedSession(), ctx);
    expect(prefill.title).toBe('Egen løbetur');
    expect(prefill.discipline).toBe('Fysisk træning');
    expect(prefill.dateISO).toBe('2026-08-14');
    expect(prefill.start).toBe('17:00');
    expect(prefill.location).toBe('Fælledparken');
    expect(prefill.durationMinutes).toBe(90);
  });

  it('does not prefill notes or intensity — those remain user-entered', () => {
    const prefill = buildSelfPostedCalendarLogContext(makeSelfPostedSession(), ctx);
    expect(prefill.notes).toBeUndefined();
    expect(prefill.intensity).toBeUndefined();
  });

  it('attaches origin with the raw sessionId and occurrenceDateISO — not any adapter-derived formatted id', () => {
    const prefill = buildSelfPostedCalendarLogContext(makeSelfPostedSession(), ctx);
    expect(prefill.origin).toEqual({
      type: 'self_posted_calendar_session',
      sessionId: 'sess_1',
      occurrenceDateISO: '2026-08-14',
    });
  });

  it('uses the explicit occurrence date context, never a toISOString-derived date', () => {
    const prefill = buildSelfPostedCalendarLogContext(makeSelfPostedSession(), {
      dateISO: '2026-01-01',
      userId: 'fighter@example.com',
    });
    expect(prefill.dateISO).toBe('2026-01-01');
    expect(prefill.origin?.occurrenceDateISO).toBe('2026-01-01');
  });

  // ── Duration edge cases (Task #10) — reject rather than silently invent
  // or return a zero/negative duration. Overnight sessions are out of scope.

  it('throws when the end time is missing/blank rather than prefilling a zero duration', () => {
    expect(() =>
      buildSelfPostedCalendarLogContext(makeSelfPostedSession({ end: '' }), ctx),
    ).toThrow(/valid positive duration/);
  });

  it('throws when end equals start (zero duration)', () => {
    expect(() =>
      buildSelfPostedCalendarLogContext(makeSelfPostedSession({ start: '17:00', end: '17:00' }), ctx),
    ).toThrow(/valid positive duration/);
  });

  it('throws when end is before start under the current same-date model (negative duration)', () => {
    expect(() =>
      buildSelfPostedCalendarLogContext(makeSelfPostedSession({ start: '17:00', end: '16:00' }), ctx),
    ).toThrow(/valid positive duration/);
  });

  it('still builds successfully for a valid same-day positive duration (regression)', () => {
    const prefill = buildSelfPostedCalendarLogContext(makeSelfPostedSession({ start: '17:00', end: '18:30' }), ctx);
    expect(prefill.durationMinutes).toBe(90);
  });
});

// ──────────────────────────────────────────────
// decideLogTrainingSheetClose (Task #5 cancel-return state transition)
// ──────────────────────────────────────────────

describe('decideLogTrainingSheetClose', () => {
  it('does not reopen the SessionModal after a successful save', () => {
    expect(decideLogTrainingSheetClose({ justSaved: true, hasEditingSession: true })).toEqual({
      reopenSessionModal: false,
    });
  });

  it('reopens the SessionModal on cancel when a session was being edited', () => {
    expect(decideLogTrainingSheetClose({ justSaved: false, hasEditingSession: true })).toEqual({
      reopenSessionModal: true,
    });
  });

  it('does not reopen when there is no editing session to restore', () => {
    expect(decideLogTrainingSheetClose({ justSaved: false, hasEditingSession: false })).toEqual({
      reopenSessionModal: false,
    });
  });

  it('does not reopen when saved and (defensively) no editing session remains', () => {
    expect(decideLogTrainingSheetClose({ justSaved: true, hasEditingSession: false })).toEqual({
      reopenSessionModal: false,
    });
  });
});
