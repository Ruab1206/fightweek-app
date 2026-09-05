/**
 * seriesSplitService — Slice 2b-2 atomic persistence for a "this and all future
 * trainings" recurring-series split (strategy A: ONE Firestore transaction over
 * the complete split). Consumes the approved pure `planSeriesSplit` (unchanged)
 * as the single source of split intent and never mutates it.
 *
 * Retry safety: `newSeriesId`, `now` and the recurrence `horizonEndDate` are
 * minted EXACTLY ONCE before `runTransaction`, so every Firestore re-run of the
 * updater re-reads fresh docs and re-runs the pure planner with identical
 * injected values — producing the same plan, the same new-definition id and the
 * same deterministic suppression doc ids (no duplicate definition, no duplicate
 * suppression). Any failure (planner rejection or Firestore abort) rolls back
 * the whole transaction: old definition unchanged, new definition absent,
 * suppressions unchanged, occurrences unchanged.
 *
 * R275: this adapter is NOT wired to any enabled UI path; it performs zero
 * production writes until a materializer exists and this-and-following is
 * separately activated.
 */
import { doc, runTransaction, type Firestore, type Transaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION, DAYS } from '../config/constants';
import {
  planSeriesSplit,
  type SplitSelectedOccurrence,
  type SplitEditedFields,
  type SplitOccurrenceInput,
  type SplitSuppressionInput,
  type SplitCounts,
  type SplitPlanFailureReason,
} from '../domain/calendar/seriesSplitPlan';
import type { EventSeriesDefinition } from '../domain/calendar/eventSeriesDefinition';
import { buildOccurrenceSuppression, suppressionDocId } from '../domain/calendar/occurrenceSuppression';
import { computeSeriesOccurrenceDates, recurrenceHorizonEndDate } from '../hooks/computeSeriesOccurrences';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_SERIES_SUBCOLLECTION = 'eventSeries';
const SUPPRESSIONS_SUBCOLLECTION = 'suppressions';
const WEEKS_SUBCOLLECTION = 'weeks';

export interface SeriesSplitRequest {
  fighterKey: string;
  selected: SplitSelectedOccurrence;
  edited: SplitEditedFields;
}

export interface SeriesSplitOptions {
  /** Minted once here when absent — injectable for deterministic tests. */
  newSeriesId?: string;
  now?: string;
  horizonEndDate?: string;
  /** Injected Firestore for emulator tests; defaults to the production client. */
  firestore?: Firestore;
}

export type SeriesSplitPersistResult =
  | { ok: true; newSeriesId: string; counts: SplitCounts }
  | { ok: false; kind: 'planner'; reason: SplitPlanFailureReason; occurrenceDateISO?: string }
  | { ok: false; kind: 'stale'; reason: 'anchor_not_found' }
  | { ok: false; kind: 'transaction'; error: unknown };

/** Thrown inside the updater to abort the transaction on a planner rejection. */
class PlannerAbortError extends Error {
  constructor(readonly reason: SplitPlanFailureReason, readonly occurrenceDateISO?: string) {
    super(`planSeriesSplit rejected: ${reason}`);
    this.name = 'PlannerAbortError';
  }
}

/** Thrown inside the updater when the selected anchor no longer belongs to the
 *  old series in the fresh read (e.g. a competing split already moved it) —
 *  aborts safely so no duplicate/empty new definition is created. */
class StaleSplitError extends Error {
  constructor() {
    super('series split anchor not found on the old series (stale)');
    this.name = 'StaleSplitError';
  }
}

/** Local YYYY-MM-DD → Danish weekday name (DAYS index 0 = Mandag/Monday). */
function dayNameForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  return DAYS[(jsDay + 6) % 7];
}

/** ISO week number for a local YYYY-MM-DD (matches getISOWeekForDate). */
function isoWeekForDate(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Apply the planner's edited (definition-vocabulary) fields onto a week-doc
 *  session entry (session-vocabulary), preserving id/date and clearing an
 *  exception flag only when the plan says so. Never writes `undefined`. */
function applyEditedFieldsToEntry(entry: Record<string, unknown>, fields: SplitEditedFields, dateISO: string, toSeriesId: string, clearException: boolean): void {
  entry.name = fields.title;
  entry.start = fields.startTime;
  entry.end = fields.endTime;
  if (fields.discipline !== undefined) entry.category = fields.discipline; else delete entry.category;
  if (fields.location !== undefined) entry.location = fields.location; else delete entry.location;
  entry.seriesId = toSeriesId;
  if (clearException) delete entry.isSeriesException;
  const [h, min] = fields.startTime.split(':').map(Number);
  const [y, mo, d] = dateISO.split('-').map(Number);
  const sd = new Date(y, mo - 1, d);
  if (!Number.isNaN(h) && !Number.isNaN(min)) sd.setHours(h, min, 0, 0);
  entry.sessionDate = sd.toISOString();
}

/**
 * Atomically persist a series split. Reads (all before any write): the old
 * EventSeries definition, every candidate forward week document, and every
 * candidate forward suppression document (by deterministic date-id ref — no
 * query). Re-runs the pure planner from that fresh state and, on success,
 * writes the new definition, suppression continuities, occurrence re-parents,
 * and the old-definition end/discontinue — all in one transaction.
 */
export async function persistSeriesSplitAtomically(
  req: SeriesSplitRequest,
  opts: SeriesSplitOptions = {},
): Promise<SeriesSplitPersistResult> {
  const { fighterKey, selected, edited } = req;
  if (!fighterKey) throw new Error('persistSeriesSplitAtomically: fighterKey is required');

  // Structural guards needed to construct document refs safely (mirror the
  // planner's own early fail-closed reasons).
  if (!selected.seriesId) return { ok: false, kind: 'planner', reason: 'unsupported_legacy_occurrence' };
  if (!PLAIN_DATE.test(selected.occurrenceDateISO)) return { ok: false, kind: 'planner', reason: 'invalid_occurrence_date' };

  const oldSeriesId = selected.seriesId;
  const splitDate = selected.occurrenceDateISO;

  // Minted EXACTLY ONCE — reused across every Firestore retry of the updater.
  const newSeriesId = opts.newSeriesId ?? crypto.randomUUID();
  const now = opts.now ?? new Date().toISOString();
  const horizonEndDate = opts.horizonEndDate ?? recurrenceHorizonEndDate();
  const fs = opts.firestore ?? db;

  try {
    const counts = await runTransaction(fs, async (tx: Transaction) => {
      const oldDefRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, oldSeriesId);
      const oldDefSnap = await tx.get(oldDefRef);
      const oldDefinition = oldDefSnap.exists() ? (oldDefSnap.data() as EventSeriesDefinition) : null;

      // Candidate forward dates are derived purely from the old definition's
      // cadence, bounded by the pre-computed horizon — the exact read set.
      const candidateDates = oldDefinition
        ? computeSeriesOccurrenceDates({
            startDate: splitDate,
            intervalWeeks: oldDefinition.intervalWeeks,
            endDate: oldDefinition.endDate,
            horizonEndDate,
          })
        : [];

      // Read every candidate week + suppression doc BEFORE any write.
      const perDate: Array<{
        dateISO: string;
        dayName: string;
        weekRef: ReturnType<typeof doc>;
        weekData: Record<string, any> | null;
        suppExists: boolean;
      }> = [];
      for (const dateISO of candidateDates) {
        const weekNum = isoWeekForDate(dateISO);
        const dayName = dayNameForDate(dateISO);
        const weekRef = doc(fs, ROOT_COLLECTION, fighterKey, WEEKS_SUBCOLLECTION, `week_${weekNum}`);
        const suppRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, oldSeriesId, SUPPRESSIONS_SUBCOLLECTION, suppressionDocId(dateISO));
        const weekSnap = await tx.get(weekRef);
        const suppSnap = await tx.get(suppRef);
        perDate.push({
          dateISO,
          dayName,
          weekRef,
          weekData: weekSnap.exists() ? structuredClone(weekSnap.data()) : null,
          suppExists: suppSnap.exists(),
        });
      }

      // Reconstruct planner inputs from the fresh reads.
      const forwardOccurrences: SplitOccurrenceInput[] = [];
      const forwardSuppressions: SplitSuppressionInput[] = [];
      for (const pd of perDate) {
        if (pd.suppExists) forwardSuppressions.push({ seriesId: oldSeriesId, occurrenceDateISO: pd.dateISO });
        const dayArr: any[] = Array.isArray(pd.weekData?.[pd.dayName]) ? pd.weekData![pd.dayName] : [];
        for (const s of dayArr) {
          if (s?.seriesId !== oldSeriesId) continue;
          forwardOccurrences.push({
            id: s.id,
            seriesId: s.seriesId,
            occurrenceDateISO: pd.dateISO,
            isSeriesException: s.isSeriesException,
            status: s.status,
          });
        }
      }

      const plan = planSeriesSplit({ oldDefinition, selected, edited, forwardOccurrences, forwardSuppressions, newSeriesId, now });
      if (!plan.ok) throw new PlannerAbortError(plan.reason, plan.occurrenceDateISO);

      // Stale guard: the anchor must still be an old-series occurrence in the
      // fresh read. If a competing split already re-parented it, abort — never
      // create a second (empty) new definition for a superseded split.
      const anchorPresent = forwardOccurrences.some((o) => o.id === selected.id && o.seriesId === oldSeriesId);
      if (!anchorPresent) throw new StaleSplitError();

      // --- Writes (all reads are complete) ---

      // 1. New definition (deterministic id → retry-safe).
      const newDefRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, newSeriesId);
      tx.set(newDefRef, plan.newDefinition);

      // 2. Suppression continuities (deterministic ids → retry-safe/idempotent).
      for (const cont of plan.suppressionContinuations) {
        const suppRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, newSeriesId, SUPPRESSIONS_SUBCOLLECTION, suppressionDocId(cont.to.occurrenceDateISO));
        tx.set(suppRef, buildOccurrenceSuppression({ seriesId: newSeriesId, occurrenceDateISO: cont.to.occurrenceDateISO, now }));
      }

      // 3. Occurrence re-parents — read-modify-write the affected week docs
      //    (aggregate array shape forces full-doc rewrite; id/date preserved).
      const touchedWeeks = new Set<(typeof perDate)[number]>();
      for (const op of plan.reparents) {
        const pd = perDate.find((p) => p.dateISO === op.occurrenceDateISO);
        if (!pd || !pd.weekData) continue;
        const dayArr: any[] = Array.isArray(pd.weekData[pd.dayName]) ? pd.weekData[pd.dayName] : [];
        const entry = dayArr.find((s: any) => s?.id === op.occurrenceId);
        if (!entry) continue;
        applyEditedFieldsToEntry(entry, op.fields, op.occurrenceDateISO, op.toSeriesId, op.clearedException);
        dayArr.sort((a: any, b: any) => (a.start || '').localeCompare(b.start || ''));
        touchedWeeks.add(pd);
      }
      for (const pd of touchedWeeks) {
        pd.weekData!.lastUpdated = now;
        tx.set(pd.weekRef, pd.weekData!);
      }

      // 4. End / discontinue the old definition LAST.
      const oldUpdate: Record<string, unknown> = { updatedAt: now };
      if (plan.oldDefinitionUpdate.discontinued) oldUpdate.status = 'discontinued';
      else oldUpdate.endDate = plan.oldDefinitionUpdate.endDateBefore;
      tx.update(oldDefRef, oldUpdate);

      return plan.counts;
    });

    return { ok: true, newSeriesId, counts };
  } catch (err) {
    if (err instanceof PlannerAbortError) {
      return { ok: false, kind: 'planner', reason: err.reason, occurrenceDateISO: err.occurrenceDateISO };
    }
    if (err instanceof StaleSplitError) {
      return { ok: false, kind: 'stale', reason: 'anchor_not_found' };
    }
    return { ok: false, kind: 'transaction', error: err };
  }
}
