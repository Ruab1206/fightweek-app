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
import type { CompletedSelfPostedTrainingInput } from './selfPostedTraining';

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
export function toDateTime(dateISO: string, time?: string): string {
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

// ──────────────────────────────────────────────
// Self-posted eligibility (Phase 3 calendar-originated TrainingLog slice)
// ──────────────────────────────────────────────

/**
 * Minimal shape needed to classify a legacy calendar entry. Deliberately
 * loose (mirrors how the current app routes these entries in `App.tsx`) —
 * the legacy model has no explicit self-posted discriminant; eligibility is
 * inferred by excluding every other known variant, not asserted by a tag.
 */
export interface LegacyCalendarSessionCandidate {
  id?: string | number;
  type?: string;
  catalogueClassId?: string;
  isRestDay?: boolean;
  status?: string;
}

/**
 * Whether a legacy calendar entry is a structurally eligible, persisted,
 * self-posted training session for the calendar-originated "Log træning"
 * action. Pure classification only — no ownership/authorization (a separate,
 * caller-supplied concern), no time/future check (see
 * `isLoggableSelfPostedCalendarOccurrence` below), and no attendance
 * inference. A session is eligible only when it is NOT a rest-day marker,
 * NOT fravær, NOT a virtual event/invitation session, NOT catalogue-linked,
 * NOT cancelled, and already has a persisted (non-empty) id — an unsaved new
 * session has no id yet.
 */
export function isEligibleSelfPostedCalendarSession(
  session: LegacyCalendarSessionCandidate | null | undefined,
): boolean {
  if (!session) return false;
  if (session.isRestDay) return false;
  if (session.type === 'fravær' || session.type === 'event' || session.type === 'invitation') return false;
  if (session.catalogueClassId) return false;
  if (session.status === 'cancelled') return false;
  return session.id !== undefined && session.id !== null && String(session.id).trim().length > 0;
}

/**
 * Explicit inputs for the future-occurrence check, kept separate from the
 * system clock so the application-level eligibility function stays
 * deterministic and testable. `occurrenceStartDateTime` uses the same local
 * (non-UTC) datetime convention as `toDateTime`/`sessionToOccurrenceAndEntry`.
 */
export interface SelfPostedCalendarOccurrenceTiming {
  /** Local "YYYY-MM-DDTHH:mm:ss" occurrence start, e.g. from `toDateTime`. */
  occurrenceStartDateTime: string;
  /** Injected reference instant — never read from the system clock here. */
  referenceDateTime: Date;
}

/**
 * Application-level eligibility: the structural check above, plus whether
 * the selected occurrence's local start is not in the future relative to an
 * explicitly injected reference instant. Never calls `new Date()` itself —
 * callers (the application layer) supply `referenceDateTime`, so this stays
 * pure and deterministic for tests. This is a UI-availability check only;
 * the existing completed-training domain validator remains the definitive,
 * unchanged protection against a future completed-training timestamp at
 * save time.
 */
export function isLoggableSelfPostedCalendarOccurrence(
  session: LegacyCalendarSessionCandidate | null | undefined,
  timing: SelfPostedCalendarOccurrenceTiming,
): boolean {
  if (!isEligibleSelfPostedCalendarSession(session)) return false;
  const startMs = new Date(timing.occurrenceStartDateTime).getTime();
  if (!Number.isFinite(startMs)) return false;
  return startMs <= timing.referenceDateTime.getTime();
}

// ──────────────────────────────────────────────
// Legacy session → calendar-originated log prefill (Phase 3 active slice)
// ──────────────────────────────────────────────

/**
 * Pure adapter: an eligible legacy self-posted `TrainingSession` + explicit
 * occurrence context → a prefilled `CompletedSelfPostedTrainingInput` for the
 * existing completed-training log lifecycle (validate → build → persist),
 * unchanged. Internally reuses `sessionToOccurrenceAndEntry` for field
 * mapping (title/discipline/location/status) rather than duplicating those
 * rules; the intermediate `EventOccurrence`/`CalendarEntry` are not exposed
 * because nothing in the approved calendar-originated flow needs them beyond
 * this mapping step.
 *
 * No Firestore, no mutation of `session`, no attendance inference — the
 * caller (application layer) still owns validation/save via the existing
 * `addCompletedTrainingLog` coordinator.
 *
 * Provenance is limited to `sessionId` + `occurrenceDateISO` — the raw values
 * already established as identity-bearing together (see `TrainingLogOrigin`)
 * — not the adapter's own formatted `occurrence.id`/`entry.id` strings, which
 * are derived, unpersisted concatenations of those same two values and add
 * no independent identifying information.
 *
 * @throws if `session` is not `isEligibleSelfPostedCalendarSession`, or if
 * the session cannot yield a positive duration (missing/blank end time, end
 * equal to start, or end before start under the current same-date model).
 * This slice does not redesign overnight sessions or repair old data — a
 * session that cannot produce a valid positive duration is rejected here
 * rather than silently prefilled with an invented or zero duration. Callers
 * must gate on `isLoggableSelfPostedCalendarOccurrence` before invoking this
 * adapter, and must handle this throw without crashing (e.g. show a toast)
 * for the residual cases it alone can detect.
 */
export function buildSelfPostedCalendarLogContext(
  session: TrainingSession,
  ctx: SessionAdapterContext,
): CompletedSelfPostedTrainingInput {
  if (!isEligibleSelfPostedCalendarSession(session)) {
    throw new Error(
      'buildSelfPostedCalendarLogContext: session is not an eligible self-posted calendar session',
    );
  }

  const { occurrence } = sessionToOccurrenceAndEntry(session, ctx);

  const startMs = new Date(occurrence.startDateTime).getTime();
  const endMs = new Date(occurrence.endDateTime).getTime();
  const durationMinutes = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.round((endMs - startMs) / 60000)
    : NaN;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error(
      'buildSelfPostedCalendarLogContext: session does not have a valid positive duration',
    );
  }

  const prefill: CompletedSelfPostedTrainingInput = {
    title: occurrence.title,
    dateISO: ctx.dateISO,
    durationMinutes,
    origin: {
      type: 'self_posted_calendar_session',
      sessionId: String(session.id),
      occurrenceDateISO: ctx.dateISO,
    },
  };
  if (session.start) prefill.start = session.start;
  if (occurrence.discipline !== undefined) prefill.discipline = occurrence.discipline;
  if (occurrence.location !== undefined) prefill.location = occurrence.location;

  return prefill;
}

// ──────────────────────────────────────────────
// Calendar-originated log-sheet close decision (Phase 3 active slice)
// ──────────────────────────────────────────────

/**
 * Pure state-transition decision for closing the calendar-originated
 * `LogTrainingSheet`: on an explicit save, the fighter returns to the
 * calendar; on cancel/close without saving, the originating `SessionModal`
 * is restored for the same selected occurrence (its `editingSession`/
 * `editingDay`/`editingWeek` are left untouched by the caller so this is a
 * pure visibility toggle, not a data reload).
 */
export function decideLogTrainingSheetClose(params: {
  justSaved: boolean;
  hasEditingSession: boolean;
}): { reopenSessionModal: boolean } {
  return { reopenSessionModal: !params.justSaved && params.hasEditingSession };
}
