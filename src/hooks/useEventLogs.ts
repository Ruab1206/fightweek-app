/**
 * useEventLogs — thin React state coordinator around the completed-training
 * pure coordinator and eventLogService persistence.
 *
 * Does not duplicate validation, record construction, or persistence paths —
 * delegates to `addCompletedTrainingLog` (domain coordinator) and
 * `listCompletedSelfPostedTrainingLogs` (service). Receives an
 * already-resolved `fighterKey`; does not resolve names/emails itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { addCompletedTrainingLog } from '../domain/calendar/logCoordinator';
import type { CompletedSelfPostedTrainingInput } from '../domain/calendar/selfPostedTraining';
import type { CompletedSelfPostedTrainingLog } from '../domain/calendar/types';
import {
  addCompletedSelfPostedTrainingLog,
  listCompletedSelfPostedTrainingLogs,
} from '../services/eventLogService';
import {
  mintUnplannedTrainingCreationIds,
  type UnplannedTrainingCreationIds,
} from '../domain/calendar/newModelCalendarAggregate';
import { buildUnplannedTrainingRecords } from '../domain/calendar/unplannedTrainingCoordinator';
import { persistUnplannedTrainingAtomically } from '../services/unplannedTrainingService';

/**
 * Explicit lifecycle status, distinct from the `loading` boolean below:
 * `'idle'` means no load has started yet for the current `fighterKey` (e.g.
 * an empty key), `'loading'` covers both the very first request and any
 * refresh, `'loaded'` is a resolved (possibly empty) result, and `'error'` is
 * a failed request. This lets a consumer tell "not yet loaded"/"loading"
 * apart from "loaded successfully with zero results" — a plain boolean
 * cannot represent that distinction (see the calendar-occurrence log
 * association slice in App.tsx, which must not treat an unresolved request
 * as "no logs").
 */
export type EventLogsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseEventLogsResult {
  logs: CompletedSelfPostedTrainingLog[];
  /** Convenience alias for `status === 'loading'`. Kept for existing callers. */
  loading: boolean;
  error: Error | null;
  status: EventLogsStatus;
  addLog: (input: CompletedSelfPostedTrainingInput) => Promise<string>;
  refresh: () => Promise<void>;
  /**
   * Checkpoint B: atomically create a new-model `NewModelCalendarAggregate`
   * + paired `TrainingLog` for one unplanned-training action (the standalone
   * flow only — the calendar-originated flow keeps using `addLog`
   * unchanged). Mints a shared id bundle on the FIRST call after the last
   * `resetUnplannedAttempt()`/successful completion, and REUSES that same
   * bundle on every subsequent call until success or an explicit reset — so
   * a technical retry after a failed save is idempotent (same ids), while a
   * genuinely new attempt (after `resetUnplannedAttempt()`) mints fresh ids.
   */
  addUnplannedTraining: (input: CompletedSelfPostedTrainingInput) => Promise<UnplannedTrainingCreationIds>;
  /**
   * Clear the in-progress unplanned-training id bundle, if any. Call on
   * sheet open, explicit cancel/close, and whenever the fighter key changes
   * (also handled internally on fighter-key change). A render or a plain
   * logs refresh must NOT call this — only an explicit new-attempt boundary.
   */
  resetUnplannedAttempt: () => void;
}

export function useEventLogs(fighterKey: string): UseEventLogsResult {
  const [logs, setLogs] = useState<CompletedSelfPostedTrainingLog[]>([]);
  // Initialize to 'loading' (not 'idle') when a fighterKey is already present
  // on first render, since the effect below will start a request for it
  // before the next paint — otherwise there would be a one-render window
  // where `status` looks like "loaded empty" before the request even started.
  const [status, setStatus] = useState<EventLogsStatus>(fighterKey ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  // Bumped whenever a load becomes stale (fighterKey changed / unmounted) so
  // an in-flight response for a previous fighter is ignored on arrival.
  const requestIdRef = useRef(0);

  // Checkpoint B: the shared id bundle for the CURRENT in-progress unplanned-
  // training attempt, if any. Retained across a failed submit (so a retry
  // reuses the same ids); cleared on success, explicit reset, and fighter-key
  // change. A plain render or logs refresh never touches this.
  const pendingIdsRef = useRef<UnplannedTrainingCreationIds | null>(null);

  const load = useCallback(async () => {
    if (!fighterKey) {
      setLogs([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus('loading');

    try {
      const result = await listCompletedSelfPostedTrainingLogs(fighterKey);
      if (requestIdRef.current !== requestId) return;
      setLogs(result);
      setError(null);
      setStatus('loaded');
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('error');
    }
  }, [fighterKey]);

  useEffect(() => {
    // Fighter-key change (including initial mount) always starts a fresh
    // unplanned-training attempt boundary — an in-progress bundle for a
    // previous/different fighter must never be reused.
    pendingIdsRef.current = null;
    load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  const addLog = useCallback(
    async (input: CompletedSelfPostedTrainingInput): Promise<string> => {
      if (!fighterKey) {
        const err = new Error('useEventLogs: cannot add a log without a fighterKey');
        setError(err);
        throw err;
      }

      try {
        const id = await addCompletedTrainingLog(input, fighterKey, {
          persist: addCompletedSelfPostedTrainingLog,
        });
        await load();
        return id;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [fighterKey, load],
  );

  const refresh = useCallback(() => load(), [load]);

  const resetUnplannedAttempt = useCallback(() => {
    pendingIdsRef.current = null;
  }, []);

  const addUnplannedTraining = useCallback(
    async (input: CompletedSelfPostedTrainingInput): Promise<UnplannedTrainingCreationIds> => {
      if (!fighterKey) {
        const err = new Error('useEventLogs: cannot add unplanned training without a fighterKey');
        setError(err);
        throw err;
      }

      // Lazy-mint on first submit of an attempt; a retry (pendingIdsRef.current
      // already set from a prior failed call) reuses the SAME bundle.
      if (!pendingIdsRef.current) {
        pendingIdsRef.current = mintUnplannedTrainingCreationIds(() => crypto.randomUUID());
      }
      const ids = pendingIdsRef.current;

      try {
        // The aggregate/log's owning identity is the resolved fighterKey —
        // required for the Firestore bilateral-pair rule's owner check, and
        // set here regardless of whether the caller already supplied one.
        const { aggregate, logRecord } = buildUnplannedTrainingRecords(
          { ...input, userId: fighterKey },
          ids,
        );
        await persistUnplannedTrainingAtomically(fighterKey, aggregate, logRecord);
        pendingIdsRef.current = null; // success: next action gets a fresh bundle
        await load();
        return ids;
      } catch (err) {
        // failure: pendingIdsRef.current is intentionally NOT cleared, so a
        // retry (same ids) can follow.
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [fighterKey, load],
  );

  return {
    logs,
    loading: status === 'loading',
    error,
    status,
    addLog,
    refresh,
    addUnplannedTraining,
    resetUnplannedAttempt,
  };
}
