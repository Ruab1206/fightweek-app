/**
 * unplannedTrainingService — Checkpoint B: Firebase-aware atomic persistence
 * adapter for the new-model calendar aggregate + TrainingLog pair created by
 * one unplanned-training creation action.
 *
 * Owns: the Firestore `WriteBatch`, both document paths, and the create-only
 * retry-verification fallback described below. Never mints ids — the caller
 * (hook) supplies the already-built `aggregate`/`logRecord`, whose ids were
 * minted once per attempt by `mintUnplannedTrainingCreationIds` and carried
 * through `buildUnplannedTrainingRecords`.
 *
 * Does not touch `weeks/*`, `meta/notes`, or the existing single-write
 * `eventLogService.addCompletedSelfPostedTrainingLog` path — that remains
 * unchanged for the calendar-originated and any other flow.
 *
 * RETRY SEMANTICS (create-only bilateral rules): a technical retry that
 * resubmits the exact same ids/records after an uncertain previous commit
 * (e.g. a dropped response) may hit a permission error on a SECOND attempt,
 * because the Firestore `create`-only rule denies overwriting an
 * already-existing document. When the batch commit fails, this adapter reads
 * back EXACTLY the two known document paths (by id — never a query, never a
 * collection search, never matching by mutable business fields as a lookup
 * mechanism) and checks whether both already exist with the same shared
 * identity AND the same occurrence/log content this call intended to write.
 * `createdAt`/`updatedAt` are deliberately excluded from that content
 * comparison — a genuine idempotent retry naturally re-stamps a fresh
 * timestamp, which must not by itself count as "different content". If the
 * check passes, the retry is treated as already-completed (resolves
 * normally, no re-throw). Otherwise the original error is rethrown. This
 * verification read never runs after a normal successful commit.
 */
import { doc, getDoc, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';
import type { NewModelCalendarAggregate, CompletedSelfPostedTrainingLog, EventOccurrence } from '../domain/calendar/types';

const CALENDAR_ENTRIES_SUBCOLLECTION = 'calendarEntries';
const EVENT_LOGS_SUBCOLLECTION = 'eventLogs';

/**
 * Persist `aggregate` + `logRecord` as one atomic Firestore batch at
 * `{ROOT_COLLECTION}/{fighterKey}/calendarEntries/{aggregate.id}` and
 * `{ROOT_COLLECTION}/{fighterKey}/eventLogs/{logRecord.id}`.
 */
export async function persistUnplannedTrainingAtomically(
  fighterKey: string,
  aggregate: NewModelCalendarAggregate,
  logRecord: CompletedSelfPostedTrainingLog,
): Promise<void> {
  if (!fighterKey) throw new Error('persistUnplannedTrainingAtomically: fighterKey is required');
  if (!aggregate?.id) throw new Error('persistUnplannedTrainingAtomically: aggregate.id is required');
  if (!logRecord?.id) throw new Error('persistUnplannedTrainingAtomically: logRecord.id is required');

  const aggregateRef = doc(db, ROOT_COLLECTION, fighterKey, CALENDAR_ENTRIES_SUBCOLLECTION, aggregate.id);
  const logRef = doc(db, ROOT_COLLECTION, fighterKey, EVENT_LOGS_SUBCOLLECTION, logRecord.id);

  try {
    const batch = writeBatch(db);
    batch.set(aggregateRef, aggregate);
    batch.set(logRef, logRecord);
    await batch.commit();
  } catch (err) {
    const alreadyPersisted = await verifyAlreadyPersistedPair(aggregateRef, logRef, aggregate, logRecord);
    if (alreadyPersisted) return;
    throw err;
  }
}

function occurrenceContentMatches(a: EventOccurrence, b: EventOccurrence): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.discipline === b.discipline &&
    a.startDateTime === b.startDateTime &&
    a.endDateTime === b.endDateTime &&
    a.location === b.location &&
    a.status === b.status
  );
}

async function verifyAlreadyPersistedPair(
  aggregateRef: DocumentReference,
  logRef: DocumentReference,
  expectedAggregate: NewModelCalendarAggregate,
  expectedLog: CompletedSelfPostedTrainingLog,
): Promise<boolean> {
  const [aggSnap, logSnap] = await Promise.all([getDoc(aggregateRef), getDoc(logRef)]);
  if (!aggSnap.exists() || !logSnap.exists()) return false;

  const agg = aggSnap.data() as NewModelCalendarAggregate;
  const log = logSnap.data() as CompletedSelfPostedTrainingLog;

  return (
    // Shared identity contract — the same ids this attempt was built from.
    agg.id === expectedAggregate.id &&
    agg.userId === expectedAggregate.userId &&
    agg.logRecordId === expectedLog.id &&
    log.id === expectedLog.id &&
    occurrenceContentMatches(agg.occurrence, expectedAggregate.occurrence) &&
    occurrenceContentMatches(log.occurrence, expectedLog.occurrence) &&
    agg.calendarEntry.id === expectedAggregate.calendarEntry.id &&
    log.calendarEntry.id === expectedLog.calendarEntry.id &&
    agg.calendarEntry.status === expectedAggregate.calendarEntry.status &&
    // Log business content that a retry-with-edits could plausibly change.
    log.log.notes === expectedLog.log.notes &&
    log.log.intensity === expectedLog.log.intensity &&
    log.log.discipline === expectedLog.log.discipline
  );
}
