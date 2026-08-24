/**
 * calendarEntryService — Checkpoint B: thin Firestore read for new-model
 * calendar aggregates (unplanned-training calendar/planning source of
 * truth). One-shot, owner-scoped (path already restricts to the fighter's
 * own subcollection). No write here — persistence lives in
 * `unplannedTrainingService.ts`.
 *
 * Never auto-repairs or writes data: an invalid/unsupported-schema record is
 * classified as a structured `CalendarEntryLoadIssue` and excluded from
 * `entries`, never silently dropped without a trace and never rendered.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';
import type { NewModelCalendarAggregate } from '../domain/calendar/types';

const CALENDAR_ENTRIES_SUBCOLLECTION = 'calendarEntries';

/** Only schemaVersion 1 is currently supported (Checkpoint B). */
const SUPPORTED_SCHEMA_VERSION = 1;

export interface CalendarEntryLoadIssue {
  id: string;
  reason: 'unsupported_schema_version' | 'invalid_record';
}

export interface CalendarEntriesLoadResult {
  entries: NewModelCalendarAggregate[];
  issues: CalendarEntryLoadIssue[];
}

/** Minimum structural shape check — deliberately loose (no deep occurrence/calendarEntry field validation beyond presence).
 *  `logRecordId` is a TRANSITIONAL, now-optional persistence concern (see
 *  `NewModelCalendarAggregate.logRecordId`): absent is valid; when present it
 *  must still be a string (unchanged field-quality contract — no non-empty
 *  requirement was ever enforced). This read-model tolerance does not yet
 *  establish persisted CalendarEntry independence (I2) on its own — no writer
 *  or Firestore rule currently produces a record without it.
 */
function isStructurallyValid(data: unknown): data is NewModelCalendarAggregate {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.userId === 'string' &&
    !!d.occurrence &&
    typeof d.occurrence === 'object' &&
    !!d.calendarEntry &&
    typeof d.calendarEntry === 'object' &&
    typeof d.createdAt === 'string' &&
    typeof d.updatedAt === 'string' &&
    (d.logRecordId === undefined || typeof d.logRecordId === 'string')
  );
}

/**
 * Read all new-model calendar aggregates for a fighter from
 * `{ROOT_COLLECTION}/{fighterKey}/calendarEntries`.
 *
 * One-shot read (no live subscription). Sorted client-side, ascending by
 * `occurrence.startDateTime` (calendar placement order), with `id` as a
 * stable tiebreaker.
 */
export async function listCalendarEntries(fighterKey: string): Promise<CalendarEntriesLoadResult> {
  if (!fighterKey) throw new Error('listCalendarEntries: fighterKey is required');

  const col = collection(db, ROOT_COLLECTION, fighterKey, CALENDAR_ENTRIES_SUBCOLLECTION);
  const snap = await getDocs(col);

  const entries: NewModelCalendarAggregate[] = [];
  const issues: CalendarEntryLoadIssue[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const schemaVersion = (data as Record<string, unknown> | null)?.schemaVersion;
    if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
      issues.push({ id: docSnap.id, reason: 'unsupported_schema_version' });
      continue;
    }
    if (!isStructurallyValid(data)) {
      issues.push({ id: docSnap.id, reason: 'invalid_record' });
      continue;
    }
    entries.push(data);
  }

  entries.sort((a, b) =>
    a.occurrence.startDateTime.localeCompare(b.occurrence.startDateTime) || a.id.localeCompare(b.id),
  );

  return { entries, issues };
}
