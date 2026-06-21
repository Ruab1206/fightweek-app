import { DAYS, RECURRENCE_HORIZON_WEEKS } from '../config/constants';
import { getDateForWeekDay, getISOWeekForDate } from '../utils/dateUtils';
import type { CatalogueAddPayload } from '../components/InlineCataloguePicker';

/**
 * Compute the list of week numbers a recurring session should occupy (#1183).
 * Pure & testable. From startWeek, stepping by `interval`, up to either the
 * explicit endWeek or the horizon (for "Slutter ikke"). The previous code only
 * wrote to the weeks currently loaded in the scroll window, so a never-ending
 * series silently stopped at the window edge.
 */
export function computeRecurringWeeks(params: {
  startWeek: number;
  interval: number;
  endWeek: number | null;
  horizonWeek: number;
}): number[] {
  const { startWeek, interval, endWeek, horizonWeek } = params;
  if (interval <= 0) return [];
  const last = endWeek === null ? horizonWeek : Math.min(endWeek, horizonWeek);
  const weeks: number[] = [];
  for (let w = startWeek; w <= last; w += interval) weeks.push(w);
  return weeks;
}

/**
 * Compute the week range a "delete this and all future" must cover (#1183 follow-up).
 * Pure & testable. Spans from fromWeek up to whichever is later: the recurrence
 * horizon (systemWeek + RECURRENCE_HORIZON_WEEKS) or the furthest loaded week.
 * Using only the loaded scroll window meant future occurrences of a year-long
 * series survived the delete and could never be removed.
 */
export function computeDeleteFutureWeeks(params: {
  fromWeek: number;
  systemWeek: number;
  loadedWeeks: number[];
}): number[] {
  const { fromWeek, systemWeek, loadedWeeks } = params;
  const horizonWeek = systemWeek + RECURRENCE_HORIZON_WEEKS;
  const lastWeek = Math.max(horizonWeek, fromWeek, ...loadedWeeks);
  const weeks: number[] = [];
  for (let w = fromWeek; w <= lastWeek; w++) weeks.push(w);
  return weeks;
}

/**
 * Generate a stable, collision-resistant session id (A1 / #1185).
 * Replaces the previous Date.now()-based ids, which could collide when sessions
 * were created in the same millisecond and changed when a session was removed and
 * re-added — orphaning its training-log note (keyed by session id). UUIDs are
 * unique and are never regenerated for an existing session.
 */
export function newSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Resolve the source week data to edit (A3 / #1187) — pure & testable.
 * For an explicitly-edited week, the in-memory copy may be missing simply
 * because that week isn't currently loaded into multiWeekData. Falling back to
 * {} would overwrite (wipe) the stored week on save. So when the week isn't in
 * memory, read the real document from Firestore first. Only a genuinely
 * non-existent week resolves to {}.
 */
export async function resolveWeekSourceData(params: {
  editingWeek: number | null;
  weekNum: number;
  scheduleData: any;
  multiWeekData: Record<number, any>;
  fetchWeekData: (week: number) => Promise<any | null>;
}): Promise<any> {
  const { editingWeek, weekNum, scheduleData, multiWeekData, fetchWeekData } = params;
  if (!editingWeek) return scheduleData;
  const inMemory = multiWeekData[weekNum];
  if (inMemory !== undefined) return inMemory;
  const fromDb = await fetchWeekData(weekNum);
  return fromDb || {};
}

interface SessionHandlerDeps {
  scheduleData: any;
  setScheduleData: (data: any) => void;
  multiWeekData: Record<number, any>;
  currentWeek: number;
  systemWeek: number;
  editingDay: string | null;
  editingWeek: number | null;
  expandedDay: string | null;
  setExpandedDay: (d: string | null) => void;
  saveToDb: (data: any) => Promise<void>;
  saveWeekToDb: (week: number, data: any) => Promise<void>;
  fetchWeekData: (week: number) => Promise<any | null>;
  seedWeekFromTemplate: (week: number) => Promise<any | null>;
  showToast: (msg: string, type: string) => void;
  setModalOpen: (v: boolean) => void;
  setEditingWeek: (v: number | null) => void;
  setEditingDay: (v: any) => void;
  setEditingSession: (v: any) => void;
  setAddScreenOpen: (v: boolean) => void;
}

export function useSessionHandlers({
  scheduleData, setScheduleData,
  multiWeekData, currentWeek, systemWeek,
  editingDay, editingWeek, expandedDay, setExpandedDay,
  saveToDb, saveWeekToDb, fetchWeekData, showToast,
  setModalOpen, setEditingWeek, setEditingDay, setEditingSession, setAddScreenOpen,
  seedWeekFromTemplate,
}: SessionHandlerDeps) {

  const resolveSourceData = (weekNum: number): Promise<any> =>
    resolveWeekSourceData({ editingWeek, weekNum, scheduleData, multiWeekData, fetchWeekData });

  const handleSaveSession = async (session: any) => {
    const weekNum = editingWeek || currentWeek;
    const sourceData = await resolveSourceData(weekNum);
    const newData = structuredClone(sourceData);
    if (!newData[editingDay]) newData[editingDay] = [];

    const sessionDate = getDateForWeekDay(weekNum, editingDay);
    if (sessionDate && session.start) {
      const [h, m] = session.start.split(':').map(Number);
      sessionDate.setHours(h, m);
      session.sessionDate = sessionDate.toISOString();
    }

    if (session.id) {
      const idx = newData[editingDay].findIndex((s: any) => s.id === session.id);
      if (idx > -1) newData[editingDay][idx] = session;
      else newData[editingDay].push(session);
    } else {
      session.id = newSessionId();
      newData[editingDay].push(session);
    }
    newData[editingDay].sort((a: any, b: any) => a.start.localeCompare(b.start));
    if (editingWeek) {
      await saveWeekToDb(weekNum, newData);
    } else {
      setScheduleData(newData);
      await saveToDb(newData);
    }
    setModalOpen(false);
    setEditingWeek(null);
  };

  const handleDeleteSession = async (sessionId: any) => {
    const weekNum = editingWeek || currentWeek;
    const sourceData = await resolveSourceData(weekNum);
    const newData = structuredClone(sourceData);
    if (newData[editingDay]) {
      newData[editingDay] = newData[editingDay].filter((s: any) => s.id !== sessionId);
      if (editingWeek) {
        await saveWeekToDb(weekNum, newData);
      } else {
        await saveToDb(newData);
      }
    }
    setModalOpen(false);
    setEditingWeek(null);
  };

  const handleAddClick = (day: string) => {
    setExpandedDay(expandedDay === day ? null : day);
  };

  // One-tap add from inline catalogue picker
  const handleAddFromCatalogue = async (session: CatalogueAddPayload, dayOverride?: string, weekOverride?: number) => {
    const day = dayOverride || expandedDay;
    if (!day) return;
    const weekNum = weekOverride || currentWeek;
    const sourceData = weekOverride ? (multiWeekData[weekNum] || {}) : scheduleData;
    const newData = structuredClone(sourceData);
    if (!newData[day]) newData[day] = [];
    const newSession: any = { ...session, id: newSessionId(), status: 'active', day };
    const sessionDate = getDateForWeekDay(weekNum, day);
    if (sessionDate && session.start) {
      const [h, m] = session.start.split(':').map(Number);
      sessionDate.setHours(h, m);
      newSession.sessionDate = sessionDate.toISOString();
    }
    newData[day].push(newSession);
    newData[day].sort((a: any, b: any) => a.start.localeCompare(b.start));
    if (weekOverride) {
      await saveWeekToDb(weekNum, newData);
    } else {
      setScheduleData(newData);
      await saveToDb(newData);
    }
    showToast(`${session.name} tilføjet`, 'success');
  };

  // Desktop: add from 7-day catalogue grid
  const handleAddFromDesktopCatalogue = async (day: string, session: CatalogueAddPayload) => {
    const newData = structuredClone(scheduleData);
    if (!newData[day]) newData[day] = [];
    const newSession: any = { ...session, id: newSessionId(), status: 'active', day };
    const sessionDate = getDateForWeekDay(currentWeek, day);
    if (sessionDate && session.start) {
      const [h, m] = session.start.split(':').map(Number);
      sessionDate.setHours(h, m);
      newSession.sessionDate = sessionDate.toISOString();
    }
    newData[day].push(newSession);
    newData[day].sort((a: any, b: any) => a.start.localeCompare(b.start));
    setScheduleData(newData);
    await saveToDb(newData);
    showToast(`${session.name} tilføjet til ${day}`, 'success');
  };

  // Open manual SessionModal from picker
  const handleManualFromPicker = (dayOverride?: string, weekOverride?: number) => {
    setEditingDay(dayOverride || expandedDay);
    setEditingSession(null);
    setEditingWeek(weekOverride || null);
    setExpandedDay(null);
    setModalOpen(true);
  };

  // Add a recurring catalogue session — materialise it across all target weeks up
  // to a year-ahead horizon (#1183), not just the weeks currently loaded.
  const handleAddRecurring = async (session: any, dayName: string, startDate: Date, recurrence: { interval: number; endDate: string | null }) => {
    if (recurrence.interval === 0) return;
    const nameLC = (session.name || '').toLowerCase();
    const startTime = session.start || '';

    const startWeekDate = new Date(startDate);
    startWeekDate.setHours(0, 0, 0, 0);
    const startWeekNum = getISOWeekForDate(startWeekDate);

    let endWeekNum: number | null = null;
    if (recurrence.endDate) {
      const endD = new Date(recurrence.endDate + 'T00:00:00');
      endWeekNum = getISOWeekForDate(endD);
    }

    const horizonWeek = systemWeek + RECURRENCE_HORIZON_WEEKS;
    const targetWeeks = computeRecurringWeeks({
      startWeek: startWeekNum,
      interval: recurrence.interval,
      endWeek: endWeekNum,
      horizonWeek,
    }).filter(w => w >= systemWeek);
    const targetSet = new Set(targetWeeks);

    let added = 0;
    let removed = 0;

    for (const weekNum of targetWeeks) {
      // Resolve the week's current data: in-memory, else from Firestore, else seed
      // from the standard template so writing this session doesn't drop the
      // week's normal sessions. Only genuinely template-less weeks start empty.
      let weekData = multiWeekData[weekNum];
      if (weekData === undefined) {
        weekData = (await fetchWeekData(weekNum)) ?? (await seedWeekFromTemplate(weekNum)) ?? {};
      }
      const newData = structuredClone(weekData);
      if (!newData[dayName]) newData[dayName] = [];

      const existing = newData[dayName].find((s: any) =>
        !s.isRestDay && (s.name || '').toLowerCase() === nameLC && s.start === startTime
      );
      if (existing) {
        if (!existing.isRecurring) { existing.isRecurring = true; await saveWeekToDb(weekNum, newData); }
      } else {
        const newSession: any = { ...session, id: newSessionId(), status: 'active', day: dayName, isRecurring: true };
        const sessionDate = getDateForWeekDay(weekNum, dayName);
        if (sessionDate && startTime) {
          const [h, m] = startTime.split(':').map(Number);
          sessionDate.setHours(h, m);
          newSession.sessionDate = sessionDate.toISOString();
        }
        newData[dayName].push(newSession);
        newData[dayName].sort((a: any, b: any) => (a.start || '').localeCompare(b.start || ''));
        await saveWeekToDb(weekNum, newData);
        added++;
      }
    }

    // Remove stale copies from non-target loaded weeks (only matters for interval > 1).
    if (recurrence.interval > 1) {
      for (const weekNum of Object.keys(multiWeekData).map(Number)) {
        if (weekNum < systemWeek || targetSet.has(weekNum)) continue;
        const weekData = multiWeekData[weekNum];
        if (!weekData?.[dayName]) continue;
        const newData = structuredClone(weekData);
        const before = newData[dayName].length;
        newData[dayName] = newData[dayName].filter((s: any) =>
          s.isRestDay || (s.name || '').toLowerCase() !== nameLC || s.start !== startTime
        );
        if (newData[dayName].length < before) {
          await saveWeekToDb(weekNum, newData);
          removed++;
        }
      }
    }

    const intervalLabel = recurrence.interval === 1 ? 'hver uge' : `hver ${recurrence.interval}. uge`;
    showToast(`${session.name} ${intervalLabel} (+${added} -${removed})`, 'success');
    setAddScreenOpen(false);
  };

  // Add or edit a fravær entry. If oldGroupId is provided, old entries are removed first (edit mode).
  const handleFravær = async (fravær: { titel: string; beskrivelse: string; startDate: string; startTime: string; endDate: string; endTime: string }, oldGroupId?: string) => {
    const start = new Date(fravær.startDate + 'T' + fravær.startTime);
    const end = new Date(fravær.endDate + 'T' + fravær.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      showToast('Ugyldig dato/tid', 'error');
      return;
    }
    const countCursor = new Date(start); countCursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end); endDay.setHours(0, 0, 0, 0);
    let totalDays = 0;
    const tmpC = new Date(countCursor);
    while (tmpC <= endDay) { totalDays++; tmpC.setDate(tmpC.getDate() + 1); }
    const groupId = `fravær_${Date.now()}`;

    const weekChanges: Record<number, { dayName: string; session: any }[]> = {};
    const cursor = new Date(countCursor);
    let count = 0;
    while (cursor <= endDay) {
      const dayIdx = (cursor.getDay() + 6) % 7;
      const dayName = DAYS[dayIdx];
      const weekNum = getISOWeekForDate(cursor);
      const dayIndex = count + 1;
      if (!weekChanges[weekNum]) weekChanges[weekNum] = [];
      weekChanges[weekNum].push({
        dayName,
        session: {
          id: newSessionId(),
          type: 'fravær',
          name: fravær.titel || 'Fravær',
          fraværTitel: fravær.titel,
          fraværBeskrivelse: fravær.beskrivelse,
          fraværGroupId: groupId,
          fraværDayIndex: dayIndex,
          fraværTotalDays: totalDays,
          fraværStartDate: fravær.startDate,
          fraværEndDate: fravær.endDate,
          fraværStartTime: fravær.startTime,
          fraværEndTime: fravær.endTime,
          start: cursor.getTime() === new Date(fravær.startDate + 'T00:00:00').getTime() ? fravær.startTime : '00:00',
          end: cursor.getTime() === endDay.getTime() ? fravær.endTime : '23:59',
          status: 'active',
          day: dayName,
          category: 'Fravær',
        },
      });
      count++;
      cursor.setDate(cursor.getDate() + 1);
    }

    const isLegacy = oldGroupId?.startsWith('legacy_');
    const legacyId = isLegacy ? Number(oldGroupId!.replace('legacy_', '')) : null;
    const shouldRemove = oldGroupId
      ? (s: any) => isLegacy ? s.id === legacyId : s.fraværGroupId === oldGroupId
      : null;

    const allWeeks = new Set([...Object.keys(multiWeekData).map(Number), ...Object.keys(weekChanges).map(Number)]);
    for (const wk of allWeeks) {
      const nd = structuredClone(multiWeekData[wk] || {});
      let changed = false;
      if (shouldRemove) {
        for (const dayName of DAYS) {
          if (!nd[dayName]) continue;
          const before = nd[dayName].length;
          nd[dayName] = nd[dayName].filter((s: any) => !shouldRemove(s));
          if (nd[dayName].length < before) changed = true;
        }
      }
      if (weekChanges[wk]) {
        for (const { dayName, session } of weekChanges[wk]) {
          if (!nd[dayName]) nd[dayName] = [];
          nd[dayName].push(session);
          changed = true;
        }
      }
      if (changed) await saveWeekToDb(wk, nd);
    }
    showToast(oldGroupId ? 'Fravær opdateret' : `Fravær tilføjet (${count} dag${count > 1 ? 'e' : ''})`, 'success');
  };

  // Delete all days of a fravær group
  const handleDeleteFravær = async (groupId: string) => {
    const isLegacy = groupId.startsWith('legacy_');
    const legacyId = isLegacy ? Number(groupId.replace('legacy_', '')) : null;
    let deleted = 0;
    for (const wk of Object.keys(multiWeekData).map(Number)) {
      const wd = multiWeekData[wk];
      if (!wd) continue;
      const nd = structuredClone(wd);
      let changed = false;
      for (const dayName of DAYS) {
        if (!nd[dayName]) continue;
        const before = nd[dayName].length;
        nd[dayName] = nd[dayName].filter((s: any) => {
          if (isLegacy) return s.id !== legacyId;
          return s.fraværGroupId !== groupId;
        });
        if (nd[dayName].length < before) { changed = true; deleted += before - nd[dayName].length; }
      }
      if (changed) await saveWeekToDb(wk, nd);
    }
    showToast(`Fravær slettet (${deleted} dag${deleted > 1 ? 'e' : ''})`, 'success');
  };

  // Delete a session in this and all future weeks by name+start match. Walks to
  // the same year-ahead horizon as handleAddRecurring (#1183 follow-up): a
  // recurring series now extends far beyond the loaded scroll window, so deleting
  // only the loaded weeks left every occurrence past the window edge orphaned and
  // undeletable. Unloaded weeks are read from Firestore on demand.
  const handleDeleteThisAndFuture = async (dayName: string, name: string, start: string, fromWeek: number) => {
    const nameLC = name.toLowerCase();
    const targetWeeks = computeDeleteFutureWeeks({
      fromWeek,
      systemWeek,
      loadedWeeks: Object.keys(multiWeekData).map(Number),
    });
    for (const wk of targetWeeks) {
      let wd = multiWeekData[wk];
      if (wd === undefined) wd = await fetchWeekData(wk);
      if (!wd?.[dayName]) continue;
      const nd = structuredClone(wd);
      const before = nd[dayName].length;
      nd[dayName] = nd[dayName].filter((s: any) => s.isRestDay || (s.name || '').toLowerCase() !== nameLC || s.start !== start);
      if (nd[dayName].length < before) await saveWeekToDb(wk, nd);
    }
  };

  return {
    handleSaveSession, handleDeleteSession, handleAddClick,
    handleAddFromCatalogue, handleAddFromDesktopCatalogue, handleManualFromPicker,
    handleAddRecurring, handleFravær, handleDeleteFravær, handleDeleteThisAndFuture,
  };
}
