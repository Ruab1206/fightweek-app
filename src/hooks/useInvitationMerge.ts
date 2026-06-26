/**
 * useInvitationMerge — builds invitation-derived sessions and merges them into
 * the personal calendar (multiWeekData + scheduleData) and the team view
 * (#1201, Release 1.14).
 *
 * Mirrors useEventMerge, with two deliberate differences:
 *  1. Invitees are keyed by EMAIL (the stable id, #1191), not display name.
 *     The personal calendar uses the active fighter's email; the team view
 *     resolves each fighter's display name to their email via emailForName.
 *  2. A `declined` invitee does NOT see the invitation on their calendar
 *     (decline removes it from their view — it never touches the inviter's
 *     activity). `pending`, `accepted` and `tentative` are shown.
 *
 * Like events, invitation sessions are virtual: they are produced at render
 * time and never persisted into a week document.
 */
import { useMemo } from 'react';
import { DAYS } from '../config/constants';
import { getISOWeekForDate } from '../utils/dateUtils';
import type { Invitation, InvitationResponse } from '../types/invitation';

/** Shape of an invitation session injected into the calendar. */
export interface InvitationSession {
  id: string;
  name: string;
  category: string;
  start: string;
  end: string;
  location: string;
  status: 'active';
  type: 'invitation';
  invitationId: string;
  invitationResponse: InvitationResponse;
  invitationCancelled: boolean;
  invitedByName: string;
}

/** A response is shown on the invitee's calendar unless they declined. A
 * per-person `cancelled` (the arranger removed them) is still shown so they get
 * the "Aflyst" notice and can dismiss it themselves. */
function isVisibleResponse(status: InvitationResponse | undefined): boolean {
  return status === 'pending' || status === 'accepted' || status === 'tentative' || status === 'cancelled';
}

function buildInvitationSession(inv: Invitation, status: InvitationResponse): InvitationSession {
  return {
    id: `invitation_${inv.id}`,
    name: inv.activity.title,
    category: inv.activity.category || 'Andet',
    start: inv.activity.start || '',
    end: inv.activity.end || '',
    location: inv.activity.location || '',
    status: 'active',
    type: 'invitation',
    invitationId: inv.id,
    invitationResponse: status,
    invitationCancelled: inv.status === 'cancelled' || status === 'cancelled',
    invitedByName: inv.invitedByName || inv.invitedBy,
  };
}

export function useInvitationMerge(
  allInvitations: Invitation[],
  activeFighterEmail: string | null,
  rawMultiWeekData: Record<number, any>,
  scheduleData: Record<string, any[]>,
  teamData: Record<string, Record<string, any[]>>,
  currentWeek: number,
  emailForName: Record<string, string>,
) {
  // Personal invitation sessions for the active fighter, grouped by week → day.
  const myInvitationSessions = useMemo(() => {
    const map: Record<number, Record<string, any[]>> = {};
    if (!activeFighterEmail) return map;
    const myEmail = activeFighterEmail.toLowerCase();
    for (const inv of allInvitations) {
      const status = inv.invitees?.[myEmail];
      if (!isVisibleResponse(status)) continue;
      const d = new Date(inv.activity.date + 'T00:00:00');
      if (Number.isNaN(d.getTime())) continue;
      const weekNum = getISOWeekForDate(d);
      const dayName = DAYS[(d.getDay() + 6) % 7];
      if (!map[weekNum]) map[weekNum] = {};
      if (!map[weekNum][dayName]) map[weekNum][dayName] = [];
      map[weekNum][dayName].push(buildInvitationSession(inv, status as InvitationResponse));
    }
    return map;
  }, [allInvitations, activeFighterEmail]);

  // Multi-week data merged with invitation sessions (mobile continuous scroll).
  const multiWeekData = useMemo(() => {
    const merged: Record<number, any> = {};
    const allWeeks = new Set([
      ...Object.keys(rawMultiWeekData).map(Number),
      ...Object.keys(myInvitationSessions).map(Number),
    ]);
    for (const wk of allWeeks) {
      merged[wk] = { ...(rawMultiWeekData[wk] || {}) };
      // Strip any previously-merged invitation sessions (they only come from the merge)
      for (const dayName of DAYS) {
        if (Array.isArray(merged[wk][dayName])) {
          merged[wk][dayName] = merged[wk][dayName].filter((s: any) => s.type !== 'invitation');
        }
      }
      const invWeek = myInvitationSessions[wk];
      if (!invWeek) continue;
      for (const dayName of DAYS) {
        const existing = merged[wk][dayName] || [];
        const invSessions = invWeek[dayName] || [];
        if (invSessions.length) merged[wk][dayName] = [...existing, ...invSessions];
      }
    }
    return merged;
  }, [rawMultiWeekData, myInvitationSessions]);

  // Single-week desktop schedule merged with invitation sessions.
  const mergedScheduleData = useMemo(() => {
    const invWeek = myInvitationSessions[currentWeek];
    const base: Record<string, any[]> = {};
    for (const dayName of DAYS) {
      const arr = scheduleData[dayName];
      base[dayName] = Array.isArray(arr) ? arr.filter((s: any) => s.type !== 'invitation') : (arr || []);
    }
    if (!invWeek) return base;
    const merged = { ...base };
    for (const dayName of DAYS) {
      const invSessions = invWeek[dayName];
      if (invSessions?.length) merged[dayName] = [...(merged[dayName] || []), ...invSessions];
    }
    return merged;
  }, [scheduleData, myInvitationSessions, currentWeek]);

  // Team data merged with invitation sessions for each (visible) invitee.
  const mergedTeamData = useMemo(() => {
    const merged: Record<string, Record<string, any[]>> = {};
    for (const f of Object.keys(teamData)) {
      merged[f] = {};
      for (const [day, sessions] of Object.entries(teamData[f])) {
        if (Array.isArray(sessions)) merged[f][day] = [...sessions];
      }
    }
    for (const inv of allInvitations) {
      if (!inv.invitees) continue;
      const d = new Date(inv.activity.date + 'T00:00:00');
      if (Number.isNaN(d.getTime())) continue;
      if (getISOWeekForDate(d) !== currentWeek) continue;
      const dayName = DAYS[(d.getDay() + 6) % 7];
      for (const [fighterName, fighterEmail] of Object.entries(emailForName)) {
        const status = inv.invitees[fighterEmail.toLowerCase()];
        if (!isVisibleResponse(status)) continue;
        if (!merged[fighterName]) merged[fighterName] = {};
        if (!merged[fighterName][dayName]) merged[fighterName][dayName] = [];
        merged[fighterName][dayName].push(buildInvitationSession(inv, status as InvitationResponse));
      }
    }
    return merged;
  }, [teamData, allInvitations, currentWeek, emailForName]);

  return { myInvitationSessions, multiWeekData, mergedScheduleData, mergedTeamData };
}
