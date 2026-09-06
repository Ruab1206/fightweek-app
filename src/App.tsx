/**
 * FIGHTWEEK APP v2.0 — Phase 2: Modular Architecture
 * Thin orchestrator — all logic lives in hooks / components.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronLeft, ChevronRight,
  Plus, X, Calendar, CalendarDays,
  History, LogOut, ClipboardList, MessageSquarePlus, Sun, Moon, Users,
  Search, Menu, ArrowLeft, UserCircle,
} from 'lucide-react';

import { DAYS, resolveFighterKey, isOwnFighterKey } from './config/constants';
import { useRolesConfig } from './hooks/useRolesConfig';
import { getDateForWeekDay, getWeekDateMap, getTodayDayName, getFullWeekDateMap, getDaysInRange, getISOWeekForDate, toLocalISODate } from './utils/dateUtils';

import { useAuth } from './hooks/useAuth';
import { useScheduleData, useMultiWeekData, useMultiWeekTeamData } from './hooks/useScheduleData';
import { useSessionHandlers } from './hooks/useSessionHandlers';
import { computeSeriesOccurrenceDates, recurrenceHorizonEndDate } from './hooks/computeSeriesOccurrences';
import { persistSeriesDeleteAtomically } from './services/seriesDeleteService';
import { persistSeriesSplitAtomically } from './services/seriesSplitService';
import { coordinateDurableSeriesDelete } from './domain/calendar/durableSeriesDeleteFlow';
import { classifyDeleteThisAndFollowingDispatch, describeDurableDeleteOutcome } from './domain/calendar/durableDeleteObservability';
import { evaluateThisAndFollowingEligibility } from './domain/calendar/seriesEditScopeEligibility';
import { coordinateThisAndFollowingEdit, shouldCloseThisAndFollowingModal } from './domain/calendar/seriesSplitFlow';
import { describeSeriesSplitOutcome, describeThisAndFollowingIneligible } from './domain/calendar/seriesSplitObservability';
import { useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { useCatalogue } from './hooks/useCatalogue';
import { useCatalogueFilter } from './hooks/useCatalogueFilter';
import { useEvents } from './hooks/useEvents';
import { useEventMerge } from './hooks/useEventMerge';
import { useInvitations } from './hooks/useInvitations';
import { useInvitationMerge } from './hooks/useInvitationMerge';
import { useScrollController } from './hooks/useScrollController';

import Toast from './components/Toast';
import BrowserBlockScreen from './components/BrowserBlockScreen';
import LoginScreen from './components/LoginScreen';
import SessionModal from './components/SessionModal';
import SearchOverlay from './components/SearchOverlay';
import type { CatalogueClass } from './types/catalogue';
import ConfirmModal from './components/ConfirmModal';
import FeedbackModal from './components/FeedbackModal';
import MonthPicker from './components/MonthPicker';
import TeamSchedule from './components/TeamSchedule';
import SessionDetailSheet from './components/SessionDetailSheet';
import { InvitationDetailSheet } from './components/InvitationDetailSheet';
import { InvitationBell } from './components/InvitationBell';
import type { Invitation } from './types/invitation';
import { useActivityNotes } from './hooks/useActivityNotes';
import { useNotificationsMeta } from './hooks/useNotificationsMeta';
import MobileScrollView from './components/MobileScrollView';
import PersonalSchedule from './components/PersonalSchedule';
import { projectDayCalendarItemsWithLookup } from './domain/calendar/calendarItemKeyLookup';
import type { CalendarItemKey } from './domain/calendar/calendarItemDetail';
import type { CalendarItemSummary } from './domain/calendar/calendarItemSummary';
import BacklogPage from './pages/BacklogPage';
import ErrorBoundary from './components/shared/ErrorBoundary';
import EventsPage from './pages/EventsPage';
import type { EventsPageHandle } from './pages/EventsPage';
import AddScreen from './components/AddScreen';
import type { AddType } from './components/AddScreen';
import TrainingLogPage from './pages/TrainingLogPage';
import { LogTrainingSheet } from './components/LogTrainingSheet';
import { TrainingLogDetailSheet } from './components/TrainingLogDetailSheet';
import { ProjectedCalendarEntryStatusSheet } from './components/ProjectedCalendarEntryStatusSheet';
import { useEventLogs } from './hooks/useEventLogs';
import { useCalendarEntries } from './hooks/useCalendarEntries';
import { useCalendarEntryMerge } from './hooks/useCalendarEntryMerge';
import { useOwnSeriesMaterialization } from './hooks/useOwnSeriesMaterialization';
import {
  isUnplannedTrainingRefreshSettled,
  didUnplannedTrainingRefreshFail,
  isPendingRefreshOwnedByActiveFighter,
  type PendingUnplannedTrainingRefresh,
} from './hooks/unplannedTrainingRefreshStatus';
import {
  isLoggableSelfPostedCalendarOccurrence,
  isEligibleSelfPostedCalendarSession,
  buildSelfPostedCalendarLogContext,
  decideLogTrainingSheetClose,
  toDateTime,
} from './domain/calendar/adapters';
import type { CompletedSelfPostedTrainingInput } from './domain/calendar/selfPostedTraining';
import { buildTrainingLogHistoryItem } from './domain/calendar/trainingLogSnapshotCompatibility';
import { resolveTrainingLogHistoryItem } from './domain/calendar/trainingLogTimingResolution';
import { selectLogsForCalendarOccurrence, selectLogsForNewModelCalendarEntry, classifyOccurrenceLogAssociation, deletionLogSignalFor } from './domain/calendar/logAssociation';
import type { TrainingHistoryItem } from './domain/calendar/types';
import type { TrainingLogAssociationView } from './components/SessionModal';

const App = () => {
  // --- Hooks ---
  const navigate = useNavigate();
  const { userMapping: USER_MAPPING, fighters: FIGHTERS, allMembers, emailForName } = useRolesConfig();
  const {
    user, authLoading, accessDenied, loginError,
    isBrowserBlocked, isMobile,
    activeFighter, setActiveFighter,
    isLocked,
    triggerLoginPopup, triggerLoginRedirect, handleLogout,
  } = useAuth(USER_MAPPING);

  // Slice 2c-3: owner-scoped rolling EventSeries materialization. Keyed ONLY on
  // the authenticated user (never activeFighter*), so viewing another fighter
  // never materializes the viewed calendar. Invisible, non-blocking maintenance.
  useOwnSeriesMaterialization({ user, accessDenied, isBrowserBlocked });

  // #1191: schedule data is keyed by email (a stable id) in Firestore. Resolve the
  // active fighter's display name to their email path key for all data hooks; the
  // UI/merge layer keeps using the display name.
  const activeFighterKey = useMemo(() => resolveFighterKey(activeFighter, emailForName), [activeFighter, emailForName]);

  // Gates the training-log create action — identity match only, not a role check.
  const canCreateLog = isOwnFighterKey(activeFighterKey, user?.email);

  // #1201: people who can be invited to an activity (every member except me),
  // and a helper to show a friendly name for an invitee email.
  const inviteCandidates = useMemo(() => {
    const me = activeFighterKey.toLowerCase();
    return Object.entries(USER_MAPPING)
      .filter(([email]) => email.toLowerCase() !== me)
      .map(([email, info]) => ({ email: email.toLowerCase(), name: info.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'da-DK'));
  }, [USER_MAPPING, activeFighterKey]);

  const nameForEmail = useCallback((email: string) => {
    return USER_MAPPING[email.toLowerCase()]?.name || email;
  }, [USER_MAPPING]);

  const {
    systemWeek, currentWeek, setCurrentWeek,
    scheduleData, setScheduleData,
    teamData,
    saveToDb,
  } = useScheduleData({ user, activeFighter, accessDenied, isBrowserBlocked, fighters: FIGHTERS, emailForName });

  const { toast, showToast, hideToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const { classes: catalogueClasses, loading: catalogueLoading } = useCatalogue();
  const { events: allEvents } = useEvents();
  const { invitations, createInvitation, createSeriesInvitation, respondToInvitation, respondToSeries, cancelInvitation, cancelInvitationForActivity, cancelInvitationsForActivityFrom, cancelSeries, dismissInvitation, removeInvitee } = useInvitations();
  const { getNote, saveNote } = useActivityNotes(activeFighterKey);
  const { lastSeen: notificationsLastSeen, markSeen: markNotificationsSeen, dismissed: notificationsDismissed, dismiss: dismissNotification, dismissAll: dismissAllNotifications } = useNotificationsMeta(activeFighterKey);

  // Phase 3 calendar-originated TrainingLog slice — reuses the SAME hook/
  // coordinator/service/lifecycle as the standalone "Log træning" entry point
  // (TrainingLogPage). `logs`/`status` now also feed the read-side association
  // section below (Next Planned Slice), so this single load serves both
  // purposes — no second Firestore query is added for association. Known
  // inefficiency (an extra one-shot eventLogs read on every mount, no live
  // subscription) is deferred rather than fixed in this slice — see revision
  // report.
  const { addLog: addEventLog, logs: eventLogs, status: eventLogsStatus, refresh: refreshEventLogs } = useEventLogs(activeFighterKey);
  const [logTrainingOpen, setLogTrainingOpen] = useState(false);
  const [logTrainingInitialValues, setLogTrainingInitialValues] = useState<CompletedSelfPostedTrainingInput | null>(null);
  // Phase 3 read-side association slice — the currently opened read-only
  // TrainingLog detail (from the association section), independent of the
  // create flow's state above.
  const [openTrainingLogDetail, setOpenTrainingLogDetail] = useState<TrainingHistoryItem | null>(null);
  // Checkpoint B — the currently opened projected new-model `calendar_entry`
  // (identity only; the classification below resolves it to a log/state).
  // Independent of `openTrainingLogDetail` above (calendar-originated legacy
  // association) and of the create-flow state above.
  const [openProjectedEntry, setOpenProjectedEntry] = useState<{ aggregateId: string; occurrenceId: string } | null>(null);
  // True only between a successful save and the sheet's own onClose() call
  // right after — lets onClose tell "saved, return to calendar" apart from
  // "cancelled, restore the SessionModal for the same session" (Task #5).
  const logTrainingJustSavedRef = useRef(false);

  // When the arranger removes or cancels an activity they invited people to, the
  // matching invitation must be cancelled too so invitees are notified (#1201).
  // Centralised here because removal happens from several places (the edit modal,
  // the detail sheet, single + recurring deletes, and the "Aflyst" toggle).
  const arrangerActivityRemoved = useCallback((
    session: { name?: string; start?: string } | null | undefined,
    dayName: string,
    weekNum: number,
    scope: 'this' | 'future',
  ) => {
    const d = getDateForWeekDay(weekNum, dayName);
    const iso = d ? toLocalISODate(d) : '';
    const title = (session?.name || '').trim();
    if (!iso || !title) return;
    const start = session?.start || '';
    let p: Promise<void>;
    if (scope === 'future') {
      // "Denne og alle fremtidige" on a recurring activity = cancel the whole
      // series (#1213). If this occurrence belongs to a series, batch-cancel by
      // seriesId so every invitee on every occurrence is notified. Legacy/1.14
      // single invites (no seriesId) fall back to the title+start match.
      const me = activeFighterKey.toLowerCase();
      const occ = invitations.find((i) =>
        i.invitedBy.toLowerCase() === me
        && (i.activity.title || '').trim() === title
        && (i.activity.start || '') === start
        && i.activity.date === iso);
      p = occ?.seriesId
        ? cancelSeries(occ.seriesId)
        : cancelInvitationsForActivityFrom(activeFighterKey, title, start, iso);
    } else {
      p = cancelInvitationForActivity(activeFighterKey, title, iso, start);
    }
    p.catch((err) => console.error('[invitation] cancel-on-remove failed:', err));
    // Return the promise so an awaiting caller (the durable delete flow) can
    // detect failure; fire-and-forget callers ignore it and the .catch above
    // still handles rejection (no unhandled rejection).
    return p;
  }, [activeFighterKey, invitations, cancelInvitationForActivity, cancelInvitationsForActivityFrom, cancelSeries]);

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
  const { multiWeekData: rawMultiWeekData, saveWeekToDb, fetchWeekData, seedWeekFromTemplate, persistRecurringSeries, persistSuppressionWithWeek } = useMultiWeekData(user, activeFighterKey, neededWeeks, accessDenied, isBrowserBlocked);

  // Event-session merge (personal + team calendars)
  const {
    multiWeekData: eventMultiWeekData,
    mergedScheduleData: eventScheduleData,
    mergedTeamData: eventTeamData,
  } = useEventMerge(
    allEvents, activeFighter, rawMultiWeekData, scheduleData, teamData, currentWeek,
  );

  // #1201: invitation merge — chained AFTER the event merge so both events and
  // invitations render in the calendar. Keyed by EMAIL (not name) and hides
  // invitations the user has declined.
  const { multiWeekData, mergedScheduleData, mergedTeamData } = useInvitationMerge(
    invitations, activeFighterKey, eventMultiWeekData, eventScheduleData, eventTeamData, currentWeek, emailForName,
  );

  // Checkpoint B — read-only calendar bridge for prospectively created
  // unplanned-training calendar aggregates. Chained AFTER the invitation
  // merge (the narrowest seam: it already produces the final week/day shape
  // desktop, mobile and search all consume). Never writes to legacy weeks —
  // `stripVirtualEntries` also strips `type: 'calendar_entry'` defensively.
  const { entries: calendarEntries, issues: calendarEntryIssues, status: calendarEntriesStatus, refresh: refreshCalendarEntries } = useCalendarEntries(activeFighterKey);
  const finalMultiWeekData = useCalendarEntryMerge(multiWeekData, calendarEntries, calendarEntriesStatus);
  const finalScheduleData = useMemo(
    () => finalMultiWeekData[currentWeek] ?? mergedScheduleData,
    [finalMultiWeekData, currentWeek, mergedScheduleData],
  );

  // MobileScrollView's non-fravær card path: project each visible scroll day's
  // already-merged raw items into CalendarItemSummary[] (reusing
  // projectDayCalendarItems via projectDayCalendarItemsWithLookup — no new
  // dispatch/placement/merging), plus a transient, in-memory
  // CalendarItemKey → {session, dayName, weekNumber} lookup so the existing
  // source-specific routing below can still resolve a click to the exact
  // original raw item. Never persisted, never passed to MobileScrollView.
  const mobileCalendarProjection = useMemo(() => {
    const calendarItemsByDayKey: Record<string, CalendarItemSummary[]> = {};
    const rawByItemKey = new Map<CalendarItemKey, { session: any; dayName: string; weekNumber: number }>();
    for (const scrollDay of scrollDays) {
      const weekData = finalMultiWeekData[scrollDay.weekNumber] || {};
      const sessions = weekData[scrollDay.dayName] || [];
      const { summaries, rawByKey } = projectDayCalendarItemsWithLookup(sessions, {
        weekNumber: scrollDay.weekNumber,
        dateISO: scrollDay.key,
      });
      calendarItemsByDayKey[scrollDay.key] = summaries;
      for (const [itemKey, session] of rawByKey) {
        rawByItemKey.set(itemKey, { session, dayName: scrollDay.dayName, weekNumber: scrollDay.weekNumber });
      }
    }
    return { calendarItemsByDayKey, rawByItemKey };
  }, [scrollDays, finalMultiWeekData]);

  // --- Local UI State ---
  const [view, setView] = useState<'personal' | 'team' | 'events' | 'trainingLog'>('personal');
  const [expandedDay, setExpandedDay] = useState<string | null>(null); // dayName for desktop, "weekNum_dayName" for mobile scroll
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [activeInvitation, setActiveInvitation] = useState<Invitation | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feedbackContext, setFeedbackContext] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const eventsRef = useRef<EventsPageHandle>(null);
  const [initialEventId, setInitialEventId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [visibleFriends, setVisibleFriends] = useState<string[]>([]);
  const [addScreenOpen, setAddScreenOpen] = useState(false);
  const [addScreenType, setAddScreenType] = useState<AddType>('træning');
  const [editingFravær, setEditingFravær] = useState<{ groupId: string; titel: string; beskrivelse: string; startDate: string; startTime: string; endDate: string; endTime: string } | null>(null);
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  const [classInfoSession, setClassInfoSession] = useState<{ cls: CatalogueClass; session: any; day: string; weekNum: number } | null>(null);
  // #1215: open an invitation's activity in its FULL detail sheet (the same
  // SessionDetailSheet you get tapping the class in your own calendar), so the
  // inviter sees complete activity info + the invitee picker with everyone's
  // answers — not the reduced invitation popup. Falls back to the invitation
  // sheet when the activity can't be matched to a catalogue session (e.g. it was
  // removed, or isn't a catalogue class).
  const openInvitationActivity = useCallback((inv: Invitation) => {
    const a = inv.activity;
    const date = a?.date ? new Date(a.date + 'T00:00:00') : null;
    if (date && !Number.isNaN(date.getTime())) {
      const weekNum = getISOWeekForDate(date);
      const dow = date.getDay();
      const dayName = dow === 0 ? 'Søndag' : DAYS[dow - 1];
      const daySessions = (multiWeekData?.[weekNum]?.[dayName] || []) as any[];
      const title = (a.title || '').trim();
      const start = a.start || '';
      const session = daySessions.find((s: any) => s.catalogueClassId && (s.name || '').trim() === title && (s.start || '') === start)
        || daySessions.find((s: any) => s.catalogueClassId && (s.name || '').trim() === title);
      if (session) {
        const cls = catalogueClasses.find((c) => c.id === session.catalogueClassId);
        if (cls) { setClassInfoSession({ cls, session, day: dayName, weekNum }); return; }
      }
    }
    setActiveInvitation(inv);
  }, [multiWeekData, catalogueClasses]);
  // #1206: the friends overlay (Holdkammerater) indexes friendWeekData by the
  // viewed currentWeek, but neededWeeks is a fixed window centered on TODAY and
  // does not move with the desktop week navigation. Past ~systemWeek+weeksAhead
  // friends silently disappeared while own sessions (per-week subscription) kept
  // showing. Always include the currently-viewed week so friends load there too.
  const teamWeeks = useMemo(() => [...new Set([...neededWeeks, currentWeek])], [neededWeeks, currentWeek]);
  const { friendWeekData } = useMultiWeekTeamData(user, visibleFriends, teamWeeks, accessDenied, isBrowserBlocked, emailForName);

  const toggleFriend = useCallback((name: string) => {
    setVisibleFriends(prev => prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]);
  }, []);

  // Stable colors for friends' sessions
  const FRIEND_COLORS: Record<string, string> = {
    Caroline: 'bg-pink-500', San: 'bg-emerald-500', Enea: 'bg-orange-500',
    Anton: 'bg-cyan-500', Jonas: 'bg-violet-500', Karl: 'bg-amber-500',
    Frode: 'bg-lime-500', Frodi: 'bg-rose-500', Rune: 'bg-blue-500',
  };
  const {
    catSearch, setCatSearch, catDiscipline, setCatDiscipline, catGym, setCatGym,
    allDisciplines, allGyms, catalogueByDay,
  } = useCatalogueFilter(catalogueClasses);

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

  // --- Session Handlers (extracted to hook) ---
  const {
    handleSaveSession, handleDeleteSession, handleAddClick,
    handleAddFromCatalogue, handleAddFromDesktopCatalogue, handleManualFromPicker,
    handleAddRecurring, handleFravær, handleDeleteFravær, handleDeleteThisAndFuture,
  } = useSessionHandlers({
    scheduleData, setScheduleData, multiWeekData, currentWeek, systemWeek,
    editingDay, editingWeek, expandedDay, setExpandedDay,
    saveToDb, saveWeekToDb, persistRecurringSeries, persistSuppressionWithWeek, fetchWeekData, showToast, getNote,
    setModalOpen, setEditingWeek, setEditingDay, setEditingSession, setAddScreenOpen,
    seedWeekFromTemplate, fighterKey: activeFighterKey,
  });

  // Scroll orchestration (scroll-to-today, month tracking, initial alignment)
  const { headerMonth, initialScrollDone, scrollToToday, scrollToDate, activeDayRef } = useScrollController({
    todayRef, mobileTodayRef, view, user, currentWeek, setCurrentWeek,
    multiWeekData, scrollDays, weeksBack, setWeeksBack, weeksAhead, setWeeksAhead, searchMode,
  });

  // Phase 3 calendar-originated TrainingLog slice — eligibility (self-posted,
  // not cancelled, not future, plus ownership) for the session currently open
  // in SessionModal. Computed once here so desktop, mobile and SearchOverlay
  // all get the identical answer, since all three converge on the same
  // `editingSession` state. Ownership stays composed through the existing
  // `canCreateLog` gate (App-level identity check + Firestore rules remain
  // the security boundary) — it is never folded into the pure predicate.
  const canLogSelectedSession = useMemo(() => {
    if (!canCreateLog) return false;
    const weekNum = editingWeek || currentWeek;
    const d = getDateForWeekDay(weekNum, editingDay);
    const dateISO = d ? toLocalISODate(d) : '';
    if (!dateISO) return false;
    const occurrenceStartDateTime = toDateTime(dateISO, (editingSession as any)?.start);
    return isLoggableSelfPostedCalendarOccurrence(editingSession as any, {
      occurrenceStartDateTime,
      referenceDateTime: new Date(),
    });
  }, [canCreateLog, editingSession, editingWeek, currentWeek, editingDay]);

  // Phase 3 read-side association slice ("Next Planned Slice") — availability
  // reuses the SAME structural eligibility predicate as calendar-originated
  // logging above, WITHOUT the ownership/future-time gate: an administrator
  // viewing another fighter's calendar may still see that fighter's already-
  // created logs for an eligible self-posted session (existing read privacy
  // model — see firestore.rules eventLogs), even though only the owner can
  // create a new one (`canLogSelectedSession`/`canCreateLog`). No second
  // eligibility implementation — this calls the same
  // `isEligibleSelfPostedCalendarSession` used by `canLogSelectedSession`.
  const showLogAssociationForSelectedSession = useMemo(
    () => isEligibleSelfPostedCalendarSession(editingSession as any),
    [editingSession],
  );

  // Explicit occurrence identity (sessionId + occurrenceDateISO) passed into
  // the pure selector — never inferred from mutable snapshot fields.
  const selectedSessionOccurrenceIdentity = useMemo(() => {
    if (!showLogAssociationForSelectedSession || !editingSession) return null;
    const weekNum = editingWeek || currentWeek;
    const d = getDateForWeekDay(weekNum, editingDay);
    const dateISO = d ? toLocalISODate(d) : '';
    if (!dateISO) return null;
    return { sessionId: String((editingSession as any).id), occurrenceDateISO: dateISO };
  }, [showLogAssociationForSelectedSession, editingSession, editingWeek, currentWeek, editingDay]);

  // Zero, one, or many exact matches — no product meaning is encoded here;
  // `logs`/`eventLogsStatus` come from the SAME `useEventLogs` load already
  // used for the standalone create action above (no new Firestore query).
  const associatedTrainingLogMatches = useMemo(() => {
    if (!selectedSessionOccurrenceIdentity) return [];
    return selectLogsForCalendarOccurrence(eventLogs, selectedSessionOccurrenceIdentity);
  }, [eventLogs, selectedSessionOccurrenceIdentity]);

  // Slice A: pure none/one/conflict/loading/error integrity classification
  // over the exact matches above (see `/docs/fightweek_refactoring_plan.md`).
  // Read-side only — does not provide atomic concurrency protection; two
  // clients that both observe `'none'` before either writes may still create
  // two logs until a separate atomic persistence slice is implemented.
  const trainingLogAssociationClassification = useMemo(
    () => classifyOccurrenceLogAssociation(eventLogsStatus, associatedTrainingLogMatches),
    [eventLogsStatus, associatedTrainingLogMatches],
  );

  // Exact adapted-session timing for the selected occurrence — the settled
  // product rule that the associated occurrence is authoritative for start,
  // end, and duration (over the log's own, possibly ambiguous, snapshot).
  // Same date/start/end fields `sessionToOccurrenceAndEntry` would derive,
  // computed directly since no CalendarEntry/userId context is needed here.
  const selectedSessionAdaptedOccurrenceTiming = useMemo(() => {
    if (!selectedSessionOccurrenceIdentity || !editingSession) return null;
    const dateISO = selectedSessionOccurrenceIdentity.occurrenceDateISO;
    return {
      startDateTime: toDateTime(dateISO, (editingSession as any).start),
      endDateTime: toDateTime(dateISO, (editingSession as any).end),
    };
  }, [selectedSessionOccurrenceIdentity, editingSession]);

  // Presentation-boundary mapping: only the log(s) actually carried by the
  // classification are converted to `TrainingHistoryItem`, for `SessionModal`/
  // `TrainingLogSummary`/`TrainingLogDetailSheet` display. The 'one' state
  // prefers the exact adapted-session timing above; 'conflict' intentionally
  // keeps the plain compatibility reader — a data-integrity conflict must not
  // have timing derived on its behalf.
  const trainingLogAssociationView = useMemo<TrainingLogAssociationView>(() => {
    const classification = trainingLogAssociationClassification;
    if (classification.kind === 'one') return { kind: 'one', log: resolveTrainingLogHistoryItem(classification.log, selectedSessionAdaptedOccurrenceTiming) };
    if (classification.kind === 'conflict') return { kind: 'conflict', logs: classification.logs.map(buildTrainingLogHistoryItem) };
    return classification;
  }, [trainingLogAssociationClassification, selectedSessionAdaptedOccurrenceTiming]);

  // Checkpoint B — exact new-model association + classification for the
  // currently opened projected `calendar_entry` (if any). Reuses the SAME
  // `eventLogs`/`eventLogsStatus` load as the legacy association above — no
  // additional Firestore query is added.
  const projectedEntryMatches = useMemo(() => {
    if (!openProjectedEntry) return [];
    return selectLogsForNewModelCalendarEntry(eventLogs, openProjectedEntry);
  }, [eventLogs, openProjectedEntry]);

  const projectedEntryClassification = useMemo(
    () => classifyOccurrenceLogAssociation(eventLogsStatus, projectedEntryMatches),
    [eventLogsStatus, projectedEntryMatches],
  );

  // Exact aggregate-occurrence timing for the currently opened projected
  // entry \u2014 the associated `NewModelCalendarAggregate` is already loaded via
  // `calendarEntries` (no additional Firestore query). Matched by both
  // `aggregateId` and `occurrenceId`, mirroring `selectLogsForNewModelCalendarEntry`.
  const projectedEntryAggregateOccurrenceTiming = useMemo(() => {
    if (!openProjectedEntry) return null;
    const aggregate = calendarEntries.find(
      (a) => a.id === openProjectedEntry.aggregateId && a.occurrence.id === openProjectedEntry.occurrenceId,
    );
    if (!aggregate) return null;
    return { startDateTime: aggregate.occurrence.startDateTime, endDateTime: aggregate.occurrence.endDateTime };
  }, [calendarEntries, openProjectedEntry]);

  // Intercept a projected `calendar_entry` click BEFORE any legacy session
  // handler — never opens SessionModal, never enters legacy edit/save/delete.
  const handleProjectedCalendarEntryClick = useCallback((session: { aggregateId: string; occurrenceId: string }) => {
    setOpenProjectedEntry({ aggregateId: session.aggregateId, occurrenceId: session.occurrenceId });
  }, []);

  // Existing mobile source-specific open routing, extracted so it can be
  // reached both from a raw click (unchanged) and from the opaque-key
  // resolver below — the branching itself is unchanged from before this
  // slice; it now just runs after key resolution instead of directly in the
  // MobileScrollView onClick handler. Does not change which detail surface
  // opens, catalogue restrictions, or any signup/RSVP/persistence behaviour.
  const openMobileCalendarItem = useCallback((session: any, dayName: string, weekNum: number) => {
    if (session.type === 'calendar_entry') {
      handleProjectedCalendarEntryClick(session);
      return;
    }
    if (session.type === 'invitation' && session.invitationId) {
      const inv = invitations.find(i => i.id === session.invitationId);
      if (inv) { setActiveInvitation(inv); return; }
    }
    if (session.type === 'event' && session.eventId) {
      setInitialEventId(session.eventId);
      setView('events');
      return;
    }
    if (session.catalogueClassId) {
      const cls = catalogueClasses.find(c => c.id === session.catalogueClassId);
      if (cls) { setClassInfoSession({ cls, session, day: dayName, weekNum }); return; }
    }
    setEditingDay(dayName); setEditingSession(session); setEditingWeek(weekNum); setModalOpen(true);
  }, [invitations, catalogueClasses, handleProjectedCalendarEntryClick]);

  // Resolves an opaque CalendarItemKey (emitted by MobileScrollView) back to
  // the exact original raw item via the transient, in-memory lookup built
  // alongside the projection above, then reuses the unchanged routing above.
  // An unknown/stale key (should not happen — same-render-cycle lookup) is a
  // safe no-op, never a fabricated open.
  const handleMobileOpenItem = useCallback((itemKey: CalendarItemKey) => {
    const resolved = mobileCalendarProjection.rawByItemKey.get(itemKey);
    if (!resolved) {
      if (import.meta.env.DEV) console.warn('[MobileScrollView] Unknown or stale CalendarItemKey:', itemKey);
      return;
    }
    openMobileCalendarItem(resolved.session, resolved.dayName, resolved.weekNumber);
  }, [mobileCalendarProjection, openMobileCalendarItem]);

  // Non-blocking notice when the calendar-entries read surfaced structured
  // load issues (Checkpoint B) — valid entries keep rendering regardless.
  useEffect(() => {
    if (calendarEntryIssues.length > 0) {
      showToast('Nogle kalenderposter kunne ikke vises', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEntryIssues.length]);

  // UX fix — TrainingLogPage's atomic creation persists via its OWN
  // `useEventLogs` instance, entirely separate from the `calendarEntries`/
  // `eventLogs` instances App.tsx holds for the calendar. Without an explicit
  // refresh here, a newly created projected entry only appeared after a full
  // page reload. Re-fetches via the EXISTING refresh paths (no second local
  // record, no optimistic write) — the created records are already returned
  // as ids only, not full objects, so plumbing them across two independent
  // hook instances would be a larger change than reusing the established
  // read-refresh. `pendingUnplannedTrainingRefreshRef` distinguishes THIS
  // refresh (which may need to report a save-succeeded-but-refresh-failed
  // notice) from any unrelated status change. It records WHICH fighter the
  // refresh belongs to, because `activeFighterKey` can change before the
  // refresh settles (switching the viewed fighter) — the other fighter's
  // own status changes must never be misread as this refresh's outcome.
  const pendingUnplannedTrainingRefreshRef = useRef<PendingUnplannedTrainingRefresh>(null);

  const handleUnplannedTrainingCreated = useCallback(() => {
    if (!activeFighterKey) return;
    pendingUnplannedTrainingRefreshRef.current = { fighterKey: activeFighterKey };
    refreshCalendarEntries();
    refreshEventLogs();
  }, [activeFighterKey, refreshCalendarEntries, refreshEventLogs]);

  useEffect(() => {
    // Runs on every activeFighterKey change too, so a fighter switch
    // invalidates stale tracking immediately rather than waiting for the
    // new fighter's statuses to happen to settle.
    if (!isPendingRefreshOwnedByActiveFighter(pendingUnplannedTrainingRefreshRef.current, activeFighterKey)) {
      pendingUnplannedTrainingRefreshRef.current = null;
      return;
    }
    if (!isUnplannedTrainingRefreshSettled(calendarEntriesStatus, eventLogsStatus)) return;
    pendingUnplannedTrainingRefreshRef.current = null;
    // The training itself was already saved successfully (TrainingLogPage's
    // own success toast already fired) — a failed refresh here must never be
    // reported as a failed save, must never retry creation automatically,
    // and must not encourage creating a duplicate.
    if (didUnplannedTrainingRefreshFail(calendarEntriesStatus, eventLogsStatus)) {
      showToast('Træningen er gemt, men kalenderen kunne ikke opdateres med det samme. Skift visning eller genindlæs for at se den.', 'error');
    }
  }, [activeFighterKey, calendarEntriesStatus, eventLogsStatus, showToast]);

  // Final calendar-log creation eligibility: all existing eligibility
  // requirements (ownership, not-future, structural — `canLogSelectedSession`)
  // PLUS the Slice A integrity classification. SessionModal itself must not
  // reconstruct this rule from a raw log count.
  const canLogSelectedSessionFinal = canLogSelectedSession && trainingLogAssociationClassification.kind === 'none';

  // Parent-owned: verify eligibility/ownership, supply explicit occurrence
  // context, invoke the pure adapter, then open the existing log form with
  // initial values. SessionModal itself only notifies that logging was
  // requested — no conversion/persistence/ownership logic lives there.
  // `editingSession`/`editingDay`/`editingWeek` are deliberately left intact
  // so the SessionModal can be restored unchanged if the fighter cancels
  // instead of saving (Task #5 cancel-return behavior).
  const handleLogTrainingRequested = useCallback(() => {
    if (!editingSession || !canLogSelectedSessionFinal) return;
    const weekNum = editingWeek || currentWeek;
    const d = getDateForWeekDay(weekNum, editingDay);
    const dateISO = d ? toLocalISODate(d) : '';
    if (!dateISO) {
      showToast('Kunne ikke bestemme træningens dato', 'error');
      return;
    }
    try {
      const prefill = buildSelfPostedCalendarLogContext(editingSession as any, {
        dateISO,
        userId: activeFighterKey,
      });
      setLogTrainingInitialValues(prefill);
      setModalOpen(false);
      setLogTrainingOpen(true);
    } catch (err) {
      console.error('[log-training] failed to build calendar log context:', err);
      showToast('Kunne ikke forberede træningsloggen', 'error');
    }
  }, [editingSession, canLogSelectedSessionFinal, editingWeek, currentWeek, editingDay, activeFighterKey, showToast]);


  // at an already-visible activity never jolts the list out from under you; on
  // desktop we only navigate when the activity is in a different week than the
  // one shown. Repositioning is instant — it happens underneath the closing
  // sheet, so the activity is simply "there" when the sheet slides away, rather
  // than a long disorienting scroll afterwards.
  const anchorOnDay = useCallback((date: Date | null | undefined) => {
    if (!date || Number.isNaN(date.getTime())) return;
    if (window.innerWidth >= 768) {
      if (getISOWeekForDate(date) !== currentWeek) scrollToDate(date);
      return;
    }
    const key = date.toISOString().slice(0, 10);
    const el = document.getElementById(`day-${key}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      // Already visible (intersects the area below the sticky header) → leave
      // the scroll position alone so the user keeps their place.
      if (rect.bottom > 100 && rect.top < window.innerHeight - 80) return;
    }
    scrollToDate(date);
  }, [currentWeek, scrollToDate]);

  // #1213: invite teammates to a whole RECURRING activity in one action. Fans out
  // one occurrence-doc per date across the FULL recurrence horizon (the same
  // horizon the arranger's own recurring session uses), so the invited series and
  // the session stay paired and the series can't run away. Shared by every invite
  // surface (Add→Hold, the edit modal, the detail sheet). `anchorTo` optionally
  // scrolls the arranger to the first occurrence after inviting.
  const inviteSeries = useCallback(async (
    session: { name?: string; category?: string; start?: string; end?: string; location?: string },
    day: string,
    startDate: Date,
    recurrence: { interval: number; endDate: string | null },
    inviteeEmails: string[],
    anchor: boolean = false,
  ): Promise<void> => {
    if (recurrence.interval === 0 || inviteeEmails.length === 0) return;
    const startWeek = getISOWeekForDate(startDate);
    const firstDate = getDateForWeekDay(startWeek, day);
    const firstIso = firstDate ? toLocalISODate(firstDate) : '';
    if (!firstIso) { showToast('Kunne ikke bestemme seriedatoerne', 'error'); return; }
    const todayIso = toLocalISODate(new Date());
    const occ = computeSeriesOccurrenceDates({
      startDate: firstIso,
      intervalWeeks: recurrence.interval,
      endDate: recurrence.endDate,
      horizonEndDate: recurrenceHorizonEndDate(),
    }).filter((d) => d >= todayIso);
    if (occ.length === 0) return;
    try {
      await createSeriesInvitation(
        {
          title: session.name || '',
          category: session.category || '',
          start: session.start || '',
          end: session.end || '',
          location: session.location || '',
        },
        occ,
        activeFighterKey,
        activeFighter,
        inviteeEmails,
      );
      showToast(`${inviteeEmails.length} ${inviteeEmails.length === 1 ? 'person' : 'personer'} inviteret til hele serien`, 'success');
      if (anchor && firstDate) anchorOnDay(firstDate);
    } catch (err) {
      console.error('[invitation] series create failed:', err);
      showToast('Kunne ikke sende serie-invitationen — prøv igen', 'error');
    }
  }, [activeFighterKey, activeFighter, createSeriesInvitation, showToast, anchorOnDay]);

  useEffect(() => {
    if (searchMode && view !== 'events') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
        // Force iOS WebKit to recalculate scrollable area after overflow restore
        requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
      };
    }
  }, [searchMode, view]);

  // --- Guard screens ---
  if (isBrowserBlocked) return <BrowserBlockScreen />;
  if (authLoading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-surface-subtle text-ds-text-subtlest'}`}>Loader...</div>;
  if (!user) return <LoginScreen onLoginPopup={triggerLoginPopup} onLoginRedirect={triggerLoginRedirect} isMobile={isMobile} error={loginError} />;
  if (accessDenied) return <div className={`min-h-screen flex items-center justify-center flex-col gap-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-surface-subtle text-ds-text'}`}><span>Ingen adgang</span><button onClick={handleLogout} className={`px-4 py-2 rounded ${isDark ? 'bg-slate-700 text-white' : 'bg-brand-500 text-white'}`}>Log ud</button></div>;

  const isPastWeek = view === 'personal' && currentWeek < systemWeek;
  // #1184: past training weeks are now fully editable (open / edit / delete / add).
  // A3 (#1187) guards the save path so editing an unloaded past week can't wipe it.
  // We keep a "Tidligere uge / Historik" label (isPastWeek) so the user still knows
  // they are looking at the past, but no longer lock the UI.
  const isReadOnly = false;
  const isAdmin = ['admin', 'coach'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);
  const weekDates = getWeekDateMap(currentWeek);
  const fullWeekDates = getFullWeekDateMap(currentWeek);
  const todayDayName = getTodayDayName();
  const isCurrentWeek = currentWeek === systemWeek;
  const monthLabel = headerMonth;

  // --- Render ---
  return (
    <div className={`min-h-dvh font-sans selection:bg-blue-500/30 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text'}`}>
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
                placeholder={view === 'events' ? "S\u00F8g i events\u2026" : "S\u00F8g i pas\u2026"}
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
            {view === 'events' ? (
              <h1 className={`font-semibold text-sm leading-tight capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>Events</h1>
            ) : (
            <button onClick={() => { const parts = headerMonth.split(' '); const mIdx = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'].indexOf(parts[0]); setPickerMonth(new Date(parseInt(parts[1]) || new Date().getFullYear(), mIdx >= 0 ? mIdx : new Date().getMonth(), 1)); setMonthPickerOpen(true); }} className="text-left">
              <h1 className={`font-semibold text-sm leading-tight flex items-center gap-1 capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>
                {monthLabel}
                <ChevronDown className={`w-4 h-4 transition-transform ${monthPickerOpen ? 'rotate-180' : ''}`} />
              </h1>
            </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSearchMode(true)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title="Søg">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={() => { if (view === 'events') { eventsRef.current?.scrollToNext('smooth'); } else { setView('personal'); setCurrentWeek(systemWeek); scrollToToday('smooth'); } }} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title={view === 'events' ? 'Gå til næste event' : 'Gå til i dag'}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <path d="M16 22l5-5" />
                <path d="M16 22v-5h5" />
                <text x="12" y="18.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">{new Date().getDate()}</text>
              </svg>
            </button>
            <InvitationBell
              invitations={invitations}
              myEmail={activeFighterKey}
              nameForEmail={nameForEmail}
              lastSeen={notificationsLastSeen}
              onMarkSeen={markNotificationsSeen}
              onOpenInvitation={(inv) => setActiveInvitation(inv)}
              onOpenActivity={openInvitationActivity}
              dismissed={notificationsDismissed}
              onDismiss={dismissNotification}
              onDismissAll={dismissAllNotifications}
            />
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors active:scale-95 ${menuOpen ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-surface-hover text-ds-text hover:bg-surface-raised')}`}>
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
                    {/* Admin-only user switch (#1165: now lists ALL members — fighters,
                        coaches, and the admin themselves — not just fighters). */}
                    {isAdmin && !isLocked && (
                      <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                        <p className={`text-[10px] font-medium uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Vis som bruger</p>
                        <select value={activeFighter} onChange={(e) => { setActiveFighter(e.target.value); setMenuOpen(false); }} className={`w-full px-2 py-1.5 rounded-lg border text-sm font-bold ${isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-surface-subtle text-ds-text border-surface-border'}`}>
                          {allMembers.map(m => <option key={m} value={m} className="bg-white text-black dark:bg-slate-800 dark:text-white">{m}</option>)}
                        </select>
                      </div>
                    )}
                    {/* Actions */}
                    <div className={`py-1 ${isAdmin ? `border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}` : ''}`}>
                      <button onClick={() => { toggleTheme(); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-ds-text hover:bg-surface-hover'}`}>
                        {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
                        <span className="font-medium">{isDark ? 'Lys tilstand' : 'Mørk tilstand'}</span>
                      </button>
                      <button onClick={() => { navigate('/profile'); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-ds-text hover:bg-surface-hover'}`}>
                        <UserCircle className="w-4 h-4" /><span className="font-medium">Profilside</span>
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
      {searchMode && view !== 'events' && <SearchOverlay searchQuery={searchQuery} scrollDays={scrollDays} multiWeekData={finalMultiWeekData} isDark={isDark}
        onOpenSession={(d, s, w) => {
          if ((s as any).type === 'calendar_entry') { handleProjectedCalendarEntryClick(s as any); return; }
          // Catalogue-linked sessions open the catalogue detail sheet — the same
          // routing used by the desktop and mobile entry points — instead of
          // SessionModal (which is self-posted only and would otherwise show a
          // recurrence scope prompt it cannot honour for catalogue sessions).
          if ((s as any).catalogueClassId) {
            const cls = catalogueClasses.find(c => c.id === (s as any).catalogueClassId);
            if (cls) { setClassInfoSession({ cls, session: s, day: d, weekNum: w }); return; }
          }
          setEditingDay(d); setEditingSession(s); setEditingWeek(w); setModalOpen(true);
        }}
        onOpenEvent={(id) => { setSearchMode(false); setSearchQuery(''); setInitialEventId(id); setView('events'); }} />}

      {/* MONTH PICKER */}
      {monthPickerOpen && <MonthPicker pickerMonth={pickerMonth} setPickerMonth={setPickerMonth} isDark={isDark}
        onClose={() => setMonthPickerOpen(false)} onSelectDate={(date) => { setMonthPickerOpen(false); setView('personal'); scrollToDate(date); }} />}

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
          <button onClick={() => { setView('personal'); setDrawerOpen(false); setTimeout(() => scrollToToday('instant'), 100); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'personal' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <Calendar className="w-4 h-4" /><span className="font-medium">Kalender</span>
          </button>
          <button onClick={() => { setView('team'); setDrawerOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'team' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <Users className="w-4 h-4" /><span className="font-medium">Teamet</span>
          </button>
          <button onClick={() => { setView('events'); setDrawerOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'events' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <CalendarDays className="w-4 h-4" /><span className="font-medium">Events</span>
          </button>
          <button onClick={() => { setView('trainingLog'); setDrawerOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'trainingLog' ? (isDark ? 'text-blue-400 bg-blue-950/30' : 'text-blue-600 bg-blue-50') : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-ds-text hover:bg-surface-hover')}`}>
            <History className="w-4 h-4" /><span className="font-medium">Træningslog</span>
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

      {/* MAIN CONTENT — responsive width */}
      <div className="mx-auto relative pt-4 min-h-[85dvh]">
        {/* Desktop: Week navigation */}
        {view === 'personal' && (
          <div className="hidden md:block mx-4 mb-4 space-y-3">
            <div className={`flex items-center justify-between p-2 rounded-xl border shadow-md ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
              <button onClick={() => setCurrentWeek(currentWeek - 1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'} ${currentWeek <= 1 ? 'invisible' : ''}`}><ChevronLeft className="w-6 h-6" /></button>
              <div className="text-center">
                <span className={`text-[10px] uppercase tracking-widest font-bold ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>{currentWeek === systemWeek ? "Aktuel Uge" : currentWeek < systemWeek ? "Tidligere Uge" : "Næste Uge"}</span>
                <div className={`font-bold text-xl ${isDark ? 'text-white' : 'text-ds-text'}`}>Uge {getISOWeekForDate(getDateForWeekDay(currentWeek, 'Torsdag')!)}</div>
              </div>
              <button onClick={() => setCurrentWeek(currentWeek + 1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronRight className="w-6 h-6" /></button>
            </div>
            {isPastWeek && (
              <div className="flex items-center px-1">
                <span className={`flex items-center text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}><History className="w-3 h-3 mr-1" /> Historik</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW: Personal / Team / Events */}
        {view === 'events' ? (
          <EventsPage ref={eventsRef} isDark={isDark} fighterName={activeFighter} isAdmin={isAdmin} userEmail={user?.email || ''} searchQuery={searchQuery} searchMode={searchMode} initialEventId={initialEventId} onClearInitialEvent={() => setInitialEventId(null)} getNote={getNote} saveNote={saveNote} />
        ) : view === 'team' ? (
          <TeamSchedule days={DAYS} teamData={mergedTeamData} currentWeek={currentWeek} isDark={isDark} />
        ) : view === 'trainingLog' ? (
          <TrainingLogPage
            fighterKey={activeFighterKey}
            canCreateLog={canCreateLog}
            onSuccess={(message) => showToast(message, 'success')}
            onError={(message) => showToast(message, 'error')}
            onUnplannedTrainingCreated={handleUnplannedTrainingCreated}
          />
        ) : (
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
                multiWeekData={finalMultiWeekData}
                calendarItemsByDayKey={mobileCalendarProjection.calendarItemsByDayKey}
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
                onOpenItem={handleMobileOpenItem}
                todayRef={mobileTodayRef}
                onLoadMorePast={loadMorePast}
                onLoadMoreFuture={loadMoreFuture}
                initialScrollDone={initialScrollDone}
                visibleFriends={visibleFriends}
                friendWeekData={friendWeekData}
                friendColors={FRIEND_COLORS}
              />
            </div>

            {/* Desktop: 7-column week grid */}
            <div className="hidden md:block">
              <PersonalSchedule
                days={DAYS}
                scheduleData={finalScheduleData}
                weekDates={weekDates}
                fullWeekDates={fullWeekDates}
                isReadOnly={isReadOnly}
                isDark={isDark}
                expandedDay={expandedDay}
                onAddClick={handleAddClick}
                onEditSession={(day, session) => {
                  if (session.type === 'calendar_entry') {
                    handleProjectedCalendarEntryClick(session);
                    return;
                  }
                  if (session.type === 'invitation' && session.invitationId) {
                    const inv = invitations.find(i => i.id === session.invitationId);
                    if (inv) { setActiveInvitation(inv); return; }
                  }
                  if (session.type === 'event' && session.eventId) {
                    setInitialEventId(session.eventId);
                    setView('events');
                    return;
                  }
                  setEditingDay(day); setEditingSession(session); setModalOpen(true);
                }}
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
              />
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {/* Desktop FAB — floating blue + button */}
      {view === 'personal' && !isReadOnly && (
        <button onClick={() => setShowCatalogue(!showCatalogue)}
          className={`hidden md:flex fixed bottom-8 right-8 z-20 w-14 h-14 rounded-full items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${showCatalogue ? 'bg-slate-500 hover:bg-slate-600 rotate-45' : 'bg-blue-600 hover:bg-blue-700'}`}>
          <Plus className="w-7 h-7 text-white" />
        </button>
      )}
      {/* Mobile FAB — floating blue + button */}
      {view === 'personal' && !isReadOnly && (
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
          onClose={() => { const d = getDateForWeekDay(classInfoSession.weekNum, classInfoSession.day); setClassInfoSession(null); anchorOnDay(d); }}
          onArrangerActivityRemoved={arrangerActivityRemoved}
          getNote={getNote}
          saveNote={saveNote}
          inviteCandidates={inviteCandidates}
          existingInvitees={(() => {
            // Anyone already invited by me to this Hold (same title + day + start),
            // so the picker shows their response instead of a fresh toggle (#1214).
            const { session, day, weekNum } = classInfoSession;
            const d = getDateForWeekDay(weekNum, day);
            const iso = d ? toLocalISODate(d) : '';
            const me = activeFighterKey.toLowerCase();
            const name = (session?.name || classInfoSession.cls.title || '').trim();
            const start = session?.start || '';
            const merged: Record<string, import('./types/invitation').InvitationResponse> = {};
            if (iso && name) {
              for (const inv of invitations) {
                if (inv.invitedBy.toLowerCase() !== me) continue;
                if (inv.activity.date !== iso) continue;
                if ((inv.activity.title || '').trim() !== name) continue;
                if ((inv.activity.start || '') !== start) continue;
                for (const [email, resp] of Object.entries(inv.invitees)) merged[email] = resp;
              }
            }
            return merged;
          })()}
          onInvite={async (inviteeEmails) => {
            const { cls, session, day, weekNum } = classInfoSession;
            const d = getDateForWeekDay(weekNum, day);
            const iso = d ? toLocalISODate(d) : '';
            if (!iso) { showToast('Kunne ikke bestemme datoen for invitationen', 'error'); return; }
            try {
              await createInvitation(
                {
                  title: session?.name || cls.title,
                  category: session?.category || '',
                  date: iso,
                  start: session?.start || '',
                  end: session?.end || '',
                  location: cls.gym || session?.location || '',
                },
                activeFighterKey,
                activeFighter,
                inviteeEmails,
              );
              showToast(`${inviteeEmails.length} ${inviteeEmails.length === 1 ? 'person inviteret' : 'personer inviteret'}`, 'success');
            } catch (err) {
              console.error('[invitation] create failed:', err);
              showToast('Kunne ikke sende invitationen — prøv igen', 'error');
            }
          }}
          onSeriesInvite={async (session, dayName, startDate, recurrence, inviteeEmails) => {
            await inviteSeries(session, dayName, startDate, recurrence, inviteeEmails, true);
          }}
          onUninvite={async (email) => {
            const { session, day, weekNum } = classInfoSession;
            const d = getDateForWeekDay(weekNum, day);
            const iso = d ? toLocalISODate(d) : '';
            const me = activeFighterKey.toLowerCase();
            const name = (session?.name || classInfoSession.cls.title || '').trim();
            const start = session?.start || '';
            const inv = invitations.find(i =>
              i.invitedBy.toLowerCase() === me
              && i.activity.date === iso
              && (i.activity.title || '').trim() === name
              && (i.activity.start || '') === start,
            );
            if (!inv) return;
            try {
              await removeInvitee(inv.id, email);
              showToast(`${nameForEmail(email)} er ikke længere inviteret`, 'success');
            } catch (err) {
              console.error('[invitation] uninvite failed:', err);
              showToast('Kunne ikke fjerne invitationen', 'error');
            }
          }}
        />
      )}

      {/* Invitation detail / RSVP sheet (#1201) */}
      {activeInvitation && (
        <InvitationDetailSheet
          invitation={activeInvitation}
          myEmail={activeFighterKey}
          nameForEmail={nameForEmail}
          onRespond={async (response) => {
            const id = activeInvitation.id;
            const seriesId = activeInvitation.seriesId;
            try {
              // #1213: a series invitation is answered once for the WHOLE series;
              // a standalone invite answers just its occurrence.
              if (seriesId) await respondToSeries(seriesId, activeFighterKey, response);
              else await respondToInvitation(id, activeFighterKey, response);
              setActiveInvitation(null);
              showToast(
                response === 'declined'
                  ? (seriesId ? 'Du har afslået hele serien' : 'Du har afslået')
                  : (seriesId ? 'Dit svar er gemt for hele serien' : 'Dit svar er gemt'),
                'success',
              );
            } catch (err) {
              console.error('[invitation] respond failed:', err);
              showToast('Kunne ikke gemme dit svar — prøv igen', 'error');
            }
          }}
          onOptOutOccurrence={async () => {
            // #1213: decline just THIS date of the series, leaving the rest intact.
            const id = activeInvitation.id;
            try {
              await respondToInvitation(id, activeFighterKey, 'declined');
              setActiveInvitation(null);
              showToast('Du er meldt fra denne dag', 'success');
            } catch (err) {
              console.error('[invitation] opt-out occurrence failed:', err);
              showToast('Kunne ikke melde fra — prøv igen', 'error');
            }
          }}
          onCancel={async () => {
            const id = activeInvitation.id;
            try {
              await cancelInvitation(id);
              setActiveInvitation(null);
              showToast('Invitation aflyst', 'success');
            } catch (err) {
              console.error('[invitation] cancel failed:', err);
              showToast('Kunne ikke aflyse invitationen', 'error');
            }
          }}
          onDismiss={async () => {
            const id = activeInvitation.id;
            try {
              await dismissInvitation(id, activeFighterKey);
              setActiveInvitation(null);
              showToast('Fjernet fra din kalender', 'success');
            } catch (err) {
              console.error('[invitation] dismiss failed:', err);
              showToast('Kunne ikke fjerne invitationen', 'error');
            }
          }}
          onClose={() => { const iso = activeInvitation.activity?.date; setActiveInvitation(null); if (iso) anchorOnDay(new Date(iso + 'T00:00:00')); }}
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
            isDark={isDark}
            editingFravær={editingFravær}
            onAddFromCatalogue={(session, day, weekNum) => { handleAddFromCatalogue(session, day, weekNum); setAddScreenOpen(false); anchorOnDay(getDateForWeekDay(weekNum, day)); }}
            onAddRecurring={handleAddRecurring}
            onManualAdd={(day, weekNum) => { handleManualFromPicker(day, weekNum); setAddScreenOpen(false); anchorOnDay(getDateForWeekDay(weekNum, day)); }}
            inviteCandidates={inviteCandidates}
            onInviteToActivity={async (session, day, weekNum, inviteeEmails) => {
              const d = getDateForWeekDay(weekNum, day);
              const iso = d ? toLocalISODate(d) : '';
              if (!iso) { showToast('Kunne ikke bestemme datoen for invitationen', 'error'); return; }
              try {
                await createInvitation(
                  {
                    title: session.name,
                    category: session.category || '',
                    date: iso,
                    start: session.start || '',
                    end: session.end || '',
                    location: session.location || '',
                  },
                  activeFighterKey,
                  activeFighter,
                  inviteeEmails,
                );
                showToast(`${inviteeEmails.length} ${inviteeEmails.length === 1 ? 'person inviteret' : 'personer inviteret'}`, 'success');
              } catch (err) {
                console.error('[invitation] create-on-add failed:', err);
                showToast('Kunne ikke sende invitationen — prøv igen', 'error');
              }
            }}
            onSeriesInvite={async (session, day, startDate, recurrence, inviteeEmails) => {
              await inviteSeries(session, day, startDate, recurrence, inviteeEmails, true);
            }}
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
        onClose={() => { const d = getDateForWeekDay(editingWeek || currentWeek, editingDay); setModalOpen(false); setEditingWeek(null); anchorOnDay(d); }}
        onSave={(form) => {
          // #1216: anchor on the activity's day once the save closes the modal.
          const d = getDateForWeekDay(editingWeek || currentWeek, editingDay);
          // Marking an activity "Aflyst" (cancelled) via the modal should also
          // call off any invitation I arranged, so invitees are notified (#1201).
          if (form?.status === 'cancelled') {
            arrangerActivityRemoved(form, editingDay, editingWeek || currentWeek, 'this');
          }
          handleSaveSession(form);
          anchorOnDay(d);
        }}
        onDelete={async (id) => {
          // If I arranged an invitation for this activity, cancel it too so
          // invitees are notified it was called off (Outlook-style) instead of
          // it silently lingering on their calendars (#1201).
          arrangerActivityRemoved(editingSession, editingDay, editingWeek || currentWeek, 'this');
          // Slice 2a: protect a logged occurrence from hard-delete using the
          // independent eventLogs store (already in memory), keyed by exact
          // sessionId + occurrenceDateISO. Computed here (not the eligibility-
          // gated section state) so a cancelled-but-logged occurrence is still
          // protected; an unresolvable date or unread log store fails closed.
          const delWeek = editingWeek || currentWeek;
          const delDate = getDateForWeekDay(delWeek, editingDay);
          const delISO = delDate ? toLocalISODate(delDate) : '';
          const delMatches = (editingSession && (editingSession as any).id != null && delISO)
            ? selectLogsForCalendarOccurrence(eventLogs, { sessionId: String((editingSession as any).id), occurrenceDateISO: delISO })
            : [];
          const trainingLogSignal = delISO
            ? deletionLogSignalFor(classifyOccurrenceLogAssociation(eventLogsStatus, delMatches))
            : 'indeterminate';
          handleDeleteSession(id, trainingLogSignal);
        }}
        onDeleteThisAndFuture={async (dayName, name, start, fromWeek) => {
          const sel = editingSession as any;
          // Durable self-posted recurring series (seriesId, not catalogue-linked)
          // route to the seriesId-based durable delete: it ENDS the EventSeries
          // definition before the selected date so the materializer cannot
          // regenerate the removed range. Legacy no-seriesId occurrences keep
          // the unchanged tuple-based handler below. Extracted to a named,
          // independently-testable classifier — see durableDeleteObservability.
          const dispatch = classifyDeleteThisAndFollowingDispatch(sel);
          setModalOpen(false);
          setEditingWeek(null);
          if (dispatch === 'durable') {
            const selDate = getDateForWeekDay(fromWeek, dayName);
            const selISO = selDate ? toLocalISODate(selDate) : '';
            // Ordering: run the durable delete FIRST; cancel invitations only
            // after it succeeds; surface a distinct partial-side-effect state and
            // never retry the destructive delete. Deletion marks every affected
            // occurrence as an invisible isDeleted record (no protection lookup).
            const outcome = await coordinateDurableSeriesDelete({
              persist: () => persistSeriesDeleteAtomically({
                fighterKey: activeFighterKey,
                selected: { id: String(sel.id), seriesId: sel.seriesId, occurrenceDateISO: selISO, isSeriesException: sel.isSeriesException, status: sel.status },
              }),
              cancelInvitations: () => arrangerActivityRemoved({ name, start }, dayName, fromWeek, 'future') ?? Promise.resolve(),
            });
            const feedback = describeDurableDeleteOutcome(outcome, { name, seriesId: sel?.seriesId });
            // Structured, no-PII diagnostic — lets a controlled verification
            // session distinguish dispatch/outcome from the browser console
            // without inspecting production data.
            console.info('[durable-delete]', feedback.diagnostic);
            showToast(feedback.toastMessage, feedback.toastType);
            return;
          }
          // Legacy (no durable seriesId) path unchanged.
          console.info('[durable-delete]', { path: 'legacy', seriesId: sel?.seriesId, catalogueClassId: !!sel?.catalogueClassId });
          showToast(`${name} fjernet`, 'success');
          arrangerActivityRemoved({ name, start }, dayName, fromWeek, 'future');
          handleDeleteThisAndFuture(dayName, name, start, fromWeek);
        }}
        onRecurrenceSave={(session, dayName, startDate, recurrence) => {
          handleAddRecurring(session, dayName, startDate, recurrence);
          setModalOpen(false);
          setEditingWeek(null);
          // #1213: land the arranger on the first occurrence, like a single add does.
          anchorOnDay(startDate);
        }}
        onRecurringEditScope={async (scope, original, submitted, dayName, startDate) => {
          if ((original as any)?.catalogueClassId || (submitted as any)?.catalogueClassId) {
            showToast('Denne træning kan ikke ændres her', 'error');
            return;
          }
          const fromWeek = editingWeek || currentWeek;
          if (scope === 'this_and_following') {
            const sel = original as any;
            const selISO = toLocalISODate(startDate);
            // Defense-in-depth only — SessionModal's own button gating already
            // uses this exact same shared contract, so a historical/legacy
            // dispatch should never reach here. Never re-derives the rule.
            const eligibility = evaluateThisAndFollowingEligibility({
              isRecurring: true,
              seriesId: sel?.seriesId,
              occurrenceDateISO: selISO,
              todayISO: toLocalISODate(new Date()),
            });
            // Modal-lifecycle contract: the edit flow may close ONLY after a
            // CONFIRMED persistence success (shouldCloseThisAndFollowingModal).
            // Every other outcome — ineligible, planner rejection, stale
            // anchor, transaction failure, or an unexpected exception — leaves
            // modalOpen/editingWeek/editingSession untouched, so the modal
            // stays open with the user's submitted values intact; it never
            // reports success and never silently discards the attempt.
            try {
              // coordinateThisAndFollowingEdit guarantees persistSeriesSplitAtomically
              // runs at most once, and only when eligible. Notes/TrainingLogs/
              // invitations are never read or written by the split itself —
              // they stay attached/unchanged via preserved occurrence id+date.
              const outcome = await coordinateThisAndFollowingEdit({
                eligibility,
                persist: () => persistSeriesSplitAtomically({
                  fighterKey: activeFighterKey,
                  selected: { id: String(sel.id), seriesId: sel.seriesId, occurrenceDateISO: selISO, isSeriesException: sel.isSeriesException, status: sel.status, isDeleted: sel.isDeleted },
                  edited: { title: submitted.name, discipline: submitted.category, location: submitted.location, startTime: submitted.start, endTime: submitted.end },
                }),
              });
              if (outcome.kind === 'ineligible') {
                const feedback = describeThisAndFollowingIneligible(outcome.reason);
                console.info('[series-split]', feedback.diagnostic);
                showToast(feedback.toastMessage, feedback.toastType);
                return;
              }
              const feedback = describeSeriesSplitOutcome(outcome.result, { name: submitted.name });
              console.info('[series-split]', feedback.diagnostic);
              showToast(feedback.toastMessage, feedback.toastType);
              // Close only after the transaction is confirmed committed. The
              // affected week documents refresh via the existing onSnapshot
              // subscriptions (useMultiWeekData) — no separate refetch needed.
              if (shouldCloseThisAndFollowingModal(outcome)) {
                setModalOpen(false);
                setEditingWeek(null);
                anchorOnDay(startDate);
              }
            } catch (err) {
              console.error('[edit-scope] this-and-following split failed:', err);
              showToast('Kunne ikke opdatere den gentagende træning — prøv igen', 'error');
            }
            return;
          }
          try {
            if (submitted?.status === 'cancelled' && original?.status !== 'cancelled') {
              arrangerActivityRemoved(submitted, dayName, fromWeek, 'this');
            }
            await handleSaveSession(submitted);
            anchorOnDay(startDate);
          } catch (err) {
            console.error('[edit-scope] this-occurrence save failed:', err);
            showToast('Kunne ikke gemme ændringen — prøv igen', 'error');
          }
        }}
        onFeedback={(ctx) => setFeedbackContext(ctx)}
        getNote={getNote}
        saveNote={saveNote}
        canLogTraining={canLogSelectedSessionFinal}
        onLogTraining={handleLogTrainingRequested}
        trainingLogAssociation={showLogAssociationForSelectedSession ? trainingLogAssociationView : undefined}
        onOpenTrainingLogDetail={setOpenTrainingLogDetail}
        inviteCandidates={inviteCandidates}
        existingInvitees={(() => {
          // Surface anyone already invited to *this* activity (same title + day)
          // by me, so the picker shows their current response instead of a toggle.
          const wk = editingWeek || currentWeek;
          const d = getDateForWeekDay(wk, editingDay);
          const iso = d ? toLocalISODate(d) : '';
          const me = activeFighterKey.toLowerCase();
          const name = (editingSession?.name || '').trim();
          const merged: Record<string, import('./types/invitation').InvitationResponse> = {};
          if (iso && name) {
            for (const inv of invitations) {
              if (inv.invitedBy.toLowerCase() !== me) continue;
              if (inv.activity.date !== iso) continue;
              if ((inv.activity.title || '').trim() !== name) continue;
              for (const [email, resp] of Object.entries(inv.invitees)) merged[email] = resp;
            }
          }
          return merged;
        })()}
        onInvite={async (savedForm, inviteeEmails) => {
          const wk = editingWeek || currentWeek;
          const d = getDateForWeekDay(wk, editingDay);
          const iso = d ? toLocalISODate(d) : '';
          if (!iso) { showToast('Kunne ikke bestemme datoen for invitationen', 'error'); return; }
          try {
            await createInvitation(
              {
                title: savedForm.name,
                category: savedForm.category,
                date: iso,
                start: savedForm.start || '',
                end: savedForm.end || '',
                location: savedForm.location || '',
              },
              activeFighterKey,
              activeFighter,
              inviteeEmails,
            );
            showToast(`${inviteeEmails.length} ${inviteeEmails.length === 1 ? 'person inviteret' : 'personer inviteret'}`, 'success');
          } catch (err) {
            console.error('[invitation] create failed:', err);
            showToast('Kunne ikke sende invitationen — prøv igen', 'error');
          }
        }}
        onSeriesInvite={async (savedForm, dayName, startDate, recurrence, inviteeEmails) => {
          await inviteSeries(savedForm, dayName, startDate, recurrence, inviteeEmails, true);
        }}
        onUninvite={async (email) => {
          // Arranger removes one person from the invitation for this activity.
          const wk = editingWeek || currentWeek;
          const d = getDateForWeekDay(wk, editingDay);
          const iso = d ? toLocalISODate(d) : '';
          const me = activeFighterKey.toLowerCase();
          const name = (editingSession?.name || '').trim();
          const inv = invitations.find(i =>
            i.invitedBy.toLowerCase() === me
            && i.activity.date === iso
            && (i.activity.title || '').trim() === name
            && (i.activity.start || '') === (editingSession?.start || ''),
          );
          if (!inv) return;
          try {
            await removeInvitee(inv.id, email);
            showToast(`${nameForEmail(email)} er ikke længere inviteret`, 'success');
          } catch (err) {
            console.error('[invitation] uninvite failed:', err);
            showToast('Kunne ikke fjerne invitationen', 'error');
          }
        }}
      />}
      {/* Phase 3 calendar-originated TrainingLog slice — same LogTrainingSheet,
          coordinator, service and hook as the standalone entry point; only the
          initial values differ. Cancelling creates nothing and restores the
          originating SessionModal (Task #5); a fresh open with no
          initialValues (below) matches the standalone flow unchanged. */}
      {canCreateLog && (
        <LogTrainingSheet
          open={logTrainingOpen}
          initialValues={logTrainingInitialValues ?? undefined}
          onClose={() => {
            const { reopenSessionModal } = decideLogTrainingSheetClose({
              justSaved: logTrainingJustSavedRef.current,
              hasEditingSession: !!editingSession,
            });
            logTrainingJustSavedRef.current = false;
            setLogTrainingOpen(false);
            setLogTrainingInitialValues(null);
            if (reopenSessionModal) setModalOpen(true);
          }}
          onSubmit={async (input) => {
            try {
              const id = await addEventLog(input);
              logTrainingJustSavedRef.current = true;
              showToast('Træning logget.', 'success');
              return id;
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Kunne ikke gemme træningen.', 'error');
              throw err;
            }
          }}
        />
      )}
      {/* Phase 3 read-side association slice — read-only detail for a log
          selected from the association section above. Renders exclusively
          from the log's own snapshot; no calendar mutation, no edit/delete. */}
      {openTrainingLogDetail && (
        <TrainingLogDetailSheet
          item={openTrainingLogDetail}
          onClose={() => setOpenTrainingLogDetail(null)}
        />
      )}
      {/* Checkpoint B — projected new-model `calendar_entry` detail routing.
          Never opens SessionModal, never edits/deletes/mutates the calendar.
          'one' goes straight to the existing read-only TrainingLogDetailSheet;
          every other state uses the small dedicated read-only status sheet. */}
      {openProjectedEntry && projectedEntryClassification.kind === 'one' && (
        <TrainingLogDetailSheet
          item={resolveTrainingLogHistoryItem(projectedEntryClassification.log, projectedEntryAggregateOccurrenceTiming)}
          onClose={() => setOpenProjectedEntry(null)}
        />
      )}
      {openProjectedEntry && projectedEntryClassification.kind !== 'one' && (
        <ProjectedCalendarEntryStatusSheet
          state={
            projectedEntryClassification.kind === 'conflict' ? 'conflict'
            : projectedEntryClassification.kind === 'error' ? 'error'
            : projectedEntryClassification.kind === 'none' ? 'none'
            : 'loading'
          }
          logs={projectedEntryClassification.kind === 'conflict' ? projectedEntryClassification.logs.map(buildTrainingLogHistoryItem) : undefined}
          onClose={() => setOpenProjectedEntry(null)}
        />
      )}
      {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} onShowToast={showToast} />}
      {adminOpen && (
        <ErrorBoundary isDark={isDark} label="Admin Error" onClose={() => setAdminOpen(false)}>
          <BacklogPage isAdmin={isAdmin} onClose={() => setAdminOpen(false)} onShowToast={showToast} />
        </ErrorBoundary>
      )}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </div>
  );
};

export default App;
