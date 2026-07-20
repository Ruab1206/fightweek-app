/**
 * Pure adapters: current app/Firestore shapes → calendar domain model.
 *
 * Phase 1 scope: read-only, one-directional (current → domain) translation.
 * These functions are PURE — no Firestore, no React, no side effects — so they
 * can be unit-tested in isolation and reused as the app gradually adopts the
 * domain vocabulary. They do NOT change how anything is persisted or rendered.
 *
 * See `/docs/fightweek_domain_model.md` ("Current implementation mapping").
 */
import type { CatalogueClass } from '../../types/catalogue';
import type { FightweekEvent } from '../../types/event';
import type { TrainingSession, FraværSession } from '../../types/common';
import type {
  EventSeries,
  EventOccurrence,
  CalendarEntry,
  EventType,
  EventStatus,
} from './types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Context required to resolve a per-day session into a concrete occurrence. */
export interface SessionAdapterContext {
  /** ISO date "YYYY-MM-DD" for the concrete day this session occurs on. */
  dateISO: string;
  /** The owning user's stable id (email). */
  userId: string;
  /** Optional calendar id the entry belongs to. */
  calendarId?: string;
}

/**
 * Combine an ISO date ("YYYY-MM-DD") and an "HH:mm" time into an ISO 8601
 * datetime string. Falls back to midnight when the time is missing/blank.
 */
function toDateTime(dateISO: string, time?: string): string {
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '00:00';
  const [h, m] = t.split(':');
  return `${dateISO}T${h.padStart(2, '0')}:${m}:00`;
}

/** Map the current one-off event type to the target `EventType`. */
function mapEventType(type: FightweekEvent['type']): EventType {
  switch (type) {
    case 'tournament':
      return 'tournament';
    case 'seminar':
      return 'seminar';
    case 'social':
      // Target model has no `social` type — collapse to `other`.
      return 'other';
    case 'other':
    default:
      return 'other';
  }
}

/** Derive occurrence status from a training session's active/cancelled flag. */
function sessionStatus(status: TrainingSession['status']): EventStatus {
  return status === 'cancelled' ? 'cancelled' : 'scheduled';
}

// ──────────────────────────────────────────────
// Adapters
// ──────────────────────────────────────────────

/**
 * CatalogueClass (Hold) → EventSeries of type `class`.
 * Preserves the recurring weekly timeslots in a structured recurrence shape
 * (no RRULE). Discipline is kept separate from the event type.
 */
export function catalogueClassToSeries(cls: CatalogueClass): EventSeries {
  return {
    id: cls.id,
    type: 'class',
    title: cls.title,
    discipline: cls.discipline,
    location: cls.location,
    address: cls.address,
    recurrence: {
      schedules: (cls.schedules ?? []).map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    },
    source: cls.source,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
  };
}

/**
 * FightweekEvent (one-off) → EventOccurrence with `seriesId: null`.
 * Uses the event's own date/time. Multi-day events keep their start date and
 * end date; when `endDate` is present the end datetime spans to that day.
 */
export function eventToOccurrence(evt: FightweekEvent): EventOccurrence {
  const startDateTime = toDateTime(evt.date, evt.startTime);
  const endDateTime = toDateTime(evt.endDate ?? evt.date, evt.endTime ?? evt.startTime);
  return {
    id: evt.id,
    seriesId: null,
    type: mapEventType(evt.type),
    title: evt.title,
    discipline: evt.discipline,
    startDateTime,
    endDateTime,
    location: evt.location,
    address: evt.address,
    status: 'scheduled',
    createdAt: evt.createdAt,
    updatedAt: evt.updatedAt,
  };
}

/**
 * FraværSession (absence) → EventOccurrence of type `absence`, `seriesId: null`.
 * Uses the absence's own start/end dates and times, preserving the multi-day
 * span (grouped in the source via `fraværGroupId`).
 */
export function fraværToOccurrence(fravaer: FraværSession): EventOccurrence {
  return {
    id: String(fravaer.id),
    seriesId: null,
    type: 'absence',
    title: fravaer.fraværTitel || fravaer.name,
    startDateTime: toDateTime(fravaer.fraværStartDate, fravaer.fraværStartTime),
    endDateTime: toDateTime(fravaer.fraværEndDate, fravaer.fraværEndTime),
    location: undefined,
    status: 'scheduled',
  };
}

/**
 * TrainingSession (a per-day calendar item) → an {occurrence, entry} pair.
 *
 * The current weekly-schedule session conflates the occurrence (what/when) with
 * the calendar entry (its appearance on the fighter's calendar). This adapter
 * separates them into the target concepts. Requires a context providing the
 * concrete date, the owning user, and optionally the calendar id.
 */
export function sessionToOccurrenceAndEntry(
  session: TrainingSession,
  ctx: SessionAdapterContext,
): { occurrence: EventOccurrence; entry: CalendarEntry } {
  const occurrenceId = `${ctx.dateISO}_${String(session.id ?? session.name)}`;
  const occurrence: EventOccurrence = {
    id: occurrenceId,
    // A catalogue-linked session originates from a class series; a manual
    // session has no series parent.
    seriesId: session.catalogueClassId ?? null,
    type: session.catalogueClassId ? 'class' : 'self_posted_training',
    title: session.name,
    discipline: session.category,
    startDateTime: toDateTime(ctx.dateISO, session.start),
    endDateTime: toDateTime(ctx.dateISO, session.end),
    location: session.location,
    status: sessionStatus(session.status),
  };

  const entry: CalendarEntry = {
    id: `${ctx.userId}_${occurrenceId}`,
    occurrenceId,
    userId: ctx.userId,
    calendarId: ctx.calendarId,
    status: session.status === 'cancelled' ? 'cancelled' : 'planned',
  };

  return { occurrence, entry };
}
