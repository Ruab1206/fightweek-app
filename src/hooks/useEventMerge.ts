/**
 * useEventMerge — builds event-derived sessions and merges them into
 * the personal calendar (multiWeekData + scheduleData) and team view.
 */
import { useMemo } from 'react';
import { DAYS } from '../config/constants';
import { getISOWeekForDate } from '../utils/dateUtils';
import { disciplineToCategory } from '../components/InlineCataloguePicker';
import type { FightweekEvent } from '../types/event';

/** Shape of an event session injected into the calendar. */
export interface EventSession {
  id: string;
  name: string;
  category: string;
  start: string;
  end: string;
  location: string;
  status: 'active';
  type: 'event';
  eventId: string;
  eventSignupStatus: string;
}

function buildEventSession(ev: FightweekEvent, d: Date, status: string): EventSession {
  return {
    id: `event_${ev.id}_${d.toISOString().slice(0, 10)}`,
    name: ev.title,
    category: ev.discipline ? disciplineToCategory(ev.discipline) : 'Andet',
    start: ev.startTime || '',
    end: ev.endTime || '',
    location: ev.location || ev.address || '',
    status: 'active',
    type: 'event',
    eventId: ev.id,
    eventSignupStatus: status,
  };
}

/** Iterate each day between start and end (inclusive). */
function forEachEventDay(ev: FightweekEvent, cb: (d: Date) => void) {
  const start = new Date(ev.date + 'T00:00:00');
  const end = ev.endDate ? new Date(ev.endDate + 'T00:00:00') : start;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    cb(new Date(d));
  }
}

export function useEventMerge(
  allEvents: FightweekEvent[],
  activeFighter: string | null,
  rawMultiWeekData: Record<number, any>,
  scheduleData: Record<string, any[]>,
  teamData: Record<string, Record<string, any[]>>,
  currentWeek: number,
) {
  // Personal event sessions grouped by week → day
  const myEventSessions = useMemo(() => {
    if (!activeFighter) return {} as Record<number, Record<string, any[]>>;
    const map: Record<number, Record<string, any[]>> = {};
    for (const ev of allEvents) {
      const status = ev.signups?.[activeFighter];
      if (status !== 'interested' && status !== 'signed-up') continue;
      forEachEventDay(ev, (d) => {
        const weekNum = getISOWeekForDate(d);
        const dayName = DAYS[(d.getDay() + 6) % 7];
        if (!map[weekNum]) map[weekNum] = {};
        if (!map[weekNum][dayName]) map[weekNum][dayName] = [];
        map[weekNum][dayName].push(buildEventSession(ev, d, status));
      });
    }
    return map;
  }, [allEvents, activeFighter]);

  // Multi-week data merged with event sessions (mobile continuous scroll)
  const multiWeekData = useMemo(() => {
    const merged: Record<number, any> = {};
    const allWeeks = new Set([...Object.keys(rawMultiWeekData).map(Number), ...Object.keys(myEventSessions).map(Number)]);
    for (const wk of allWeeks) {
      merged[wk] = { ...(rawMultiWeekData[wk] || {}) };
      // Strip any previously-persisted event sessions from raw data (they should only come from the merge)
      for (const dayName of DAYS) {
        if (Array.isArray(merged[wk][dayName])) {
          merged[wk][dayName] = merged[wk][dayName].filter((s: any) => s.type !== 'event');
        }
      }
      const evWeek = myEventSessions[wk];
      if (!evWeek) continue;
      for (const dayName of DAYS) {
        const existing = merged[wk][dayName] || [];
        const evSessions = evWeek[dayName] || [];
        if (evSessions.length) merged[wk][dayName] = [...existing, ...evSessions];
      }
    }
    return merged;
  }, [rawMultiWeekData, myEventSessions]);

  // Single-week desktop schedule merged with event sessions
  const mergedScheduleData = useMemo(() => {
    const evWeek = myEventSessions[currentWeek];
    // Strip any previously-persisted event sessions
    const base: Record<string, any[]> = {};
    for (const dayName of DAYS) {
      const arr = scheduleData[dayName];
      base[dayName] = Array.isArray(arr) ? arr.filter((s: any) => s.type !== 'event') : (arr || []);
    }
    if (!evWeek) return base;
    const merged = { ...base };
    for (const dayName of DAYS) {
      const evSessions = evWeek[dayName];
      if (evSessions?.length) merged[dayName] = [...(merged[dayName] || []), ...evSessions];
    }
    return merged;
  }, [scheduleData, myEventSessions, currentWeek]);

  // Team data merged with event sessions for all signed-up fighters
  const mergedTeamData = useMemo(() => {
    const merged: Record<string, Record<string, any[]>> = {};
    for (const f of Object.keys(teamData)) {
      merged[f] = {};
      for (const [day, sessions] of Object.entries(teamData[f])) {
        if (Array.isArray(sessions)) merged[f][day] = [...sessions];
      }
    }
    for (const ev of allEvents) {
      if (!ev.signups) continue;
      forEachEventDay(ev, (d) => {
        if (getISOWeekForDate(d) !== currentWeek) return;
        const dayName = DAYS[(d.getDay() + 6) % 7];
        for (const [fighter, status] of Object.entries(ev.signups)) {
          if (status !== 'interested' && status !== 'signed-up') continue;
          if (!merged[fighter]) merged[fighter] = {};
          if (!merged[fighter][dayName]) merged[fighter][dayName] = [];
          merged[fighter][dayName].push(buildEventSession(ev, d, status));
        }
      });
    }
    return merged;
  }, [teamData, allEvents, currentWeek]);

  return { myEventSessions, multiWeekData, mergedScheduleData, mergedTeamData };
}
