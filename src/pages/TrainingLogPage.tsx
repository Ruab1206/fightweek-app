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
import { logToHistoryItem } from '../domain/calendar/selfPostedTraining';
import type { CompletedSelfPostedTrainingInput } from '../domain/calendar/selfPostedTraining';

export interface TrainingLogPageProps {
  fighterKey: string;
  /** False when an administrator is viewing another fighter's history read-only. */
  canCreateLog: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export default function TrainingLogPage({ fighterKey, canCreateLog, onSuccess, onError }: TrainingLogPageProps) {
  const { isDark } = useTheme();
  const { logs, loading, error, addLog, refresh } = useEventLogs(fighterKey);
  const [sheetOpen, setSheetOpen] = useState(false);

  const bg = isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text';
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border';
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';

  const handleAddLog = async (input: CompletedSelfPostedTrainingInput) => {
    try {
      const id = await addLog(input);
      onSuccess?.('Træning logget.');
      return id;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Kunne ikke gemme træningen.');
      throw err;
    }
  };

  return (
    <div className={`min-h-screen font-sans ${bg}`}>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-ds-text'}`}>Træningslog</h1>
          {canCreateLog && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
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
                  <div className="flex items-start justify-between gap-3">
                    <h2 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>{item.title}</h2>
                    {item.discipline && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${subtle}`}>{item.discipline}</span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 capitalize ${subtle}`}>
                    {formatHistoryDate(item.startDateTime)} · {formatHistoryTime(item.startDateTime)} · {item.durationMinutes} min
                  </p>
                  {item.location && <p className={`text-xs mt-1 ${subtle}`}>{item.location}</p>}
                  {item.intensity != null && <p className={`text-xs mt-1 ${subtle}`}>Intensitet: {item.intensity}/5</p>}
                  {item.notes && <p className={`text-sm mt-2 ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>{item.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canCreateLog && (
        <LogTrainingSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSubmit={handleAddLog}
        />
      )}
    </div>
  );
}
