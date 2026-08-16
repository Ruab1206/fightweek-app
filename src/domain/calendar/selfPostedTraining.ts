/**
 * Log completed self-posted training (Phase 3 — active strangler slice).
 *
 * See `/docs/fightweek_refactoring_plan.md` — "Active Slice: Log completed
 * self-posted training" and "Domain clarification: notes/comments vs logs".
 *
 * This module is PURE — no Firestore, no React, no side effects — so it can
 * be unit-tested in isolation. It builds a self-contained
 * `CompletedSelfPostedTrainingLog` record: a snapshot of occurrence context
 * bundled with a calendar-entry-style reference and the log itself, so a
 * chronological history view can render it without a live lookup of the
 * originating occurrence or calendar entry.
 *
 * IMPORTANT domain rule: a note/comment on a calendar entry does NOT by
 * itself mean training happened. A `CompletedSelfPostedTrainingLog` is
 * different — it is only created when the user explicitly registers training
 * as completed/happened. Do not generalize these helpers to ordinary notes on
 * classes, events, fravær or participation flows.
 *
 * Step 1 scope: pure builders/validators/mappers only. No persistence, no
 * repository, no hook, no UI. Firestore shape/repository wiring is a later
 * step and requires separate approval.
 */
import type {
  CompletedSelfPostedTrainingLog,
  EventOccurrence,
  CalendarEntry,
  EventLog,
  TrainingHistoryItem,
} from './types';

// ──────────────────────────────────────────────
// Input
// ──────────────────────────────────────────────

/** Form-level input for logging a completed self-posted training session. */
export interface CompletedSelfPostedTrainingInput {
  title: string;
  /** Discipline/category — reuse the existing category taxonomy (no new one). */
  discipline?: string;
  /** ISO date "YYYY-MM-DD" the training happened on. */
  dateISO: string;
  /** "HH:mm" start time. Optional if `durationMinutes` is given instead. */
  start?: string;
  /** "HH:mm" end time. Optional if `durationMinutes` is given instead. */
  end?: string;
  /** Used to derive `endDateTime` when `end` is not given. */
  durationMinutes?: number;
  location?: string;
  /**
   * Optional free-text context. A completed training log does NOT require a
   * note — completion is established by the user explicitly using the "log
   * completed training" flow (structured title/date/discipline/time), not by
   * the presence of a note. Notes are additional context only.
   */
  notes?: string;
  /** Optional 1–5 post-session load rating. */
  intensity?: number;
  /**
   * Owning fighter id. Optional here because Step 1 is pure/Firestore-free —
   * a future repository/hook layer supplies this from auth context. Defaults
   * to '' when omitted.
   */
  userId?: string;
}

/** Injectable id/clock so builders stay deterministic and testable. */
export interface CompletedSelfPostedTrainingDeps {
  generateId?: () => string;
  nowISO?: () => string;
}

/**
 * Injectable current-instant clock for the future-date/time validation rule
 * (kept separate from `CompletedSelfPostedTrainingDeps.nowISO`, which stamps
 * `createdAt`/`updatedAt` and is an unrelated concern).
 */
export interface CompletedSelfPostedTrainingValidationDeps {
  /** Defaults to `new Date()`. Injected in tests for deterministic results. */
  now?: () => Date;
}

function defaultId(): string {
  return crypto.randomUUID();
}

function defaultNowISO(): string {
  return new Date().toISOString();
}

function defaultNow(): Date {
  return new Date();
}

/**
 * Combine an ISO date ("YYYY-MM-DD") and an "HH:mm" time into an ISO 8601
 * datetime string. Falls back to midnight when the time is missing/blank.
 * (Deliberately local/duplicated from `./adapters`'s private `toDateTime` —
 * that helper is not exported and this module must stay self-contained.)
 */
function toDateTime(dateISO: string, time?: string): string {
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '00:00';
  const [h, m] = t.split(':');
  return `${dateISO}T${h.padStart(2, '0')}:${m}:00`;
}

/** Minutes between two ISO 8601 datetimes (may be negative if end < start). */
function diffMinutes(startDateTime: string, endDateTime: string): number {
  const start = new Date(startDateTime).getTime();
  const end = new Date(endDateTime).getTime();
  return Math.round((end - start) / 60000);
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Validate input for logging a completed self-posted training session.
 * Returns an array of error messages; empty array = valid.
 *
 * Rules:
 * - title required (non-empty after trim).
 * - dateISO required (YYYY-MM-DD shape).
 * - notes are OPTIONAL — completion is established by the caller explicitly
 *   using the "log completed training" flow with structured fields (title,
 *   date, discipline, time/duration), not by the presence of a note. A
 *   missing note must never fail validation.
 * - either a valid `end` time or a positive `durationMinutes` must be
 *   derivable; `start`/`end`, when given, must match HH:mm.
 * - `intensity`, when given, must be within 1–5.
 * - the training's start (dateISO + start, defaulting to midnight when start
 *   is absent) must not be later than the injected `now` — this flow logs
 *   training that already happened, so a future date OR a future time later
 *   today is rejected. `now`/the candidate start are both plain local `Date`
 *   values (no explicit UTC offset), so this stays correct across local
 *   midnight regardless of timezone (see `toDateTime` below).
 */
export function validateCompletedSelfPostedTrainingInput(
  input: CompletedSelfPostedTrainingInput,
  deps: CompletedSelfPostedTrainingValidationDeps = {},
): string[] {
  const errors: string[] = [];

  if (!input.title || !input.title.trim()) {
    errors.push('title is required');
  }

  if (!input.dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) {
    errors.push('dateISO is required and must be YYYY-MM-DD');
  } else {
    const now = (deps.now ?? defaultNow)();
    const candidateStart = new Date(toDateTime(input.dateISO, input.start));
    if (candidateStart.getTime() > now.getTime()) {
      errors.push('dateISO/start must not be in the future');
    }
  }

  // Notes are optional — do NOT validate their presence. Completion is
  // established by the explicit "log completed training" flow using the
  // structured fields above, never by whether a note was typed.

  if (input.start !== undefined && !TIME_RE.test(input.start)) {
    errors.push('start must be a valid HH:mm time');
  }
  if (input.end !== undefined && !TIME_RE.test(input.end)) {
    errors.push('end must be a valid HH:mm time');
  }

  const hasValidEnd = input.end !== undefined && TIME_RE.test(input.end);
  const hasValidDuration =
    typeof input.durationMinutes === 'number' && input.durationMinutes > 0;
  if (!hasValidEnd && !hasValidDuration) {
    errors.push('either a valid end time or a positive durationMinutes is required');
  }

  if (
    input.intensity !== undefined &&
    (typeof input.intensity !== 'number' || input.intensity < 1 || input.intensity > 5)
  ) {
    errors.push('intensity must be between 1 and 5');
  }

  return errors;
}

// ──────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────

/**
 * Build the preserved occurrence-context snapshot for a completed
 * self-posted training input. This is what keeps the eventual history row
 * understandable independently of any live occurrence/calendar lookup.
 */
export function buildLogContext(
  input: CompletedSelfPostedTrainingInput,
  occurrenceId: string,
): EventOccurrence {
  const startDateTime = toDateTime(input.dateISO, input.start);
  const endDateTime =
    input.end !== undefined
      ? toDateTime(input.dateISO, input.end)
      : new Date(
          new Date(startDateTime).getTime() + (input.durationMinutes ?? 0) * 60000,
        ).toISOString();

  return {
    id: occurrenceId,
    seriesId: null,
    type: 'self_posted_training',
    title: input.title,
    discipline: input.discipline,
    startDateTime,
    endDateTime,
    location: input.location,
    status: 'completed',
    hasLogs: true,
  };
}

/**
 * Build a self-contained `CompletedSelfPostedTrainingLog` record: bundles the
 * preserved occurrence context, a calendar-entry-style reference, and the log
 * data. Pure — no Firestore, no ids/clock side effects beyond the injectable
 * `deps` (defaults to `crypto.randomUUID()` / `new Date().toISOString()`).
 *
 * Does NOT validate; call `validateCompletedSelfPostedTrainingInput` first.
 */
export function buildCompletedSelfPostedTrainingLog(
  input: CompletedSelfPostedTrainingInput,
  deps: CompletedSelfPostedTrainingDeps = {},
): CompletedSelfPostedTrainingLog {
  const generateId = deps.generateId ?? defaultId;
  const nowISO = deps.nowISO ?? defaultNowISO;

  const occurrenceId = generateId();
  const calendarEntryId = generateId();
  const logId = generateId();
  const recordId = generateId();
  const now = nowISO();

  const occurrence = buildLogContext(input, occurrenceId);

  const calendarEntry: CalendarEntry = {
    id: calendarEntryId,
    occurrenceId,
    status: 'completed',
  };

  const log: EventLog = {
    id: logId,
    occurrenceId,
    calendarEntryId,
    userId: input.userId ?? '',
    attended: true,
    actualStartDateTime: occurrence.startDateTime,
    actualEndDateTime: occurrence.endDateTime,
    intensity: input.intensity,
    discipline: input.discipline,
    notes: input.notes,
  };

  return {
    id: recordId,
    occurrence,
    calendarEntry,
    log,
    createdAt: now,
    updatedAt: now,
  };
}

// ──────────────────────────────────────────────
// History mapping
// ──────────────────────────────────────────────

/**
 * Map a self-contained `CompletedSelfPostedTrainingLog` into a render-ready
 * chronological history row. Built ONLY from the log/context record itself —
 * never from weekly calendar/session data — so it remains renderable even if
 * `calendarEntry` visibility is false/absent or the record is otherwise
 * detached from any live calendar entry.
 */
export function logToHistoryItem(
  record: CompletedSelfPostedTrainingLog,
): TrainingHistoryItem {
  const { occurrence, log } = record;
  const durationMinutes = diffMinutes(occurrence.startDateTime, occurrence.endDateTime);

  return {
    id: record.id,
    title: occurrence.title,
    type: occurrence.type,
    discipline: occurrence.discipline,
    startDateTime: occurrence.startDateTime,
    endDateTime: occurrence.endDateTime,
    durationMinutes,
    location: occurrence.location,
    notes: log.notes ?? '',
    intensity: log.intensity,
  };
}
