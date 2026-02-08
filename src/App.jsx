/**
 * FIGHTWEEK APP v1.74
 * -------------------
 * - Login: Robust model fra v1.66 (Popup + Redirect support)
 * - Struktur: Opryddet v1.73
 * - Design: Aflyste pas beholder farve (opacity 50%)
 */

// --- SEKTION 1: IMPORTS ---
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, ClipboardList, MessageSquarePlus, 
  MoreHorizontal, Sparkles, CheckSquare, Square, Search, 
  ArrowUpCircle, ArrowDownCircle, CornerDownLeft, Keyboard, Save, 
  Layout, List, Upload, FileDown, Table, RefreshCw, Terminal, Check, Copy, Smartphone, HelpCircle, MousePointerClick
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, query, writeBatch, getDocs 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithPopup,
  signInWithRedirect, // Tilføjet fra fungerende kode
  getRedirectResult,  // Tilføjet fra fungerende kode 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";

// --- SEKTION 2: KONSTANTER & STAMDATA ---
const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const CATEGORIES = [
  { label: 'MMA', color: 'bg-red-600', border: 'border-red-600' },
  { label: 'Brydning', color: 'bg-emerald-600', border: 'border-emerald-600' },
  { label: 'Grappling', color: 'bg-purple-600', border: 'border-purple-600' },
  { label: 'Boksning', color: 'bg-yellow-600', border: 'border-yellow-600' },
  { label: 'Kickboxing', color: 'bg-orange-500', border: 'border-orange-500' },
  { label: 'Fysisk træning', color: 'bg-stone-600', border: 'border-stone-600' },
  { label: 'Andet', color: 'bg-slate-500', border: 'border-slate-500' }
];

const GLOBAL_TEMPLATES = [
  { id: 'm1', day: 'Mandag', name: 'Wall Wrestling', category: 'Brydning', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'm2', day: 'Mandag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '19:00', location: 'Rumble' },
  { id: 'm3', day: 'Mandag', name: 'MMA Grappling', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 't1', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 't2', day: 'Tirsdag', name: 'Grappling', category: 'Grappling', start: '17:00', end: '18:00', location: 'Burnell' },
  { id: 't3', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '17:00', end: '18:00', location: 'Rumble' },
  { id: 't4', day: 'Tirsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '19:00', location: 'Rumble' },
  { id: 't5', day: 'Tirsdag', name: 'Boksning', category: 'Boksning', start: '17:30', end: '19:00', location: 'Rødovre' },
  { id: 't6', day: 'Tirsdag', name: 'Nogi Adv', category: 'Grappling', start: '18:00', end: '19:00', location: 'Rumble' },
  { id: 't7', day: 'Tirsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '21:00', location: 'Roskilde' },
  { id: 'o1', day: 'Onsdag', name: 'MMA Sparring', category: 'MMA', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'o2', day: 'Onsdag', name: 'Grappling', category: 'Grappling', start: '17:00', end: '18:00', location: 'Burnell' },
  { id: 'o3', day: 'Onsdag', name: 'MMA Adv', category: 'MMA', start: '16:30', end: '18:00', location: 'Rumble' },
  { id: 'o4', day: 'Onsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:30', location: 'Rumble' },
  { id: 'o5', day: 'Onsdag', name: 'Nogi All', category: 'Grappling', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 'th1', day: 'Torsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 'th2', day: 'Torsdag', name: 'Nogi All', category: 'Grappling', start: '17:00', end: '18:00', location: 'Rumble' },
  { id: 'th3', day: 'Torsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:30', location: 'Rumble' },
  { id: 'th4', day: 'Torsdag', name: 'Boksning', category: 'Boksning', start: '17:30', end: '19:00', location: 'Rødovre' },
  { id: 'th5', day: 'Torsdag', name: 'Nogi Adv', category: 'Grappling', start: '18:00', end: '19:00', location: 'Rumble' },
  { id: 'th6', day: 'Torsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '21:00', location: 'Roskilde' },
  { id: 'f1', day: 'Fredag', name: 'MMA', category: 'MMA', start: '17:00', end: '18:00', location: 'Rumble' },
  { id: 'f2', day: 'Fredag', name: 'MMA Sparring', category: 'MMA', start: '18:00', end: '19:00', location: 'Rumble' },
  { id: 'sa1', day: 'Lørdag', name: 'Nogi All', category: 'Grappling', start: '10:00', end: '11:00', location: 'Rumble' },
  { id: 'sa2', day: 'Lørdag', name: 'Boksning', category: 'Boksning', start: '10:00', end: '11:30', location: 'Rødovre' },
  { id: 'sa3', day: 'Lørdag', name: 'Boxing All', category: 'Boksning', start: '10:30', end: '12:00', location: 'Rumble' },
  { id: 'sa4', day: 'Lørdag', name: 'Nogi Adv', category: 'Grappling', start: '11:00', end: '12:00', location: 'Rumble' },
  { id: 'sa5', day: 'Lørdag', name: 'Brydning', category: 'Brydning', start: '14:00', end: '16:00', location: 'Roskilde' },
  { id: 'su1', day: 'Søndag', name: 'Nogi All', category: 'Grappling', start: '12:00', end: '13:30', location: 'Rumble' },
  { id: 'su2', day: 'Søndag', name: 'Kickboxing All', category: 'Kickboxing', start: '13:30', end: '15:00', location: 'Rumble' },
];

const USER_MAPPING = {
  'carolinemollerh@gmail.com': { name: 'Caroline', role: 'fighter' },
  'sankarem00@gmail.com': { name: 'San', role: 'fighter' },
  'eneasopa354@gmail.com': { name: 'Enea', role: 'fighter' },
  'anton.emil.bang@gmail.com': { name: 'Anton', role: 'fighter' },
  'duraceljones@gmail.com': { name: 'Jonas', role: 'fighter' },
  'karl.lindsgren@gmail.com': { name: 'Karl', role: 'fighter' },
  'frodihansen@hotmail.com': { name: 'Frodi', role: 'coach' }, 
  'rune.abrahamsson@gmail.com': { name: 'Rune', role: 'admin' }
};

const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl'];

const firebaseConfig = {
  apiKey: "AIzaSyDdOsNxPtlvWBP3SmNOxo1JfVXV9KeGUVA",
  authDomain: "fightweek-app.firebaseapp.com",
  projectId: "fightweek-app",
  storageBucket: "fightweek-app.firebasestorage.app",
  messagingSenderId: "141030861103",
  appId: "1:141030861103:web:962fd2747623b171f159da"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ROOT_COLLECTION = `artifacts/production/users`; 
const PUBLIC_DATA_PATH = `artifacts/production/public/data`; 

// --- SEKTION 3: HJÆLPEFUNKTIONER ---

const formatCancellationTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return `Kl. ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    const dayIndex = date.getDay();
    const dayName = dayIndex === 0 ? 'Søndag' : DAYS[dayIndex - 1];
    return dayName;
};

const getISOWeek = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const getDateForWeekDay = (weekNumber, dayName) => {
    const dayIndex = DAYS.indexOf(dayName); 
    if (dayIndex === -1) return null;
    const simpleDate = new Date();
    const currentYear = simpleDate.getFullYear();
    const simple = new Date(currentYear, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    const targetDate = new Date(ISOweekStart);
    targetDate.setDate(ISOweekStart.getDate() + dayIndex);
    return targetDate;
};

const getWeekDateMap = (weekNumber) => {
    const map = {};
    DAYS.forEach(day => {
        const date = getDateForWeekDay(weekNumber, day);
        if (date) map[day] = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }).replace('.', '');
    });
    return map;
};

const addMinutes = (timeStr, minutes) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m);
    date.setMinutes(date.getMinutes() + minutes);
    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
}

const checkInAppBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Instagram") > -1);
};

const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const getDeviceInfo = () => navigator.userAgent;

// --- SEKTION 4: KOMPONENTER ---

const Toast = ({ message, type = 'success', visible, onClose }) => {
    useEffect(() => {
        if (visible) { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }
    }, [visible, onClose]);
    if (!visible) return null;
    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] fade-in">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${type === 'success' ? 'bg-slate-900 border-green-900/50 text-white' : 'bg-red-900 border-red-800 text-white'}`}>
                {type === 'success' ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-white" />}
                <span className="font-bold text-sm">{message}</span>
            </div>
        </div>
    );
};

const BrowserBlockScreen = () => {
    const [copied, setCopied] = useState(false);
    const copyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4"><Smartphone className="w-8 h-8 text-red-500" /></div>
                <h2 className="text-white font-bold text-xl mb-2">Brug Chrome eller Safari</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">Google tillader ikke login direkte i Messenger/Facebook.</p>
                <button onClick={copyLink} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? "Link kopieret!" : "Kopier Link"}
                </button>
            </div>
        </div>
    );
}

const LoginScreen = ({ onLoginPopup, onLoginRedirect, error }) => {
    const getFriendlyError = (msg) => {
        if (!msg) return null;
        if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) return "Login afbrudt af bruger (Popup).";
        if (msg.includes("network-request-failed")) return "Netværksfejl.";
        if (msg.includes("unauthorized-domain")) return "Domæne ikke godkendt.";
        return msg;
    };
    
    const friendlyError = getFriendlyError(error);

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center relative">
          <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">v1.74</div>
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">FightWeek</h1>
          <p className="text-slate-400 mb-8 text-sm">Log ind for at se din træningsplan</p>
          
          {friendlyError && (
            <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-6 text-xs text-red-200 text-left">
                <p className="font-bold mb-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Fejl:</p>
                <p>{friendlyError}</p>
            </div>
          )}

          <button onClick={onLoginPopup} className="w-full bg-white text-slate-900 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 mb-4">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Log ind med Google (Popup)
          </button>

          <button onClick={onLoginRedirect} className="text-slate-500 text-xs hover:text-blue-400 underline flex items-center justify-center w-full mt-2">
            <MousePointerClick className="w-3 h-3 mr-1" />
            Alternativ Login (Redirect)
          </button>
        </div>
      </div>
    );
};

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 fade-in">
    <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl overflow-hidden p-6 text-center">
      <div className="mx-auto w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mb-4"><HelpCircle className="w-6 h-6 text-blue-500" /></div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex space-x-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors">Annuller</button>
        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg">Bekræft</button>
      </div>
    </div>
  </div>
);

// --- SEKTION 5: HOVEDAPPLIKATION (LOGIC) ---
const App = () => {
  // Authentication State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isBrowserBlocked, setIsBrowserBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // App Data State
  const [activeFighter, setActiveFighter] = useState('Karl');
  const [isLocked, setIsLocked] = useState(true);
  const [systemWeek] = useState(getISOWeek()); 
  const [currentWeek, setCurrentWeek] = useState(getISOWeek()); 
  const [view, setView] = useState('personal'); 
  const [isStandardMode, setIsStandardMode] = useState(false);
  const [scheduleData, setScheduleData] = useState({}); 
  const [teamData, setTeamData] = useState({}); 
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // UI State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null); 
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feedbackContext, setFeedbackContext] = useState(null); 
  const [adminOpen, setAdminOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

  // Init Effects
  useEffect(() => {
    setIsMobile(isMobileDevice());
    if (checkInAppBrowser()) { setIsBrowserBlocked(true); setAuthLoading(false); return; }

    const initAuth = async () => {
        try { await setPersistence(auth, browserLocalPersistence); } 
        catch (error) { console.error("Persistence error:", error); }
    };
    initAuth();
    
    // Check for redirect result (from working code)
    getRedirectResult(auth).catch((error) => {
        if (error.code !== 'auth/popup-closed-by-user') setLoginError(error.message);
    });

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthLoading(false);
      if (u) {
        const email = u.email ? u.email.toLowerCase() : '';
        const userProfile = USER_MAPPING[email];
        if (userProfile) {
            setUser(u);
            setAccessDenied(false);
            if (userProfile.role === 'coach' || userProfile.role === 'admin') {
                setIsLocked(false);
                setActiveFighter('Karl'); 
            } else {
                setActiveFighter(userProfile.name);
                setIsLocked(true);
            }
        } else { setAccessDenied(true); setUser(u); }
      } else { setUser(null); }
    });
    return () => unsubAuth();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user || accessDenied || isBrowserBlocked) return;
    const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const collectionPath = isStandardMode ? 'templates' : 'weeks';
    
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
    const unsubPersonal = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScheduleData(data);
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
      } else { setScheduleData({}); setLastUpdated('Aldrig'); }
    });

    const unsubsTeam = [];
    FIGHTERS.forEach(fighter => {
        const fRef = doc(db, ROOT_COLLECTION, fighter, collectionPath, docId);
        const unsub = onSnapshot(fRef, (snap) => {
            if (snap.exists()) setTeamData(prev => ({...prev, [fighter]: snap.data()}));
            else setTeamData(prev => ({...prev, [fighter]: {}}));
        });
        unsubsTeam.push(unsub);
    });
    return () => { unsubPersonal(); unsubsTeam.forEach(u => u()); };
  }, [user, activeFighter, currentWeek, isStandardMode, accessDenied, isBrowserBlocked]);

  // LOGIN HANDLERS (Fra fungerende kode)
  const triggerLoginPopup = async () => {
      setLoginError(null);
      const provider = new GoogleAuthProvider();
      try { await signInWithPopup(auth, provider); } 
      catch (error) { setLoginError(error.message); }
  };

  const triggerLoginRedirect = async () => {
      setLoginError(null);
      const provider = new GoogleAuthProvider();
      try { await signInWithRedirect(auth, provider); } 
      catch (error) { setLoginError(error.message); }
  };

  const showToast = (message, type = 'success') => setToast({ message, type, visible: true });
  const handleLogout = () => { signOut(auth); setAccessDenied(false); setLoginError(null); };

  const saveToDb = async (newData) => {
      const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
      const collectionPath = isStandardMode ? 'templates' : 'weeks';
      const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
      newData.lastUpdated = new Date().toISOString();
      await setDoc(docRef, newData);
  };

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
    newData[editingDay].sort((a,b) => a.start.localeCompare(b.start));
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
                  setTimeout(() => { setEditingDay(day); setEditingSession(null); setModalOpen(true); }, 100);
              }
          });
      } else { setEditingDay(day); setEditingSession(null); setModalOpen(true); }
  };

  const handleImportStandard = () => {
    setConfirmDialog({
        title: "Hent Standarduge", message: "Dette vil overskrive hele ugen. Er du sikker?",
        onConfirm: async () => {
            const standardSnap = await getDoc(doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard'));
            if (standardSnap.exists()) await saveToDb(standardSnap.data());
            else showToast("Ingen standarduge fundet.", "error");
            setConfirmDialog(null);
        }
    });
  };

  if (isBrowserBlocked) return <BrowserBlockScreen />;
  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loader...</div>;
  if (!user) return <LoginScreen onLoginPopup={triggerLoginPopup} onLoginRedirect={triggerLoginRedirect} error={loginError} />;
  if (accessDenied) return <div className="text-white text-center p-10">Ingen adgang <button onClick={handleLogout}>Log ud</button></div>;

  const isReadOnly = !isStandardMode && currentWeek < systemWeek;
  const isAdmin = ['admin', 'coach'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);
  const weekDates = getWeekDateMap(currentWeek);

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen pb-24 font-sans selection:bg-blue-500/30">
      <div className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 sticky top-0 z-20">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">FightWeek</h1>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">
                 {isAdmin ? 'Admin / Coach' : 'Fighter'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && <button onClick={() => setAdminOpen(true)} className="p-2 bg-slate-800 rounded-lg text-yellow-500 border border-yellow-900/30 shadow-sm"><ClipboardList className="w-5 h-5" /></button>}
            {isLocked ? (
              <div className="flex items-center bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <User className="w-3 h-3 text-slate-400 mr-2" />
                <span className="text-sm font-bold text-white">{activeFighter}</span>
              </div>
            ) : (
              <div className="relative group">
                <select value={activeFighter} onChange={(e) => setActiveFighter(e.target.value)} className="appearance-none bg-slate-800 text-white pl-4 pr-10 py-2 rounded-lg border border-slate-700 text-sm font-bold">
                  {FIGHTERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400"><ChevronDown className="w-4 h-4" /></div>
              </div>
            )}
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-white"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto relative pt-4 min-h-[85vh]">
        {isStandardMode && (
          <div className={`mx-4 mb-4 rounded-xl p-3 flex items-start space-x-3 fade-in ${view === 'team' ? 'bg-indigo-900/30 border-indigo-700/50' : 'bg-yellow-900/30 border-yellow-700/50'}`}>
              <Info className={`w-5 h-5 mt-0.5 ${view === 'team' ? 'text-indigo-400' : 'text-yellow-500'}`} />
              <div>
                <p className={`text-sm font-bold ${view === 'team' ? 'text-indigo-200' : 'text-yellow-200'}`}>{view === 'team' ? 'Teamets Standarduger' : 'Redigerer Standarduge'}</p>
                <p className="text-xs opacity-80 mt-1">{view === 'team' ? 'Her ser du teamets faste grundplan.' : 'Dette er din skabelon. Klik "Gem" når du er færdig.'}</p>
              </div>
          </div>
        )}

        <div className="mx-4 mb-4 space-y-3">
          <div className="flex items-center justify-between bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-md">
            <button onClick={() => { setCurrentWeek(currentWeek - 1); setIsStandardMode(false); }} className={`p-2 hover:bg-slate-700 rounded-lg text-slate-400 ${currentWeek <= 1 ? 'invisible' : ''}`}><ChevronLeft className="w-6 h-6" /></button>
            <div className="text-center">
              <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">{currentWeek === systemWeek ? "Aktuel Uge" : currentWeek < systemWeek ? "Tidligere Uge" : "Næste Uge"}</span>
              <div className="text-white font-bold text-xl">Uge {currentWeek}</div>
            </div>
            <button onClick={() => { setCurrentWeek(currentWeek + 1); setIsStandardMode(false); }} className={`p-2 hover:bg-slate-700 rounded-lg text-slate-400 ${currentWeek >= systemWeek + 1 ? 'invisible' : ''}`}><ChevronRight className="w-6 h-6" /></button>
          </div>

          <div className="flex justify-between items-center px-1">
            <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-medium">
                {!isStandardMode && lastUpdated && <><Clock className="w-3 h-3" /><span>Opdateret: {lastUpdated}</span></>}
                {isReadOnly && <span className="flex items-center text-slate-400 ml-2"><History className="w-3 h-3 mr-1"/> Historik</span>}
            </div>
            {!isReadOnly && (
                <div className="flex space-x-2">
                    <button onClick={() => setIsStandardMode(!isStandardMode)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center ${isStandardMode ? 'bg-yellow-900/50 text-yellow-100 border-yellow-700' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                        {isStandardMode ? <><X className="w-3 h-3 mr-1.5"/> Luk Standard</> : <><Globe className="w-3 h-3 mr-1.5"/> {view === 'personal' ? 'Rediger standarduge' : 'Se standarduger'}</>}
                    </button>
                    {view === 'personal' && !isStandardMode && (
                        <button onClick={handleImportStandard} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-blue-900/20 text-blue-400 border-blue-800/50 flex items-center">
                            <ChevronDown className="w-3 h-3 mr-1.5"/> Hent Standard
                        </button>
                    )}
                </div>
            )}
          </div>
        </div>

        {view === 'personal' ? (
          <div className="px-4 space-y-3 pb-32 fade-in">
             {DAYS.map(day => {
                const sessions = scheduleData[day] || [];
                const isRestDay = sessions.some(s => s.isRestDay);
                const visibleSessions = sessions.filter(s => !s.isRestDay);
                return (
                    <div key={day} className={`mb-3 rounded-2xl p-4 border transition-all shadow-md ${isRestDay ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center space-x-2">
                                <h3 className={`text-white font-bold text-lg ${isReadOnly ? 'text-slate-400' : ''}`}>
                                    {day} 
                                    {!isStandardMode && weekDates[day] && <span className="text-slate-500 text-sm ml-2 font-medium">d. {weekDates[day]}</span>}
                                </h3>
                                {isRestDay && <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">HVILEDAG</span>}
                            </div>
                            <div className="flex space-x-1">
                                 <button disabled={isReadOnly} onClick={() => handleToggleRestDay(day)} className={`p-1.5 rounded-full transition-colors ${isRestDay ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'} ${isReadOnly ? 'opacity-0' : ''}`}><Bed className="w-4 h-4" /></button>
                                 <button disabled={isReadOnly} onClick={() => handleAddClick(day)} className={`bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-full p-1.5 transition-colors ${isReadOnly ? 'opacity-0' : ''}`}><Plus className="w-5 h-5" /></button>
                            </div>
                        </div>
                        {visibleSessions.length === 0 && !isRestDay && <div className="text-slate-600 text-sm font-medium py-3 text-center border-2 border-dashed border-slate-800/50 rounded-xl">Ingen pas planlagt</div>}
                        {visibleSessions.map(s => {
                            const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                            const isCancelled = s.status === 'cancelled';
                            return (
                                <div key={s.id} onClick={() => !isReadOnly && (setEditingDay(day), setEditingSession(s), setModalOpen(true))} className={`relative flex items-center justify-between p-3 rounded-xl mb-2 border shadow-sm transition-all ${isCancelled ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-slate-800 border-slate-700/50'} ${!isReadOnly ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                                    {/* FEATURE: DESIGN FIX - Lodret streg beholder farve men bliver gennemsigtig ved aflysning */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                                    
                                    <div className="flex-1 pl-3">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-bold text-sm leading-tight mb-1 ${isCancelled ? 'line-through text-slate-500' : 'text-white'}`}>{s.name}</h4>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">{s.category}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center text-slate-400 text-xs space-x-3 font-medium">
                                                <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {s.start} - {s.end}</span>
                                                <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/> {s.location}</span>
                                            </div>
                                            {isCancelled && <div className="mt-1 text-[10px] text-red-400 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Aflyst {formatCancellationTime(s.cancellationTime)}: {s.cancellationReason}</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
             })}
          </div>
        ) : (
             <TeamSchedule days={DAYS} teamData={teamData} currentWeek={currentWeek} isStandardMode={isStandardMode} />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe z-50">
        <div className="max-w-md mx-auto flex justify-between items-center p-2 px-6">
            <NavButton icon={Calendar} label="Min Plan" active={view === 'personal'} onClick={() => setView('personal')} />
            <button onClick={() => setFeedbackContext(view === 'personal' ? 'Min Plan' : 'Teamet')} className="flex flex-col items-center justify-center p-2 text-slate-500 hover:text-blue-400">
                <div className="bg-slate-800 p-2 rounded-full mb-1 border border-slate-700"><MessageSquarePlus className="w-5 h-5" /></div>
            </button>
            <NavButton icon={User} label="Teamet" active={view === 'team'} onClick={() => setView('team')} />
        </div>
      </div>

      {modalOpen && <SessionModal day={editingDay} initialData={editingSession} existingSessions={scheduleData[editingDay] || []} onClose={() => setModalOpen(false)} onSave={handleSaveSession} onDelete={handleDeleteSession} isStandardMode={isStandardMode} onFeedback={(ctx) => setFeedbackContext(ctx)} />}
      {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} onShowToast={showToast} />}
      {adminOpen && <AdminDashboard onClose={() => setAdminOpen(false)} onShowToast={showToast} />}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={() => setToast({...toast, visible: false})} />
    </div>
  );
};

// --- SUB-KOMPONENTER ---
const NavButton = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl w-16 transition-colors ${active ? 'text-blue-500' : 'text-slate-500'}`}>
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

const TeamSchedule = ({ days, teamData, currentWeek, isStandardMode }) => {
    const [weekDates, setWeekDates] = useState({});
    
    useEffect(() => {
        setWeekDates(getWeekDateMap(currentWeek));
    }, [currentWeek]);

    useEffect(() => {
        const dayIndex = new Date().getDay(); 
        const dayName = dayIndex === 0 ? 'Søndag' : DAYS[dayIndex - 1];
        const element = document.getElementById(`team-day-${dayName}`);
        if (element) {
            setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [days]); 

    return (
        <div className="fade-in px-4 pb-32">
             <div className="flex flex-col gap-6">
                 {days.map(day => {
                     const slots = {};
                     Object.keys(teamData).forEach(fighter => {
                        const data = teamData[fighter];
                        if (!data) return;
                        const sessions = data[day] || [];
                        sessions.forEach(s => {
                            if (s.isRestDay) return;
                            const key = `${s.start}###${s.location}`;
                            if (!slots[key]) slots[key] = [];
                            slots[key].push({ ...s, fighter });
                        });
                     });
                     
                     const sortedKeys = Object.keys(slots).sort();
                     
                     return (
                         <div id={`team-day-${day}`} key={day} className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                            <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center">
                                <h3 className="text-white font-bold text-lg">{day}</h3>
                                {!isStandardMode && weekDates[day] && <span className="text-sm text-slate-400 font-medium">{weekDates[day]}</span>}
                            </div>
                            
                            <div className="p-2">
                                {sortedKeys.length === 0 && <div className="text-center py-8 text-slate-600 text-sm italic border-2 border-dashed border-slate-800/50 rounded-xl m-2">Ingen fælles træning planlagt</div>}
                                
                                {sortedKeys.map(key => {
                                    const [time, location] = key.split('###');
                                    const sessions = slots[key];
                                    
                                    return (
                                        <div key={key} className="mb-3 last:mb-0 bg-slate-950/30 rounded-xl p-3 border border-slate-800">
                                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/50">
                                                <div className="flex items-center text-white font-bold font-mono text-lg">
                                                    <Clock className="w-5 h-5 mr-2 text-blue-500"/> {time}
                                                </div>
                                                <div className="flex items-center bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                                    <MapPin className="w-3 h-3 mr-1 text-slate-400"/> 
                                                    <span className="text-xs font-bold text-slate-200 uppercase">{location}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                {sessions.map((s, idx) => {
                                                     const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                                                     const isCancelled = s.status === 'cancelled';
                                                     return (
                                                         <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border ${isCancelled ? 'bg-red-900/10 border-red-900/30' : 'bg-slate-800 border-slate-700/50'}`}>
                                                             <div className="flex items-center gap-3">
                                                                <div className={`w-1.5 h-8 rounded-full ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                                                                <div>
                                                                    <div className="text-white text-xs font-bold">{s.fighter}</div>
                                                                    <div className={`text-[10px] ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-400'}`}>{s.name}</div>
                                                                </div>
                                                             </div>
                                                             {isCancelled && (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] font-bold text-red-400 bg-red-900/20 px-2 py-0.5 rounded">AFLYST</span>
                                                                    {s.cancellationReason && <span className="text-[9px] text-red-400/70 italic mt-0.5 max-w-[80px] truncate">{s.cancellationReason}</span>}
                                                                </div>
                                                             )}
                                                         </div>
                                                     );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                     );
                 })}
             </div>
        </div>
    );
};

const SessionModal = ({ day, initialData, existingSessions, onClose, onSave, onDelete, isStandardMode, onFeedback }) => {
    const [tab, setTab] = useState(initialData ? 'adhoc' : 'favorites');
    const [form, setForm] = useState({
        name: initialData?.name || '',
        category: initialData?.category || 'MMA',
        start: initialData?.start || '17:00',
        end: initialData?.end || '18:30',
        location: initialData?.location || 'Rumble',
        cancel: initialData?.status === 'cancelled',
        reason: initialData?.cancellationReason || ''
    });

    const isExisting = !!initialData;
    const handleStartChange = (e) => {
        const newStart = e.target.value;
        const newEnd = addMinutes(newStart, 90);
        setForm({ ...form, start: newStart, end: newEnd });
    };

    const submit = () => {
        onSave({
            id: initialData?.id,
            ...form,
            status: form.cancel ? 'cancelled' : 'active',
            cancellationReason: form.cancel ? form.reason : null,
            cancellationTime: form.cancel ? (initialData?.cancellationTime || new Date().toISOString()) : null
        });
    };
    
    const existingNames = existingSessions.map(s => s.name);
    const availableTemplates = GLOBAL_TEMPLATES.filter(t => t.day === day && !existingNames.includes(t.name));

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
             <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 shrink-0">
                    <h3 className="text-white font-bold text-lg flex items-center"><span className="w-1 h-6 bg-blue-500 rounded-full mr-3"></span> {day}</h3>
                    <div className="flex gap-2">
                        {isExisting && (
                            <button onClick={() => onFeedback(`Session: ${initialData.name} (${day})`)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700">
                                <MessageSquarePlus className="w-5 h-5"/>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                    </div>
                </div>
                {!initialData && (
                    <div className="flex p-2 bg-slate-800/30 gap-2 shrink-0">
                        <button onClick={() => setTab('favorites')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'favorites' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Vælg Eksisterende</button>
                        <button onClick={() => setTab('adhoc')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'adhoc' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Opret Ny</button>
                    </div>
                )}
                <div className="p-5 space-y-6 overflow-y-auto">
                    {tab === 'favorites' && !initialData ? (
                        <div className="space-y-2">
                             {availableTemplates.map(t => {
                                 const cat = CATEGORIES.find(c => c.label === t.category) || CATEGORIES[6];
                                 return (
                                     <button key={t.id} onClick={() => onSave({...t, id: null})} className={`w-full text-left bg-slate-950 p-3 rounded-xl border ${cat.border} border-l-4 hover:bg-slate-900 transition-colors`}>
                                         <div className="font-bold text-sm text-white">{t.name}</div>
                                         <div className="text-xs text-slate-500">{t.start}-{t.end} • {t.location}</div>
                                     </button>
                                 );
                             })}
                             {availableTemplates.length === 0 && <p className="text-slate-500 text-xs italic text-center">Ingen flere faste pas at vælge.</p>}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {isExisting && <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-xs text-yellow-200 mb-2">Du kan kun slette eller aflyse dette pas. For at ændre tid/sted, slet og opret på ny.</div>}
                            <div>
                                <label className="block text-slate-400 text-xs uppercase font-bold mb-3">Kategori</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat.label} disabled={isExisting} onClick={() => setForm({...form, category: cat.label})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${form.category === cat.label ? `${cat.color} text-white border-transparent` : 'bg-slate-900 border-slate-700 text-slate-400'} ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}>{cat.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Navn</label>
                                <input disabled={isExisting} type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Start</label>
                                    <input disabled={isExisting} type="time" value={form.start} onChange={handleStartChange} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}/>
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Slut</label>
                                    <input disabled={isExisting} type="time" value={form.end} onChange={e => setForm({...form, end: e.target.value})} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Lokation</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                                    <select disabled={isExisting} value={form.location} onChange={e => setForm({...form, location: e.target.value})} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none appearance-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <option value="Rumble">Rumble</option>
                                        <option value="Burnell">Burnell</option>
                                        <option value="Roskilde">Roskilde</option>
                                        <option value="Andet">Andet</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"><ChevronDown className="w-4 h-4" /></div>
                                </div>
                            </div>
                            {isExisting && !isStandardMode && (
                                <div className="pt-4 border-t border-slate-800">
                                    <label className="flex items-center space-x-2 cursor-pointer mb-3">
                                        <input type="checkbox" checked={form.cancel} onChange={e => setForm({...form, cancel: e.target.checked})} className="w-5 h-5 rounded border-slate-600 text-red-600 bg-slate-800"/>
                                        <span className="text-sm font-bold text-slate-300">Aflys Træning</span>
                                    </label>
                                    {form.cancel && (
                                        <input type="text" placeholder="Årsag (fx Sygdom)" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full bg-red-950/30 border border-red-900/50 text-red-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 outline-none"/>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-800/50 flex space-x-3 shrink-0">
                    {initialData && <button onClick={() => onDelete(initialData.id)} className="py-3.5 px-4 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors"><Trash2 className="w-5 h-5"/></button>}
                    <button onClick={submit} className={`flex-1 py-3.5 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex justify-center items-center ${form.cancel ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>{form.cancel ? 'Gem & Aflys' : 'Gem'}</button>
                </div>
             </div>
        </div>
    );
};

// Admin Dashboard Component
const AdminDashboard = ({ onClose, onShowToast }) => {
    return (
        <div className="fixed inset-0 bg-slate-950 z-[60] flex items-center justify-center">
             <div className="text-center p-8">
                <h2 className="text-white text-xl font-bold mb-4">Admin Dashboard</h2>
                <button onClick={onClose} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Luk</button>
             </div>
        </div>
    );
};

const FeedbackModal = ({ user, currentContext, onClose, onShowToast }) => {
    const [text, setText] = useState('');
    const send = async () => {
        if(!text) return;
        try {
            await addDoc(collection(db, PUBLIC_DATA_PATH, 'feedback'), {
                text, user: user.email, timestamp: new Date().toISOString(), context: currentContext || 'App', status: 'new'
            });
            onShowToast("Tak for feedback!");
            onClose();
        } catch(e) { console.error(e); }
    };
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 p-6">
                <h3 className="text-white font-bold mb-2">Send Feedback</h3>
                <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm mb-4" rows="4" value={text} onChange={e=>setText(e.target.value)}></textarea>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="text-slate-400 px-4 py-2 text-sm">Luk</button>
                    <button onClick={send} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Send</button>
                </div>
            </div>
        </div>
    );
};

export default App;
