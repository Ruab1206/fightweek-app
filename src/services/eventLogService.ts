/**
 * eventLogService — thin Firestore persistence for completed self-posted
 * training logs (Phase 3 strangler slice, Step 2).
 *
 * See `/docs/fightweek_refactoring_plan.md` — "Active Slice: Log completed
 * self-posted training". Path convention mirrors the existing per-fighter
 * `ROOT_COLLECTION` layout (`weeks`, `meta`, `templates`), keyed by an
 * already-resolved `fighterKey` (email). This module does NOT resolve
 * name/email itself — callers (a future hook) are responsible for that.
 *
 * Deliberately thin: no validation, no id/timestamp generation, no business
 * rules. The record must already be fully built by the pure domain builder
 * in `src/domain/calendar/selfPostedTraining.ts` before it reaches here.
 * Only defensive checks on the path inputs themselves (fighterKey/record.id)
 * are performed.
 *
 * Does not touch `weeks/*`, `meta/notes`, or any existing Phase 2 path.
 */
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';
import type { CompletedSelfPostedTrainingLog } from '../domain/calendar/types';

const EVENT_LOGS_SUBCOLLECTION = 'eventLogs';

/**
 * Persist an already-built `CompletedSelfPostedTrainingLog` at
 * `{ROOT_COLLECTION}/{fighterKey}/eventLogs/{record.id}`.
 *
 * Uses the record's own `id` as the Firestore document id (via `setDoc`)
 * rather than an auto-generated id, so there is only ever one id per log.
 * Persists the record exactly as built — does not re-stamp
 * `createdAt`/`updatedAt`.
 *
 * @returns the persisted document id (`record.id`).
 */
export async function addCompletedSelfPostedTrainingLog(
  fighterKey: string,
  record: CompletedSelfPostedTrainingLog,
): Promise<string> {
  if (!fighterKey) throw new Error('addCompletedSelfPostedTrainingLog: fighterKey is required');
  if (!record?.id) throw new Error('addCompletedSelfPostedTrainingLog: record.id is required');

  const ref = doc(db, ROOT_COLLECTION, fighterKey, EVENT_LOGS_SUBCOLLECTION, record.id);
  await setDoc(ref, record);
  return record.id;
}

/**
 * Read all completed self-posted training logs for a fighter from
 * `{ROOT_COLLECTION}/{fighterKey}/eventLogs`.
 *
 * One-shot read (no live subscription — that belongs to a future hook).
 * Sorted client-side, descending by `occurrence.startDateTime` (the actual
 * training time), NOT by `createdAt`/logging time, so the chronological
 * history view reflects when training happened.
 */
export async function listCompletedSelfPostedTrainingLogs(
  fighterKey: string,
): Promise<CompletedSelfPostedTrainingLog[]> {
  if (!fighterKey) throw new Error('listCompletedSelfPostedTrainingLogs: fighterKey is required');

  const col = collection(db, ROOT_COLLECTION, fighterKey, EVENT_LOGS_SUBCOLLECTION);
  const snap = await getDocs(col);
  const logs = snap.docs.map((d) => d.data() as CompletedSelfPostedTrainingLog);

  return logs.sort((a, b) =>
    b.occurrence.startDateTime.localeCompare(a.occurrence.startDateTime),
  );
}
