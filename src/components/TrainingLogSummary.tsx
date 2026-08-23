/**
 * TrainingLogSummary — shared read-only presentation of one
 * `TrainingHistoryItem`, extracted from `TrainingLogPage` (Phase 3 strangler
 * slice) so the same rendering is reusable by the calendar-originated
 * read-side association section (`SessionModal`) and its read-only detail
 * view, without duplicating markup or formatting rules.
 *
 * Presentational only: renders exactly what is passed in via `item` (a
 * `TrainingLog` snapshot), never a live legacy session lookup — this is what
 * keeps a log's display independent of later edits/deletes to its source.
 */
import type { TrainingHistoryItem } from '../domain/calendar/types';

export function formatTrainingLogDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTrainingLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export interface TrainingLogSummaryProps {
  item: TrainingHistoryItem;
  isDark: boolean;
}

/** Neutral fallback shown instead of a fabricated or runtime-timezone-dependent duration (see `/docs/fightweek_decisions.md` §24). */
const DURATION_UNAVAILABLE_TEXT = 'Varighed ikke tilgængelig';

function formatTrainingLogDuration(item: TrainingHistoryItem): string {
  if (typeof item.durationMinutes === 'number' && (item.durationCertainty === undefined || item.durationCertainty === 'exact')) {
    return `${item.durationMinutes} min`;
  }
  return DURATION_UNAVAILABLE_TEXT;
}

export function TrainingLogSummary({ item, isDark }: TrainingLogSummaryProps) {
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>{item.title}</h2>
        {item.discipline && (
          <span className={`text-[10px] font-bold uppercase tracking-wider ${subtle}`}>{item.discipline}</span>
        )}
      </div>
      <p className={`text-xs mt-1 capitalize ${subtle}`}>
        {formatTrainingLogDate(item.startDateTime)} · {formatTrainingLogTime(item.startDateTime)} · {formatTrainingLogDuration(item)}
      </p>
      {item.location && <p className={`text-xs mt-1 ${subtle}`}>{item.location}</p>}
      {item.intensity != null && <p className={`text-xs mt-1 ${subtle}`}>Intensitet: {item.intensity}/5</p>}
      {item.notes && <p className={`text-sm mt-2 ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>{item.notes}</p>}
    </>
  );
}
