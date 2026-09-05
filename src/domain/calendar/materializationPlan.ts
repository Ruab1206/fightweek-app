/**
 * materializationPlan — Slice 2c-1 pure planner for generating the occurrences
 * of a durable self-posted recurring series (`EventSeriesDefinition`). It is
 * the FIRST consumer of the Slice 2a suppression contract: it decides which
 * series/date occurrences to CREATE and NEVER writes, reads Firestore, or
 * depends on React or a clock/UUID (the horizon window is injected).
 *
 * Cadence is anchored strictly to the definition's `startDate` stepping —
 * candidate dates are `startDate + n * intervalWeeks` (n = 0, 1, 2, …). No ISO
 * week parity or system-week modulo scheme is used.
 *
 * R8 gate: a candidate date is generated ONLY when BOTH hold — no suppression
 * exists for (seriesId, date) AND no occurrence already exists for
 * (seriesId, date). Suppression is the authoritative no-regeneration source
 * (R7). Membership is resolved by `seriesId` only, never by tuple; a legacy
 * occurrence without `seriesId` is not part of this series and neither blocks
 * nor enables generation (R5/R9).
 *
 * Every planned occurrence carries a DETERMINISTIC id (`materializedOccurrenceId`)
 * derived only from (seriesId, occurrenceDateISO) — stable across retries and
 * reload, independent of mutable fields (name/time/status/etc). The planner
 * fails closed (no partial plan) on any data state that contradicts this
 * identity or the suppression contract: duplicate occurrences for one
 * series/date, an ACTIVE occurrence or exception coexisting with a suppression
 * for the same date (a cancelled one coexisting with a suppression is valid —
 * both express the same no-regeneration intent, R7), or the deterministic
 * target id already claimed by a foreign series or an incompatible date.
 */
import type { EventSeriesDefinition } from './eventSeriesDefinition';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Minimal identity/state a planner needs for one already-materialized occurrence. */
export interface MaterializationOccurrenceInput {
  id: string;
  seriesId?: string;
  occurrenceDateISO: string;
  isSeriesException?: boolean;
  status?: string;
}

/** A durable suppression the planner must honour as no-regeneration. */
export interface MaterializationSuppressionInput {
  seriesId: string;
  occurrenceDateISO: string;
}

/** One occurrence the plan says to create. Carries the definition's content. */
export interface PlannedOccurrence {
  /** Deterministic — see `materializedOccurrenceId`. */
  id: string;
  seriesId: string;
  occurrenceDateISO: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  discipline?: string;
  location?: string;
}

export interface MaterializationCounts {
  /** Candidate dates in the window before the R8 gate. */
  candidates: number;
  /** Candidates skipped because a suppression exists. */
  suppressed: number;
  /** Candidates skipped because an occurrence already exists. */
  existing: number;
  /** Occurrences the plan will create. */
  generate: number;
}

export type MaterializationFailureReason =
  | 'missing_definition'
  | 'discontinued_series'
  | 'invalid_interval'
  | 'invalid_start_date'
  | 'invalid_end_date'
  | 'invalid_horizon'
  | 'start_weekday_mismatch'
  | 'duplicate_occurrence_for_date'
  | 'active_occurrence_with_suppression'
  | 'deterministic_id_conflict_foreign_series'
  | 'deterministic_id_conflict_incompatible_date';

export type MaterializationPlan =
  | {
      ok: true;
      seriesId: string;
      generate: PlannedOccurrence[];
      counts: MaterializationCounts;
    }
  /** `occurrenceDateISO` is present (diagnostics only) for date-scoped failures. */
  | { ok: false; reason: MaterializationFailureReason; occurrenceDateISO?: string };

/**
 * Deterministic occurrence id for one materialized series/date. Depends ONLY
 * on `seriesId` and `occurrenceDateISO` — stable across retries, reload, and
 * any later field edit. Safe as a week-document session `id` (plain string,
 * no path separators), consistent with existing `{prefix}_{...}` id shapes
 * (e.g. `fravær_{groupId}`, `event_{eventId}_{date}`).
 */
export function materializedOccurrenceId(seriesId: string, occurrenceDateISO: string): string {
  return `series_${seriesId}_${occurrenceDateISO}`;
}

/** ISO weekday (1=Mon … 7=Sun) of a local YYYY-MM-DD, timezone-independent. */
function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
  return js === 0 ? 7 : js;
}

/** Add `days` calendar days to a local YYYY-MM-DD, timezone-independent. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Plan which occurrences of a durable recurring series to create. Pure. The
 * inclusive `horizonEndDateISO` window bound is injected so the planner stays
 * deterministic and free of any clock. Returns validation failures instead of
 * throwing; on success returns only the occurrences to generate.
 */
export function planSeriesMaterialization(params: {
  definition: EventSeriesDefinition | null | undefined;
  existingOccurrences: readonly MaterializationOccurrenceInput[];
  suppressions: readonly MaterializationSuppressionInput[];
  /** Inclusive last local date to materialize up to (the horizon window end). */
  horizonEndDateISO: string;
}): MaterializationPlan {
  const { definition, existingOccurrences, suppressions, horizonEndDateISO } = params;

  if (!definition) return { ok: false, reason: 'missing_definition' };
  if (definition.status !== 'active') return { ok: false, reason: 'discontinued_series' };
  if (!Number.isInteger(definition.intervalWeeks) || definition.intervalWeeks < 1) {
    return { ok: false, reason: 'invalid_interval' };
  }
  if (!PLAIN_DATE.test(definition.startDate)) return { ok: false, reason: 'invalid_start_date' };
  if (definition.endDate !== null && !PLAIN_DATE.test(definition.endDate)) {
    return { ok: false, reason: 'invalid_end_date' };
  }
  if (!PLAIN_DATE.test(horizonEndDateISO)) return { ok: false, reason: 'invalid_horizon' };
  if (isoWeekday(definition.startDate) !== definition.dayOfWeek) {
    return { ok: false, reason: 'start_weekday_mismatch' };
  }

  const seriesId = definition.id;

  // `endDate: null` is open-ended — the window is capped by the horizon, which
  // is NEVER substituted as the endDate (Slice 1 R-note). With an endDate set,
  // the effective window end is the earlier of the two bounds.
  const windowEnd =
    definition.endDate !== null && definition.endDate < horizonEndDateISO
      ? definition.endDate
      : horizonEndDateISO;

  const stepDays = definition.intervalWeeks * 7;
  const candidateDates: string[] = [];
  for (let date = definition.startDate; date <= windowEnd; date = addDaysISO(date, stepDays)) {
    candidateDates.push(date);
  }
  const candidateSet = new Set(candidateDates);

  // Occurrences of THIS series that fall on one of our candidate dates.
  // Membership by seriesId only (never tuple); off-cadence dates are outside
  // this run's scope and are never touched. Group by date to also expose a
  // fail-closed duplicate check (E.7).
  const byDate = new Map<string, MaterializationOccurrenceInput[]>();
  for (const occ of existingOccurrences) {
    if (occ.seriesId !== seriesId) continue;
    if (!candidateSet.has(occ.occurrenceDateISO)) continue;
    const list = byDate.get(occ.occurrenceDateISO);
    if (list) list.push(occ);
    else byDate.set(occ.occurrenceDateISO, [occ]);
  }
  for (const [date, occs] of byDate) {
    if (occs.length > 1) {
      return { ok: false, reason: 'duplicate_occurrence_for_date', occurrenceDateISO: date };
    }
  }

  // Suppressions of THIS series scoped to our candidate window.
  const suppressedDates = new Set<string>();
  for (const supp of suppressions) {
    if (supp.seriesId !== seriesId) continue;
    if (!candidateSet.has(supp.occurrenceDateISO)) continue;
    suppressedDates.add(supp.occurrenceDateISO);
  }

  // A suppression coexisting with an ACTIVE occurrence (plain or exception) is
  // a contradictory lifecycle state — one input says the date is deleted, the
  // other says it must be preserved — and fails closed (E.8/E.9). A CANCELLED
  // occurrence coexisting with a suppression is valid: both express the same
  // no-regeneration intent (R7), so it is a normal skip, never a conflict.
  for (const date of suppressedDates) {
    const occs = byDate.get(date);
    if (!occs) continue;
    if (occs[0].status !== 'cancelled') {
      return { ok: false, reason: 'active_occurrence_with_suppression', occurrenceDateISO: date };
    }
  }

  // Deterministic-id identity check (E.10/E.11), scanned against ALL supplied
  // occurrences (any series) since a claim on our target id from OUTSIDE this
  // series is itself the conflict. Only occurrences whose real persisted id
  // exactly equals our computed target id are examined; a differently-id'd
  // legacy occurrence for the same date is unaffected (handled above by date).
  const byId = new Map<string, MaterializationOccurrenceInput[]>();
  for (const occ of existingOccurrences) {
    const list = byId.get(occ.id);
    if (list) list.push(occ);
    else byId.set(occ.id, [occ]);
  }
  for (const date of candidateDates) {
    const targetId = materializedOccurrenceId(seriesId, date);
    const claimants = byId.get(targetId);
    if (!claimants) continue;
    for (const occ of claimants) {
      if (occ.seriesId !== seriesId) {
        return { ok: false, reason: 'deterministic_id_conflict_foreign_series', occurrenceDateISO: date };
      }
      if (occ.occurrenceDateISO !== date) {
        return { ok: false, reason: 'deterministic_id_conflict_incompatible_date', occurrenceDateISO: date };
      }
    }
  }

  const generate: PlannedOccurrence[] = [];
  let suppressed = 0;
  let existing = 0;

  for (const date of candidateDates) {
    if (suppressedDates.has(date)) {
      suppressed += 1;
      continue;
    }
    if (byDate.has(date)) {
      existing += 1;
      continue;
    }
    const planned: PlannedOccurrence = {
      id: materializedOccurrenceId(seriesId, date),
      seriesId,
      occurrenceDateISO: date,
      dayOfWeek: definition.dayOfWeek,
      startTime: definition.startTime,
      endTime: definition.endTime,
      title: definition.title,
    };
    if (definition.discipline !== undefined) planned.discipline = definition.discipline;
    if (definition.location !== undefined) planned.location = definition.location;
    generate.push(planned);
  }

  return {
    ok: true,
    seriesId,
    generate,
    counts: { candidates: candidateDates.length, suppressed, existing, generate: generate.length },
  };
}
