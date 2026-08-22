/**
 * newModelCalendarAggregate — Checkpoint A: pure new-model calendar aggregate
 * builder and read-only calendar projection for unplanned completed training.
 *
 * See `/docs/fightweek_refactoring_plan.md` — "Phase 3 checkpoint (2026-08-22)"
 * and the standalone-flow consistency direction recorded there. This module
 * is PURE — no Firestore, no React, no side effects — so the new-model
 * `EventOccurrence` + `CalendarEntry` aggregate and its projection into the
 * current calendar read shape can be proven before any persistence, rule, or
 * merge-hook wiring exists. Nothing here changes how anything is persisted
 * or rendered today.
 */
import {
  validateCompletedSelfPostedTrainingInput,
  type CompletedSelfPostedTrainingInput,
} from './selfPostedTraining';
import { toDateTime } from './adapters';
import { getISOWeekForDate } from '../../utils/dateUtils';
import { DAYS } from '../../config/constants';
import type {
  NewModelCalendarAggregate,
  ProjectedNewModelCalendarEntry,
  EventOccurrence,
  CalendarEntry,
} from './types';

// ──────────────────────────────────────────────
// Creation id bundle
// ──────────────────────────────────────────────

/** The four distinct identities minted for one unplanned-training creation action. */
export interface UnplannedTrainingCreationIds {
  aggregateId: string;
  occurrenceId: string;
  calendarEntryId: string;
  logRecordId: string;
}

/**
 * Mint the four ids needed to create a `NewModelCalendarAggregate` alongside
 * its paired `TrainingLog`, before either record is built. Calls the injected
 * generator exactly four times — never derives an id from the training input
 * (title/date/time/discipline/location), so two calls with identical input
 * still produce distinct, unrelated ids.
 */
export function mintUnplannedTrainingCreationIds(
  generateId: () => string,
): UnplannedTrainingCreationIds {
  return {
    aggregateId: generateId(),
    occurrenceId: generateId(),
    calendarEntryId: generateId(),
    logRecordId: generateId(),
  };
}

// ──────────────────────────────────────────────
// Aggregate builder
// ──────────────────────────────────────────────

/** Injectable clock so the builder stays deterministic and testable. */
export interface BuildNewModelCalendarAggregateDeps {
  /** Stamps `createdAt`/`updatedAt`. Defaults to `new Date().toISOString()`. */
  nowISO?: () => string;
  /** Reference instant for the future-timestamp validation rule. Defaults to `new Date()`. */
  now?: () => Date;
}

function defaultNowISO(): string {
  return new Date().toISOString();
}

/**
 * Local-safe: add `minutes` to a local "YYYY-MM-DDTHH:mm:ss" datetime string
 * (no timezone suffix) and return the result in the SAME local convention.
 * Deliberately does not round-trip through `toISOString()` (which would
 * convert to UTC and could silently shift the calendar date), so the
 * resulting `endDateTime` stays safe for direct local date/time extraction
 * by the projection below.
 */
function addMinutesLocal(dateTime: string, minutes: number): string {
  const d = new Date(dateTime);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Build a `NewModelCalendarAggregate` for one unplanned completed-training
 * action. Pure — no Firebase, no React, no mutation of `input`/`ids`.
 *
 * Reuses `validateCompletedSelfPostedTrainingInput` (the same rule that
 * protects the existing standalone/calendar-originated flows) and throws on
 * failure — including a future completed-training timestamp — rather than
 * building an invalid aggregate.
 *
 * Does NOT set `source`/legacy-session identity/Participation/recurrence —
 * out of scope for Checkpoint A.
 */
export function buildNewModelCalendarAggregate(
  input: CompletedSelfPostedTrainingInput,
  ids: UnplannedTrainingCreationIds,
  deps: BuildNewModelCalendarAggregateDeps = {},
): NewModelCalendarAggregate {
  const errors = validateCompletedSelfPostedTrainingInput(input, { now: deps.now });
  if (errors.length > 0) {
    throw new Error(
      `buildNewModelCalendarAggregate: validation failed:\n${errors.join('\n')}`,
    );
  }

  const nowISO = deps.nowISO ?? defaultNowISO;
  const now = nowISO();
  const userId = input.userId ?? '';

  const startDateTime = toDateTime(input.dateISO, input.start);
  const endDateTime =
    input.end !== undefined
      ? toDateTime(input.dateISO, input.end)
      : addMinutesLocal(startDateTime, input.durationMinutes ?? 0);

  const occurrence: EventOccurrence = {
    id: ids.occurrenceId,
    seriesId: null,
    type: 'self_posted_training',
    title: input.title,
    startDateTime,
    endDateTime,
    status: 'completed',
  };
  // Firestore-safe: omit rather than assign undefined for absent optional fields.
  if (input.discipline !== undefined) occurrence.discipline = input.discipline;
  if (input.location !== undefined) occurrence.location = input.location;

  const calendarEntry: CalendarEntry = {
    id: ids.calendarEntryId,
    occurrenceId: ids.occurrenceId,
    status: 'completed',
  };
  if (input.userId !== undefined) calendarEntry.userId = input.userId;

  return {
    id: ids.aggregateId,
    userId,
    occurrence,
    calendarEntry,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    logRecordId: ids.logRecordId,
  };
}

// ──────────────────────────────────────────────
// Calendar projection
// ──────────────────────────────────────────────

/** Where a projected entry belongs in the current week/day calendar shape, plus the entry itself. */
export interface ProjectedNewModelCalendarPlacement {
  weekNumber: number;
  dayName: string;
  entry: ProjectedNewModelCalendarEntry;
}

const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Strictly parsed local "YYYY-MM-DDTHH:mm[:ss]" datetime: the validated date
 * portion, the "HH:mm" time portion, and a local instant (epoch ms) usable
 * ONLY for ordering comparisons (start vs end) — never for day placement,
 * which uses `dateISO` directly.
 */
interface ParsedLocalDateTime {
  dateISO: string;
  time: string;
  instant: number;
}

/**
 * Parse and strictly validate a local ISO datetime string. Rejects malformed
 * strings, out-of-range time components, AND impossible calendar dates (e.g.
 * "2026-02-31", "2026-13-10", "2026-00-10") that `new Date(...)` would
 * otherwise silently normalize onto a different day/month instead of
 * rejecting — normalization this projection must never rely on for
 * placement.
 */
function parseLocalDateTimeStrict(value: string, fieldName: string): ParsedLocalDateTime {
  const match = LOCAL_DATETIME_RE.exec(value);
  if (!match) {
    throw new Error(
      `projectNewModelCalendarAggregate: ${fieldName} is not a valid local ISO datetime`,
    );
  }
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s !== undefined ? Number(s) : 0;

  // UTC round-trip: constructing then reading back Y/M/D detects any
  // day/month overflow regardless of the runner's local timezone.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(
      `projectNewModelCalendarAggregate: ${fieldName} is not a valid calendar date`,
    );
  }
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(
      `projectNewModelCalendarAggregate: ${fieldName} is not a valid time of day`,
    );
  }

  return {
    dateISO: `${y}-${mo}-${d}`,
    time: `${h}:${mi}`,
    instant: new Date(year, month - 1, day, hour, minute, second).getTime(),
  };
}

/**
 * Project a `NewModelCalendarAggregate` into the minimum shape the current
 * calendar UI needs (`PersonalSchedule`/`MobileScrollView`/`SearchOverlay`).
 * Pure — no Firebase, no React, no hook dependency, no mutation of
 * `aggregate`. Does NOT implement a merge hook; callers wire this into the
 * existing week/day shape themselves.
 *
 * Placement is derived from `occurrence.startDateTime` only, using the same
 * local-date convention as the rest of the calendar merge pipeline (parse the
 * date portion directly, then build a local midnight `Date` for week/day
 * math) — never `toISOString().slice(0, 10)`, which would convert to UTC and
 * could silently shift the calendar date.
 *
 * Throws if `occurrence.startDateTime`/`endDateTime` are not a valid local
 * "YYYY-MM-DDTHH:mm[:ss]" datetime, resolve to an impossible calendar date
 * (e.g. "2026-02-31"), or if `endDateTime` is before `startDateTime` — the
 * aggregate type permits direct/external construction, so this projection
 * cannot assume it only ever receives builder-produced aggregates.
 */
export function projectNewModelCalendarAggregate(
  aggregate: NewModelCalendarAggregate,
): ProjectedNewModelCalendarPlacement {
  const { occurrence, calendarEntry } = aggregate;

  const startParsed = parseLocalDateTimeStrict(occurrence.startDateTime, 'occurrence.startDateTime');
  const endParsed = parseLocalDateTimeStrict(occurrence.endDateTime, 'occurrence.endDateTime');

  if (endParsed.instant < startParsed.instant) {
    throw new Error(
      'projectNewModelCalendarAggregate: occurrence.endDateTime must not be before occurrence.startDateTime',
    );
  }

  const placementDate = new Date(`${startParsed.dateISO}T00:00:00`);

  const weekNumber = getISOWeekForDate(placementDate);
  const dayName = DAYS[(placementDate.getDay() + 6) % 7];

  const isCancelled = occurrence.status === 'cancelled' || calendarEntry.status === 'cancelled';

  const entry: ProjectedNewModelCalendarEntry = {
    type: 'calendar_entry',
    readOnly: true,
    aggregateId: aggregate.id,
    occurrenceId: occurrence.id,
    calendarEntryId: calendarEntry.id,
    name: occurrence.title,
    category: occurrence.discipline ?? '',
    start: startParsed.time,
    end: endParsed.time,
    status: isCancelled ? 'cancelled' : 'active',
  };
  if (occurrence.location !== undefined) entry.location = occurrence.location;

  return { weekNumber, dayName, entry };
}
