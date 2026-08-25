/**
 * logExistingCalendarEntryCoordinator.ts — application-layer capability for
 * creating a TrainingLog against an already-existing independent CalendarEntry
 * aggregate (persisted CalendarEntry independence, I2/I11 — see
 * `/docs/fightweek_decisions.md` §26 and
 * `/docs/self_posted_lifecycle_and_invariants.md` Section E/I step 7).
 *
 * A separate sibling to `logCoordinator.ts` (standalone logging) and
 * `unplannedTrainingCoordinator.ts` (paired create): none of those three
 * responsibilities should blur into one file. This coordinator never
 * constructs an `EventOccurrence`, `CalendarEntry`, or aggregate — it
 * consumes an already-loaded, already-persisted, log-less
 * `NewModelCalendarAggregate` exactly as given. Loading/selecting that
 * aggregate is the caller's responsibility (a later UI/hook slice, not
 * performed here). Firestore rules (`b57fefb`) independently enforce the
 * same referential-integrity requirements this composition upholds.
 *
 * Pure — no Firebase, React, or hooks. Reuses the existing canonical
 * `buildTransitionalSelfPostedTrainingLog` builder and expects an
 * `addCompletedSelfPostedTrainingLog`-compatible injected persist function.
 * No new persistence operation, no new domain type, no UI wiring.
 */
import { buildTransitionalSelfPostedTrainingLog } from './selfPostedOperations';
import {
  validateCompletedSelfPostedTrainingInput,
  type CompletedSelfPostedTrainingInput,
} from './selfPostedTraining';
import type { CompletedSelfPostedTrainingLog, NewModelCalendarAggregate } from './types';

/**
 * Injectable persistence function and the narrow id/clock dependencies the
 * existing builder contract requires. No aggregate-write capability is
 * exposed — this coordinator never writes to `calendarEntries`.
 */
export interface LogAgainstExistingCalendarEntryDeps {
  /** Persist the completed log and return its id (e.g. `addCompletedSelfPostedTrainingLog`). */
  persist: (
    fighterKey: string,
    record: CompletedSelfPostedTrainingLog,
  ) => Promise<string>;
  /** Optional deterministic id generator for testing (passed through to the builder). */
  generateId?: () => string;
  /** Optional deterministic clock for testing (passed through to the builder). */
  nowISO?: () => string;
  /** Optional deterministic current-instant clock for the future-date/time validation rule. */
  now?: () => Date;
}

/**
 * Create and persist a `TrainingLog` that references an already-existing,
 * independent (log-less) `NewModelCalendarAggregate`. `aggregate` MUST
 * already be loaded by the caller — this function never fetches it.
 *
 * Rejects an `aggregate` that already carries `logRecordId` (already paired;
 * use the completed-unplanned/paired flow instead) before any persistence
 * call, mirroring the Firestore rule's own independence guard.
 *
 * Does not mutate `input` or `aggregate` (including its embedded `occurrence`
 * and `calendarEntry`). Constructs no `EventOccurrence`, `CalendarEntry`, or
 * aggregate — the resulting TrainingLog snapshot is formed directly from
 * `aggregate.occurrence` and reuses `aggregate.calendarEntry.id`.
 *
 * @returns the persisted log id.
 * @throws if `aggregate.logRecordId` is present, if input validation fails,
 *         or if persistence fails.
 */
export async function addTrainingLogForExistingCalendarEntry(
  input: CompletedSelfPostedTrainingInput,
  aggregate: NewModelCalendarAggregate,
  fighterKey: string,
  deps: LogAgainstExistingCalendarEntryDeps,
): Promise<string> {
  if (!fighterKey) {
    throw new Error('addTrainingLogForExistingCalendarEntry: fighterKey is required');
  }
  if (aggregate.logRecordId !== undefined) {
    throw new Error(
      'addTrainingLogForExistingCalendarEntry: aggregate must not carry logRecordId (already paired — use the paired flow)',
    );
  }

  const validationErrors = validateCompletedSelfPostedTrainingInput(input, { now: deps.now });
  if (validationErrors.length > 0) {
    throw new Error(
      `addTrainingLogForExistingCalendarEntry: validation failed:\n${validationErrors.join('\n')}`,
    );
  }

  const generateId = deps.generateId ?? (() => crypto.randomUUID());
  const recordId = generateId();

  const logInput: CompletedSelfPostedTrainingInput = {
    ...input,
    origin: {
      type: 'new_model_calendar_entry',
      aggregateId: aggregate.id,
      occurrenceId: aggregate.occurrence.id,
    },
  };

  const record = buildTransitionalSelfPostedTrainingLog(logInput, aggregate.occurrence, {
    generateId: deps.generateId,
    nowISO: deps.nowISO,
    ids: {
      occurrenceId: aggregate.occurrence.id,
      calendarEntryId: aggregate.calendarEntry.id,
      recordId,
    },
  });

  return deps.persist(fighterKey, record);
}
