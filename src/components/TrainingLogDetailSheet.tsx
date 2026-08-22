/**
 * TrainingLogDetailSheet — read-only detail view of one TrainingLog,
 * opened from the calendar-originated read-side association section
 * (Phase 3 strangler slice — see `/docs/fightweek_refactoring_plan.md`,
 * "Next Planned Slice").
 *
 * Renders exclusively from the log's own snapshot (`TrainingHistoryItem`),
 * never a live legacy session lookup — the log stays independently readable
 * even if the source calendar session is later edited or deleted. No edit,
 * no delete, no calendar mutation: `onClose` is the only interaction.
 */
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { TrainingLogSummary } from './TrainingLogSummary';
import type { TrainingHistoryItem } from '../domain/calendar/types';

export interface TrainingLogDetailSheetProps {
  item: TrainingHistoryItem;
  onClose: () => void;
}

export function TrainingLogDetailSheet({ item, onClose }: TrainingLogDetailSheetProps) {
  const { isDark } = useTheme();

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
            className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>Træningslog</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <TrainingLogSummary item={item} isDark={isDark} />
        </div>
      </div>
    </>
  );
}
