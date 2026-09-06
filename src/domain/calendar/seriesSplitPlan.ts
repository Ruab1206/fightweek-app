/**
 * seriesSplitPlan — Slice 2b-1 pure planner for "this training and all future
 * trainings" (a recurring-series split). It computes the COMPLETE set of
 * planned changes and NEVER writes, reads Firestore, or depends on React.
 *
 * Membership is resolved by `seriesId` only (never tuple). The planner
 * preserves every occurrence id and date so Notes (`s_{date}_{id}`) and
 * TrainingLog associations (`sessionId`+`occurrenceDateISO`) keep resolving.
 * Persistence shape, transactions, and UI activation are out of scope here.
 */
import { buildEventSeriesDefinition, type EventSeriesDefinition } from './eventSeriesDefinition';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The persisted occurrence fields the split propagates to the new series. */
export interface SplitEditedFields {
  title: string;
  discipline?: string;
  location?: string;
  startTime: string;
  endTime: string;
}

/** Minimal identity/state a planner needs for one materialized occurrence. */
export interface SplitOccurrenceInput {
  id: string;
  seriesId?: string;
  occurrenceDateISO: string;
  isSeriesException?: boolean;
  status?: string;
  /** True when this is an invisible durable-deletion record (J.9/R25-R36). */
  isDeleted?: boolean;
}

/** Minimal identity of the occurrence the user split from. */
export interface SplitSelectedOccurrence {
  id: string;
  seriesId?: string;
  occurrenceDateISO: string;
  isSeriesException?: boolean;
  status?: string;
  isDeleted?: boolean;
}

export interface SplitSuppressionInput {
  seriesId: string;
  occurrenceDateISO: string;
}

/** One planned re-parent to the new series (a clean occurrence, the anchor,
 *  or an active future exception). */
export interface SplitReparentOp {
  occurrenceId: string;        // preserved
  occurrenceDateISO: string;   // preserved
  fromSeriesId: string;
  toSeriesId: string;
  /** Absent when `preserveExistingFields` is true — the exception's own content is left as-is. */
  fields?: SplitEditedFields;
  /** True only for the selected anchor when it was an exception (flag cleared). */
  clearedException: boolean;
  /** True for a non-anchor active exception: only `seriesId` changes, its
   *  independently edited fields and `isSeriesException` are never touched. */
  preserveExistingFields: boolean;
}

/** One planned suppression continuity: same date, re-pointed to the new series. */
export interface SplitSuppressionContinuation {
  from: { seriesId: string; occurrenceDateISO: string };
  to: { seriesId: string; occurrenceDateISO: string };
}

export interface SplitCounts {
  definitionUpdates: number;
  definitionCreates: number;
  occurrenceReparents: number;
  suppressionContinuations: number;
  total: number;
}

export type SplitPlanFailureReason =
  | 'missing_series_id'
  | 'missing_definition'
  | 'selected_before_definition_start'
  | 'unsupported_legacy_occurrence'
  | 'invalid_occurrence_date'
  | 'conflicting_occurrence_and_suppression'
  | 'anchor_is_deleted';

export interface SplitOldDefinitionUpdate {
  seriesId: string;
  /** Inclusive end applied to the old series, or null when discontinued. */
  endDateBefore: string | null;
  /** True when the anchor is the old series' own first occurrence. */
  discontinued: boolean;
}

export type SplitPlan =
  | {
      ok: true;
      oldDefinitionUpdate: SplitOldDefinitionUpdate;
      newDefinition: EventSeriesDefinition;
      reparents: SplitReparentOp[];
      suppressionContinuations: SplitSuppressionContinuation[];
      counts: SplitCounts;
    }
  /** `occurrenceDateISO` is present (diagnostics only) for `conflicting_occurrence_and_suppression`. */
  | { ok: false; reason: SplitPlanFailureReason; occurrenceDateISO?: string };

/**
 * An old-series date is a conflicting lifecycle state (fail closed, never
 * silently resolved) when it carries a suppression AND an occurrence that is
 * still active (clean or an active exception) — one input says the date is
 * deleted, the other says it must be preserved. A cancelled occurrence (plain
 * or exception) alongside a suppression is NOT a conflict: both express the
 * same no-regeneration intent (R7). Only forward dates (>= splitDate) are
 * checked — past dates never reach the plan's write set.
 */
function findConflictingOldSeriesDate(params: {
  oldSeriesId: string;
  splitDate: string;
  forwardOccurrences: readonly SplitOccurrenceInput[];
  forwardSuppressions: readonly SplitSuppressionInput[];
}): string | null {
  const { oldSeriesId, splitDate, forwardOccurrences, forwardSuppressions } = params;
  const suppressedDates = new Set<string>();
  for (const supp of forwardSuppressions) {
    if (supp.seriesId !== oldSeriesId) continue;
    if (supp.occurrenceDateISO < splitDate) continue;
    suppressedDates.add(supp.occurrenceDateISO);
  }
  if (suppressedDates.size === 0) return null;
  for (const occ of forwardOccurrences) {
    if (occ.seriesId !== oldSeriesId) continue;
    if (occ.occurrenceDateISO < splitDate) continue;
    if (occ.status === 'cancelled' || occ.isDeleted === true) continue; // cancelled/isDeleted + suppression is valid
    if (suppressedDates.has(occ.occurrenceDateISO)) return occ.occurrenceDateISO;
  }
  return null;
}

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

/**
 * Plan a series split. Pure. `newSeriesId` and `now` are injected so the
 * planner stays deterministic (no UUID/clock inside). Returns validation
 * failures instead of throwing; on success returns only planned changes.
 */
export function planSeriesSplit(params: {
  oldDefinition: EventSeriesDefinition | null | undefined;
  selected: SplitSelectedOccurrence;
  edited: SplitEditedFields;
  forwardOccurrences: readonly SplitOccurrenceInput[];
  forwardSuppressions: readonly SplitSuppressionInput[];
  newSeriesId: string;
  now?: string;
}): SplitPlan {
  const { oldDefinition, selected, edited, forwardOccurrences, forwardSuppressions, newSeriesId, now } = params;

  if (!selected.seriesId) return { ok: false, reason: 'unsupported_legacy_occurrence' };
  if (!PLAIN_DATE.test(selected.occurrenceDateISO)) return { ok: false, reason: 'invalid_occurrence_date' };
  // R31: an isDeleted occurrence is never reactivated — not even as a split anchor.
  // Defense-in-depth: R32 already excludes isDeleted from all presentation/interaction,
  // so the UI should never let a user select one, but the planner fails closed anyway.
  if (selected.isDeleted) return { ok: false, reason: 'anchor_is_deleted' };
  if (!oldDefinition) return { ok: false, reason: 'missing_definition' };
  if (oldDefinition.id !== selected.seriesId) return { ok: false, reason: 'missing_series_id' };
  if (selected.occurrenceDateISO < oldDefinition.startDate) return { ok: false, reason: 'selected_before_definition_start' };

  const oldSeriesId = selected.seriesId;
  const splitDate = selected.occurrenceDateISO;

  const conflictingDate = findConflictingOldSeriesDate({ oldSeriesId, splitDate, forwardOccurrences, forwardSuppressions });
  if (conflictingDate) {
    return { ok: false, reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: conflictingDate };
  }

  // Re-parent the selected anchor, every clean forward member, and every
  // active future exception (preserving its own edited content). Cancelled
  // and isDeleted occurrences stay associated with the old (now-ended) series
  // — never re-parented, never overwritten, never reactivated (R31) — and
  // instead receive suppression continuity below so the new series' own
  // materializer cannot resurrect their date.
  const reparents: SplitReparentOp[] = [];
  for (const occ of forwardOccurrences) {
    if (occ.seriesId !== oldSeriesId) continue;
    if (occ.occurrenceDateISO < splitDate) continue;
    const isAnchor = occ.id === selected.id;
    if (!isAnchor && occ.isDeleted === true) continue;      // isDeleted: never reparented/reactivated
    if (!isAnchor && occ.status === 'cancelled') continue;  // cancelled tombstone preserved on old series
    if (!isAnchor && occ.isSeriesException) {
      // Active future exception: re-parented so its date stays covered under
      // the new series, but its independently edited fields are NEVER
      // replaced by the submitted series-wide edit.
      reparents.push({
        occurrenceId: occ.id,
        occurrenceDateISO: occ.occurrenceDateISO,
        fromSeriesId: oldSeriesId,
        toSeriesId: newSeriesId,
        clearedException: false,
        preserveExistingFields: true,
      });
      continue;
    }
    reparents.push({
      occurrenceId: occ.id,
      occurrenceDateISO: occ.occurrenceDateISO,
      fromSeriesId: oldSeriesId,
      toSeriesId: newSeriesId,
      fields: edited,
      clearedException: isAnchor && occ.isSeriesException === true,
      preserveExistingFields: false,
    });
  }

  // Suppression continuity: a tombstone on the old series is supplementary,
  // never a regeneration authority (R7) — only a suppression prevents a
  // future new-series materializer from resurrecting the date (R8). Forward
  // continuity is therefore produced from (A) existing suppressions, (B)
  // cancelled occurrences, and (C) isDeleted occurrences (status:'cancelled'
  // or isDeleted:true only — never inferred from other field differences),
  // deduped by {newSeriesId, occurrenceDateISO} so an already-suppressed
  // cancelled/isDeleted date yields exactly one operation.
  const suppressionContinuations: SplitSuppressionContinuation[] = [];
  const continuedDates = new Set<string>();
  const addContinuation = (occurrenceDateISO: string) => {
    if (continuedDates.has(occurrenceDateISO)) return;
    continuedDates.add(occurrenceDateISO);
    suppressionContinuations.push({
      from: { seriesId: oldSeriesId, occurrenceDateISO },
      to: { seriesId: newSeriesId, occurrenceDateISO },
    });
  };
  for (const supp of forwardSuppressions) {
    if (supp.seriesId !== oldSeriesId) continue;
    if (supp.occurrenceDateISO < splitDate) continue;   // past suppression stays on old series
    addContinuation(supp.occurrenceDateISO);
  }
  for (const occ of forwardOccurrences) {
    if (occ.seriesId !== oldSeriesId) continue;
    if (occ.occurrenceDateISO < splitDate) continue;    // past cancellation/deletion stays on old series
    if (occ.status !== 'cancelled' && occ.isDeleted !== true) continue; // active exceptions do not auto-suppress
    addContinuation(occ.occurrenceDateISO);
  }

  const discontinued = splitDate === oldDefinition.startDate;
  const oldDefinitionUpdate: SplitOldDefinitionUpdate = {
    seriesId: oldSeriesId,
    endDateBefore: discontinued ? null : previousDayISO(splitDate),
    discontinued,
  };

  const newDefinition = buildEventSeriesDefinition({
    seriesId: newSeriesId,
    ownerKey: oldDefinition.ownerKey,
    title: edited.title,
    discipline: edited.discipline,
    location: edited.location,
    dayOfWeek: oldDefinition.dayOfWeek,
    startTime: edited.startTime,
    endTime: edited.endTime,
    startDate: splitDate,
    intervalWeeks: oldDefinition.intervalWeeks,
    endDate: oldDefinition.endDate,
    now,
  });

  const counts: SplitCounts = {
    definitionUpdates: 1,
    definitionCreates: 1,
    occurrenceReparents: reparents.length,
    suppressionContinuations: suppressionContinuations.length,
    total: 2 + reparents.length + suppressionContinuations.length,
  };

  return { ok: true, oldDefinitionUpdate, newDefinition, reparents, suppressionContinuations, counts };
}
