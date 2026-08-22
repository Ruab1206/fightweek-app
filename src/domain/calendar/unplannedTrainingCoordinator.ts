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
 * new-model calendar aggregate + TrainingLog pair).
 */
import {
  buildNewModelCalendarAggregate,
  type UnplannedTrainingCreationIds,
  type BuildNewModelCalendarAggregateDeps,
} from './newModelCalendarAggregate';
import {
  buildCompletedSelfPostedTrainingLog,
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
 * pre-minted `UnplannedTrainingCreationIds` bundle. Always attaches a
 * `new_model_calendar_entry` origin to the log (overriding any `origin`
 * present on `input` — this coordinator is only used for the new-model
 * unplanned-training path, never for calendar-originated/legacy creation).
 *
 * Throws (via `buildNewModelCalendarAggregate`'s reused validation) on
 * invalid input, including a future completed-training timestamp — building
 * neither record rather than an inconsistent pair.
 */
export function buildUnplannedTrainingRecords(
  input: CompletedSelfPostedTrainingInput,
  ids: UnplannedTrainingCreationIds,
  deps: BuildNewModelCalendarAggregateDeps = {},
): UnplannedTrainingRecords {
  const aggregate = buildNewModelCalendarAggregate(input, ids, deps);

  const logInput: CompletedSelfPostedTrainingInput = {
    ...input,
    origin: {
      type: 'new_model_calendar_entry',
      aggregateId: ids.aggregateId,
      occurrenceId: ids.occurrenceId,
    },
  };

  const logRecord = buildCompletedSelfPostedTrainingLog(logInput, {
    nowISO: deps.nowISO,
    ids: {
      occurrenceId: ids.occurrenceId,
      calendarEntryId: ids.calendarEntryId,
      recordId: ids.logRecordId,
    },
  });

  return { aggregate, logRecord };
}
