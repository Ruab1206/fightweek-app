/**
 * seriesDeletePlan — pure planner for "delete this training and all future
 * trainings" of a durable self-posted recurring series (the deletion analogue
 * of `seriesSplitPlan`). It computes the COMPLETE set of planned changes and
 * NEVER writes, reads Firestore, or depends on React / a clock / a UUID.
 *
 * Membership is resolved by `seriesId` only — never by title, weekday, start
 * time, recurrenceInterval, template, or migration history. The durable
 * `EventSeriesDefinition` is the recurrence authority: ending it immediately
 * before the selected date is the authoritative prevention of future
 * materialization, so NO per-date suppression fan-out is produced for the
 * removed forward range — the definition simply stops generating those dates.
 *
 * Deletion contract (transitional): every same-series occurrence on or after
 * the selected date becomes an INVISIBLE deletion record — `isDeleted: true`
 * plus a stable `deletedAt` — while its id, occurrence date, `seriesId`,
 * `isSeriesException`, and historical snapshot fields are preserved so Notes
 * and TrainingLogs stay associated. There is NO hard delete and NO Note/
 * TrainingLog protection decision, so deletion is safe regardless of concurrent
 * Note/TrainingLog creation. A deleted occurrence is never converted to
 * `status: 'cancelled'` and never receives cancellation fields.
 */
import type { EventSeriesDefinition } from './eventSeriesDefinition';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Identity of the occurrence the user chose "delete this and all future" on. */
export interface DeleteSelectedOccurrence {
  id: string;
  seriesId?: string;
  occurrenceDateISO: string;
  isSeriesException?: boolean;
  status?: string;
}

/** One forward materialized occurrence's identity/state (no protection inputs). */
export interface DeleteOccurrenceInput {
  id: string;
  seriesId?: string;
  occurrenceDateISO: string;
  isSeriesException?: boolean;
  status?: string;
  /** True when this occurrence is already an invisible deletion record. */
  isDeleted?: boolean;
}

/** A durable single-occurrence suppression the planner must not contradict. */
export interface DeleteSuppressionInput {
  seriesId: string;
  occurrenceDateISO: string;
}

export type SeriesDeleteFailureReason =
  | 'unsupported_legacy_occurrence'
  | 'invalid_occurrence_date'
  | 'missing_definition'
  | 'not_series_member'
  | 'selected_before_definition_start'
  | 'definition_not_active'
  | 'selected_after_definition_end'
  | 'selected_off_cadence'
  | 'selected_occurrence_not_found'
  | 'already_deleted'
  | 'duplicate_occurrence_for_date'
  | 'conflicting_occurrence_and_suppression';

export interface SeriesDeleteDefinitionUpdate {
  seriesId: string;
  /** Inclusive end applied to the definition, or null when fully discontinued. */
  endDateBefore: string | null;
  /** True when the selected date is the definition's own first occurrence. */
  discontinued: boolean;
}

/** One occurrence to mark as an invisible deletion record (identity preserved). */
export interface SeriesDeleteMark {
  occurrenceId: string;
  occurrenceDateISO: string;
  isSeriesException: boolean;
}

export interface SeriesDeleteCounts {
  definitionUpdates: number; // always 1 on success
  deletions: number;
  total: number;
}

export type SeriesDeletePlan =
  | {
      ok: true;
      definitionUpdate: SeriesDeleteDefinitionUpdate;
      deletions: SeriesDeleteMark[];
      /** The single stable timestamp to stamp on every deletion mark. */
      deletedAt: string;
      counts: SeriesDeleteCounts;
    }
  /** `occurrenceDateISO` present (diagnostics) for date-scoped failures. */
  | { ok: false; reason: SeriesDeleteFailureReason; occurrenceDateISO?: string };

/** Previous calendar day of a local YYYY-MM-DD, timezone-independent. */
function previousDayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Whole calendar days from `a` to `b` (local dates), timezone-independent. */
function daysBetweenISO(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** True when `date` lands exactly on the series cadence from `startDate`
 *  (`startDate + n * intervalWeeks * 7 days`, n >= 0). Fails closed for a
 *  non-positive interval. */
function isOnCadence(startDate: string, intervalWeeks: number, date: string): boolean {
  const step = intervalWeeks * 7;
  if (!Number.isInteger(step) || step <= 0) return false;
  const diff = daysBetweenISO(startDate, date);
  return diff >= 0 && diff % step === 0;
}

/** A "live" occurrence is one that is neither already deleted nor cancelled —
 *  the only kind that participates in duplicate/suppression conflict checks. */
function isLive(o: DeleteOccurrenceInput): boolean {
  return o.isDeleted !== true && o.status !== 'cancelled';
}

/**
 * Plan a durable series delete-this-and-following. Pure. `deletedAt` is injected
 * (a single stable value) so every mark shares one timestamp and a retry stamps
 * the same value. Returns validation failures instead of throwing; on success
 * returns only planned changes and never a partial plan.
 */
export function planSeriesDelete(params: {
  definition: EventSeriesDefinition | null | undefined;
  selected: DeleteSelectedOccurrence;
  forwardOccurrences: readonly DeleteOccurrenceInput[];
  forwardSuppressions?: readonly DeleteSuppressionInput[];
  deletedAt: string;
}): SeriesDeletePlan {
  const { definition, selected, forwardOccurrences, forwardSuppressions = [], deletedAt } = params;

  if (!selected.seriesId) return { ok: false, reason: 'unsupported_legacy_occurrence' };
  if (!PLAIN_DATE.test(selected.occurrenceDateISO)) return { ok: false, reason: 'invalid_occurrence_date' };
  if (!definition) return { ok: false, reason: 'missing_definition' };
  if (definition.id !== selected.seriesId) return { ok: false, reason: 'not_series_member' };
  if (selected.occurrenceDateISO < definition.startDate) return { ok: false, reason: 'selected_before_definition_start' };
  // Fail-closed integrity guards: acting on any of these states could end the
  // definition while leaving forward same-series occurrences un-enumerated and
  // therefore orphaned (active but no owning definition).
  if (definition.status !== 'active') return { ok: false, reason: 'definition_not_active' };
  if (definition.endDate !== null && selected.occurrenceDateISO > definition.endDate) {
    return { ok: false, reason: 'selected_after_definition_end' };
  }
  if (!isOnCadence(definition.startDate, definition.intervalWeeks, selected.occurrenceDateISO)) {
    return { ok: false, reason: 'selected_off_cadence' };
  }

  const seriesId = selected.seriesId;
  const fromDate = selected.occurrenceDateISO;

  // Same-series forward members only (>= fromDate). Foreign / no-seriesId
  // occurrences are never in scope — a same-tuple sibling series is isolated.
  const members = forwardOccurrences.filter(
    (o) => o.seriesId === seriesId && o.occurrenceDateISO >= fromDate,
  );

  // Validate dates and detect duplicate LIVE occurrences per date (fail closed).
  const liveByDate = new Map<string, number>();
  for (const o of members) {
    if (!PLAIN_DATE.test(o.occurrenceDateISO)) {
      return { ok: false, reason: 'invalid_occurrence_date', occurrenceDateISO: o.occurrenceDateISO };
    }
    if (isLive(o)) {
      const n = (liveByDate.get(o.occurrenceDateISO) ?? 0) + 1;
      liveByDate.set(o.occurrenceDateISO, n);
      if (n > 1) return { ok: false, reason: 'duplicate_occurrence_for_date', occurrenceDateISO: o.occurrenceDateISO };
    }
  }

  // Conflict: a LIVE occurrence coexisting with a suppression for the same
  // forward date is contradictory. An already-deleted or cancelled occurrence
  // coexisting with a suppression is valid (same no-regeneration intent).
  const suppressedDates = new Set<string>();
  for (const s of forwardSuppressions) {
    if (s.seriesId !== seriesId) continue;
    if (s.occurrenceDateISO < fromDate) continue;
    suppressedDates.add(s.occurrenceDateISO);
  }
  if (suppressedDates.size > 0) {
    for (const o of members) {
      if (!isLive(o)) continue;
      if (suppressedDates.has(o.occurrenceDateISO)) {
        return { ok: false, reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: o.occurrenceDateISO };
      }
    }
  }

  // The selected anchor must still be a same-series occurrence at its date.
  const anchor = members.find((o) => o.id === selected.id && o.occurrenceDateISO === fromDate);
  if (!anchor) return { ok: false, reason: 'selected_occurrence_not_found' };
  // Safe repeat: the anchor is already an invisible deletion record — nothing to
  // do, and re-stamping deletedAt is avoided (zero new mutation).
  if (anchor.isDeleted === true) return { ok: false, reason: 'already_deleted' };

  // Every not-yet-deleted forward member becomes an invisible deletion record.
  // Already-deleted members are skipped (never re-stamped).
  const deletions: SeriesDeleteMark[] = [];
  for (const o of members) {
    if (o.isDeleted === true) continue;
    deletions.push({
      occurrenceId: o.id,
      occurrenceDateISO: o.occurrenceDateISO,
      isSeriesException: o.isSeriesException === true,
    });
  }

  const discontinued = fromDate === definition.startDate;
  const definitionUpdate: SeriesDeleteDefinitionUpdate = {
    seriesId,
    endDateBefore: discontinued ? null : previousDayISO(fromDate),
    discontinued,
  };

  const counts: SeriesDeleteCounts = {
    definitionUpdates: 1,
    deletions: deletions.length,
    total: 1 + deletions.length,
  };

  return { ok: true, definitionUpdate, deletions, deletedAt, counts };
}
