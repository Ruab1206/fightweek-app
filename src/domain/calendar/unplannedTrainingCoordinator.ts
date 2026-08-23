/**
 * unplannedTrainingCoordinator — Checkpoint B: pure coordinator that builds a
 * `NewModelCalendarAggregate` and its paired `CompletedSelfPostedTrainingLog`
 * from ONE shared `UnplannedTrainingCreationIds` bundle, so both records
 * carry the identical occurrence/calendarEntry identity and the log's `id`
 * matches `ids.logRecordId` exactly. No Firebase, no React, no mutation of
 * `input`/`ids`. Deciding *when* to mint the bundle and *how* to persist the
 * pair atomically are the caller's/adapter's responsibility — this module
 * only builds records.
 *
 * See `/docs/fightweek_refactoring_plan.md` — Checkpoint B (bilateral
 * new-model calendar aggregate + TrainingLog pair) and
 * `/docs/self_posted_lifecycle_and_invariants.md` Section I step 3 (pure
 * canonical operation extraction). This coordinator COMPOSES the canonical
 * operations (`createSelfPostedOccurrence`, `addOccurrenceToFighterCalendar`)
 * plus the one authoritative envelope assembler for the aggregate, and uses
 * the TRANSITIONAL `buildTransitionalSelfPostedTrainingLog` for the paired
 * log — behaviour-preserving: the resulting `NewModelCalendarAggregate` and
 * TrainingLog shapes, field names, `schemaVersion`, `status`, and
 * `logRecordId` pairing are unchanged. This does NOT make persisted
 * `CalendarEntry` independent of `TrainingLog` — the envelope assembled below
 * still requires `logRecordId`, and Firestore rules are unchanged; persisted
 * I2 remains a separately gated, later step.
 */
import {
  assembleNewModelCalendarAggregate,
  type UnplannedTrainingCreationIds,
  type BuildNewModelCalendarAggregateDeps,
} from './newModelCalendarAggregate';
import {
  createSelfPostedOccurrence,
  addOccurrenceToFighterCalendar,
  buildTransitionalSelfPostedTrainingLog,
  toSelfPostedOccurrenceInput,
} from './selfPostedOperations';
import {
  validateCompletedSelfPostedTrainingInput,
  type CompletedSelfPostedTrainingInput,
} from './selfPostedTraining';
import type { NewModelCalendarAggregate, CompletedSelfPostedTrainingLog } from './types';

/** The two aggregate roots created together for one unplanned-training action. */
export interface UnplannedTrainingRecords {
  aggregate: NewModelCalendarAggregate;
  logRecord: CompletedSelfPostedTrainingLog;
}

/**
 * Build the calendar aggregate and its paired TrainingLog from one
 * pre-minted `UnplannedTrainingCreationIds` bundle, composed from the
 * canonical self-posted operations plus the one authoritative envelope
 * assembler. Always attaches a `new_model_calendar_entry` origin to the log
 * (overriding any `origin` present on `input` — this coordinator is only
 * used for the new-model unplanned-training path, never for calendar-
 * originated/legacy creation).
 *
 * The aggregate uses the CANONICAL occurrence + CalendarEntry; the TrainingLog
 * still uses the TRANSITIONAL current-snapshot builder, which reconstructs its
 * own (currently divergent) occurrence/CalendarEntry snapshot for byte
 * compatibility (see the contract's Section E). One semantic occurrence
 * record does NOT yet feed both persisted snapshots — that is a separately
 * gated normalization step.
 *
 * Throws on invalid input, including a future completed-training timestamp —
 * building neither record rather than an inconsistent pair.
 */
export function buildUnplannedTrainingRecords(
  input: CompletedSelfPostedTrainingInput,
  ids: UnplannedTrainingCreationIds,
  deps: BuildNewModelCalendarAggregateDeps = {},
): UnplannedTrainingRecords {
  const errors = validateCompletedSelfPostedTrainingInput(input, { now: deps.now });
  if (errors.length > 0) {
    throw new Error(`buildUnplannedTrainingRecords: validation failed:\n${errors.join('\n')}`);
  }

  const nowISO = deps.nowISO ?? (() => new Date().toISOString());
  const now = nowISO();

  // Canonical operations feed the aggregate. CalendarEntry never receives a
  // TrainingLog/logRecordId input (see selfPostedOperations.ts).
  const occurrence = createSelfPostedOccurrence(toSelfPostedOccurrenceInput(input), ids.occurrenceId);
  const calendarEntry = addOccurrenceToFighterCalendar(occurrence, ids.calendarEntryId, 'completed', input.userId);

  const aggregate = assembleNewModelCalendarAggregate({
    aggregateId: ids.aggregateId,
    userId: input.userId ?? '',
    occurrence,
    calendarEntry,
    logRecordId: ids.logRecordId,
    createdAt: now,
    updatedAt: now,
  });

  const logInput: CompletedSelfPostedTrainingInput = {
    ...input,
    origin: {
      type: 'new_model_calendar_entry',
      aggregateId: ids.aggregateId,
      occurrenceId: ids.occurrenceId,
    },
  };

  // TRANSITIONAL: rebuilds the log's own (currently divergent) snapshot — see
  // buildTransitionalSelfPostedTrainingLog. Not yet the canonical LogOccurrence.
  const logRecord = buildTransitionalSelfPostedTrainingLog(logInput, {
    nowISO: deps.nowISO,
    ids: {
      occurrenceId: ids.occurrenceId,
      calendarEntryId: ids.calendarEntryId,
      recordId: ids.logRecordId,
    },
  });

  return { aggregate, logRecord };
}
