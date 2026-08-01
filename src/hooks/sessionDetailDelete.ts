/**
 * Pure, firebase-free delete-decision helpers for SessionDetailSheet
 * (mobile bottom sheet for catalogue sessions).
 *
 * Phase 2b bug fix: SessionDetailSheet previously had its own raw `.filter()`
 * delete logic that bypassed log protection entirely, so a noted future
 * occurrence could be hard-deleted by "this and future". These helpers reuse
 * the SAME protected-delete building blocks (`decideOccurrenceDeletion`,
 * `applyProtectedDelete`) already used by `useSessionHandlers`, so both the
 * desktop (SessionModal) and mobile (SessionDetailSheet) delete paths share
 * one protection decision.
 */
import { decideOccurrenceDeletion, applyProtectedDelete } from './useSessionHandlers';

/**
 * Compute the protected result of deleting a single session occurrence
 * (SessionDetailSheet "this" delete). Returns null if there's nothing to
 * change (week/day not loaded). The caller is responsible for persisting
 * `entries` back via saveWeekToDb.
 */
export function computeSessionDetailDeleteThis(params: {
  multiWeekData: Record<number, any>;
  day: string;
  weekNum: number;
  sessionId: any;
  getNote: (key: string) => string;
}): { weekNum: number; day: string; entries: any[] } | null {
  const { multiWeekData, day, weekNum, sessionId, getNote } = params;
  const weekData = multiWeekData[weekNum];
  if (!weekData?.[day]) return null;
  const cancellationTime = new Date().toISOString();
  const { entries } = applyProtectedDelete({
    entries: weekData[day],
    isTarget: (s: any) => s.id === sessionId,
    decide: (s: any) => decideOccurrenceDeletion({ weekNum, dayName: day, entry: s, getNote }),
    cancellationTime,
  });
  return { weekNum, day, entries };
}

/**
 * Compute the protected result of deleting "this and all future" occurrences
 * (SessionDetailSheet). Matches the SAME name+start algorithm as before,
 * across the SAME loaded weeks (>= weekNum) — only the delete decision
 * (soft-cancel vs hard-delete) changes. Past weeks are never touched. Only
 * weeks whose day entries actually changed are returned, so the caller can
 * persist exactly the weeks it used to persist.
 */
export function computeSessionDetailDeleteThisAndFuture(params: {
  multiWeekData: Record<number, any>;
  day: string;
  weekNum: number;
  nameLC: string;
  startTime: string;
  getNote: (key: string) => string;
}): Array<{ weekNum: number; day: string; entries: any[] }> {
  const { multiWeekData, day, weekNum, nameLC, startTime, getNote } = params;
  const cancellationTime = new Date().toISOString();
  const results: Array<{ weekNum: number; day: string; entries: any[] }> = [];
  for (const wk of Object.keys(multiWeekData).map(Number).sort((a, b) => a - b)) {
    if (wk < weekNum) continue;
    const weekData = multiWeekData[wk];
    if (!weekData?.[day]) continue;
    const { entries, changed } = applyProtectedDelete({
      entries: weekData[day],
      isTarget: (s: any) => (s.name || '').toLowerCase() === nameLC && s.start === startTime,
      decide: (s: any) => decideOccurrenceDeletion({ weekNum: wk, dayName: day, entry: s, getNote }),
      cancellationTime,
    });
    if (changed) results.push({ weekNum: wk, day, entries });
  }
  return results;
}
