/**
 * selfPostedOperations — pure canonical self-posted application operations
 * (see `/docs/self_posted_lifecycle_and_invariants.md` Sections D and I,
 * step 3: pure canonical operation extraction). Each operation is pure,
 * Firestore-free, React-free, and independently testable. None persists
 * anything, and none claims to enforce persisted uniqueness (I7/I8
 * enforcement remains deferred — see the canonical contract's enforcement
 * note).
 *
 * TERMINOLOGY (see the contract's Section I / decision §23):
 * - `createSelfPostedOccurrence` and `addOccurrenceToFighterCalendar` are
 *   canonical pure operations with narrow, log-independent inputs.
 * - `buildTransitionalSelfPostedTrainingLog` is a TRANSITIONAL current-
 *   snapshot compatibility adapter, NOT yet the final occurrence-oriented
 *   `LogOccurrence` operation (see its own doc-comment below).
 *
 * `createSelfPostedOccurrence` intentionally does NOT reuse `buildLogContext`
 * from `./selfPostedTraining` — that helper adds `hasLogs: true` and computes
 * a derived end time via a UTC round-trip, which is the current behaviour for
 * a TrainingLog's own embedded snapshot, but is NOT what the aggregate
 * occurrence uses (no `hasLogs`, and a local-safe end-time calculation). This
 * occurrence/log snapshot divergence is a documented TRANSITIONAL gap
 * (contract Section E); this operation mirrors the aggregate occurrence's
 * existing construction exactly, so composing it changes no persisted output.
 */
import { toDateTime } from './adapters';
import type {
  CompletedSelfPostedTrainingInput,
  CompletedSelfPostedTrainingDeps,
} from './selfPostedTraining';
import { buildCompletedSelfPostedTrainingLog } from './selfPostedTraining';
import type {
  EventOccurrence,
  CalendarEntry,
  CalendarEntryStatus,
  CompletedSelfPostedTrainingLog,
} from './types';

// ──────────────────────────────────────────────
// CreateSelfPostedOccurrence — canonical pure operation
// ──────────────────────────────────────────────

/**
 * Narrow, occurrence-only input for `createSelfPostedOccurrence`. Contains
 * exactly the fields needed to build a self-posted `EventOccurrence` — no
 * log, CalendarEntry, provenance, or id fields — so the operation cannot
 * depend on TrainingLog/CalendarEntry concerns.
 */
export interface SelfPostedOccurrenceInput {
  title: string;
  discipline?: string;
  dateISO: string;
  start?: string;
  end?: string;
  durationMinutes?: number;
  location?: string;
}

/** Map the broad completed-training form DTO down to the narrow occurrence input. */
export function toSelfPostedOccurrenceInput(
  input: CompletedSelfPostedTrainingInput,
): SelfPostedOccurrenceInput {
  const occ: SelfPostedOccurrenceInput = { title: input.title, dateISO: input.dateISO };
  if (input.discipline !== undefined) occ.discipline = input.discipline;
  if (input.start !== undefined) occ.start = input.start;
  if (input.end !== undefined) occ.end = input.end;
  if (input.durationMinutes !== undefined) occ.durationMinutes = input.durationMinutes;
  if (input.location !== undefined) occ.location = input.location;
  return occ;
}

/**
 * Local-safe: add `minutes` to a local "YYYY-MM-DDTHH:mm:ss" datetime string
 * and return the result in the same local convention, without round-tripping
 * through `toISOString()` (which would convert to UTC and could silently
 * shift the calendar date). Mirrors the historical private helper in the
 * previous aggregate builder exactly, so `createSelfPostedOccurrence`
 * produces byte-identical occurrence output.
 */
function addMinutesLocal(dateTime: string, minutes: number): string {
  const d = new Date(dateTime);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * CreateSelfPostedOccurrence — build one `EventOccurrence` from a narrow
 * occurrence input. Takes no `CalendarEntry`/`TrainingLog` input, no
 * Firestore dependency, and is UI-entry-neutral. Occurrence status is
 * `'completed'` for this self-posted-completed flow (unchanged from the
 * previous builder). Caller validates the source form input beforehand.
 */
export function createSelfPostedOccurrence(
  input: SelfPostedOccurrenceInput,
  occurrenceId: string,
): EventOccurrence {
  const startDateTime = toDateTime(input.dateISO, input.start);
  const endDateTime =
    input.end !== undefined
      ? toDateTime(input.dateISO, input.end)
      : addMinutesLocal(startDateTime, input.durationMinutes ?? 0);

  const occurrence: EventOccurrence = {
    id: occurrenceId,
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

  return occurrence;
}

/**
 * AddOccurrenceToFighterCalendar — build one fighter-specific `CalendarEntry`
 * for an existing `EventOccurrence`. Takes no `TrainingLog`/`logRecordId`
 * input, so a `CalendarEntry` can be built without ever knowing a
 * `TrainingLog` exists (I2 at the builder/application-contract level).
 * Never infers `Participation` or a `Note`.
 */
export function addOccurrenceToFighterCalendar(
  occurrence: EventOccurrence,
  calendarEntryId: string,
  status: CalendarEntryStatus,
  userId?: string,
): CalendarEntry {
  const calendarEntry: CalendarEntry = {
    id: calendarEntryId,
    occurrenceId: occurrence.id,
    status,
  };
  if (userId !== undefined) calendarEntry.userId = userId;

  return calendarEntry;
}

// ──────────────────────────────────────────────
// TransitionalSelfPostedTrainingLog — TRANSITIONAL compatibility adapter
// ──────────────────────────────────────────────

/**
 * buildTransitionalSelfPostedTrainingLog — TRANSITIONAL current-snapshot
 * compatibility adapter. It is NOT yet the final canonical
 * occurrence-oriented `LogOccurrence` operation.
 *
 * - It delegates to the existing `buildCompletedSelfPostedTrainingLog`
 *   snapshot builder, which reconstructs the TrainingLog's own historical
 *   occurrence snapshot and embedded CalendarEntry from the form input.
 * - Kept for byte compatibility: the persisted `eventLogs` snapshot currently
 *   diverges from the aggregate's canonical occurrence/CalendarEntry (see
 *   `/docs/self_posted_lifecycle_and_invariants.md` Section E — occurrence
 *   `endDateTime` representation, `hasLogs`, and embedded
 *   `calendarEntry.userId`). Consuming the canonical occurrence/CalendarEntry
 *   here would change the persisted TrainingLog shape and is out of scope for
 *   this slice.
 * - Replacement direction: consume an approved canonical occurrence and
 *   CalendarEntry snapshot after the snapshot-normalization slice.
 * - Retirement condition: existing and future TrainingLogs use one approved
 *   canonical snapshot representation.
 */
export function buildTransitionalSelfPostedTrainingLog(
  input: CompletedSelfPostedTrainingInput,
  deps: CompletedSelfPostedTrainingDeps = {},
): CompletedSelfPostedTrainingLog {
  return buildCompletedSelfPostedTrainingLog(input, deps);
}
