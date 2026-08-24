/**
 * TrainingLogPage — isolated chronological view of a fighter's completed
 * self-posted training logs (Phase 3 active slice, Step 4.3).
 *
 * Loads/persists through `useEventLogs` only (no direct Firestore/service
 * calls here) and renders rows in the order the hook already returns them
 * (service sorts descending by actual training time), through the shared
 * `resolveTrainingLogHistoryItem` timing resolver (see
 * `../domain/calendar/trainingLogTimingResolution`): a log exactly
 * associated with a `new_model_calendar_entry` aggregate (already loaded via
 * `useCalendarEntries`, no new Firestore query pattern) uses that aggregate
 * occurrence's exact timing; a log exactly associated with a legacy
 * `self_posted_calendar_session` resolves its exact adapted-session timing
 * from one cached legacy week document per fighter+ISO-week (loaded via the
 * TRANSITIONAL `legacySessionAssociationService.loadLegacyWeekDocument`,
 * selected via the pure `resolveLegacySessionTimingFromWeekData`) — several
 * logs in the same week share one `getDoc`; every other log (standalone)
 * falls back to the ambiguity-preserving `buildTrainingLogHistoryItem`
 * compatibility read adapter. `LogTrainingSheet` remains the single place
 * business rules for logging a completed session are enforced — this page
 * only wires its `onSubmit` to `useEventLogs().addLog`.
 *
 * Deliberately independent of the old weekly calendar/session model and
 * `meta/notes` — this view is built only from `CompletedSelfPostedTrainingLog`
 * records via `useEventLogs`/`buildTrainingLogHistoryItem`.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useEventLogs } from '../hooks/useEventLogs';
import { useCalendarEntries } from '../hooks/useCalendarEntries';
import { LogTrainingSheet } from '../components/LogTrainingSheet';
import { TrainingLogSummary } from '../components/TrainingLogSummary';
import { resolveTrainingLogHistoryItem, type AssociatedOccurrenceTiming } from '../domain/calendar/trainingLogTimingResolution';
import { legacyWeekNumberForOccurrenceDateISO, resolveLegacySessionTimingFromWeekData } from '../domain/calendar/legacySessionAssociation';
import { loadLegacyWeekDocument } from '../services/legacySessionAssociationService';
import type { CompletedSelfPostedTrainingInput } from '../domain/calendar/selfPostedTraining';

export interface TrainingLogPageProps {
  fighterKey: string;
  /** False when an administrator is viewing another fighter's history read-only. */
  canCreateLog: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  /**
   * Called once, after a successful atomic unplanned-training creation
   * (`useEventLogs.addUnplannedTraining`), so a parent holding its own
   * separate `calendarEntries`/`eventLogs` state (e.g. the main calendar in
   * App.tsx) can refresh it. This page's own history list already refreshes
   * independently via the hook itself — this callback exists only for
   * cross-instance state that this page has no visibility into.
   */
  onUnplannedTrainingCreated?: () => void;
}

export default function TrainingLogPage({ fighterKey, canCreateLog, onSuccess, onError, onUnplannedTrainingCreated }: TrainingLogPageProps) {
  const { isDark } = useTheme();
  const { logs, loading, error, addUnplannedTraining, resetUnplannedAttempt, refresh } = useEventLogs(fighterKey);
  const { entries: calendarEntries, refresh: refreshCalendarEntries } = useCalendarEntries(fighterKey);
  const [sheetOpen, setSheetOpen] = useState(false);

  const bg = isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text';
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border';
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';

  // Exact adapted-session timing for a `self_posted_calendar_session`-origin
  // log, derived from one cached legacy week document per fighter+ISO-week —
  // this page (unlike App.tsx's open SessionModal) has no legacy session
  // already in memory. Cache/dedup key is `fighterKey|weekNumber`, NOT
  // per-session, so several logs in the same week share one `getDoc` (one
  // fighter + one ISO week is the Firestore document boundary). `null` cache
  // value means "looked up, week doesn't exist" (never re-guessed); absent
  // key means "not yet looked up". `requestedWeekKeysRef` (not the cache
  // state) gates issuing a new request, so an in-flight or already-resolved
  // week is never re-fetched merely because `logs` got a new array reference
  // (e.g. a same-fighter refresh) — only fighter identity or unmount may
  // discard a pending result: `currentFighterKeyRef` always reflects the
  // latest `fighterKey` prop, and each request remembers which fighter it
  // was issued for, so a request started for fighter A that resolves after
  // switching to fighter B is silently ignored (never applied under B's
  // view); `isMountedRef` similarly guards against updating state after this
  // page has unmounted.
  const [legacyWeekCache, setLegacyWeekCache] = useState<Record<string, Record<string, unknown> | null>>({});
  const requestedWeekKeysRef = useRef<Set<string>>(new Set());
  const currentFighterKeyRef = useRef(fighterKey);
  currentFighterKeyRef.current = fighterKey;
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    for (const record of logs) {
      const origin = record.origin;
      if (!origin || origin.type !== 'self_posted_calendar_session') continue;
      const weekNumber = legacyWeekNumberForOccurrenceDateISO(origin.occurrenceDateISO);
      if (weekNumber === null) continue;
      const weekKey = `${fighterKey}|${weekNumber}`;
      if (requestedWeekKeysRef.current.has(weekKey)) continue;
      requestedWeekKeysRef.current.add(weekKey);
      const requestFighterKey = fighterKey;
      loadLegacyWeekDocument(fighterKey, weekNumber)
        .then((weekData) => {
          if (!isMountedRef.current || currentFighterKeyRef.current !== requestFighterKey) return;
          setLegacyWeekCache((prev) => ({ ...prev, [weekKey]: weekData }));
        })
        .catch(() => {
          if (!isMountedRef.current || currentFighterKeyRef.current !== requestFighterKey) return;
          setLegacyWeekCache((prev) => ({ ...prev, [weekKey]: null }));
        });
    }
  }, [logs, fighterKey]);

  // Exact aggregate-occurrence timing for a `new_model_calendar_entry`-origin
  // log, or exact adapted-session timing for a `self_posted_calendar_session`-
  // origin log (selected from the already-loaded week document above via the
  // pure `resolveLegacySessionTimingFromWeekData`) — `null` for standalone
  // logs and for legacy logs whose week is not yet (or never) resolved,
  // which fall back to the compatibility reader inside
  // `resolveTrainingLogHistoryItem`.
  function associatedOccurrenceTimingFor(record: (typeof logs)[number]): AssociatedOccurrenceTiming | null {
    const origin = record.origin;
    if (!origin) return null;
    if (origin.type === 'new_model_calendar_entry') {
      const aggregate = calendarEntries.find(
        (a) => a.id === origin.aggregateId && a.occurrence.id === origin.occurrenceId,
      );
      if (!aggregate) return null;
      return { startDateTime: aggregate.occurrence.startDateTime, endDateTime: aggregate.occurrence.endDateTime };
    }
    if (origin.type === 'self_posted_calendar_session') {
      const weekNumber = legacyWeekNumberForOccurrenceDateISO(origin.occurrenceDateISO);
      if (weekNumber === null) return null;
      const weekData = legacyWeekCache[`${fighterKey}|${weekNumber}`];
      if (weekData === undefined) return null;
      return resolveLegacySessionTimingFromWeekData(weekData, origin.occurrenceDateISO, origin.sessionId);
    }
    return null;
  }

  const handleAddLog = async (input: CompletedSelfPostedTrainingInput) => {
    try {
      const ids = await addUnplannedTraining(input);
      // addUnplannedTraining only returns ids, not the persisted aggregate —
      // this page's own useCalendarEntries instance (separate from any
      // parent's) must refresh itself so the new log's associated occurrence
      // is resolvable immediately, without navigating away and back.
      await refreshCalendarEntries();
      onSuccess?.('Træning logget.');
      onUnplannedTrainingCreated?.();
      return ids.logRecordId;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Kunne ikke gemme træningen.');
      throw err;
    }
  };

  // Checkpoint B: a genuinely new attempt (open) always starts with a fresh
  // id bundle; an explicit cancel/close also resets it. A retry after a
  // failed save (sheet stays open, LogTrainingSheet does not call onClose on
  // failure) never goes through either path, so the same ids are reused.
  const openSheet = () => {
    resetUnplannedAttempt();
    setSheetOpen(true);
  };
  const closeSheet = () => {
    resetUnplannedAttempt();
    setSheetOpen(false);
  };

  return (
    <div className={`min-h-screen font-sans ${bg}`}>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-ds-text'}`}>Træningslog</h1>
          {canCreateLog && (
            <button
              type="button"
              onClick={openSheet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Log træning
            </button>
          )}
        </div>

        {loading && <p className={`text-center py-16 ${subtle}`}>Indlæser…</p>}

        {!loading && error && (
          <div className={`rounded-2xl border p-6 text-center ${card}`}>
            <p className={subtle}>Kunne ikke hente træningslog.</p>
            <button
              type="button"
              onClick={() => refresh()}
              className="mt-3 text-sm font-semibold underline"
            >
              Prøv igen
            </button>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className={`rounded-2xl border p-8 text-center ${card}`}>
            <p className={subtle}>Ingen træning logget endnu.</p>
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <ul className="space-y-3">
            {logs.map((record) => {
              const item = resolveTrainingLogHistoryItem(record, associatedOccurrenceTimingFor(record));
              return (
                <li key={item.id} className={`rounded-2xl border p-4 ${card}`}>
                  <TrainingLogSummary item={item} isDark={isDark} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canCreateLog && (
        <LogTrainingSheet
          open={sheetOpen}
          onClose={closeSheet}
          onSubmit={handleAddLog}
        />
      )}
    </div>
  );
}
