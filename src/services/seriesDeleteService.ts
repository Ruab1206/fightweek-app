/**
 * seriesDeleteService — atomic persistence for "delete this training and all
 * future trainings" of a durable self-posted recurring series (strategy A: ONE
 * Firestore transaction over the complete deletion). Consumes the approved pure
 * `planSeriesDelete` as the single source of deletion intent and never mutates
 * it. It is the deletion analogue of `seriesSplitService`.
 *
 * The durable `EventSeriesDefinition` is the recurrence authority: this ends it
 * immediately before the selected date, which is the authoritative prevention
 * of future materialization — so NO per-date suppression is written for the
 * removed forward range. Single-occurrence suppression behaviour is untouched.
 *
 * Deletion representation: every affected forward occurrence is marked in place
 * as an INVISIBLE deletion record (`isDeleted: true` + a single stable
 * `deletedAt`), never physically removed and never converted to
 * `status: 'cancelled'`. There is NO Note/TrainingLog read or protection
 * decision, so the operation is safe regardless of concurrent Note/TrainingLog
 * creation and touches no Note or TrainingLog data.
 *
 * Read boundary: the Firestore transaction reads the definition, every
 * candidate forward week document, and every candidate forward suppression doc
 * (by deterministic date-id ref — no query), then re-runs the pure planner from
 * that FRESH state and writes atomically. `now` and the recurrence
 * `horizonEndDate` are minted EXACTLY ONCE before `runTransaction`, so every
 * re-run re-reads fresh docs and re-runs the planner with identical injected
 * values (the same `deletedAt` on a retry). Any failure (planner rejection or
 * Firestore abort) rolls back the whole transaction unchanged.
 */
import { doc, runTransaction, type Firestore, type Transaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION, DAYS } from '../config/constants';
import {
  planSeriesDelete,
  type DeleteSelectedOccurrence,
  type DeleteOccurrenceInput,
  type DeleteSuppressionInput,
  type SeriesDeleteCounts,
  type SeriesDeleteFailureReason,
} from '../domain/calendar/seriesDeletePlan';
import type { EventSeriesDefinition } from '../domain/calendar/eventSeriesDefinition';
import { suppressionDocId } from '../domain/calendar/occurrenceSuppression';
import {
  computeSeriesOccurrenceDates,
  recurrenceHorizonEndDate,
  productionWeekNumberForOccurrence,
} from '../hooks/computeSeriesOccurrences';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_SERIES_SUBCOLLECTION = 'eventSeries';
const SUPPRESSIONS_SUBCOLLECTION = 'suppressions';
const WEEKS_SUBCOLLECTION = 'weeks';

export interface SeriesDeleteRequest {
  fighterKey: string;
  selected: DeleteSelectedOccurrence;
}

export interface SeriesDeleteOptions {
  now?: string;
  horizonEndDate?: string;
  /** Injected Firestore for emulator tests; defaults to the production client. */
  firestore?: Firestore;
}

export type SeriesDeletePersistResult =
  | { ok: true; counts: SeriesDeleteCounts }
  | { ok: false; kind: 'planner'; reason: SeriesDeleteFailureReason; occurrenceDateISO?: string }
  | { ok: false; kind: 'transaction'; error: unknown };

/** Thrown inside the updater to abort the transaction on a planner rejection. */
class PlannerAbortError extends Error {
  constructor(readonly reason: SeriesDeleteFailureReason, readonly occurrenceDateISO?: string) {
    super(`planSeriesDelete rejected: ${reason}`);
    this.name = 'PlannerAbortError';
  }
}

/** Local YYYY-MM-DD → Danish weekday name (DAYS index 0 = Mandag/Monday). */
function dayNameForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  return DAYS[(jsDay + 6) % 7];
}

/** Mark a week-doc entry as an invisible deletion record in place. Preserves
 *  id/date/seriesId/isSeriesException and every snapshot field; sets only the
 *  additive `isDeleted`/`deletedAt` markers. Never touches status or any
 *  cancellation field (deletion is distinct from cancellation). */
function markDeletedEntry(entry: Record<string, unknown>, deletedAt: string): void {
  entry.isDeleted = true;
  entry.deletedAt = deletedAt;
}

/**
 * Atomically persist a durable series delete-this-and-following. Reads (all
 * before any write): the EventSeries definition, every candidate forward week
 * document, and every candidate forward suppression doc. Re-runs the pure
 * planner from that fresh state and, on success, marks every affected forward
 * occurrence as an invisible deletion record in place (id/date/seriesId/
 * isSeriesException + snapshot preserved) and ends/discontinues the definition
 * — all in one transaction. Unrelated activities in shared week documents are
 * preserved through the fresh transactional reads. No Note or TrainingLog is
 * read, written, or deleted.
 */
export async function persistSeriesDeleteAtomically(
  req: SeriesDeleteRequest,
  opts: SeriesDeleteOptions = {},
): Promise<SeriesDeletePersistResult> {
  const { fighterKey, selected } = req;
  if (!fighterKey) throw new Error('persistSeriesDeleteAtomically: fighterKey is required');

  // Structural guards needed to construct document refs safely (mirror the
  // planner's own early fail-closed reasons).
  if (!selected.seriesId) return { ok: false, kind: 'planner', reason: 'unsupported_legacy_occurrence' };
  if (!PLAIN_DATE.test(selected.occurrenceDateISO)) return { ok: false, kind: 'planner', reason: 'invalid_occurrence_date' };

  const seriesId = selected.seriesId;
  const fromDate = selected.occurrenceDateISO;

  // Minted EXACTLY ONCE — reused across every Firestore retry of the updater.
  const now = opts.now ?? new Date().toISOString();
  const horizonEndDate = opts.horizonEndDate ?? recurrenceHorizonEndDate();
  const fs = opts.firestore ?? db;

  try {
    const counts = await runTransaction(fs, async (tx: Transaction) => {
      const defRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, seriesId);
      const defSnap = await tx.get(defRef);
      const definition = defSnap.exists() ? (defSnap.data() as EventSeriesDefinition) : null;

      // Candidate forward dates come purely from the definition's cadence,
      // bounded by the pre-computed horizon — the exact read set.
      const candidateDates = definition
        ? computeSeriesOccurrenceDates({
            startDate: fromDate,
            intervalWeeks: definition.intervalWeeks,
            endDate: definition.endDate,
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
        const weekNum = productionWeekNumberForOccurrence(dateISO, definition!.startDate);
        const dayName = dayNameForDate(dateISO);
        const weekRef = doc(fs, ROOT_COLLECTION, fighterKey, WEEKS_SUBCOLLECTION, `week_${weekNum}`);
        const suppRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, seriesId, SUPPRESSIONS_SUBCOLLECTION, suppressionDocId(dateISO));
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

      // Reconstruct planner inputs from the fresh reads. No Note/TrainingLog is
      // read: deletion never depends on protection state.
      const forwardOccurrences: DeleteOccurrenceInput[] = [];
      const forwardSuppressions: DeleteSuppressionInput[] = [];
      for (const pd of perDate) {
        if (pd.suppExists) forwardSuppressions.push({ seriesId, occurrenceDateISO: pd.dateISO });
        const dayArr: any[] = Array.isArray(pd.weekData?.[pd.dayName]) ? pd.weekData![pd.dayName] : [];
        for (const s of dayArr) {
          if (s?.seriesId !== seriesId) continue;
          forwardOccurrences.push({
            id: s.id,
            seriesId: s.seriesId,
            occurrenceDateISO: pd.dateISO,
            isSeriesException: s.isSeriesException,
            status: s.status,
            isDeleted: s.isDeleted === true,
          });
        }
      }

      const plan = planSeriesDelete({ definition, selected, forwardOccurrences, forwardSuppressions, deletedAt: now });
      if (!plan.ok) throw new PlannerAbortError(plan.reason, plan.occurrenceDateISO);

      // --- Writes (all reads are complete) ---
      const touchedWeeks = new Set<(typeof perDate)[number]>();

      // Mark every affected forward occurrence as an invisible deletion record
      // IN PLACE (never physically removed, never status-cancelled).
      for (const del of plan.deletions) {
        const pd = perDate.find((p) => p.dateISO === del.occurrenceDateISO);
        if (!pd || !pd.weekData) continue;
        const dayArr: any[] = Array.isArray(pd.weekData[pd.dayName]) ? pd.weekData[pd.dayName] : [];
        const entry = dayArr.find((s: any) => s?.id === del.occurrenceId);
        if (!entry) continue;
        markDeletedEntry(entry, plan.deletedAt);
        touchedWeeks.add(pd);
      }

      for (const pd of touchedWeeks) {
        pd.weekData!.lastUpdated = now;
        tx.set(pd.weekRef, pd.weekData!);
      }

      // 3. End / discontinue the definition LAST.
      const defUpdate: Record<string, unknown> = { updatedAt: now };
      if (plan.definitionUpdate.discontinued) defUpdate.status = 'discontinued';
      else defUpdate.endDate = plan.definitionUpdate.endDateBefore;
      tx.update(defRef, defUpdate);

      return plan.counts;
    });

    return { ok: true, counts };
  } catch (err) {
    if (err instanceof PlannerAbortError) {
      return { ok: false, kind: 'planner', reason: err.reason, occurrenceDateISO: err.occurrenceDateISO };
    }
    return { ok: false, kind: 'transaction', error: err };
  }
}
