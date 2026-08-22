/**
 * TrainingLogPage — isolated chronological view of a fighter's completed
 * self-posted training logs (Phase 3 active slice, Step 4.3).
 *
 * Loads/persists through `useEventLogs` only (no direct Firestore/service
 * calls here) and renders `logToHistoryItem` rows in the order the hook
 * already returns them (service sorts descending by actual training time).
 * `LogTrainingSheet` remains the single place business rules for logging a
 * completed session are enforced — this page only wires its `onSubmit` to
 * `useEventLogs().addLog`.
 *
 * Deliberately independent of the old weekly calendar/session model and
 * `meta/notes` — this view is built only from `CompletedSelfPostedTrainingLog`
 * records via `useEventLogs`/`logToHistoryItem`.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useEventLogs } from '../hooks/useEventLogs';
import { LogTrainingSheet } from '../components/LogTrainingSheet';
import { TrainingLogSummary } from '../components/TrainingLogSummary';
import { logToHistoryItem } from '../domain/calendar/selfPostedTraining';
import type { CompletedSelfPostedTrainingInput } from '../domain/calendar/selfPostedTraining';

export interface TrainingLogPageProps {
  fighterKey: string;
  /** False when an administrator is viewing another fighter's history read-only. */
  canCreateLog: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function TrainingLogPage({ fighterKey, canCreateLog, onSuccess, onError }: TrainingLogPageProps) {
  const { isDark } = useTheme();
  const { logs, loading, error, addUnplannedTraining, resetUnplannedAttempt, refresh } = useEventLogs(fighterKey);
  const [sheetOpen, setSheetOpen] = useState(false);

  const bg = isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text';
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border';
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';

  const handleAddLog = async (input: CompletedSelfPostedTrainingInput) => {
    try {
      const ids = await addUnplannedTraining(input);
      onSuccess?.('Træning logget.');
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
              const item = logToHistoryItem(record);
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
