/**
 * FIGHTWEEK APP v2.0 — Phase 2: Modular Architecture
 * Thin orchestrator — all logic lives in hooks / components.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, User, ChevronDown, ChevronLeft, ChevronRight,
  Clock, MapPin, Bed, Plus, AlertCircle, X, Calendar, Repeat,
  History, LogOut, ClipboardList, MessageSquarePlus, Sun, Moon, Users,
  Search, SlidersHorizontal, PenLine, BookOpen,
} from 'lucide-react';

import { DAYS, CATEGORIES, USER_MAPPING, FIGHTERS } from './config/constants';
import { getISOWeek, getDateForWeekDay, getWeekDateMap } from './utils/dateUtils';

import { useAuth } from './hooks/useAuth';
import { useScheduleData } from './hooks/useScheduleData';
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

  // --- Local UI State ---
  const [view, setView] = useState<'personal' | 'program' | 'team'>('personal');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feedbackContext, setFeedbackContext] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
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
          if (!cls.title.toLowerCase().includes(q) && !cls.discipline.toLowerCase().includes(q) && !cls.gym.toLowerCase().includes(q) && !(cls.instructor && cls.instructor.toLowerCase().includes(q))) match = false;
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
    const newData = JSON.parse(JSON.stringify(scheduleData));
    if (!newData[editingDay]) newData[editingDay] = [];

    if (!isStandardMode) {
      const sessionDate = getDateForWeekDay(currentWeek, editingDay);
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
    setScheduleData(newData);
    await saveToDb(newData);
    setModalOpen(false);
  };

  const handleDeleteSession = async (sessionId) => {
    const newData = JSON.parse(JSON.stringify(scheduleData));
    if (newData[editingDay]) {
      newData[editingDay] = newData[editingDay].filter(s => s.id !== sessionId);
      await saveToDb(newData);
    }
    setModalOpen(false);
  };

  const handleToggleRestDay = (day) => {
    const executeToggle = async () => {
      const newData = JSON.parse(JSON.stringify(scheduleData));
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
          const newData = JSON.parse(JSON.stringify(scheduleData));
          newData[day] = (newData[day] || []).filter(s => !s.isRestDay);
          await saveToDb(newData);
          setConfirmDialog(null);
          setTimeout(() => { setExpandedDay(day); }, 100);
        }
      });
    } else { setExpandedDay(expandedDay === day ? null : day); }
  };

  // One-tap add from inline catalogue picker
  const handleAddFromCatalogue = async (session: CatalogueAddPayload, dayOverride?: string) => {
    const day = dayOverride || expandedDay;
    if (!day) return;
    const newData = JSON.parse(JSON.stringify(scheduleData));
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
    showToast(`${session.name} tilføjet`, 'success');
  };

  // Desktop: add from 7-day catalogue grid
  const handleAddFromDesktopCatalogue = async (day: string, session: CatalogueAddPayload) => {
    const newData = JSON.parse(JSON.stringify(scheduleData));
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
  const handleManualFromPicker = (dayOverride?: string) => {
    setEditingDay(dayOverride || expandedDay);
    setEditingSession(null);
    setExpandedDay(null);
    setModalOpen(true);
  };

  // --- Guard screens ---
  if (isBrowserBlocked) return <BrowserBlockScreen />;
  if (authLoading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-surface-subtle text-ds-text-subtlest'}`}>Loader...</div>;
  if (!user) return <LoginScreen onLoginPopup={triggerLoginPopup} onLoginRedirect={triggerLoginRedirect} error={loginError} />;
  if (accessDenied) return <div className={`min-h-screen flex items-center justify-center flex-col gap-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-surface-subtle text-ds-text'}`}><span>Ingen adgang</span><button onClick={handleLogout} className={`px-4 py-2 rounded ${isDark ? 'bg-slate-700 text-white' : 'bg-brand-500 text-white'}`}>Log ud</button></div>;

  const isReadOnly = view === 'personal' && currentWeek < systemWeek;
  const isAdmin = ['admin', 'coach'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);
  const weekDates = getWeekDateMap(currentWeek);

  // --- Render ---
  return (
    <div className={`min-h-screen pb-24 font-sans selection:bg-blue-500/30 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text'}`}>
      {/* HEADER */}
      <div className={`p-4 shadow-lg border-b sticky top-0 z-20 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border shadow-sm'}`}>
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`font-bold text-lg leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>FightWeek</h1>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">
                {isAdmin ? 'Admin / Coach' : 'Fighter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setFeedbackContext({ location: 'header' })} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title="Feedback">
              <MessageSquarePlus className="w-5 h-5" />
            </button>
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-yellow-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {isAdmin && <button onClick={() => setAdminOpen(true)} className={`p-2 rounded-lg border shadow-sm ${isDark ? 'bg-slate-800 text-yellow-500 border-yellow-900/30' : 'bg-surface-raised text-yellow-600 border-yellow-200'}`}><ClipboardList className="w-5 h-5" /></button>}
            {isLocked ? (
              <div className={`flex items-center px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-surface-raised border-surface-border'}`}>
                <User className={`w-3 h-3 mr-2 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>{activeFighter}</span>
              </div>
            ) : (
              <div className="relative group">
                <select value={activeFighter} onChange={(e) => setActiveFighter(e.target.value)} className={`appearance-none pl-4 pr-10 py-2 rounded-lg border text-sm font-bold ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-ds-text border-surface-border'}`}>
                  {FIGHTERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}><ChevronDown className="w-4 h-4" /></div>
              </div>
            )}
            <button onClick={handleLogout} className={`p-2 ${isDark ? 'text-slate-500 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — responsive width */}
      <div className="mx-auto relative pt-4 min-h-[85vh]">
        {/* Week navigation — only for Min Uge */}
        {view === 'personal' && (
          <div className="mx-4 mb-4 space-y-3">
            <div className={`flex items-center justify-between p-2 rounded-xl border shadow-md ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
              <button onClick={() => setCurrentWeek(currentWeek - 1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'} ${currentWeek <= 1 ? 'invisible' : ''}`}><ChevronLeft className="w-6 h-6" /></button>
              <div className="text-center">
                <span className={`text-[10px] uppercase tracking-widest font-bold ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>{currentWeek === systemWeek ? "Aktuel Uge" : currentWeek < systemWeek ? "Tidligere Uge" : "Næste Uge"}</span>
                <div className={`font-bold text-xl ${isDark ? 'text-white' : 'text-ds-text'}`}>Uge {currentWeek}</div>
              </div>
              <button onClick={() => setCurrentWeek(currentWeek + 1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'} ${currentWeek >= systemWeek + 1 ? 'invisible' : ''}`}><ChevronRight className="w-6 h-6" /></button>
            </div>
            <div className="flex justify-between items-center px-1">
              <div className={`flex items-center space-x-1 text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                {lastUpdated && <><Clock className="w-3 h-3" /><span>Opdateret: {lastUpdated}</span></>}
                {isReadOnly && <span className={`flex items-center ml-2 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}><History className="w-3 h-3 mr-1" /> Historik</span>}
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && !isStandardMode && (
                  <button onClick={() => { setConfirmDialog({ title: 'Nulstil til program?', message: 'Vil du erstatte denne uges plan med dit program?', onConfirm: async () => { const ok = await handleImportStandard(); if (ok) showToast('Uge nulstillet fra program', 'success'); else showToast('Intet program fundet', 'error'); setConfirmDialog(null); } }); }}
                    className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-ds-text-subtlest hover:text-ds-text-subtle'}`}>
                    <History className="w-3 h-3" /> Nulstil til program
                  </button>
                )}
                {!isReadOnly && (
                  <button onClick={() => setShowCatalogue(!showCatalogue)}
                    className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${showCatalogue ? (isDark ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white') : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {showCatalogue ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showCatalogue ? 'F\u00e6rdig' : 'Tilf\u00f8j pas'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Program header */}
        {view === 'program' && (
          <div className="mx-4 mb-4 space-y-3">
            <div className={`rounded-xl p-3 flex items-start space-x-3 border ${isDark ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50 border-indigo-200'}`}>
              <Repeat className={`w-5 h-5 mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
              <div>
                <p className={`text-sm font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>Mit Program</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-indigo-300/70' : 'text-indigo-500'}`}>Din faste ugeplan. Nye uger starter automatisk herfra.</p>
              </div>
            </div>
            <div className="flex justify-between items-center px-1">
              <div className={`flex items-center space-x-1 text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                {lastUpdated && <><Clock className="w-3 h-3" /><span>Opdateret: {lastUpdated}</span></>}
              </div>
              <button onClick={() => setShowCatalogue(!showCatalogue)}
                className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${showCatalogue ? (isDark ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white') : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {showCatalogue ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {showCatalogue ? 'F\u00e6rdig' : 'Tilf\u00f8j pas'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW: Personal Schedule or Program */}
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
            <PersonalSchedule
              days={DAYS}
              scheduleData={scheduleData}
              weekDates={weekDates}
              isStandardMode={isStandardMode}
              isReadOnly={isReadOnly}
              isDark={isDark}
              expandedDay={expandedDay}
              onToggleRestDay={handleToggleRestDay}
              onAddClick={handleAddClick}
              onEditSession={(day, session) => { setEditingDay(day); setEditingSession(session); setModalOpen(true); }}
              onAddFromCatalogue={handleAddFromCatalogue}
              onManualAdd={handleManualFromPicker}
              onCollapseDay={() => setExpandedDay(null)}
              showDesktopCatalogue={showCatalogue && !isReadOnly}
              catalogueByDay={catalogueByDay}
              catalogueLoading={catalogueLoading}
              onAddFromDesktopCatalogue={handleAddFromDesktopCatalogue}
              onDesktopManual={handleManualFromPicker}
            />
          </>
        ) : (
          <TeamSchedule days={DAYS} teamData={teamData} currentWeek={currentWeek} isStandardMode={isStandardMode} isDark={isDark} />
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className={`fixed bottom-0 left-0 right-0 backdrop-blur border-t pb-safe z-50 ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-surface-border'}`}>
        <div className="mx-auto flex justify-between items-center p-2 px-6">
          <NavButton icon={Calendar} label="Min Uge" active={view === 'personal'} onClick={() => setView('personal')} isDark={isDark} />
          <NavButton icon={Repeat} label="Program" active={view === 'program'} onClick={() => setView('program')} isDark={isDark} />
          <NavButton icon={Users} label="Teamet" active={view === 'team'} onClick={() => setView('team')} isDark={isDark} />
        </div>
      </div>

      {/* MODALS */}
      {modalOpen && <SessionModal day={editingDay} initialData={editingSession} existingSessions={scheduleData[editingDay] || []} onClose={() => setModalOpen(false)} onSave={handleSaveSession} onDelete={handleDeleteSession} isStandardMode={isStandardMode} onFeedback={(ctx) => setFeedbackContext(ctx)} />}
      {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} onShowToast={showToast} />}
      {adminOpen && <BacklogPage isAdmin={isAdmin} onClose={() => setAdminOpen(false)} onShowToast={showToast} />}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </div>
  );
};

// --- Personal Schedule (inline — small, tightly coupled to App state) ---
const PersonalSchedule = ({ days, scheduleData, weekDates, isStandardMode, isReadOnly, isDark, expandedDay, onToggleRestDay, onAddClick, onEditSession, onAddFromCatalogue, onManualAdd, onCollapseDay, showDesktopCatalogue, catalogueByDay, catalogueLoading, onAddFromDesktopCatalogue, onDesktopManual }) => (
  <div className="px-4 pb-32 fade-in">
    <div className="grid grid-cols-1 md:grid-cols-7 md:grid-rows-[1fr_auto] gap-3">
    {days.map(day => {
      const sessions = scheduleData[day] || [];
      const isRestDay = sessions.some(s => s.isRestDay);
      const visibleSessions = sessions.filter(s => !s.isRestDay);
      const isExpanded = expandedDay === day;
      const dayCatalogue = catalogueByDay?.[day] || [];
      return (
        <div key={day} className={`rounded-2xl p-3 border transition-all shadow-md flex flex-col md:row-span-2 md:grid md:grid-rows-subgrid md:gap-y-0 ${isExpanded ? (isDark ? 'bg-slate-900 border-blue-800/50 ring-1 ring-blue-800/30' : 'bg-white border-brand-200 ring-1 ring-brand-100') : isRestDay ? (isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-surface-raised/50 border-surface-border') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border')}`}>
          <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-1">
              <h3 className={`font-bold text-sm md:text-xs ${isReadOnly ? (isDark ? 'text-slate-400' : 'text-ds-text-subtle') : (isDark ? 'text-white' : 'text-ds-text')}`}>
                <span className="md:hidden">{day}</span>
                <span className="hidden md:inline">{day.slice(0, 3)}</span>
                {!isStandardMode && weekDates[day] && <span className={`text-xs md:text-[10px] ml-1 font-medium ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>d. {weekDates[day]}</span>}
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
            return (
              <div key={s.id} onClick={() => !isReadOnly && onEditSession(day, s)} className={`relative flex items-start p-2 rounded-xl mb-1.5 border shadow-sm transition-all ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-surface-raised border-surface-border')} ${!isReadOnly ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                <div className="flex-1 pl-2.5 min-w-0">
                  <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 md:min-h-[1.875rem] ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{s.name}</h4>
                  <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                    <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.start} - {s.end}</span>
                    <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.location}</span>
                  </div>
                  {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{s.cancellationReason ? `: ${s.cancellationReason}` : ''}</div>}
                </div>
              </div>
            );
          })}
          {/* Mobile inline picker */}
          {isExpanded && <div className="md:hidden"><InlineCataloguePicker day={day} onAdd={onAddFromCatalogue} onManual={onManualAdd} onClose={onCollapseDay} /></div>}
          </div>
          </div>
          {/* Desktop catalogue — always rendered for subgrid row alignment */}
          <div className="hidden md:block">
          {showDesktopCatalogue && (
            <>
              <div className="flex items-center gap-2 mt-2 mb-1.5">
                  <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-surface-border'}`} />
                  <button onClick={() => onDesktopManual(day)} className={`flex items-center gap-1 text-[9px] font-bold whitespace-nowrap transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-ds-text-subtle hover:text-ds-text'}`}><Plus className="w-2.5 h-2.5" /> Eget pas</button>
                  <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-surface-border'}`} />
              </div>
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
                        <div className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{schedule.startTime}–{schedule.endTime}</div>
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
