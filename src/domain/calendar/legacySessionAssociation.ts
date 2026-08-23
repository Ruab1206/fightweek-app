/**
 * legacySessionAssociation — pure helpers for resolving a legacy self-posted
 * calendar session's exact adapted occurrence timing from a persisted
 * `self_posted_calendar_session` origin (sessionId + occurrenceDateISO).
 *
 * Shared exact-association rule: App.tsx already has the session in memory
 * (the open `SessionModal`) and derives timing the same way; TrainingLogPage
 * has no session in memory and loads the ONE legacy week document that
 * `occurrenceDateISO` implies (via `legacySessionAssociationService`, one
 * `getDoc` per fighter/week, cached/deduped at the call site), then calls
 * `resolveLegacySessionTimingFromWeekData` below to derive the identical
 * timing. No Firestore here — pure, no mutation, exact id match only (no
 * fuzzy matching by title, time, discipline, or array position).
 */
import { DAYS } from '../../config/constants';
import { toDateTime } from './adapters';
import { getISOWeekForDate } from '../../utils/dateUtils';
import type { TrainingSession } from '../../types/common';

/** Local Danish day name (Mandag..Søndag) for an ISO "YYYY-MM-DD" date. `null` if malformed. */
export function dayNameForOccurrenceDateISO(occurrenceDateISO: string): string | null {
  const date = new Date(`${occurrenceDateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const dow = date.getDay();
  return dow === 0 ? 'Søndag' : DAYS[dow - 1];
}

/** ISO week number for an occurrence date — the legacy week-document boundary. `null` if malformed. */
export function legacyWeekNumberForOccurrenceDateISO(occurrenceDateISO: string): number | null {
  const date = new Date(`${occurrenceDateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return getISOWeekForDate(date);
}

/** Find the session with an EXACT id match in one day's session array — never fuzzy. */
export function findSessionByExactId(
  daySessions: readonly TrainingSession[] | null | undefined,
  sessionId: string,
): TrainingSession | null {
  if (!daySessions) return null;
  return daySessions.find((s) => s.id !== undefined && s.id !== null && String(s.id) === sessionId) ?? null;
}

/** Adapt a legacy session + its occurrence date into exact start/end timing. */
export function adaptLegacySessionTiming(
  session: TrainingSession,
  occurrenceDateISO: string,
): { startDateTime: string; endDateTime: string } {
  return {
    startDateTime: toDateTime(occurrenceDateISO, session.start),
    endDateTime: toDateTime(occurrenceDateISO, session.end),
  };
}

/**
 * Resolve exact adapted timing for a `self_posted_calendar_session` origin
 * from an ALREADY-LOADED legacy week document (no Firestore access here).
 * Returns `null` when the date is malformed, the week document is missing,
 * the day has no sessions, or no session matches `sessionId` exactly —
 * never a guess, never fuzzy.
 */
export function resolveLegacySessionTimingFromWeekData(
  weekData: Record<string, unknown> | null | undefined,
  occurrenceDateISO: string,
  sessionId: string,
): { startDateTime: string; endDateTime: string } | null {
  if (!weekData) return null;
  const dayName = dayNameForOccurrenceDateISO(occurrenceDateISO);
  if (!dayName) return null;
  const daySessions = weekData[dayName];
  if (!Array.isArray(daySessions)) return null;
  const session = findSessionByExactId(daySessions as TrainingSession[], sessionId);
  if (!session) return null;
  return adaptLegacySessionTiming(session, occurrenceDateISO);
}
