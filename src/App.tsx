/**
 * FIGHTWEEK APP v2.0 — Phase 2: Modular Architecture
 * Thin orchestrator — all logic lives in hooks / components.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight,
  Clock, MapPin, Bed, Plus, AlertCircle, X, Calendar, Repeat,
  History, LogOut, ClipboardList, MessageSquarePlus, Sun, Moon, Users,
  Search, PenLine, Menu, ArrowLeft,
  ExternalLink, Link2, Phone, Mail,
} from 'lucide-react';

import { DAYS, CATEGORIES, USER_MAPPING, FIGHTERS, DAY_NAMES, RECURRENCE_OPTIONS, googleMapsUrl } from './config/constants';
import { getISOWeek, getDateForWeekDay, getWeekDateMap, getTodayDayName, getFullWeekDateMap, getWeekMonthLabel, getDaysInRange, getISOWeekForDate } from './utils/dateUtils';
import type { ScrollDay } from './utils/dateUtils';

import { useAuth } from './hooks/useAuth';
import { useScheduleData, useMultiWeekData, useMultiWeekTeamData, useStandardTemplate } from './hooks/useScheduleData';
import { useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { useCatalogue } from './hooks/useCatalogue';

import Toast from './components/Toast';
import BrowserBlockScreen from './components/BrowserBlockScreen';
import LoginScreen from './components/LoginScreen';
import SessionModal from './components/SessionModal';
import InlineCataloguePicker, { disciplineToCategory } from './components/InlineCataloguePicker';
import type { CatalogueAddPayload } from './components/InlineCataloguePicker';
import type { CatalogueClass, ClassSchedule } from './types/catalogue';
import ConfirmModal from './components/ConfirmModal';
import FeedbackModal from './components/FeedbackModal';
import NavButton from './components/NavButton';
import TeamSchedule from './components/TeamSchedule';
import BacklogPage from './pages/BacklogPage';
import AddScreen from './components/AddScreen';
import type { AddType } from './components/AddScreen';
import { useGyms as useGymsHook } from './hooks/useGyms';

const App = () => {
  // --- Hooks ---
  const {
    user, authLoading, accessDenied, loginError,
    isBrowserBlocked, isMobile,
    activeFighter, setActiveFighter,
    isLocked,
    triggerLoginPopup, triggerLoginRedirect, handleLogout,
  } = useAuth();

  const {
    systemWeek, currentWeek, setCurrentWeek,
    isStandardMode, setIsStandardMode,
    scheduleData, setScheduleData,
    teamData, lastUpdated,
    saveToDb, handleImportStandard,
  } = useScheduleData({ user, activeFighter, accessDenied, isBrowserBlocked });

  const { toast, showToast, hideToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const { classes: catalogueClasses, loading: catalogueLoading } = useCatalogue();

  // --- Refs & scroll-to-today (must be before early returns) ---
  const todayRef = useRef<HTMLDivElement | null>(null);
  const mobileTodayRef = useRef<HTMLDivElement | null>(null);

  // --- Continuous scroll days (mobile) ---
  const [weeksBack, setWeeksBack] = useState(10);
  const [weeksAhead, setWeeksAhead] = useState(4);
  const scrollDays = useMemo(() => getDaysInRange(weeksBack, weeksAhead), [weeksBack, weeksAhead]);
  const neededWeeks = useMemo(() => [...new Set(scrollDays.map(d => d.weekNumber))], [scrollDays]);
  const loadMoreFuture = useCallback(() => setWeeksAhead(prev => prev + 4), []);
  const loadMorePast = useCallback(() => setWeeksBack(prev => prev + 4), []);
  const { multiWeekData, saveWeekToDb } = useMultiWeekData(user, activeFighter, neededWeeks, accessDenied, isBrowserBlocked);

  // --- Local UI State ---
  const [view, setView] = useState<'personal' | 'program' | 'team'>('personal');
  const [expandedDay, setExpandedDay] = useState<string | null>(null); // dayName for desktop, "weekNum_dayName" for mobile scroll
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feedbackContext, setFeedbackContext] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [headerMonth, setHeaderMonth] = useState(() => new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
  const [visibleFriends, setVisibleFriends] = useState<string[]>([]);
  const [addScreenOpen, setAddScreenOpen] = useState(false);
  const [addScreenType, setAddScreenType] = useState<AddType>('træning');
  const [editingFravær, setEditingFravær] = useState<{ groupId: string; titel: string; beskrivelse: string; startDate: string; startTime: string; endDate: string; endTime: string } | null>(null);
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  const [classInfoSession, setClassInfoSession] = useState<{ cls: CatalogueClass; session: any; day: string; weekNum: number } | null>(null);
  const activeDayRef = useRef<{ dayName: string; weekNumber: number; date: Date; key: string } | null>(null);
  const { friendWeekData } = useMultiWeekTeamData(user, visibleFriends, neededWeeks, accessDenied, isBrowserBlocked);
  const { programData, updateProgramSessionRecurrence, removeProgramSession } = useStandardTemplate(user, activeFighter, accessDenied, isBrowserBlocked);

  // Build a Set of "day|name|start" keys from the program for quick lookup
  const programKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const day of DAYS) {
      const sessions = programData[day] || [];
      for (const s of sessions) {
        if (s.isRestDay) continue;
        keys.add(`${day}|${(s.name || '').toLowerCase()}|${s.start || ''}`);
      }
    }
    return keys;
  }, [programData]);

  const toggleFriend = useCallback((name: string) => {
    setVisibleFriends(prev => prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]);
  }, []);

  // Stable colors for friends' sessions
  const FRIEND_COLORS: Record<string, string> = {
    Caroline: 'bg-pink-500', San: 'bg-emerald-500', Enea: 'bg-orange-500',
    Anton: 'bg-cyan-500', Jonas: 'bg-violet-500', Karl: 'bg-amber-500',
    Frode: 'bg-lime-500', Frodi: 'bg-rose-500', Rune: 'bg-blue-500',
  };
  const [catSearch, setCatSearch] = useState('');
  const [catDiscipline, setCatDiscipline] = useState<string | null>(null);
  const [catGym, setCatGym] = useState<string | null>(null);

  // Catalogue: per-day filtered lists for desktop inline view
  const allDisciplines = useMemo(() => [...new Set(catalogueClasses.map(c => c.discipline))].sort(), [catalogueClasses]);
  const allGyms = useMemo(() => [...new Set(catalogueClasses.map(c => c.gym))].sort(), [catalogueClasses]);

  const catalogueByDay = useMemo(() => {
    const map: Record<string, { cls: CatalogueClass; schedule: ClassSchedule }[]> = {};
    for (const day of DAYS) map[day] = [];
    for (const cls of catalogueClasses) {
      for (const sched of cls.schedules) {
        const dayName = DAYS[sched.dayOfWeek - 1];
        if (!dayName) continue;
        let match = true;
        if (catDiscipline && cls.discipline !== catDiscipline) match = false;
        if (catGym && cls.gym !== catGym) match = false;
        if (catSearch.trim()) {
          const q = catSearch.toLowerCase();
          if (!cls.title.toLowerCase().includes(q) && !cls.discipline.toLowerCase().includes(q) && !disciplineToCategory(cls.discipline).toLowerCase().includes(q) && !cls.gym.toLowerCase().includes(q) && !(cls.location && cls.location.toLowerCase().includes(q)) && !(cls.address && cls.address.toLowerCase().includes(q)) && !(cls.level && cls.level.toLowerCase().includes(q)) && !(cls.subDiscipline && cls.subDiscipline.toLowerCase().includes(q)) && !(cls.instructor && cls.instructor.toLowerCase().includes(q))) match = false;
        }
        if (match) map[dayName].push({ cls, schedule: sched });
      }
    }
    for (const day of DAYS) map[day].sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
    return map;
  }, [catalogueClasses, catDiscipline, catGym, catSearch]);

  // Sync isStandardMode with view
  useEffect(() => {
    setIsStandardMode(view === 'program');
  }, [view, setIsStandardMode]);

  // --- Admin 'b' shortcut ---
  useEffect(() => {
    const isAdmin = user && ['admin', 'coach'].includes(USER_MAPPING[user.email?.toLowerCase()]?.role);
    if (!isAdmin) return;
    const handler = (e: KeyboardEvent) => {
      if (modalOpen || confirmDialog || feedbackContext) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'b' && !e.ctrlKey && !e.altKey && !e.metaKey && !expandedDay) {
        e.preventDefault();
        setAdminOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [user, modalOpen, confirmDialog, feedbackContext, expandedDay]);

  // --- Session Handlers ---
  const handleSaveSession = async (session) => {
    const weekNum = editingWeek || currentWeek;
    const sourceData = editingWeek ? (multiWeekData[weekNum] || {}) : scheduleData;
    const newData = structuredClone(sourceData);
    if (!newData[editingDay]) newData[editingDay] = [];

    if (!isStandardMode) {
      const sessionDate = getDateForWeekDay(weekNum, editingDay);
      if (sessionDate && session.start) {
        const [h, m] = session.start.split(':').map(Number);
        sessionDate.setHours(h, m);
        session.sessionDate = sessionDate.toISOString();
      }
    }

    if (session.id) {
      const idx = newData[editingDay].findIndex(s => s.id === session.id);
      if (idx > -1) newData[editingDay][idx] = session;
      else newData[editingDay].push(session);
    } else {
      session.id = Date.now();
      newData[editingDay].push(session);
    }
    newData[editingDay].sort((a, b) => a.start.localeCompare(b.start));
    if (editingWeek) {
      await saveWeekToDb(weekNum, newData);
    } else {
      setScheduleData(newData);
      await saveToDb(newData);
    }
    setModalOpen(false);
    setEditingWeek(null);
  };

  const handleDeleteSession = async (sessionId) => {
    const weekNum = editingWeek || currentWeek;
    const sourceData = editingWeek ? (multiWeekData[weekNum] || {}) : scheduleData;
    const newData = structuredClone(sourceData);
    if (newData[editingDay]) {
      newData[editingDay] = newData[editingDay].filter(s => s.id !== sessionId);
      if (editingWeek) {
        await saveWeekToDb(weekNum, newData);
      } else {
        await saveToDb(newData);
      }
    }
    setModalOpen(false);
    setEditingWeek(null);
  };

  const handleToggleRestDay = (day) => {
    const executeToggle = async () => {
      const newData = structuredClone(scheduleData);
      let currentSessions = newData[day] || [];
      const isRest = currentSessions.some(s => s.isRestDay);
      if (isRest) {
        newData[day] = currentSessions.filter(s => !s.isRestDay);
      } else {
        currentSessions = currentSessions.map(s => {
          if (s.status !== 'cancelled' && !s.isRestDay) {
            return { ...s, status: 'cancelled', cancellationReason: 'Hviledag', cancellationTime: new Date().toISOString() };
          }
          return s;
        });
        currentSessions.push({ isRestDay: true, id: Date.now() });
        newData[day] = currentSessions;
      }
      await saveToDb(newData);
      setConfirmDialog(null);
    };
    const currentSessions = scheduleData[day] || [];
    const isRest = currentSessions.some(s => s.isRestDay);
    if (!isRest && currentSessions.filter(s => s.status !== 'cancelled' && !s.isRestDay).length > 0) {
      setConfirmDialog({ title: "Bekræft Hviledag", message: `Du har planlagte pas. Vil du aflyse dem?`, onConfirm: executeToggle });
    } else { executeToggle(); }
  };

  const handleAddClick = (day) => {
    const sessions = scheduleData[day] || [];
    if (sessions.some(s => s.isRestDay)) {
      setConfirmDialog({
        title: "Fjern Hviledag?", message: "Vil du fjerne hviledagen og oprette et pas?",
        onConfirm: async () => {
          const newData = structuredClone(scheduleData);
          newData[day] = (newData[day] || []).filter(s => !s.isRestDay);
          await saveToDb(newData);
          setConfirmDialog(null);
          setTimeout(() => { setExpandedDay(day); }, 100);
        }
      });
    } else { setExpandedDay(expandedDay === day ? null : day); }
  };

  // One-tap add from inline catalogue picker
  const handleAddFromCatalogue = async (session: CatalogueAddPayload, dayOverride?: string, weekOverride?: number) => {
    const day = dayOverride || expandedDay;
    if (!day) return;
    const weekNum = weekOverride || currentWeek;
    const sourceData = weekOverride ? (multiWeekData[weekNum] || {}) : scheduleData;
    const newData = structuredClone(sourceData);
    if (!newData[day]) newData[day] = [];
    const newSession: any = { ...session, id: Date.now(), status: 'active', day };
    if (!isStandardMode) {
      const sessionDate = getDateForWeekDay(weekNum, day);
      if (sessionDate && session.start) {
        const [h, m] = session.start.split(':').map(Number);
        sessionDate.setHours(h, m);
        newSession.sessionDate = sessionDate.toISOString();
      }
    }
    newData[day].push(newSession);
    newData[day].sort((a, b) => a.start.localeCompare(b.start));
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
    const newSession: any = { ...session, id: Date.now(), status: 'active', day };
    if (!isStandardMode) {
      const sessionDate = getDateForWeekDay(currentWeek, day);
      if (sessionDate && session.start) {
        const [h, m] = session.start.split(':').map(Number);
        sessionDate.setHours(h, m);
        newSession.sessionDate = sessionDate.toISOString();
      }
    }
    newData[day].push(newSession);
    newData[day].sort((a, b) => a.start.localeCompare(b.start));
    setScheduleData(newData);
    await saveToDb(newData);
    showToast(`${session.name} tilf\u00f8jet til ${day}`, 'success');
  };

  // Open manual SessionModal from picker
  const handleManualFromPicker = (dayOverride?: string, weekOverride?: number) => {
    setEditingDay(dayOverride || expandedDay);
    setEditingSession(null);
    setEditingWeek(weekOverride || null);
    setExpandedDay(null);
    setModalOpen(true);
  };

  // Add a recurring catalogue session — save to program template so it auto-seeds into all future weeks
  // Add a recurring catalogue session — add to matching weeks, remove from non-matching
  const handleAddRecurring = async (session: any, dayName: string, startDate: Date, recurrence: { interval: number; endDate: string | null }) => {
    if (recurrence.interval === 0) return;
    const nameLC = (session.name || '').toLowerCase();
    const startTime = session.start || '';

    // Compute starting week number from startDate
    const startWeekDate = new Date(startDate);
    startWeekDate.setHours(0, 0, 0, 0);
    const startWeekNum = getISOWeekForDate(startWeekDate);

    // Update template with recurrence metadata so future auto-seeding respects the interval
    if (recurrence.interval > 1) {
      await updateProgramSessionRecurrence(dayName, session.name || '', startTime, recurrence.interval, startWeekNum);
    }

    // Compute end week number from endDate if provided
    let endWeekNum: number | null = null;
    if (recurrence.endDate) {
      const endD = new Date(recurrence.endDate + 'T00:00:00');
      endWeekNum = getISOWeekForDate(endD);
    }

    let added = 0;
    let removed = 0;
    let processed = 0;
    const loadedWeeks = Object.keys(multiWeekData).map(Number).sort((a, b) => a - b);
    for (const weekNum of loadedWeeks) {
      if (weekNum < systemWeek) continue;
      processed++;
      const weekData = multiWeekData[weekNum];
      if (!weekData) continue;
      const newData = structuredClone(weekData);
      if (!newData[dayName]) newData[dayName] = [];

      // Simple modulo check: is this week on the recurrence pattern? Also respect end date.
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
          if (!isStandardMode) {
            const sessionDate = getDateForWeekDay(weekNum, dayName);
            if (sessionDate && startTime) {
              const [h, m] = startTime.split(':').map(Number);
              sessionDate.setHours(h, m);
              newSession.sessionDate = sessionDate.toISOString();
            }
          }
          newData[dayName].push(newSession);
          newData[dayName].sort((a: any, b: any) => (a.start || '').localeCompare(b.start || ''));
          await saveWeekToDb(weekNum, newData);
          added++;
        }
      } else {
        // Remove this session from non-matching weeks
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
    // Count total days
    const countCursor = new Date(start); countCursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end); endDay.setHours(0, 0, 0, 0);
    let totalDays = 0;
    const tmpC = new Date(countCursor);
    while (tmpC <= endDay) { totalDays++; tmpC.setDate(tmpC.getDate() + 1); }
    const groupId = `fravær_${Date.now()}`;

    // Build new sessions per week
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

    // Determine delete filter for edit mode
    const isLegacy = oldGroupId?.startsWith('legacy_');
    const legacyId = isLegacy ? Number(oldGroupId!.replace('legacy_', '')) : null;
    const shouldRemove = oldGroupId
      ? (s: any) => isLegacy ? s.id === legacyId : s.fraværGroupId === oldGroupId
      : null;

    // Save: for each affected week, optionally remove old entries + add new ones
    const allWeeks = new Set([...Object.keys(multiWeekData).map(Number), ...Object.keys(weekChanges).map(Number)]);
    for (const wk of allWeeks) {
      const nd = structuredClone(multiWeekData[wk] || {});
      let changed = false;
      // Remove old group entries (edit mode)
      if (shouldRemove) {
        for (const dayName of DAYS) {
          if (!nd[dayName]) continue;
          const before = nd[dayName].length;
          nd[dayName] = nd[dayName].filter((s: any) => !shouldRemove(s));
          if (nd[dayName].length < before) changed = true;
        }
      }
      // Add new entries for this week
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

  // Scroll to today on mount and when entering personal view
  const hasScrolledOnMount = useRef(false);
  const dataSettledRef = useRef(false);
  const weeksBackRef = useRef(weeksBack);
  const weeksAheadRef = useRef(weeksAhead);
  weeksBackRef.current = weeksBack;
  weeksAheadRef.current = weeksAhead;
  const scrollToToday = useCallback((behavior: ScrollBehavior = 'instant') => {
    const ref = mobileTodayRef.current || todayRef.current;
    if (ref) ref.scrollIntoView({ behavior, block: 'start' });
  }, []);
  const scrollToDate = useCallback((date: Date) => {
    const key = date.toISOString().slice(0, 10);
    setHeaderMonth(date.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
    // Compute internal week number
    const target = new Date(date); target.setHours(0, 0, 0, 0);
    const internalWeek = getISOWeekForDate(target);
    setCurrentWeek(internalWeek);
    if (window.innerWidth >= 768) return;
    // Mobile: expand range if needed
    const currentWk = getISOWeek();
    const needBack = currentWk - internalWeek + 2;
    const needAhead = internalWeek - currentWk + 2;
    if (needBack > weeksBackRef.current) setWeeksBack(needBack);
    if (needAhead > weeksAheadRef.current) setWeeksAhead(needAhead);
    // Retry loop — wait for React to render expanded scrollDays
    let retries = 0;
    const tryScroll = () => {
      const el = document.getElementById(`day-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else if (retries < 50) {
        retries++;
        setTimeout(tryScroll, 100);
      }
    };
    setTimeout(tryScroll, 50);
  }, [setCurrentWeek]);
  useEffect(() => {
    if (view !== 'personal') return;
    let attempts = 0;
    const tryScroll = () => {
      if (mobileTodayRef.current || todayRef.current) {
        scrollToToday(hasScrolledOnMount.current ? 'smooth' : 'instant');
        hasScrolledOnMount.current = true;
      } else if (attempts < 10) {
        attempts++;
        setTimeout(tryScroll, 150);
      }
    };
    setTimeout(tryScroll, 50);
  }, [view, scrollToToday]);
  // Re-align after data first populates (sessions change card heights)
  useEffect(() => {
    if (!dataSettledRef.current && Object.keys(multiWeekData).length > 0 && view === 'personal') {
      dataSettledRef.current = true;
      setTimeout(() => scrollToToday('instant'), 50);
    }
  }, [multiWeekData, view, scrollToToday]);
  // Scroll to current week's Monday when crossing desktop→mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (view !== 'personal' || e.matches) return; // only when entering mobile
      const mon = getDateForWeekDay(currentWeek, 'Mandag');
      if (mon) setTimeout(() => scrollToDate(mon), 100);
      else setTimeout(() => scrollToToday('instant'), 100);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [view, currentWeek, scrollToDate, scrollToToday]);
  // Track visible month: from scroll on mobile, from currentWeek on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      // Desktop: derive from currentWeek
      const thu = getDateForWeekDay(currentWeek, 'Torsdag');
      if (thu) setHeaderMonth(thu.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
    }
  }, [currentWeek]);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (window.innerWidth >= 768) return; // desktop handled by currentWeek
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = document.elementFromPoint(window.innerWidth / 2, 90);
        const card = el?.closest?.('[id^="day-"]') as HTMLElement | null;
        if (card) {
          const dateStr = card.id.replace('day-', '');
          const d = new Date(dateStr + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            setHeaderMonth(d.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
            // Track active day for FAB
            const sd = scrollDays.find(s => s.key === dateStr);
            if (sd) activeDayRef.current = { dayName: sd.dayName, weekNumber: sd.weekNumber, date: sd.date, key: sd.key };
          }
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Expand range when search opens so results cover ~6 months ahead
  useEffect(() => {
    if (searchMode) setWeeksAhead(prev => Math.max(prev, 26));
  }, [searchMode]);
  // Prevent background scroll when search overlay is open
  useEffect(() => {
    if (searchMode) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [searchMode]);

  // --- Guard screens ---
  if (isBrowserBlocked) return <BrowserBlockScreen />;
  if (authLoading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-surface-subtle text-ds-text-subtlest'}`}>Loader...</div>;
  if (!user) return <LoginScreen onLoginPopup={triggerLoginPopup} onLoginRedirect={triggerLoginRedirect} error={loginError} />;
  if (accessDenied) return <div className={`min-h-screen flex items-center justify-center flex-col gap-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-surface-subtle text-ds-text'}`}><span>Ingen adgang</span><button onClick={handleLogout} className={`px-4 py-2 rounded ${isDark ? 'bg-slate-700 text-white' : 'bg-brand-500 text-white'}`}>Log ud</button></div>;

  const isReadOnly = view === 'personal' && currentWeek < systemWeek;
  const isAdmin = ['admin', 'coach'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);
  const weekDates = getWeekDateMap(currentWeek);
  const fullWeekDates = getFullWeekDateMap(currentWeek);
  const todayDayName = getTodayDayName();
  const isCurrentWeek = currentWeek === systemWeek;
  const monthLabel = headerMonth;

  // --- Render ---
  return (
    <div className={`min-h-screen font-sans selection:bg-blue-500/30 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text'}`}>
      {/* HEADER */}
      <div className={`p-4 shadow-lg border-b sticky top-0 z-20 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border shadow-sm'}`}>
        <div className="flex justify-between items-center px-2">
          {searchMode ? (
            /* Search mode header: back arrow + input */
            <div className="flex items-center flex-1 gap-2">
              <button onClick={() => { setSearchMode(false); setSearchQuery(''); }} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchMode(false); setSearchQuery(''); } }}
                placeholder="Søg i pas..."
                autoFocus
                className={`flex-1 bg-transparent outline-none text-sm font-medium ${isDark ? 'text-white placeholder-slate-500' : 'text-ds-text placeholder-ds-text-subtlest'}`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className={`p-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-ds-text-subtlest hover:text-ds-text-subtle'}`}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            /* Normal header */
            <>
          <div className="flex items-center space-x-2">
            <button onClick={() => setDrawerOpen(!drawerOpen)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
              <Menu className="w-5 h-5" />
            </button>
            <button onClick={() => { const parts = headerMonth.split(' '); const mIdx = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'].indexOf(parts[0]); setPickerMonth(new Date(parseInt(parts[1]) || new Date().getFullYear(), mIdx >= 0 ? mIdx : new Date().getMonth(), 1)); setMonthPickerOpen(true); }} className="text-left">
              <h1 className={`font-semibold text-sm leading-tight flex items-center gap-1 capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>
                {monthLabel}
                <ChevronDown className={`w-4 h-4 transition-transform ${monthPickerOpen ? 'rotate-180' : ''}`} />
              </h1>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSearchMode(true)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title="Søg">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={() => { setView('personal'); setCurrentWeek(systemWeek); scrollToToday('smooth'); }} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title="Gå til i dag">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <path d="M16 22l5-5" />
                <path d="M16 22v-5h5" />
                <text x="12" y="18.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">{new Date().getDate()}</text>
              </svg>
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${menuOpen ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-surface-hover text-ds-text hover:bg-surface-raised')}`}>
                {activeFighter.slice(0, 1)}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className={`absolute right-0 top-12 w-56 rounded-xl border shadow-xl z-40 py-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
                    {/* User info */}
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDark ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>{activeFighter.slice(0, 1)}</div>
                        <div>
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>{activeFighter}</p>
                          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    {/* Admin-only fighter switch */}
                    {isAdmin && !isLocked && (
                      <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                        <p className={`text-[10px] font-medium uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Vis som fighter</p>
                        <select value={activeFighter} onChange={(e) => { setActiveFighter(e.target.value); setMenuOpen(false); }} className={`w-full px-2 py-1.5 rounded-lg border text-sm font-bold ${isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-surface-subtle text-ds-text border-surface-border'}`}>
                          {FIGHTERS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    )}
                    {/* Actions */}
                    <div className={`py-1 ${isAdmin ? `border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}` : ''}`}>
                      <button onClick={() => { toggleTheme(); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-ds-text hover:bg-surface-hover'}`}>
                        {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
                        <span className="font-medium">{isDark ? 'Lys tilstand' : 'Mørk tilstand'}</span>
                      </button>
                      <button onClick={() => { setFeedbackContext({ location: 'menu' }); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-ds-text hover:bg-surface-hover'}`}>
                        <MessageSquarePlus className="w-4 h-4" /><span className="font-medium">Feedback</span>
                      </button>
                    </div>
                    {isAdmin && (
                      <div className={`py-1 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                        <button onClick={() => { setAdminOpen(true); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-yellow-400 hover:bg-slate-700' : 'text-yellow-600 hover:bg-surface-hover'}`}>
                          <ClipboardList className="w-4 h-4" /><span className="font-medium">Backlog</span>
                        </button>
                      </div>
                    )}
                    <div className="py-1">
                      <button onClick={() => { handleLogout(); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-red-400 hover:bg-slate-700' : 'text-red-500 hover:bg-surface-hover'}`}>
                        <LogOut className="w-4 h-4" /><span className="font-medium">Log ud</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* SEARCH RESULTS OVERLAY */}
      {searchMode && (
        <div className={`fixed inset-0 top-[73px] z-[18] overflow-y-auto pb-32 ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
          {(() => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return (
              <div className={`flex flex-col items-center justify-center pt-24 px-8 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
                <Search className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Søg efter holdnavn, kategori, sted...</p>
              </div>
            );
            // Collect all sessions from today forward
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const results: { date: Date; dayName: string; weekNum: number; session: any; key: string }[] = [];
            for (const sd of scrollDays) {
              if (sd.date < today) continue;
              const weekData = multiWeekData[sd.weekNumber] || {};
              const sessions = weekData[sd.dayName] || [];
              for (const s of sessions) {
                if (s.isRestDay) continue;
                const fields = [s.name, s.category, s.location, s.start, s.end, s.cancellationReason].filter(Boolean).map((f: string) => f.toLowerCase());
                if (fields.some(f => f.includes(q))) {
                  results.push({ date: sd.date, dayName: sd.dayName, weekNum: sd.weekNumber, session: s, key: sd.key });
                }
              }
            }
            if (results.length === 0) return (
              <div className={`flex flex-col items-center justify-center pt-24 px-8 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
                <Search className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Ingen resultater for "{searchQuery}"</p>
              </div>
            );
            // Group by date
            const grouped: { label: string; date: Date; items: typeof results }[] = [];
            let currentLabel = '';
            for (const r of results) {
              const label = r.date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
              if (label !== currentLabel) {
                currentLabel = label;
                grouped.push({ label, date: r.date, items: [] });
              }
              grouped[grouped.length - 1].items.push(r);
            }
            return (
              <div className="px-4 pt-2 space-y-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{results.length} resultat{results.length !== 1 ? 'er' : ''}</p>
                {grouped.map(group => (
                  <div key={group.label}>
                    <div className={`text-xs font-bold capitalize mb-1.5 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{group.label}</div>
                    <div className="space-y-1.5">
                      {group.items.map(r => {
                        const cat = CATEGORIES.find(c => c.label === r.session.category) || CATEGORIES[6];
                        const isCancelled = r.session.status === 'cancelled';
                        return (
                          <button key={`${r.key}-${r.session.id}`} onClick={() => { setEditingDay(r.dayName); setEditingSession(r.session); setEditingWeek(r.weekNum); setModalOpen(true); }}
                            className={`w-full text-left relative flex items-start p-2.5 rounded-xl border shadow-sm transition-all active:scale-[0.98] ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border')}`}>
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`} />
                            <div className="flex-1 pl-2.5 min-w-0">
                              <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{r.session.name}</h4>
                              <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                                <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{r.session.start} - {r.session.end}</span>
                                <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{r.session.location}</span>
                              </div>
                              {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{r.session.cancellationReason ? `: ${r.session.cancellationReason}` : ''}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* MONTH PICKER */}
      {monthPickerOpen && (
        <>
          <div className="fixed inset-0 z-[25]" onClick={() => setMonthPickerOpen(false)} />
          <div className={`fixed left-0 right-0 top-[73px] z-30 mx-4 rounded-2xl border shadow-xl p-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronLeft className="w-5 h-5" /></button>
              <span className={`text-sm font-bold capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>{pickerMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
                <div key={d} className={`text-[10px] font-bold py-1 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{d}</div>
              ))}
              {(() => {
                const year = pickerMonth.getFullYear();
                const month = pickerMonth.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
                const today = new Date(); today.setHours(0,0,0,0);
                const todayStr = today.toISOString().slice(0, 10);
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < startPad; i++) cells.push(<div key={`pad-${i}`} />);
                for (let d = 1; d <= lastDay.getDate(); d++) {
                  const date = new Date(year, month, d);
                  const dateStr = date.toISOString().slice(0, 10);
                  const isToday = dateStr === todayStr;
                  cells.push(
                    <button key={d} onClick={() => { setMonthPickerOpen(false); setView('personal'); scrollToDate(date); }}
                      className={`w-8 h-8 mx-auto rounded-full text-xs font-medium transition-colors ${isToday ? 'bg-blue-600 text-white font-bold' : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>{d}</button>
                  );
                }
                return cells;
              })()}
            </div>
          </div>
        </>
      )}

      {/* LEFT DRAWER */}
      {drawerOpen && <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setDrawerOpen(false)} />}
      <div className={`fixed top-0 left-0 h-full w-64 z-40 transform transition-transform duration-200 ease-out border-r shadow-xl ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
        {/* Drawer header */}
        <div className={`p-4 border-b ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>FightWeek</h2>
            <button onClick={() => setDrawerOpen(false)} className={`p-1 rounded ${isDark ? 'text-slate-500 hover:text-white' : 'text-ds-text-subtlest hover:text-ds-text'}`}><X className="w-4 h-4" /></button>
          </div>
        </div>
        {/* Navigation */}
        <div className={`py-1 border-b ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <button onClick={() => { setView('personal'); setDrawerOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'personal' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <Calendar className="w-4 h-4" /><span className="font-medium">Kalender</span>
          </button>
          <button onClick={() => { setView('program'); setDrawerOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'program' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <Repeat className="w-4 h-4" /><span className="font-medium">Program</span>
          </button>
          <button onClick={() => { setView('team'); setDrawerOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'team' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <Users className="w-4 h-4" /><span className="font-medium">Teamet</span>
          </button>
        </div>
        {/* Friends calendars */}
        <div className="px-4 pt-3 pb-2">
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Holdkammerater</p>
          <div className="space-y-0.5">
            {FIGHTERS.filter(f => f !== activeFighter).map(f => {
              const isVisible = visibleFriends.includes(f);
              const color = FRIEND_COLORS[f] || 'bg-slate-500';
              return (
                <button key={f} onClick={() => toggleFriend(f)} className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${isVisible ? (isDark ? 'bg-slate-800' : 'bg-surface-hover') : (isDark ? 'hover:bg-slate-800/50' : 'hover:bg-surface-hover/50')}`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${isVisible ? color : 'border-2 ' + (isDark ? 'border-slate-600' : 'border-surface-border')}`}>
                    {isVisible && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12"><path d="M10 3L4.5 8.5 2 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`font-medium ${isVisible ? (isDark ? 'text-white' : 'text-ds-text') : (isDark ? 'text-slate-400' : 'text-ds-text-subtle')}`}>{f}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — responsive width */}
      <div className="mx-auto relative pt-4 min-h-[85vh]">
        {/* Desktop: Week navigation — only for Min Uge or Program */}
        {(view === 'personal' || view === 'program') && (
          <div className="hidden md:block mx-4 mb-4 space-y-3">
            {view === 'personal' && (
              <>
                <div className={`flex items-center justify-between p-2 rounded-xl border shadow-md ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
                  <button onClick={() => setCurrentWeek(currentWeek - 1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'} ${currentWeek <= 1 ? 'invisible' : ''}`}><ChevronLeft className="w-6 h-6" /></button>
                  <div className="text-center">
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>{currentWeek === systemWeek ? "Aktuel Uge" : currentWeek < systemWeek ? "Tidligere Uge" : "Næste Uge"}</span>
                    <div className={`font-bold text-xl ${isDark ? 'text-white' : 'text-ds-text'}`}>Uge {getISOWeekForDate(getDateForWeekDay(currentWeek, 'Torsdag')!)}</div>
                  </div>
                  <button onClick={() => setCurrentWeek(currentWeek + 1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronRight className="w-6 h-6" /></button>
                </div>
                {isReadOnly && (
                  <div className="flex items-center px-1">
                    <span className={`flex items-center text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}><History className="w-3 h-3 mr-1" /> Historik</span>
                  </div>
                )}
              </>
            )}
            {view === 'program' && (
              <>
                <div className={`rounded-xl p-3 flex items-start space-x-3 border ${isDark ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50 border-indigo-200'}`}>
                  <Repeat className={`w-5 h-5 mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                  <div>
                    <p className={`text-sm font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>Mit Program</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-indigo-300/70' : 'text-indigo-500'}`}>Din faste ugeplan. Nye uger starter automatisk herfra.</p>
                  </div>
                </div>
                <div className="flex justify-between items-center px-1">
                  <div />
                  <button onClick={() => setShowCatalogue(!showCatalogue)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${showCatalogue ? (isDark ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white') : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {showCatalogue ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showCatalogue ? 'Færdig' : 'Tilføj pas'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile: Program header */}
        {view === 'program' && (
          <div className="md:hidden mx-4 mb-4">
            <div className={`rounded-xl p-3 flex items-start space-x-3 border ${isDark ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50 border-indigo-200'}`}>
              <Repeat className={`w-5 h-5 mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
              <div>
                <p className={`text-sm font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>Mit Program</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-indigo-300/70' : 'text-indigo-500'}`}>Din faste ugeplan. Nye uger starter automatisk herfra.</p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: Personal / Program / Team */}
        {view !== 'team' ? (
          <>
            {/* Desktop action bar + catalogue filter */}
            {!isReadOnly && (
              <div className="hidden md:block mx-4 mb-3">
                {showCatalogue && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 w-56 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-surface-border'}`}>
                      <Search className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                      <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Søg hold..."
                        className={`flex-1 bg-transparent outline-none text-xs ${isDark ? 'text-white placeholder-slate-500' : 'text-ds-text placeholder-ds-text-subtlest'}`} />
                      {catSearch && <button onClick={() => setCatSearch('')}><X className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} /></button>}
                    </div>
                    {allDisciplines.map(d => (
                      <button key={d} onClick={() => setCatDiscipline(catDiscipline === d ? null : d)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${catDiscipline === d ? 'bg-blue-600 text-white border-blue-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>{d}</button>
                    ))}
                    {allGyms.length > 1 && allGyms.map(g => (
                      <button key={g} onClick={() => setCatGym(catGym === g ? null : g)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${catGym === g ? 'bg-emerald-600 text-white border-emerald-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>{g}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mobile: Continuous day scroll */}
            <div className="md:hidden">
              <MobileScrollView
                scrollDays={scrollDays}
                multiWeekData={multiWeekData}
                isDark={isDark}
                onFraværClick={(session, dayKey) => {
                  setEditingFravær({
                    groupId: session.fraværGroupId || `legacy_${session.id}`,
                    titel: session.fraværTitel || session.name || '',
                    beskrivelse: session.fraværBeskrivelse || '',
                    startDate: session.fraværStartDate || dayKey,
                    startTime: session.fraværStartTime || session.start || '09:00',
                    endDate: session.fraværEndDate || dayKey,
                    endTime: session.fraværEndTime || session.end || '17:00',
                  });
                  setAddScreenType('fravær');
                  setAddScreenOpen(true);
                }}
                onEditSession={(day, session, weekNum) => {
                  // Compute isRecurring from both explicit flag and template membership
                  const enriched = { ...session, isRecurring: session.isRecurring || programKeys.has(`${day}|${(session.name || '').toLowerCase()}|${session.start || ''}`) };
                  // If session has catalogueClassId, show info sheet instead of edit modal
                  if (enriched.catalogueClassId) {
                    const cls = catalogueClasses.find(c => c.id === enriched.catalogueClassId);
                    if (cls) { setClassInfoSession({ cls, session: enriched, day, weekNum }); return; }
                  }
                  setEditingDay(day); setEditingSession(enriched); setEditingWeek(weekNum); setModalOpen(true);
                }}
                todayRef={mobileTodayRef}
                onLoadMorePast={loadMorePast}
                onLoadMoreFuture={loadMoreFuture}
                visibleFriends={visibleFriends}
                friendWeekData={friendWeekData}
                friendColors={FRIEND_COLORS}
                programKeys={programKeys}
              />
            </div>

            {/* Desktop: 7-column week grid */}
            <div className="hidden md:block">
              <PersonalSchedule
                days={DAYS}
                scheduleData={scheduleData}
                weekDates={weekDates}
                fullWeekDates={fullWeekDates}
                isStandardMode={isStandardMode}
                isReadOnly={isReadOnly}
                isDark={isDark}
                expandedDay={expandedDay}
                onToggleRestDay={handleToggleRestDay}
                onAddClick={handleAddClick}
                onEditSession={(day, session) => {
                  const enriched = { ...session, isRecurring: session.isRecurring || programKeys.has(`${day}|${(session.name || '').toLowerCase()}|${session.start || ''}`) };
                  setEditingDay(day); setEditingSession(enriched); setModalOpen(true);
                }}
                onAddFromCatalogue={handleAddFromCatalogue}
                onManualAdd={handleManualFromPicker}
                onCollapseDay={() => setExpandedDay(null)}
                showDesktopCatalogue={showCatalogue && !isReadOnly}
                catalogueByDay={catalogueByDay}
                catalogueLoading={catalogueLoading}
                onAddFromDesktopCatalogue={handleAddFromDesktopCatalogue}
                onDesktopManual={handleManualFromPicker}
                todayDayName={isCurrentWeek ? todayDayName : null}
                todayRef={todayRef}
                visibleFriends={visibleFriends}
                friendWeekData={friendWeekData}
                friendColors={FRIEND_COLORS}
                currentWeek={currentWeek}
                programKeys={programKeys}
              />
            </div>
          </>
        ) : (
          <TeamSchedule days={DAYS} teamData={teamData} currentWeek={currentWeek} isStandardMode={isStandardMode} isDark={isDark} />
        )}
      </div>

      {/* MODALS */}
      {/* Desktop FAB — floating blue + button */}
      {(view === 'personal' || view === 'program') && !isReadOnly && (
        <button onClick={() => setShowCatalogue(!showCatalogue)}
          className={`hidden md:flex fixed bottom-8 right-8 z-20 w-14 h-14 rounded-full items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${showCatalogue ? 'bg-slate-500 hover:bg-slate-600 rotate-45' : 'bg-blue-600 hover:bg-blue-700'}`}>
          <Plus className="w-7 h-7 text-white" />
        </button>
      )}
      {/* Mobile FAB — floating blue + button */}
      {(view === 'personal' || view === 'program') && !isReadOnly && (
        <>
          <button onClick={() => setFabSheetOpen(true)}
            className={`md:hidden fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 bg-blue-600 hover:bg-blue-700`}>
            <Plus className="w-7 h-7 text-white" />
          </button>
          {/* FAB action sheet */}
          {fabSheetOpen && (
            <div className="md:hidden fixed inset-0 z-30" onClick={() => setFabSheetOpen(false)}>
              <div className="absolute inset-0 bg-black/40" />
              <div className={`absolute bottom-0 left-0 right-0 rounded-t-2xl p-4 pb-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
                <button onClick={() => { setFabSheetOpen(false); setAddScreenType('træning'); setAddScreenOpen(true); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 text-left font-semibold text-sm transition-colors ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-surface-hover text-ds-text hover:bg-surface-raised'}`}>
                  <Plus className="w-5 h-5 text-blue-500" /> Træning
                </button>
                <button onClick={() => { setFabSheetOpen(false); setAddScreenType('fravær'); setAddScreenOpen(true); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm transition-colors ${isDark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100'}`}>
                  <Calendar className="w-5 h-5" /> Fravær
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Session detail sheet (from calendar tap) */}
      {classInfoSession && (
        <SessionDetailSheet
          cls={classInfoSession.cls}
          session={classInfoSession.session}
          day={classInfoSession.day}
          weekNum={classInfoSession.weekNum}
          isDark={isDark}
          multiWeekData={multiWeekData}
          systemWeek={systemWeek}
          saveWeekToDb={saveWeekToDb}
          showToast={showToast}
          onRecurrenceChange={(session, dayName, startDate, recurrence) => {
            handleAddRecurring(session, dayName, startDate, recurrence);
            setClassInfoSession(null);
          }}
          onRemoveFromTemplate={removeProgramSession}
          onClose={() => setClassInfoSession(null)}
        />
      )}

      {/* AddScreen full-screen overlay */}
      {addScreenOpen && (() => {
        const ad = activeDayRef.current || (() => {
          const today = scrollDays.find(d => d.isToday) || scrollDays[0];
          return today ? { dayName: today.dayName, weekNumber: today.weekNumber, date: today.date, key: today.key } : { dayName: 'Mandag', weekNumber: systemWeek, date: new Date(), key: '' };
        })();
        return (
          <AddScreen
            defaultType={addScreenType}
            activeDay={ad}
            multiWeekData={multiWeekData}
            programKeys={programKeys}
            isDark={isDark}
            editingFravær={editingFravær}
            onAddFromCatalogue={(session, day, weekNum) => { handleAddFromCatalogue(session, day, weekNum); setAddScreenOpen(false); }}
            onAddRecurring={handleAddRecurring}
            onManualAdd={(day, weekNum) => { handleManualFromPicker(day, weekNum); setAddScreenOpen(false); }}
            onAddFravær={(fravær) => { handleFravær(fravær); setAddScreenOpen(false); setEditingFravær(null); }}
            onDeleteFravær={(groupId) => { handleDeleteFravær(groupId); setAddScreenOpen(false); setEditingFravær(null); }}
            onEditFravær={async (oldGroupId, fravær) => { await handleFravær(fravær, oldGroupId); setAddScreenOpen(false); setEditingFravær(null); }}
            onClose={() => { setAddScreenOpen(false); setEditingFravær(null); }}
          />
        );
      })()}
      {modalOpen && <SessionModal
        day={editingDay}
        weekNum={editingWeek || currentWeek}
        date={getDateForWeekDay(editingWeek || currentWeek, editingDay) || new Date()}
        initialData={editingSession}
        existingSessions={editingWeek ? ((multiWeekData[editingWeek] || {})[editingDay] || []) : (scheduleData[editingDay] || [])}
        onClose={() => { setModalOpen(false); setEditingWeek(null); }}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
        onDeleteThisAndFuture={(dayName, name, start, fromWeek) => {
          setModalOpen(false);
          setEditingWeek(null);
          showToast(`${name} fjernet`, 'success');
          const nameLC = name.toLowerCase();
          (async () => {
            for (const wk of Object.keys(multiWeekData).map(Number).sort((a, b) => a - b)) {
              if (wk < fromWeek) continue;
              const wd = multiWeekData[wk];
              if (!wd?.[dayName]) continue;
              const nd = structuredClone(wd);
              const before = nd[dayName].length;
              nd[dayName] = nd[dayName].filter((s: any) => s.isRestDay || (s.name || '').toLowerCase() !== nameLC || s.start !== start);
              if (nd[dayName].length < before) await saveWeekToDb(wk, nd);
            }
            await removeProgramSession(dayName, name, start);
          })();
        }}
        onRecurrenceSave={(session, dayName, startDate, recurrence) => {
          handleAddRecurring(session, dayName, startDate, recurrence);
          setModalOpen(false);
          setEditingWeek(null);
        }}
        isStandardMode={isStandardMode}
        onFeedback={(ctx) => setFeedbackContext(ctx)}
      />}
      {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} onShowToast={showToast} />}
      {adminOpen && <BacklogPage isAdmin={isAdmin} onClose={() => setAdminOpen(false)} onShowToast={showToast} />}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </div>
  );
};

// --- Session Detail Sheet (calendar tap — same layout as HoldBottomSheet + delete) ---

const SessionDetailSheet = ({ cls, session, day, weekNum, isDark, multiWeekData, systemWeek, saveWeekToDb, showToast, onRecurrenceChange, onRemoveFromTemplate, onClose }: {
  cls: CatalogueClass;
  session: any;
  day: string;
  weekNum: number;
  isDark: boolean;
  multiWeekData: Record<number, any>;
  systemWeek: number;
  saveWeekToDb: (weekNum: number, data: any) => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRecurrenceChange: (session: any, dayName: string, startDate: Date, recurrence: { interval: number; endDate: string | null }) => void;
  onRemoveFromTemplate: (dayName: string, sessionName: string, sessionStart: string) => Promise<boolean>;
  onClose: () => void;
}) => {
  const [showMore, setShowMore] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [interval, setRecurrenceInterval] = useState(session.isRecurring ? 1 : 0);
  const [endType, setEndType] = useState<'never' | 'date'>('never');
  const [endDate, setEndDate] = useState('');
  const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
  const { gyms } = useGymsHook();
  const gymEntity = gyms.find(g => g.name === cls.gym);
  const labelCls = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
  const nameLC = (session.name || '').toLowerCase();
  const startTime = session.start || '';

  // Compute the date for this session's week+day
  const sessionDate = useMemo(() => getDateForWeekDay(weekNum, day) || new Date(), [weekNum, day]);

  const handleSave = () => {
    const sessionPayload = {
      name: cls.title,
      category: disciplineToCategory(cls.discipline),
      start: session.start,
      end: session.end,
      location: cls.gym,
      catalogueClassId: cls.id,
    };
    onRecurrenceChange(sessionPayload, day, sessionDate, {
      interval,
      endDate: endType === 'date' && endDate ? endDate : null,
    });
  };

  const handleDeleteThis = () => {
    onClose();
    showToast(`${session.name} fjernet`, 'success');
    const weekData = multiWeekData[weekNum];
    if (!weekData) return;
    const newData = structuredClone(weekData);
    if (newData[day]) {
      newData[day] = newData[day].filter((s: any) => s.id !== session.id);
      saveWeekToDb(weekNum, newData);
    }
  };

  const handleDeleteThisAndFuture = () => {
    onClose();
    showToast(`${session.name} fjernet`, 'success');
    (async () => {
      for (const wk of Object.keys(multiWeekData).map(Number).sort((a, b) => a - b)) {
        if (wk < weekNum) continue;
        const weekData = multiWeekData[wk];
        if (!weekData?.[day]) continue;
        const newData = structuredClone(weekData);
        const before = newData[day].length;
        newData[day] = newData[day].filter((s: any) =>
          s.isRestDay || (s.name || '').toLowerCase() !== nameLC || s.start !== startTime
        );
        if (newData[day].length < before) {
          await saveWeekToDb(wk, newData);
        }
      }
      await onRemoveFromTemplate(day, session.name, startTime);
    })();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-4" />

        {/* Class info */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-1.5 rounded-full self-stretch shrink-0 ${cat.color}`} />
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-base leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</h3>
              <div className={`mt-1 space-y-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.start} — {session.end}</div>
                <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cls.gym}{cls.location ? ` · ${cls.location}` : ''}</div>
                {cls.instructor && <div className="flex items-center gap-1">ðŸ‘¤ {cls.instructor}</div>}
                {cls.discipline && <div>{cls.discipline}{cls.level ? ` · ${cls.level}` : ''}</div>}
              </div>
              {showMore && cls.description && (
                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{cls.description}</p>
              )}
              {showMore && (
                <div className={`mt-3 space-y-3 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                  {cls.address && (
                    <div>
                      <p className={labelCls}>Adresse</p>
                      <a href={googleMapsUrl(cls.address)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 mt-0.5">
                        <MapPin className="w-3 h-3" />{cls.address}<ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                  {(gymEntity?.phone || gymEntity?.email) && (
                    <div className="flex flex-wrap gap-4">
                      {gymEntity?.phone && (
                        <div>
                          <p className={labelCls}>Telefon</p>
                          <a href={`tel:${gymEntity.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
                            <Phone className="w-3 h-3" />{gymEntity.phone}
                          </a>
                        </div>
                      )}
                      {gymEntity?.email && (
                        <div>
                          <p className={labelCls}>Email</p>
                          <a href={`mailto:${gymEntity.email}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
                            <Mail className="w-3 h-3" />{gymEntity.email}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {cls.schedules.length > 1 && (
                    <div>
                      <p className={labelCls}>Ugentlige tider</p>
                      <div className="mt-1 space-y-0.5">
                        {cls.schedules.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((s, i) => (
                          <div key={i} className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                            <Calendar className={`w-3 h-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                            <span className="font-medium w-14">{DAY_NAMES[s.dayOfWeek]}</span>
                            <Clock className={`w-3 h-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                            <span>{s.startTime} — {s.endTime}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {gymEntity?.scheduleUrl && (
                    <a href={gymEntity.scheduleUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400">
                      <Link2 className="w-3 h-3" />Holdoversigt<ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              )}
              <button onClick={() => setShowMore(!showMore)} className={`mt-1 text-[10px] font-bold ${isDark ? 'text-blue-400' : 'text-brand-500'}`}>
                {showMore ? 'Skjul info' : 'Mere info'}
              </button>
            </div>
          </div>
        </div>

        {/* Day + time (read-only) */}
        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
            <Calendar className="w-4 h-4" />
            <span className="font-medium capitalize">
              {sessionDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>

        {/* Recurrence */}
        <div className={`px-5 py-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Gentagelse</label>
            <select value={interval} onChange={e => setRecurrenceInterval(Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`}>
              {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {interval > 0 && (
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slutdato</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={endType === 'never'} onChange={() => setEndType('never')} className="accent-blue-600" />
                  <span className={isDark ? 'text-slate-300' : 'text-ds-text'}>Slutter ikke</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={endType === 'date'} onChange={() => setEndType('date')} className="accent-blue-600" />
                  <span className={isDark ? 'text-slate-300' : 'text-ds-text'}>På en dato</span>
                </label>
              </div>
              {endType === 'date' && (
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  min={sessionDate.toISOString().slice(0, 10)}
                  className={`mt-2 w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`} />
              )}
            </div>
          )}
        </div>
        </div>{/* end scrollable area */}

        {/* Footer — either actions or delete options */}
        {showDeleteOptions ? (
          <div className={`px-5 py-3 border-t space-y-1.5 shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slet træning</p>
            <button onClick={handleDeleteThis}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
              Denne træning
            </button>
            <button onClick={handleDeleteThisAndFuture}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
              Denne og alle fremtidige træninger
            </button>
            <button onClick={() => setShowDeleteOptions(false)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
              Annuller
            </button>
          </div>
        ) : (
          <div className={`px-5 py-4 border-t flex justify-between items-center shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            <button onClick={() => setShowDeleteOptions(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
              Slet
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>Annuller</button>
              <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Gem</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// --- Mobile Continuous Scroll View (Google Calendar style — date rail layout) ---
const DAY_ABBREV: Record<string, string> = { Mandag: 'MAN', Tirsdag: 'TIR', Onsdag: 'ONS', Torsdag: 'TOR', Fredag: 'FRE', Lørdag: 'LØR', Søndag: 'SØN' };

const MobileScrollView = ({ scrollDays, multiWeekData, isDark, onEditSession, onFraværClick, todayRef, onLoadMorePast, onLoadMoreFuture, visibleFriends = [], friendWeekData = {}, friendColors = {}, programKeys = new Set<string>() }: {
  scrollDays: ScrollDay[];
  multiWeekData: Record<number, any>;
  isDark: boolean;
  onEditSession: (day: string, session: any, weekNum: number) => void;
  onFraværClick: (session: any, dayKey: string) => void;
  todayRef: React.RefObject<HTMLDivElement | null>;
  onLoadMorePast: () => void;
  onLoadMoreFuture: () => void;
  visibleFriends?: string[];
  friendWeekData?: Record<string, Record<number, any>>;
  friendColors?: Record<string, string>;
  programKeys?: Set<string>;
}) => {
  const topSentinel = useRef<HTMLDivElement | null>(null);
  const bottomSentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === topSentinel.current) onLoadMorePast();
        if (entry.target === bottomSentinel.current) onLoadMoreFuture();
      }
    }, { rootMargin: '400px' });
    if (topSentinel.current) observer.observe(topSentinel.current);
    if (bottomSentinel.current) observer.observe(bottomSentinel.current);
    return () => observer.disconnect();
  }, [onLoadMorePast, onLoadMoreFuture]);

  return (
  <div className="pb-32 fade-in">
    <div ref={topSentinel} className="h-1" />
    {scrollDays.map((scrollDay, idx) => {
      const weekData = multiWeekData[scrollDay.weekNumber] || {};
      const sessions = weekData[scrollDay.dayName] || [];
      const isRestDay = sessions.some((s: any) => s.isRestDay);
      const visibleSessions = sessions.filter((s: any) => !s.isRestDay && s.type !== 'fravær');
      // Fravær entries
      const fraværSessions = sessions.filter((s: any) => s.type === 'fravær');
      const showWeekDivider = idx > 0 && scrollDay.dayName === 'Mandag';
      const dayNum = scrollDay.date.getDate();

      return (
        <React.Fragment key={scrollDay.key}>
          {showWeekDivider && (
            <div className={`flex items-center gap-2 pt-3 pb-1 px-4 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
              <div className={`flex-1 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Uge {getISOWeekForDate(scrollDay.date)}</span>
              <div className={`flex-1 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`} />
            </div>
          )}
          {/* Date-rail row */}
          <div
            id={`day-${scrollDay.key}`}
            ref={scrollDay.isToday ? todayRef : undefined}
            style={{ scrollMarginTop: '82px' }}
            className={`flex items-start gap-0 border-b ${isDark ? 'border-slate-800/50' : 'border-surface-border/50'}`}
          >
            {/* Left date rail */}
            <div className={`w-12 shrink-0 pt-2 pb-2 flex flex-col items-center sticky top-[73px] z-[5] ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${scrollDay.isToday ? 'text-blue-500' : (isDark ? 'text-slate-500' : 'text-ds-text-subtlest')}`}>{DAY_ABBREV[scrollDay.dayName] || scrollDay.dayName.slice(0, 3).toUpperCase()}</span>
              <span className={`text-lg font-bold leading-tight ${scrollDay.isToday ? 'text-white bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center' : (isDark ? 'text-slate-300' : 'text-ds-text')}`}>{dayNum}</span>
            </div>
            {/* Right content area */}
            <div className="flex-1 min-w-0 py-1.5 pr-4 space-y-1">
              {/* Fravær blocks */}
              {fraværSessions.map((s: any) => {
                const title = s.fraværTitel || s.name || 'Fravær';
                const total = s.fraværTotalDays || 1;
                const dayIdx = s.fraværDayIndex || 1;
                const isFirst = dayIdx === 1;
                const isLast = dayIdx === total;
                const isSingle = total === 1;
                return (
                  <div key={s.id}
                    onClick={() => onFraværClick(s, scrollDay.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] transition-all ${isDark ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`}>
                    <span className="font-bold">{title}</span>
                    {!isSingle && <span className="opacity-70"> (dag {dayIdx}/{total})</span>}
                    {isSingle && <span className="opacity-70"> · {s.start} — {s.end}</span>}
                    {!isSingle && isFirst && <span className="opacity-70"> · Fra {s.start}</span>}
                    {!isSingle && isLast && <span className="opacity-70"> · Indtil {s.end}</span>}
                  </div>
                );
              })}
              {/* Session cards */}
              {visibleSessions.length === 0 && fraværSessions.length === 0 && !isRestDay && (
                <div className={`text-[10px] font-medium py-1.5 ${isDark ? 'text-slate-700' : 'text-ds-text-subtlest/60'}`}>Ingen pas</div>
              )}
              {visibleSessions.map((s: any) => {
                const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                const isCancelled = s.status === 'cancelled';
                const isRecurring = s.isRecurring || programKeys.has(`${scrollDay.dayName}|${(s.name || '').toLowerCase()}|${s.start || ''}`);
                return (
                  <div key={s.id} onClick={() => onEditSession(scrollDay.dayName, s, scrollDay.weekNumber)}
                    className={`relative flex items-start p-2 rounded-xl border shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-surface-border')}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                    <div className="flex-1 pl-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{s.name}</h4>
                        {isRecurring && <Repeat className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />}
                      </div>
                      <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                        <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.start} - {s.end}</span>
                        <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.location}</span>
                      </div>
                      {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{s.cancellationReason ? `: ${s.cancellationReason}` : ''}</div>}
                    </div>
                  </div>
                );
              })}
              {/* Friend sessions overlay */}
              {visibleFriends.length > 0 && visibleFriends.map(friend => {
                const fWeek = friendWeekData[friend]?.[scrollDay.weekNumber] || {};
                const fSessions = (fWeek[scrollDay.dayName] || []).filter((s: any) => !s.isRestDay);
                if (fSessions.length === 0) return null;
                const colorClass = friendColors[friend] || 'bg-gray-400';
                return (
                  <div key={friend} className="mt-1">
                    <div className={`text-[9px] font-bold uppercase tracking-wide mb-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{friend}</div>
                    {fSessions.map((s: any) => (
                      <div key={s.id} className={`relative flex items-start p-1.5 rounded-lg mb-1 border opacity-70 ${isDark ? 'bg-slate-800/50 border-slate-700/30' : 'bg-surface-raised/60 border-surface-border/60'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClass}`}></div>
                        <div className="flex-1 pl-2 min-w-0">
                          <h4 className={`font-semibold text-[10px] leading-tight line-clamp-1 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{s.name}</h4>
                          <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{s.start} - {s.end}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </React.Fragment>
      );
    })}
    <div ref={bottomSentinel} className="h-1" />
  </div>
  );
};

// --- Personal Schedule (inline — small, tightly coupled to App state) ---
const PersonalSchedule = ({ days, scheduleData, weekDates, fullWeekDates, isStandardMode, isReadOnly, isDark, expandedDay, onToggleRestDay, onAddClick, onEditSession, onAddFromCatalogue, onManualAdd, onCollapseDay, showDesktopCatalogue, catalogueByDay, catalogueLoading, onAddFromDesktopCatalogue, onDesktopManual, todayDayName, todayRef, visibleFriends = [], friendWeekData = {}, friendColors = {}, currentWeek = 0, programKeys = new Set<string>() }) => (
  <div className="px-4 pb-32 fade-in">
    <div className="grid grid-cols-1 md:grid-cols-7 md:grid-rows-[1fr_auto] gap-3">
    {days.map(day => {
      const sessions = scheduleData[day] || [];
      const isRestDay = sessions.some(s => s.isRestDay);
      const visibleSessions = sessions.filter(s => !s.isRestDay && s.type !== 'fravær');
      const isExpanded = expandedDay === day;
      const dayCatalogue = catalogueByDay?.[day] || [];
      const isToday = day === todayDayName;
      return (
        <div key={day} ref={isToday ? todayRef : undefined} className={`rounded-2xl p-3 border transition-all shadow-md flex flex-col md:row-span-2 md:grid md:grid-rows-subgrid md:gap-y-0 ${isToday ? (isDark ? 'border-blue-700/60 ring-1 ring-blue-800/40' : 'border-brand-300 ring-1 ring-brand-100') : ''} ${isExpanded ? (isDark ? 'bg-slate-900 border-blue-800/50 ring-1 ring-blue-800/30' : 'bg-white border-brand-200 ring-1 ring-brand-100') : isRestDay ? (isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-surface-raised/50 border-surface-border') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border')}`}>
          <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-1">
              <h3 className={`font-bold text-sm md:text-xs ${isReadOnly ? (isDark ? 'text-slate-400' : 'text-ds-text-subtle') : (isDark ? 'text-white' : 'text-ds-text')}`}>
                <span className="md:hidden">{day}{!isStandardMode && fullWeekDates[day] && <span className={`text-xs font-medium ml-1 ${isToday ? 'text-blue-400' : (isDark ? 'text-slate-500' : 'text-ds-text-subtlest')}`}>{fullWeekDates[day]}</span>}</span>
                <span className="hidden md:inline">{day.slice(0, 3)}</span>
                {!isStandardMode && weekDates[day] && <span className={`hidden md:inline text-[10px] ml-1 font-medium ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>d. {weekDates[day]}</span>}
                {isToday && <span className="md:hidden ml-1.5 text-[9px] font-bold uppercase tracking-wide text-blue-400">i dag</span>}
              </h3>
              {isRestDay && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-surface-hover text-ds-text-subtle border-surface-border'}`}>HVILE</span>}
            </div>
            <div className="flex space-x-0.5">
              <button disabled={isReadOnly} onClick={() => onToggleRestDay(day)} className={`p-1 rounded-full transition-colors ${isRestDay ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-800 text-slate-500 hover:text-slate-300' : 'bg-surface-hover text-ds-text-subtlest hover:text-ds-text-subtle')} ${isReadOnly ? 'opacity-0' : ''}`}><Bed className="w-3.5 h-3.5" /></button>
              <button disabled={isReadOnly} onClick={() => onAddClick(day)} className={`md:hidden rounded-full p-1 transition-colors ${isExpanded ? 'bg-blue-600 text-white' : (isDark ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400' : 'bg-brand-50 hover:bg-brand-100 text-brand-500')} ${isReadOnly ? 'opacity-0' : ''}`}><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
          {visibleSessions.length === 0 && !isRestDay && !isExpanded && !showDesktopCatalogue && <div className={`text-xs font-medium py-2 text-center border-2 border-dashed rounded-xl ${isDark ? 'text-slate-600 border-slate-800/50' : 'text-ds-text-subtlest border-surface-border'}`}>Ingen pas</div>}
          {visibleSessions.map(s => {
            const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
            const isCancelled = s.status === 'cancelled';
            const isRecurring = s.isRecurring || programKeys.has(`${day}|${(s.name || '').toLowerCase()}|${s.start || ''}`);
            return (
              <div key={s.id} onClick={() => !isReadOnly && onEditSession(day, s)} className={`relative flex items-start p-2 rounded-xl mb-1.5 border shadow-sm transition-all ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-surface-raised border-surface-border')} ${!isReadOnly ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                <div className="flex-1 pl-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 md:min-h-[1.875rem] ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{s.name}</h4>
                    {isRecurring && <Repeat className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />}
                  </div>
                  <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                    <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.start} - {s.end}</span>
                    <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.location}</span>
                  </div>
                  {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{s.cancellationReason ? `: ${s.cancellationReason}` : ''}</div>}
                </div>
              </div>
            );
          })}
          {/* Mobile: Tilføj eget pas outside picker */}
          {isExpanded && !isReadOnly && (
            <div className="md:hidden mt-1.5 mb-0.5">
              <button onClick={() => onManualAdd()} className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-surface-border text-ds-text hover:bg-surface-hover'}`}>
                <PenLine className="w-3.5 h-3.5" /> Tilføj eget pas
              </button>
            </div>
          )}
          {/* Mobile inline picker */}
          {isExpanded && <div className="md:hidden"><InlineCataloguePicker day={day} onAdd={onAddFromCatalogue} onClose={onCollapseDay} /></div>}
          {/* Friend sessions overlay (desktop) */}
          {visibleFriends.length > 0 && visibleFriends.map(friend => {
            const fWeek = friendWeekData[friend]?.[currentWeek] || {};
            const fSessions = (fWeek[day] || []).filter((s: any) => !s.isRestDay);
            if (fSessions.length === 0) return null;
            const colorClass = friendColors[friend] || 'bg-gray-400';
            return (
              <div key={friend} className="mt-1.5">
                <div className={`text-[9px] font-bold uppercase tracking-wide mb-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{friend}</div>
                {fSessions.map((s: any) => (
                  <div key={s.id} className={`relative flex items-start p-1.5 rounded-lg mb-1 border opacity-70 ${isDark ? 'bg-slate-800/50 border-slate-700/30' : 'bg-surface-raised/60 border-surface-border/60'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClass}`}></div>
                    <div className="flex-1 pl-2 min-w-0">
                      <h4 className={`font-semibold text-[10px] leading-tight line-clamp-1 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{s.name}</h4>
                      <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{s.start} - {s.end}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          </div>
          </div>
          {/* Desktop catalogue — always rendered for subgrid row alignment */}
          <div className="hidden md:block">
          {showDesktopCatalogue && (
            <>
              <button onClick={() => onDesktopManual(day)} className={`flex items-center gap-1 mt-2 mb-1 text-[9px] font-medium whitespace-nowrap transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-brand-500 hover:text-brand-600'}`}><Plus className="w-2.5 h-2.5" /> Tilføj eget pas</button>
              <span className={`text-[8px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>Tilføj fra katalog</span>
              {catalogueLoading && <div className={`text-center py-2 text-[9px] ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>...</div>}
              {!catalogueLoading && dayCatalogue.length === 0 && (
                <div className={`text-center py-2 text-[9px] ${isDark ? 'text-slate-700' : 'text-ds-text-subtlest/50'}`}>Ingen hold</div>
              )}
              {dayCatalogue.map(({ cls, schedule }) => {
                const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
                return (
                  <button key={`cat-${cls.id}-${schedule.startTime}`}
                    onClick={() => onAddFromDesktopCatalogue(day, { name: cls.title, category: disciplineToCategory(cls.discipline), start: schedule.startTime, end: schedule.endTime, location: cls.gym, catalogueClassId: cls.id })}
                    className={`w-full text-left p-1.5 rounded-lg border border-dashed mb-1 transition-colors active:scale-[0.97] group ${isDark ? 'bg-slate-800/20 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600' : 'bg-surface-subtle/50 border-surface-border hover:bg-surface-hover'}`}>
                    <div className="flex items-start gap-1">
                      <div className={`w-1 mt-0.5 rounded-full shrink-0 h-3 ${cat.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-bold leading-tight line-clamp-2 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{cls.title}</div>
                        <div className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{schedule.startTime}—{schedule.endTime}</div>
                        <div className={`text-[9px] flex items-center ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}><MapPin className="w-2 h-2 mr-0.5 shrink-0" />{cls.gym}</div>
                      </div>
                      <Plus className={`w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-blue-400' : 'text-brand-500'}`} />
                    </div>
                  </button>
                );
              })}
            </>
          )}
          </div>
        </div>
      );
    })}
    </div>
  </div>
);

export default App;

