import { RECURRENCE_HORIZON_WEEKS } from '../config/constants';

/**
 * Compute the occurrence dates a recurring-series invitation materialises (#1213,
 * Release 1.17). Pure & testable — the series equivalent of computeRecurringWeeks.
 *
 * Stepping by `intervalWeeks * 7` days from the first occurrence lands on the SAME
 * weekday every step, so this produces exactly the dates the arranger's own
 * recurring session occupies (computeRecurringWeeks + getDateForWeekDay) — keeping
 * the invited series and the session paired. The series is BOUNDED: it stops at
 * whichever comes first, the explicit `endDate` or the recurrence horizon
 * (`horizonEndDate`, normally today + RECURRENCE_HORIZON_WEEKS weeks). This is the
 * #1183 lesson applied to invites — we walk the FULL horizon, never the loaded
 * scroll window, so an open-ended weekly invite materialises at most ~52
 * occurrence-docs instead of an infinite series.
 *
 * Dates are handled as local Y-M-D (no UTC round-trip) so DK summer time can't roll
 * a day back (the toLocalISODate lesson).
 */
export function computeSeriesOccurrenceDates(params: {
  startDate: string;       // ISO "YYYY-MM-DD" — the first occurrence
  intervalWeeks: number;   // 1 = weekly, 2 = bi-weekly, …
  endDate: string | null;  // ISO "YYYY-MM-DD" or null = no end → horizon
  horizonEndDate: string;  // ISO "YYYY-MM-DD" — hard cap (the recurrence horizon)
}): string[] {
  const { startDate, intervalWeeks, endDate, horizonEndDate } = params;
  if (intervalWeeks <= 0) return [];
  if (!startDate) return [];

  const last = endDate && endDate < horizonEndDate ? endDate : horizonEndDate;
  if (startDate > last) return [];

  const start = parseLocalDate(startDate);
  if (!start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  // Guard against a runaway loop; the horizon already bounds this far tighter.
  const maxOccurrences = Math.ceil(RECURRENCE_HORIZON_WEEKS / intervalWeeks) + 2;
  for (let i = 0; i <= maxOccurrences; i++) {
    const iso = toLocalISO(cursor);
    if (iso > last) break;
    dates.push(iso);
    cursor.setDate(cursor.getDate() + intervalWeeks * 7);
  }
  return dates;
}

/** Today + RECURRENCE_HORIZON_WEEKS weeks, as a local ISO "YYYY-MM-DD" cap. */
export function recurrenceHorizonEndDate(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + RECURRENCE_HORIZON_WEEKS * 7);
  return toLocalISO(d);
}

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toLocalISO(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
