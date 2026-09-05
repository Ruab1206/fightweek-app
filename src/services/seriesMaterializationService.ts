/**
 * seriesMaterializationService — Slice 2c-2 persistence for materializing the
 * occurrences of a durable self-posted recurring series into the legacy
 * week documents, ONE Firestore transaction per affected week.
 *
 * The committed pure `planSeriesMaterialization` is the SOLE authority for
 * cadence, suppression, deterministic identity and conflict detection — this
 * adapter never re-derives any of that. It only turns the plan's intent into
 * per-week transactional writes and reports typed per-week results.
 *
 * Retry/idempotency: occurrence ids come from the deterministic formula
 * (`materializedOccurrenceId`), so a re-run of the whole range re-reads fresh
 * week state and the planner's existing-occurrence gate skips anything already
 * created — the same series/date always resolves to the same id (transaction
 * retry, service retry, reload, or two concurrent clients cannot create a
 * duplicate). `now` and the recurrence horizon are minted EXACTLY ONCE so every
 * per-week transaction re-runs the planner with identical injected values.
 *
 * R275: this adapter is NOT wired to any enabled UI path or trigger. It is
 * directly testable but is imported by no App/hook/presentation code, so it
 * performs zero production writes.
 */
import { doc, getDoc, runTransaction, type Firestore, type Transaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION, DAYS } from '../config/constants';
import {
  planSeriesMaterialization,
  type MaterializationOccurrenceInput,
  type MaterializationSuppressionInput,
  type MaterializationFailureReason,
  type PlannedOccurrence,
} from '../domain/calendar/materializationPlan';
import type { EventSeriesDefinition } from '../domain/calendar/eventSeriesDefinition';
import { suppressionDocId } from '../domain/calendar/occurrenceSuppression';
import { recurrenceHorizonEndDate } from '../hooks/computeSeriesOccurrences';
import { getISOWeekForDate } from '../utils/dateUtils';

const EVENT_SERIES_SUBCOLLECTION = 'eventSeries';
const SUPPRESSIONS_SUBCOLLECTION = 'suppressions';
const WEEKS_SUBCOLLECTION = 'weeks';

/** Definition-level failure reasons the pure planner emits for a bad/inactive
 *  definition (as opposed to a per-date data-integrity conflict). */
const DEFINITION_REASONS: ReadonlySet<MaterializationFailureReason> = new Set([
  'missing_definition',
  'discontinued_series',
  'invalid_interval',
  'invalid_start_date',
  'invalid_end_date',
  'invalid_horizon',
  'start_weekday_mismatch',
]);

export interface SeriesMaterializationRequest {
  fighterKey: string;
  seriesId: string;
}

export interface SeriesMaterializationOptions {
  /** Injected Firestore for emulator tests; defaults to the production client. */
  firestore?: Firestore;
  /** Inclusive horizon window end; minted once from the 52-week horizon when absent. */
  horizonEndDate?: string;
  now?: string;
}

export type MaterializeWeekResult =
  | { weekKey: string; ok: true; created: string[] }
  | { weekKey: string; ok: false; kind: 'planner'; reason: MaterializationFailureReason; occurrenceDateISO?: string }
  | { weekKey: string; ok: false; kind: 'definition'; reason: MaterializationFailureReason }
  | { weekKey: string; ok: false; kind: 'transaction'; error: unknown };

export type SeriesMaterializationResult =
  /** Pre-flight: the definition is missing/malformed/discontinued — nothing planned. */
  | { ok: false; kind: 'definition'; reason: MaterializationFailureReason }
  /** Per-week outcomes; NOT range-wide atomic — each week commits independently. */
  | { ok: true; weeks: MaterializeWeekResult[]; totalCreated: number };

/** Thrown inside the updater to abort a week transaction on a planner rejection. */
class PlannerAbortError extends Error {
  constructor(readonly reason: MaterializationFailureReason, readonly occurrenceDateISO?: string) {
    super(`planSeriesMaterialization rejected: ${reason}`);
    this.name = 'PlannerAbortError';
  }
}

/** Thrown inside the updater when the definition is missing/inactive at
 *  transaction-read time (it changed since pre-flight). */
class DefinitionAbortError extends Error {
  constructor(readonly reason: MaterializationFailureReason) {
    super(`materialization definition rejected: ${reason}`);
    this.name = 'DefinitionAbortError';
  }
}

/** Local YYYY-MM-DD → Danish weekday name (DAYS index 0 = Mandag/Monday). */
function dayNameForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  return DAYS[(jsDay + 6) % 7];
}

/** Week-document key for a local YYYY-MM-DD (production ISO-week keying). */
function weekKeyForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `week_${getISOWeekForDate(new Date(y, m - 1, d))}`;
}

/** ISO timestamp of a local date at the occurrence's start time (for note keys). */
function sessionDateISO(dateISO: string, startTime: string): string {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const [h, min] = startTime.split(':').map(Number);
  const dt = new Date(y, mo - 1, d);
  if (!Number.isNaN(h) && !Number.isNaN(min)) dt.setHours(h, min, 0, 0);
  return dt.toISOString();
}

/** Build a week-document session entry from a planned occurrence. Never writes
 *  `undefined`; id/date/seriesId come verbatim from the deterministic plan. */
function buildWeekEntry(planned: PlannedOccurrence, dayName: string): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    id: planned.id,
    seriesId: planned.seriesId,
    day: dayName,
    name: planned.title,
    start: planned.startTime,
    end: planned.endTime,
    status: 'active',
    isRecurring: true,
    sessionDate: sessionDateISO(planned.occurrenceDateISO, planned.startTime),
  };
  if (planned.discipline !== undefined) entry.category = planned.discipline;
  if (planned.location !== undefined) entry.location = planned.location;
  return entry;
}

/** Reconstruct planner occurrence inputs for one candidate date from a fresh
 *  week-document read. All entries on that day (any series) are supplied so the
 *  planner's foreign-id and duplicate checks can see them. */
function readWeekOccurrences(
  weekData: Record<string, unknown>,
  dayName: string,
  dateISO: string,
): MaterializationOccurrenceInput[] {
  const dayArr = Array.isArray(weekData[dayName]) ? (weekData[dayName] as Record<string, unknown>[]) : [];
  const out: MaterializationOccurrenceInput[] = [];
  for (const s of dayArr) {
    if (!s || typeof s.id !== 'string') continue;
    out.push({
      id: s.id,
      seriesId: typeof s.seriesId === 'string' ? s.seriesId : undefined,
      occurrenceDateISO: dateISO,
      isSeriesException: s.isSeriesException === true,
      status: typeof s.status === 'string' ? s.status : undefined,
    });
  }
  return out;
}

/**
 * Materialize a durable recurring series into its week documents, one
 * transaction per affected week. Pre-flight reads the definition and asks the
 * pure planner for the full candidate set (deterministic ids), grouped by week.
 * Each week's transaction then re-reads the definition, that week document, and
 * the deterministic suppression refs for its candidate dates BEFORE any write,
 * re-runs the planner against that fresh state, aborts the week on any conflict,
 * and otherwise inserts only the missing occurrences while preserving every
 * unrelated activity. The definition itself is never written or mutated here.
 */
export async function materializeSeries(
  req: SeriesMaterializationRequest,
  opts: SeriesMaterializationOptions = {},
): Promise<SeriesMaterializationResult> {
  const { fighterKey, seriesId } = req;
  if (!fighterKey) throw new Error('materializeSeries: fighterKey is required');
  if (!seriesId) throw new Error('materializeSeries: seriesId is required');

  const fs = opts.firestore ?? db;
  const now = opts.now ?? new Date().toISOString();
  const horizonEndDateISO = opts.horizonEndDate ?? recurrenceHorizonEndDate();

  const defRef = doc(fs, ROOT_COLLECTION, fighterKey, EVENT_SERIES_SUBCOLLECTION, seriesId);

  // Pre-flight: read the definition and let the planner enumerate the full
  // candidate set (empty occurrence/suppression state → every cadence date).
  const defSnap = await getDoc(defRef);
  const definition = defSnap.exists() ? (defSnap.data() as EventSeriesDefinition) : null;
  const preview = planSeriesMaterialization({
    definition,
    existingOccurrences: [],
    suppressions: [],
    horizonEndDateISO,
  });
  if (!preview.ok) {
    // With empty inputs only definition-level reasons can fire.
    return { ok: false, kind: 'definition', reason: preview.reason };
  }

  // Group candidate dates by their week document (one weekly/bi-weekly
  // occurrence falls in a distinct ISO week, but grouping is defensive).
  const byWeek = new Map<string, string[]>();
  for (const planned of preview.generate) {
    const key = weekKeyForDate(planned.occurrenceDateISO);
    const list = byWeek.get(key);
    if (list) list.push(planned.occurrenceDateISO);
    else byWeek.set(key, [planned.occurrenceDateISO]);
  }

  const weeks: MaterializeWeekResult[] = [];
  let totalCreated = 0;

  for (const [weekKey, weekDates] of byWeek) {
    const weekRef = doc(fs, ROOT_COLLECTION, fighterKey, WEEKS_SUBCOLLECTION, weekKey);
    const weekDateSet = new Set(weekDates);
    try {
      const created = await runTransaction(fs, async (tx: Transaction) => {
        // --- Reads (all before any write) ---
        const freshDefSnap = await tx.get(defRef);
        const freshDefinition = freshDefSnap.exists()
          ? (freshDefSnap.data() as EventSeriesDefinition)
          : null;

        const weekSnap = await tx.get(weekRef);
        const weekData: Record<string, unknown> = weekSnap.exists()
          ? structuredClone(weekSnap.data())
          : {};

        const suppressedDates = new Set<string>();
        for (const dateISO of weekDates) {
          const suppRef = doc(
            fs,
            ROOT_COLLECTION,
            fighterKey,
            EVENT_SERIES_SUBCOLLECTION,
            seriesId,
            SUPPRESSIONS_SUBCOLLECTION,
            suppressionDocId(dateISO),
          );
          const suppSnap = await tx.get(suppRef);
          if (suppSnap.exists()) suppressedDates.add(dateISO);
        }

        // Reconstruct planner inputs from the FRESH transaction reads.
        const existingOccurrences: MaterializationOccurrenceInput[] = [];
        const suppressions: MaterializationSuppressionInput[] = [];
        for (const dateISO of weekDates) {
          if (suppressedDates.has(dateISO)) suppressions.push({ seriesId, occurrenceDateISO: dateISO });
          existingOccurrences.push(...readWeekOccurrences(weekData, dayNameForDate(dateISO), dateISO));
        }

        const plan = planSeriesMaterialization({
          definition: freshDefinition,
          existingOccurrences,
          suppressions,
          horizonEndDateISO,
        });
        if (!plan.ok) {
          if (DEFINITION_REASONS.has(plan.reason)) throw new DefinitionAbortError(plan.reason);
          throw new PlannerAbortError(plan.reason, plan.occurrenceDateISO);
        }

        // Only this week's dates are written; other weeks are their own txns.
        const toCreate = plan.generate.filter((g) => weekDateSet.has(g.occurrenceDateISO));
        if (toCreate.length === 0) return []; // nothing missing → no-op, week unchanged

        // --- Writes (all reads complete) ---
        for (const planned of toCreate) {
          const dayName = dayNameForDate(planned.occurrenceDateISO);
          const dayArr = Array.isArray(weekData[dayName])
            ? (weekData[dayName] as Record<string, unknown>[])
            : [];
          dayArr.push(buildWeekEntry(planned, dayName));
          dayArr.sort((a, b) => String(a.start ?? '').localeCompare(String(b.start ?? '')));
          weekData[dayName] = dayArr;
        }
        weekData.lastUpdated = now;
        tx.set(weekRef, weekData);
        return toCreate.map((t) => t.id);
      });

      weeks.push({ weekKey, ok: true, created });
      totalCreated += created.length;
    } catch (err) {
      if (err instanceof DefinitionAbortError) {
        weeks.push({ weekKey, ok: false, kind: 'definition', reason: err.reason });
      } else if (err instanceof PlannerAbortError) {
        weeks.push({ weekKey, ok: false, kind: 'planner', reason: err.reason, occurrenceDateISO: err.occurrenceDateISO });
      } else {
        weeks.push({ weekKey, ok: false, kind: 'transaction', error: err });
      }
    }
  }

  return { ok: true, weeks, totalCreated };
}
