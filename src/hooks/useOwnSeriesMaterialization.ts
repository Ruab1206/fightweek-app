/**
 * useOwnSeriesMaterialization — Slice 2c-3 owner-scoped production trigger for
 * rolling EventSeries materialization. Invisible automatic maintenance: it lists
 * the AUTHENTICATED owner's active series and materializes each via the approved
 * `seriesMaterializationService`, non-blocking and diagnostic-only.
 *
 * Owner identity is ALWAYS the authenticated Firebase user email — never
 * `activeFighter`/`activeFighterKey`/viewed calendar/"Vis som bruger" state, so
 * an admin/coach/teammate viewing another fighter never materializes the viewed
 * fighter's data. `planSeriesMaterialization` + `seriesMaterializationService`
 * remain the sole domain/persistence authorities; this only decides WHEN it runs
 * and for WHOM. R275 unaffected: no split invocation, no this-and-following, no
 * SessionModal wiring.
 *
 * The coordination logic is extracted framework-free so it is testable without
 * React; the hook is a thin wrapper that drives it from auth + three triggers:
 * authenticated startup / owner change, a one-shot next-ISO-week-boundary timer
 * (rescheduled after firing — never recurring polling), and a visibility catch-up
 * for sleeping/backgrounded tabs.
 *
 * Retry semantics: `inFlight` guards CONCURRENCY (never two runs at once for the
 * current owner); `lastSuccessfulWeek` guards REPEATED WORK (never re-run a week
 * that already completed cleanly). These are deliberately separate — a
 * transient owner-series-read or materialization infrastructure/transaction
 * failure must NOT permanently mark the week done, so a later `visibilitychange`
 * in the same ISO week can retry. A malformed definition or a planner
 * data-integrity conflict is diagnostic-only for its own series and does NOT by
 * itself prevent the week from being marked successfully handled (D).
 */
import { useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { getISOWeek } from '../utils/dateUtils';
import {
  listActiveOwnerSeriesDefinitions,
  materializeSeries,
} from '../services/seriesMaterializationService';

/** Planner failure reasons that are genuine DATA-INTEGRITY conflicts (as
 *  opposed to a definition- or infrastructure-level problem). */
const INTEGRITY_CONFLICT_REASONS = new Set([
  'duplicate_occurrence_for_date',
  'active_occurrence_with_suppression',
  'deterministic_id_conflict_foreign_series',
  'deterministic_id_conflict_incompatible_date',
]);

export interface OwnSeriesMaterializationDeps {
  listActiveOwnerSeries: typeof listActiveOwnerSeriesDefinitions;
  materialize: typeof materializeSeries;
  isoWeek: () => number;
}

const defaultDeps: OwnSeriesMaterializationDeps = {
  listActiveOwnerSeries: listActiveOwnerSeriesDefinitions,
  materialize: materializeSeries,
  isoWeek: getISOWeek,
};

export interface MaterializationConflict {
  seriesId?: string;
  reason: string;
  occurrenceDateISO?: string;
}

/** Structured, non-blocking diagnostics for one attempt. */
export interface MaterializationRunDiagnostics {
  ownerKey: string;
  isoWeek: number;
  reason: string;
  seriesActive: number;
  seriesSkipped: number;
  totalCreated: number;
  integrityConflicts: MaterializationConflict[];
  definitionIssues: MaterializationConflict[];
  infraFailures: number;
  readFailed: boolean;
  /** Deterministic completion rule (D): true only when the owner-series read
   *  succeeded AND no series/week hit an infrastructure/transaction failure.
   *  Definition/integrity diagnostics never prevent this — they are
   *  non-retryable for their own series but do not block the week. */
  successful: boolean;
}

export interface OwnSeriesMaterializationCoordinator {
  setOwner(ownerKey: string | null): void;
  attempt(reason: string): Promise<MaterializationRunDiagnostics | null>;
  getLastRun(): MaterializationRunDiagnostics | null;
}

/**
 * Framework-free coordinator. `inFlight` blocks any concurrent run for the
 * current owner; `lastSuccessfulWeek` blocks only a REPEAT of a week that
 * already completed cleanly — a failed attempt leaves it untouched so a later
 * signal (typically `visibilitychange`) can retry the SAME week. React Strict
 * Mode replays, rerenders and duplicate signals are absorbed by `inFlight`
 * (while running) and by `lastSuccessfulWeek` (once a week has succeeded).
 */
export function createOwnSeriesMaterializationCoordinator(
  deps: OwnSeriesMaterializationDeps = defaultDeps,
): OwnSeriesMaterializationCoordinator {
  let ownerKey: string | null = null;
  let lastSuccessfulWeek: number | null = null;
  let inFlight = false;
  let lastRun: MaterializationRunDiagnostics | null = null;

  function setOwner(next: string | null): void {
    if (next === ownerKey) return;
    // Never carry one owner's successful/failed week state into another
    // owner's session (F). `inFlight` is left alone: a still-running attempt
    // for the PREVIOUS owner is guarded against contaminating the new owner's
    // state below (only the run's own captured owner may record success).
    ownerKey = next;
    lastSuccessfulWeek = null;
  }

  async function attempt(reason: string): Promise<MaterializationRunDiagnostics | null> {
    const owner = ownerKey;
    if (!owner) return null;
    if (inFlight) return null; // in-flight guard: no concurrent runs (A)
    const isoWeek = deps.isoWeek();
    if (lastSuccessfulWeek === isoWeek) return null; // week already completed cleanly (B)
    inFlight = true;
    try {
      const diag = await runMaterialization(deps, owner, isoWeek, reason);
      lastRun = diag;
      // Guard: only THIS run's own owner may record success — an owner switch
      // mid-flight must never let a stale run mark the NEW owner's week done.
      if (ownerKey === owner && diag.successful) lastSuccessfulWeek = isoWeek;
      return diag;
    } finally {
      inFlight = false;
    }
  }

  return { setOwner, attempt, getLastRun: () => lastRun };
}

async function runMaterialization(
  deps: OwnSeriesMaterializationDeps,
  ownerKey: string,
  isoWeek: number,
  reason: string,
): Promise<MaterializationRunDiagnostics> {
  const diag: MaterializationRunDiagnostics = {
    ownerKey, isoWeek, reason,
    seriesActive: 0, seriesSkipped: 0, totalCreated: 0,
    integrityConflicts: [], definitionIssues: [], infraFailures: 0, readFailed: false,
    successful: false,
  };

  const listResult = await deps.listActiveOwnerSeries(ownerKey);
  if (!listResult.ok) {
    diag.readFailed = true;
    // Infrastructure failure (offline/Firestore) — diagnostic-only, non-blocking,
    // and RETRYABLE: `successful` stays false so a later same-week signal retries.
    console.warn('[materialization] owner series read failed', { ownerKey, error: listResult.error });
    return diag;
  }

  diag.seriesActive = listResult.definitions.length;
  diag.seriesSkipped = listResult.skipped;

  for (const def of listResult.definitions) {
    let res;
    try {
      res = await deps.materialize({ fighterKey: ownerKey, seriesId: def.id });
    } catch (error) {
      // A thrown error (e.g. permission-denied) fails ONLY this series.
      diag.infraFailures += 1;
      console.warn('[materialization] series threw', { ownerKey, seriesId: def.id, error });
      continue;
    }
    if (!res.ok) {
      diag.definitionIssues.push({ seriesId: def.id, reason: res.reason }); // fail-closed per series
      continue;
    }
    diag.totalCreated += res.totalCreated;
    for (const week of res.weeks) {
      if (week.ok) continue;
      if (week.kind === 'planner') {
        (INTEGRITY_CONFLICT_REASONS.has(week.reason) ? diag.integrityConflicts : diag.definitionIssues)
          .push({ seriesId: def.id, reason: week.reason, occurrenceDateISO: week.occurrenceDateISO });
      } else if (week.kind === 'definition') {
        diag.definitionIssues.push({ seriesId: def.id, reason: week.reason });
      } else {
        diag.infraFailures += 1;
      }
    }
  }

  // Keep data-integrity conflicts identifiable in diagnostics without blocking.
  if (diag.integrityConflicts.length > 0) {
    console.warn('[materialization] integrity conflicts', { ownerKey, conflicts: diag.integrityConflicts });
  }
  // Deterministic completion rule (D): the read succeeded and no series/week
  // hit an infrastructure/transaction failure. Definition/integrity issues are
  // diagnostic-only for their own series and never block this — they must not
  // cause an endless whole-run retry cycle by themselves.
  diag.successful = !diag.readFailed && diag.infraFailures === 0;
  return diag;
}

/** Ms from `now` until the next local ISO-week boundary (next Monday 00:00). */
export function msUntilNextISOWeekBoundary(now: Date): number {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isoDow = (todayMidnight.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const nextMonday = new Date(todayMidnight);
  nextMonday.setDate(todayMidnight.getDate() + (7 - isoDow)); // always 1..7 days ahead
  return nextMonday.getTime() - now.getTime();
}

export interface OwnSeriesMaterializationParams {
  user: User | null;
  accessDenied?: boolean;
  isBrowserBlocked?: boolean;
  /** Test seam only; production uses the real service + ISO-week clock. */
  deps?: OwnSeriesMaterializationDeps;
}

/**
 * Wire the owner-scoped materialization trigger into the authenticated app.
 * Fire-and-forget: renders nothing, blocks nothing. Owner is derived ONLY from
 * `user.email`; `activeFighter*` is never a dependency, so switching the viewed
 * fighter cannot retrigger materialization.
 */
export function useOwnSeriesMaterialization(params: OwnSeriesMaterializationParams): void {
  const { user, accessDenied, isBrowserBlocked, deps } = params;
  const coordRef = useRef<OwnSeriesMaterializationCoordinator | null>(null);
  if (coordRef.current === null) coordRef.current = createOwnSeriesMaterializationCoordinator(deps);

  const ownerKey = user?.email?.trim().toLowerCase() || null;
  const eligible = !!ownerKey && !accessDenied && !isBrowserBlocked;

  // Startup + authenticated-owner change: one attempt (deduped per owner/week).
  useEffect(() => {
    const coord = coordRef.current!;
    if (!eligible) { coord.setOwner(null); return; }
    coord.setOwner(ownerKey);
    void coord.attempt('startup');
  }, [ownerKey, eligible]);

  // Visibility catch-up for sleeping/backgrounded tabs — a fresh-week check only.
  useEffect(() => {
    if (!eligible) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void coordRef.current!.attempt('visibility');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [eligible]);

  // One-shot timer to the next ISO-week boundary, rescheduled after firing.
  // Not recurring polling: a single pending timeout at any time.
  useEffect(() => {
    if (!eligible) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        void coordRef.current!.attempt('week-boundary');
        schedule();
      }, msUntilNextISOWeekBoundary(new Date()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [eligible]);
}
