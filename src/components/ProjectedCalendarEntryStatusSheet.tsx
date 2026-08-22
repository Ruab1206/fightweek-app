/**
 * ProjectedCalendarEntryStatusSheet — Checkpoint B: small read-only
 * presentation for the non-`'one'` classification states of a projected
 * `calendar_entry` (loading / error / none / conflict). The `'one'` state is
 * routed directly to the existing `TrainingLogDetailSheet` by the caller and
 * never reaches this component.
 *
 * Deliberately excludes: create, edit, delete, any legacy session handler,
 * any calendar mutation, and canonical-log selection. `'none'` is presented
 * as a data-integrity inconsistency (Checkpoint B creates the aggregate and
 * its TrainingLog atomically, so a projected entry with no associated log is
 * anomalous) — never as an invitation to create one.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { TrainingLogSummary } from './TrainingLogSummary';
import { TrainingLogDetailSheet } from './TrainingLogDetailSheet';
import type { TrainingHistoryItem } from '../domain/calendar/types';

export type ProjectedCalendarEntryStatusSheetState = 'loading' | 'error' | 'none' | 'conflict';

export interface ProjectedCalendarEntryStatusSheetProps {
  state: ProjectedCalendarEntryStatusSheetState;
  /** Populated only for `state === 'conflict'`. */
  logs?: TrainingHistoryItem[];
  onClose: () => void;
}

export function ProjectedCalendarEntryStatusSheet({ state, logs, onClose }: ProjectedCalendarEntryStatusSheetProps) {
  const { isDark } = useTheme();
  const [openLog, setOpenLog] = useState<TrainingHistoryItem | null>(null);
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';

  if (openLog) {
    return <TrainingLogDetailSheet item={openLog} onClose={() => setOpenLog(null)} />;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Træningslog"
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}
      >
        <div className={`p-4 border-b flex items-center gap-3 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <button
            onClick={onClose}
            aria-label="Tilbage"
            className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>Træningslog</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {state === 'loading' && <p className={subtle}>Indlæser…</p>}

          {state === 'error' && <p className={subtle}>Kunne ikke hente træningslog.</p>}

          {state === 'none' && (
            <p className={subtle}>
              Der er en uoverensstemmelse i datas integritet: denne træning mangler den forventede log.
            </p>
          )}

          {state === 'conflict' && (
            <>
              <p className={`mb-3 ${subtle}`}>
                Der er en konflikt: flere træningslogs findes for denne træning. Ingen er valgt som gældende — se dem hver for sig.
              </p>
              <ul className="space-y-3">
                {(logs ?? []).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenLog(item)}
                      className={`w-full text-left rounded-xl border p-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-surface-raised border-surface-border'}`}
                    >
                      <TrainingLogSummary item={item} isDark={isDark} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
