import { describe, it, expect } from 'vitest';
import {
  catalogueClassToSeries,
  eventToOccurrence,
  fraværToOccurrence,
  sessionToOccurrenceAndEntry,
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
