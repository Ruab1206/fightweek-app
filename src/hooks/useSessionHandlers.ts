import { DAYS } from '../config/constants';
import { getDateForWeekDay, getISOWeekForDate } from '../utils/dateUtils';
import type { CatalogueAddPayload } from '../components/InlineCataloguePicker';

/** Clone week data and strip virtual event sessions (they are merged at render time by useEventMerge). */
export function cloneWithoutEvents(weekData: any): any {
  const data = structuredClone(weekData);
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      data[key] = data[key].filter((s: any) => s.type !== 'event');
    }
  }
  return data;
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
  saveToDb, saveWeekToDb, showToast,
  setModalOpen, setEditingWeek, setEditingDay, setEditingSession, setAddScreenOpen,
}: SessionHandlerDeps) {

  const handleSaveSession = async (session: any) => {
    const weekNum = editingWeek || currentWeek;
    const sourceData = editingWeek ? (multiWeekData[weekNum] || {}) : scheduleData;
    const newData = editingWeek ? cloneWithoutEvents(sourceData) : structuredClone(sourceData);
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
      session.id = Date.now();
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
    const sourceData = editingWeek ? (multiWeekData[weekNum] || {}) : scheduleData;
    const newData = editingWeek ? cloneWithoutEvents(sourceData) : structuredClone(sourceData);
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
    const newData = weekOverride ? cloneWithoutEvents(sourceData) : structuredClone(sourceData);
    if (!newData[day]) newData[day] = [];
    const newSession: any = { ...session, id: Date.now(), status: 'active', day };
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
    const newData = cloneWithoutEvents(scheduleData);
    if (!newData[day]) newData[day] = [];
    const newSession: any = { ...session, id: Date.now(), status: 'active', day };
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

  // Add a recurring catalogue session — add to matching weeks, remove from non-matching
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

    let added = 0;
    let removed = 0;
    const loadedWeeks = Object.keys(multiWeekData).map(Number).sort((a, b) => a - b);
    for (const weekNum of loadedWeeks) {
      if (weekNum < systemWeek) continue;
      const weekData = multiWeekData[weekNum];
      if (!weekData) continue;
      const newData = structuredClone(weekData);
      // Strip virtual event sessions — they must not be persisted
      for (const dayKey of Object.keys(newData)) {
        if (Array.isArray(newData[dayKey])) {
          newData[dayKey] = newData[dayKey].filter((s: any) => s.type !== 'event');
        }
      }
      if (!newData[dayName]) newData[dayName] = [];

      const isTarget = weekNum >= startWeekNum
        && (weekNum - startWeekNum) % recurrence.interval === 0
        && (endWeekNum === null || weekNum <= endWeekNum);

      if (isTarget) {
        const existing = newData[dayName].find((s: any) =>
          !s.isRestDay && (s.name || '').toLowerCase() === nameLC &&
          s.start === startTime && s.status !== 'cancelled'
        );
        if (existing) {
          if (!existing.isRecurring) { existing.isRecurring = true; await saveWeekToDb(weekNum, newData); }
        } else {
          const newSession: any = { ...session, id: Date.now() + weekNum, status: 'active', day: dayName, isRecurring: true };
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
      } else {
        if (recurrence.interval > 1) {
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
          id: Date.now() + count,
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
      const nd = cloneWithoutEvents(multiWeekData[wk] || {});
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
      const nd = cloneWithoutEvents(wd);
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

  return {
    handleSaveSession, handleDeleteSession, handleAddClick,
    handleAddFromCatalogue, handleAddFromDesktopCatalogue, handleManualFromPicker,
    handleAddRecurring, handleFravær, handleDeleteFravær,
  };
}
