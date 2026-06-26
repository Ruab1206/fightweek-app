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

import { DAYS, resolveFighterKey } from './config/constants';
import { useRolesConfig } from './hooks/useRolesConfig';
import { getDateForWeekDay, getWeekDateMap, getTodayDayName, getFullWeekDateMap, getDaysInRange, getISOWeekForDate, toLocalISODate } from './utils/dateUtils';

import { useAuth } from './hooks/useAuth';
import { useScheduleData, useMultiWeekData, useMultiWeekTeamData } from './hooks/useScheduleData';
import { useSessionHandlers } from './hooks/useSessionHandlers';
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
import type { Invitation } from './types/invitation';
import { useActivityNotes } from './hooks/useActivityNotes';
import MobileScrollView from './components/MobileScrollView';
import PersonalSchedule from './components/PersonalSchedule';
import BacklogPage from './pages/BacklogPage';
import ErrorBoundary from './components/shared/ErrorBoundary';
import EventsPage from './pages/EventsPage';
import type { EventsPageHandle } from './pages/EventsPage';
import AddScreen from './components/AddScreen';
import type { AddType } from './components/AddScreen';

const App = () => {
  // --- Hooks ---
  const navigate = useNavigate();
  const { userMapping: USER_MAPPING, fighters: FIGHTERS, emailForName } = useRolesConfig();
  const {
    user, authLoading, accessDenied, loginError,
    isBrowserBlocked, isMobile,
    activeFighter, setActiveFighter,
    isLocked,
    triggerLoginPopup, triggerLoginRedirect, handleLogout,
  } = useAuth(USER_MAPPING);

  // #1191: schedule data is keyed by email (a stable id) in Firestore. Resolve the
  // active fighter's display name to their email path key for all data hooks; the
  // UI/merge layer keeps using the display name.
  const activeFighterKey = useMemo(() => resolveFighterKey(activeFighter, emailForName), [activeFighter, emailForName]);

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
  const { invitations, createInvitation, respondToInvitation, cancelInvitation, cancelInvitationForActivity, dismissInvitation } = useInvitations();
  const { getNote, saveNote } = useActivityNotes(activeFighterKey);

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
  const { multiWeekData: rawMultiWeekData, saveWeekToDb, fetchWeekData, seedWeekFromTemplate } = useMultiWeekData(user, activeFighterKey, neededWeeks, accessDenied, isBrowserBlocked);

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

  // --- Local UI State ---
  const [view, setView] = useState<'personal' | 'team' | 'events'>('personal');
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
    saveToDb, saveWeekToDb, fetchWeekData, showToast,
    setModalOpen, setEditingWeek, setEditingDay, setEditingSession, setAddScreenOpen,
    seedWeekFromTemplate,
  });

  // Scroll orchestration (scroll-to-today, month tracking, initial alignment)
  const { headerMonth, initialScrollDone, scrollToToday, scrollToDate, activeDayRef } = useScrollController({
    todayRef, mobileTodayRef, view, user, currentWeek, setCurrentWeek,
    multiWeekData, scrollDays, weeksBack, setWeeksBack, weeksAhead, setWeeksAhead, searchMode,
  });
  // Prevent background scroll when search overlay is open (calendar only — events page handles its own filtering inline)
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
                    {/* Admin-only fighter switch */}
                    {isAdmin && !isLocked && (
                      <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                        <p className={`text-[10px] font-medium uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Vis som fighter</p>
                        <select value={activeFighter} onChange={(e) => { setActiveFighter(e.target.value); setMenuOpen(false); }} className={`w-full px-2 py-1.5 rounded-lg border text-sm font-bold ${isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-surface-subtle text-ds-text border-surface-border'}`}>
                          {FIGHTERS.map(f => <option key={f} value={f} className="bg-white text-black dark:bg-slate-800 dark:text-white">{f}</option>)}
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
      {searchMode && view !== 'events' && <SearchOverlay searchQuery={searchQuery} scrollDays={scrollDays} multiWeekData={multiWeekData} isDark={isDark}
        onOpenSession={(d, s, w) => { setEditingDay(d); setEditingSession(s); setEditingWeek(w); setModalOpen(true); }}
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
                    if (cls) { setClassInfoSession({ cls, session, day, weekNum }); return; }
                  }
                  setEditingDay(day); setEditingSession(session); setEditingWeek(weekNum); setModalOpen(true);
                }}
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
                scheduleData={mergedScheduleData}
                weekDates={weekDates}
                fullWeekDates={fullWeekDates}
                isReadOnly={isReadOnly}
                isDark={isDark}
                expandedDay={expandedDay}
                onAddClick={handleAddClick}
                onEditSession={(day, session) => {
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
          onClose={() => setClassInfoSession(null)}
          getNote={getNote}
          saveNote={saveNote}
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
            try {
              await respondToInvitation(id, activeFighterKey, response);
              setActiveInvitation(null);
              showToast(response === 'declined' ? 'Du har afslået' : 'Dit svar er gemt', 'success');
            } catch (err) {
              console.error('[invitation] respond failed:', err);
              showToast('Kunne ikke gemme dit svar — prøv igen', 'error');
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
          onClose={() => setActiveInvitation(null)}
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
        onDelete={async (id) => {
          // If I arranged an invitation for this activity, cancel it too so
          // invitees see it was called off (Outlook-style) instead of it
          // silently lingering on their calendars (#1201 step A).
          try {
            const wk = editingWeek || currentWeek;
            const d = getDateForWeekDay(wk, editingDay);
            const iso = d ? toLocalISODate(d) : '';
            const title = (editingSession?.name || '').trim();
            if (iso && title) {
              await cancelInvitationForActivity(activeFighterKey, title, iso, editingSession?.start || '');
            }
          } catch (err) {
            console.error('[invitation] cancel-on-delete failed:', err);
          }
          handleDeleteSession(id);
        }}
        onDeleteThisAndFuture={(dayName, name, start, fromWeek) => {
          setModalOpen(false);
          setEditingWeek(null);
          showToast(`${name} fjernet`, 'success');
          handleDeleteThisAndFuture(dayName, name, start, fromWeek);
        }}
        onRecurrenceSave={(session, dayName, startDate, recurrence) => {
          handleAddRecurring(session, dayName, startDate, recurrence);
          setModalOpen(false);
          setEditingWeek(null);
        }}
        onFeedback={(ctx) => setFeedbackContext(ctx)}
        getNote={getNote}
        saveNote={saveNote}
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
      />}
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
