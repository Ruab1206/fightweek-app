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

export interface UseEventLogsResult {
  logs: CompletedSelfPostedTrainingLog[];
  loading: boolean;
  error: Error | null;
  addLog: (input: CompletedSelfPostedTrainingInput) => Promise<string>;
  refresh: () => Promise<void>;
}

export function useEventLogs(fighterKey: string): UseEventLogsResult {
  const [logs, setLogs] = useState<CompletedSelfPostedTrainingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Bumped whenever a load becomes stale (fighterKey changed / unmounted) so
  // an in-flight response for a previous fighter is ignored on arrival.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!fighterKey) {
      setLogs([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const result = await listCompletedSelfPostedTrainingLogs(fighterKey);
      if (requestIdRef.current !== requestId) return;
      setLogs(result);
      setError(null);
      setLoading(false);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
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

  return { logs, loading, error, addLog, refresh };
}
