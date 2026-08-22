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

  return { logs, loading: status === 'loading', error, status, addLog, refresh };
}
