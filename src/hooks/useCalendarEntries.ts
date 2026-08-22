/**
 * useCalendarEntries — Checkpoint B: thin React state coordinator around
 * `calendarEntryService.listCalendarEntries`. Mirrors `useEventLogs`'s
 * status/stale-request pattern; one-shot read only (no realtime listener).
 * Never writes to legacy weeks; never repairs/writes data itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listCalendarEntries, type CalendarEntryLoadIssue } from '../services/calendarEntryService';
import type { NewModelCalendarAggregate } from '../domain/calendar/types';

export type CalendarEntriesStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseCalendarEntriesResult {
  entries: NewModelCalendarAggregate[];
  issues: CalendarEntryLoadIssue[];
  status: CalendarEntriesStatus;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useCalendarEntries(fighterKey: string): UseCalendarEntriesResult {
  const [entries, setEntries] = useState<NewModelCalendarAggregate[]>([]);
  const [issues, setIssues] = useState<CalendarEntryLoadIssue[]>([]);
  const [status, setStatus] = useState<CalendarEntriesStatus>(fighterKey ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!fighterKey) {
      setEntries([]);
      setIssues([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus('loading');

    try {
      const result = await listCalendarEntries(fighterKey);
      if (requestIdRef.current !== requestId) return;
      setEntries(result.entries);
      setIssues(result.issues);
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

  const refresh = useCallback(() => load(), [load]);

  return { entries, issues, status, error, refresh };
}
