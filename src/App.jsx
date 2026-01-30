import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, Lock, HelpCircle 
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

// --- CONFIG & CONSTANTS ---
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

// Stamdata (Kataloget) - V12 Liste
const GLOBAL_TEMPLATES = [
  // Mandag
  { id: 'm1', day: 'Mandag', name: 'Wall Wrestling', category: 'Brydning', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'm2', day: 'Mandag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '19:00', location: 'Rumble' },
  { id: 'm3', day: 'Mandag', name: 'MMA Grappling', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  
  // Tirsdag
  { id: 't1', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 't2', day: 'Tirsdag', name: 'Grappling', category: 'Grappling', start: '17:00', end: '18:00', location: 'Burnell' },
  { id: 't3', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '17:00', end: '18:00', location: 'Rumble' },
  { id: 't4', day: 'Tirsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '19:00', location: 'Rumble' },
  { id: 't5', day: 'Tirsdag', name: 'Boksning', category: 'Boksning', start: '17:30', end: '19:00', location: 'Rødovre' },
  { id: 't6', day: 'Tirsdag', name: 'Nogi Adv', category: 'Grappling', start: '18:00', end: '19:00', location: 'Rumble' },
  { id: 't7', day: 'Tirsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '21:00', location: 'Roskilde' },

  // Onsdag
  { id: 'o1', day: 'Onsdag', name: 'MMA Sparring', category: 'MMA', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'o2', day: 'Onsdag', name: 'Grappling', category: 'Grappling', start: '17:00', end: '18:00', location: 'Burnell' },
  { id: 'o3', day: 'Onsdag', name: 'MMA Adv', category: 'MMA', start: '16:30', end: '18:00', location: 'Rumble' },
  { id: 'o4', day: 'Onsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:30', location: 'Rumble' },
  { id: 'o5', day: 'Onsdag', name: 'Nogi All', category: 'Grappling', start: '18:00', end: '19:30', location: 'Rumble' },

  // Torsdag
  { id: 'th1', day: 'Torsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 'th2', day: 'Torsdag', name: 'Nogi All', category: 'Grappling', start: '17:00', end: '18:00', location: 'Rumble' },
  { id: 'th3', day: 'Torsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:30', location: 'Rumble' },
  { id: 'th4', day: 'Torsdag', name: 'Boksning', category: 'Boksning', start: '17:30', end: '19:00', location: 'Rødovre' },
  { id: 'th5', day: 'Torsdag', name: 'Nogi Adv', category: 'Grappling', start: '18:00', end: '19:00', location: 'Rumble' },
  { id: 'th6', day: 'Torsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '21:00', location: 'Roskilde' },

  // Fredag
  { id: 'f1', day: 'Fredag', name: 'MMA', category: 'MMA', start: '17:00', end: '18:00', location: 'Rumble' },
  { id: 'f2', day: 'Fredag', name: 'MMA Sparring', category: 'MMA', start: '18:00', end: '19:00', location: 'Rumble' },

  // Lørdag
  { id: 'sa1', day: 'Lørdag', name: 'Nogi All', category: 'Grappling', start: '10:00', end: '11:00', location: 'Rumble' },
  { id: 'sa2', day: 'Lørdag', name: 'Boksning', category: 'Boksning', start: '10:00', end: '11:30', location: 'Rødovre' },
  { id: 'sa3', day: 'Lørdag', name: 'Boxing All', category: 'Boksning', start: '10:30', end: '12:00', location: 'Rumble' },
  { id: 'sa4', day: 'Lørdag', name: 'Nogi Adv', category: 'Grappling', start: '11:00', end: '12:00', location: 'Rumble' },
  { id: 'sa5', day: 'Lørdag', name: 'Brydning', category: 'Brydning', start: '14:00', end: '16:00', location: 'Roskilde' },

  // Søndag
  { id: 'su1', day: 'Søndag', name: 'Nogi All', category: 'Grappling', start: '12:00', end: '13:30', location: 'Rumble' },
  { id: 'su2', day: 'Søndag', name: 'Kickboxing All', category: 'Kickboxing', start: '13:30', end: '15:00', location: 'Rumble' },
];

// USER MAPPING & CONFIGURATION
const USER_MAPPING = {
  'carolinemollerh@gmail.com': { name: 'Caroline', role: 'fighter' },
  'sankarem00@gmail.com': { name: 'San', role: 'fighter' },
  'eneasopa354@gmail.com': { name: 'Enea', role: 'fighter' },
  'anton.emil.bang@gmail.com': { name: 'Anton', role: 'fighter' },
  'duraceljones@gmail.com': { name: 'Jonas', role: 'fighter' },
  'karl.lindsgren@gmail.com': { name: 'Karl', role: 'fighter' },
  'frodihansen@hotmail.com': { name: 'Frodi', role: 'coach' }, // Coach ser alt
  'rune.abrahamsson@gmail.com': { name: 'Rune', role: 'admin' } // Admin ser alt
};

const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl'];

// --- FIREBASE SETUP ---
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

// Data Path Helper
const ROOT_COLLECTION = `artifacts/production/users`; 

// --- UTILS ---
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

// --- COMPONENTS ---

// -- NEW CONFIRM MODAL --
const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 fade-in">
    <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl overflow-hidden p-6 text-center">
      <div className="mx-auto w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
        <HelpCircle className="w-6 h-6 text-blue-500" />
      </div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex space-x-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors">
          Annuller
        </button>
        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg">
          Bekræft
        </button>
      </div>
    </div>
  </div>
);

const LoginScreen = ({ onLogin, error }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center">
      <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
        <ShieldCheck className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">FightWeek</h1>
      <p className="text-slate-400 mb-8 text-sm">Log ind for at se din træningsplan</p>
      
      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-6 text-xs text-red-200 text-left">
            <p className="font-bold mb-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Login Fejl:</p>
            <p>{error}</p>
        </div>
      )}

      <button 
        onClick={onLogin}
        className="w-full bg-white text-slate-900 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
        Log ind med Google
      </button>
    </div>
  </div>
);

const AccessDenied = ({ email, onLogout }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
    <Lock className="w-12 h-12 text-red-500 mb-4" />
    <h2 className="text-xl font-bold text-white mb-2">Ingen Adgang</h2>
    <p className="text-slate-400 mb-6 max-w-xs">Emailen <strong>{email}</strong> er ikke oprettet i systemet endnu.</p>
    <button onClick={onLogout} className="text-slate-500 underline text-sm">Log ud</button>
  </div>
);

const Header = ({ activeFighter, isLocked, onSwitchFighter, currentUser, onLogout }) => (
  <div className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 sticky top-0 z-20">
    <div className="flex justify-between items-center max-w-md mx-auto">
      <div className="flex items-center space-x-2">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">FightWeek</h1>
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">
             {USER_MAPPING[currentUser?.email?.toLowerCase()]?.role === 'admin' ? 'Admin' : 'Production'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {isLocked ? (
          <div className="flex items-center bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <User className="w-3 h-3 text-slate-400 mr-2" />
            <span className="text-sm font-bold text-white">{activeFighter}</span>
          </div>
        ) : (
          <div className="relative group">
            <select 
              value={activeFighter} 
              onChange={(e) => onSwitchFighter(e.target.value)}
              className="appearance-none bg-slate-800 text-white pl-4 pr-10 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold shadow-sm"
            >
              {FIGHTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        )}
        <button onClick={onLogout} className="p-2 text-slate-500 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

const App = () => {
  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // App State
  const [activeFighter, setActiveFighter] = useState('Karl');
  const [isLocked, setIsLocked] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(5); 
  const [systemWeek] = useState(5); 
  const [view, setView] = useState('personal'); 
  const [isStandardMode, setIsStandardMode] = useState(false);
  const [scheduleData, setScheduleData] = useState({}); 
  const [teamData, setTeamData] = useState({}); 
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null); 
  
  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }

  // --- AUTH LOGIC ---
  useEffect(() => {
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
        } else {
            setAccessDenied(true);
            setUser(u);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubAuth();
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed", error);
        let msg = error.message;
        if (error.code === 'auth/unauthorized-domain') {
            msg = "Domænet er ikke godkendt. Husk at tilføje dit Vercel-link i Firebase Console.";
        } else if (error.code === 'auth/popup-closed-by-user') {
            msg = "Login blev afbrudt.";
        }
        setLoginError(msg);
    }
  };

  const handleLogout = () => {
      signOut(auth);
      setAccessDenied(false);
      setLoginError(null);
  };

  // --- DATA SYNC ---
  useEffect(() => {
    if (!user || accessDenied) return;
    const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const collectionPath = isStandardMode ? 'templates' : 'weeks';
    
    // Personal Sync
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
    const unsubPersonal = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScheduleData(data);
        if (data.lastUpdated) {
             const date = new Date(data.lastUpdated);
             setLastUpdated(date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
        } else {
             setLastUpdated(null);
        }
      } else {
        setScheduleData({});
        setLastUpdated('Aldrig');
      }
    });

    // Team Sync
    const unsubsTeam = [];
    FIGHTERS.forEach(fighter => {
        const fRef = doc(db, ROOT_COLLECTION, fighter, collectionPath, docId);
        const unsub = onSnapshot(fRef, (snap) => {
        if (snap.exists()) {
            setTeamData(prev => ({...prev, [fighter]: snap.data()}));
        } else {
            setTeamData(prev => ({...prev, [fighter]: {}}));
        }
        });
        unsubsTeam.push(unsub);
    });

    return () => {
      unsubPersonal();
      unsubsTeam.forEach(u => u());
    };
  }, [user, activeFighter, currentWeek, isStandardMode, accessDenied]);

  // --- ACTIONS & CONFIRMATIONS ---

  const saveToDb = async (newData) => {
      const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
      const collectionPath = isStandardMode ? 'templates' : 'weeks';
      const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
      newData.lastUpdated = new Date().toISOString();
      await setDoc(docRef, newData);
  };

  const handleSaveSession = async (session) => {
    if (!user) return;
    const newData = JSON.parse(JSON.stringify(scheduleData));
    if (!newData[editingDay]) newData[editingDay] = [];

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
    if (!user) return;
    const newData = JSON.parse(JSON.stringify(scheduleData));
    if (newData[editingDay]) {
        newData[editingDay] = newData[editingDay].filter(s => s.id !== sessionId);
        await saveToDb(newData);
    }
    setModalOpen(false);
  };

  // -- Refactored to use Custom Modal --
  const handleToggleRestDay = (day) => {
    if (!user || (currentWeek < systemWeek && !isStandardMode)) return; 
    
    const executeToggle = async () => {
        const newData = JSON.parse(JSON.stringify(scheduleData));
        let currentSessions = newData[day] || [];
        const isRest = currentSessions.some(s => s.isRestDay);

        if (isRest) {
            newData[day] = currentSessions.filter(s => !s.isRestDay);
        } else {
            // Logic for setting rest day (and cancelling active sessions)
            const activeSessions = currentSessions.filter(s => s.status !== 'cancelled' && !s.isRestDay);
            if (activeSessions.length > 0) {
                 // We need to handle this inside the check now
                 // Since we moved confirm out, we check if we need confirm
            }
            // See implementation below in wrapper
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

    // Check logic for confirmation
    const currentSessions = scheduleData[day] || [];
    const isRest = currentSessions.some(s => s.isRestDay);
    
    if (!isRest) {
        const activeSessions = currentSessions.filter(s => s.status !== 'cancelled' && !s.isRestDay);
        if (activeSessions.length > 0) {
            setConfirmDialog({
                title: "Bekræft Hviledag",
                message: `Du har ${activeSessions.length} planlagte pas. Vil du aflyse dem og holde hviledag?`,
                onConfirm: executeToggle
            });
            return;
        }
    }
    // No confirm needed (removing rest day or no sessions)
    executeToggle();
  };

  // -- Refactored Add Click --
  const handleAddClick = (day) => {
      const sessions = scheduleData[day] || [];
      const isRest = sessions.some(s => s.isRestDay);
      
      if (isRest) {
          setConfirmDialog({
              title: "Fjern Hviledag?",
              message: "Dette er en hviledag. Vil du fjerne hviledagen og oprette et pas?",
              onConfirm: async () => {
                  // Remove rest day logic directly
                  const newData = JSON.parse(JSON.stringify(scheduleData));
                  const currentSessions = newData[day] || [];
                  newData[day] = currentSessions.filter(s => !s.isRestDay);
                  await saveToDb(newData);
                  
                  setConfirmDialog(null);
                  setTimeout(() => { setEditingDay(day); setEditingSession(null); setModalOpen(true); }, 100);
              }
          });
          return;
      }
      setEditingDay(day);
      setEditingSession(null);
      setModalOpen(true);
  };

  // -- Refactored Import --
  const handleImportStandard = () => {
    if (!user) return;
    
    setConfirmDialog({
        title: "Hent Standarduge",
        message: "Dette vil overskrive hele ugen med din Standarduge. Er du sikker?",
        onConfirm: async () => {
            try {
                const standardRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
                const standardSnap = await getDoc(standardRef);
                if (standardSnap.exists()) {
                    await saveToDb(standardSnap.data());
                } else {
                    alert("Du har ikke oprettet en standarduge endnu.");
                }
            } catch (error) {
                console.error("Fejl:", error);
            }
            setConfirmDialog(null);
        }
    });
  };

  const changeWeek = (delta) => {
    const nextWeek = currentWeek + delta;
    if (nextWeek < 1 || nextWeek > systemWeek + 1) return; 
    setCurrentWeek(nextWeek);
    setIsStandardMode(false);
  };

  // --- RENDER ---
  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loader...</div>;
  if (!user) return <LoginScreen onLogin={handleLogin} error={loginError} />;
  if (accessDenied) return <AccessDenied email={user.email} onLogout={handleLogout} />;

  const isReadOnly = !isStandardMode && currentWeek < systemWeek;

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen pb-24 font-sans selection:bg-blue-500/30">
      <Header 
        activeFighter={activeFighter} 
        isLocked={isLocked} 
        onSwitchFighter={setActiveFighter} 
        currentUser={user}
        onLogout={handleLogout}
      />

      <div className="max-w-md mx-auto relative pt-4 min-h-[85vh]">
        
        {/* Banner: Standard Mode */}
        {isStandardMode && (
          view === 'team' ? (
            <div className="mx-4 mb-4 bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-3 flex items-start space-x-3 fade-in">
              <Globe className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-sm text-indigo-200 font-bold">Teamets Standarduger</p>
                <p className="text-xs text-indigo-300/80 mt-1">Her ser du teamets faste grundplan.</p>
              </div>
            </div>
          ) : (
            <div className="mx-4 mb-4 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3 flex items-start space-x-3 fade-in">
              <Info className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-200 font-bold">Redigerer Standarduge</p>
                <p className="text-xs text-yellow-400/80 mt-1">Dette er din skabelon. Klik "Gem" når du er færdig.</p>
              </div>
            </div>
          )
        )}

        {/* Controls */}
        <div className="mx-4 mb-4 space-y-3">
          <div className="flex items-center justify-between bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-md">
            <button onClick={() => changeWeek(-1)} className={`p-2 hover:bg-slate-700 rounded-lg text-slate-400 active:scale-95 transition-all ${currentWeek <= 1 ? 'invisible' : ''}`}>
                <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                {currentWeek === systemWeek ? "Aktuel Uge" : currentWeek < systemWeek ? "Tidligere Uge" : "Næste Uge"}
              </span>
              <div className="text-white font-bold text-xl">Uge {currentWeek}</div>
            </div>
            <button onClick={() => changeWeek(1)} className={`p-2 hover:bg-slate-700 rounded-lg text-slate-400 active:scale-95 transition-all ${currentWeek >= systemWeek + 1 ? 'invisible' : ''}`}>
                <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex justify-between items-center px-1">
            <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-medium">
                {!isStandardMode && lastUpdated && (
                    <><Clock className="w-3 h-3" /><span>Opdateret: {lastUpdated}</span></>
                )}
                {isReadOnly && <span className="flex items-center text-slate-400 ml-2"><History className="w-3 h-3 mr-1"/> Historik</span>}
            </div>
            {!isReadOnly && (
                <div className="flex space-x-2">
                    {isStandardMode ? (
                        <button onClick={() => setIsStandardMode(false)} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-yellow-900/50 text-yellow-100 border-yellow-700 transition-colors flex items-center">
                           <X className="w-3 h-3 mr-1.5"/> Luk Standard
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setIsStandardMode(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 transition-colors flex items-center">
                                <Globe className="w-3 h-3 mr-1.5"/> {view === 'personal' ? 'Rediger standarduge' : 'Se standarduger'}
                            </button>
                            {/* Kun vis 'Hent Standard' hvis vi er på personlig visning */}
                            {view === 'personal' && (
                                <button onClick={handleImportStandard} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-blue-900/20 text-blue-400 border-blue-800/50 hover:bg-blue-900/40 transition-colors flex items-center">
                                    <ChevronDown className="w-3 h-3 mr-1.5"/> Hent Standard
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
          </div>
        </div>

        {/* VIEWS */}
        {view === 'personal' ? (
          <PersonalSchedule 
            days={DAYS} 
            data={scheduleData} 
            isReadOnly={isReadOnly}
            onToggleRest={handleToggleRestDay}
            onAdd={handleAddClick}
            onEdit={(day, session) => { setEditingDay(day); setEditingSession(session); setModalOpen(true); }}
          />
        ) : (
            <TeamSchedule days={DAYS} teamData={teamData} />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe z-50">
        <div className="max-w-md mx-auto flex justify-around p-2">
            <NavButton icon={Calendar} label="Min Plan" active={view === 'personal'} onClick={() => setView('personal')} />
            <NavButton icon={User} label="Teamet" active={view === 'team'} onClick={() => setView('team')} />
        </div>
      </div>

      {modalOpen && (
          <SessionModal 
            day={editingDay}
            initialData={editingSession}
            onClose={() => setModalOpen(false)}
            onSave={handleSaveSession}
            onDelete={handleDeleteSession}
            isStandardMode={isStandardMode}
          />
      )}
      
      {/* GLOBAL CONFIRM DIALOG */}
      {confirmDialog && (
          <ConfirmModal 
              title={confirmDialog.title}
              message={confirmDialog.message}
              onConfirm={confirmDialog.onConfirm}
              onCancel={() => setConfirmDialog(null)}
          />
      )}
    </div>
  );
};

// --- SUB COMPONENTS ---

const NavButton = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl w-1/2 transition-colors ${active ? 'text-blue-500' : 'text-slate-500'}`}>
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

const PersonalSchedule = ({ days, data, isReadOnly, onToggleRest, onAdd, onEdit }) => (
    <div className="px-4 space-y-3 pb-32 fade-in">
        {days.map(day => {
            const sessions = data[day] || [];
            const isRestDay = sessions.some(s => s.isRestDay);
            const visibleSessions = sessions.filter(s => !s.isRestDay);

            return (
                <div key={day} className={`mb-3 rounded-2xl p-4 border transition-all shadow-md ${isRestDay ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center space-x-2">
                            <h3 className={`text-white font-bold text-lg ${isReadOnly ? 'text-slate-400' : ''}`}>{day}</h3>
                            {isRestDay && <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">HVILEDAG</span>}
                        </div>
                        <div className="flex space-x-1">
                             <button disabled={isReadOnly} onClick={() => onToggleRest(day)} className={`p-1.5 rounded-full transition-colors ${isRestDay ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'} ${isReadOnly ? 'opacity-0' : ''}`}><Bed className="w-4 h-4" /></button>
                             <button disabled={isReadOnly} onClick={() => onAdd(day)} className={`bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-full p-1.5 transition-colors ${isReadOnly ? 'opacity-0' : ''}`}><Plus className="w-5 h-5" /></button>
                        </div>
                    </div>

                    {visibleSessions.length === 0 && !isRestDay && (
                        <div className="text-slate-600 text-sm font-medium py-3 text-center border-2 border-dashed border-slate-800/50 rounded-xl">Ingen pas planlagt</div>
                    )}

                    {visibleSessions.map(s => {
                        const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                        const isCancelled = s.status === 'cancelled';
                        const cancelInfo = isCancelled ? formatCancellationTime(s.cancellationTime) : '';

                        return (
                            <div key={s.id} onClick={() => !isReadOnly && onEdit(day, s)} className={`relative flex items-center justify-between p-3 rounded-xl mb-2 border shadow-sm transition-all ${isCancelled ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-slate-800 border-slate-700/50'} ${!isReadOnly ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${isCancelled ? 'bg-red-900' : cat.color}`}></div>
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
                                        {isCancelled && <div className="mt-1 text-[10px] text-red-400 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Aflyst {cancelInfo}: {s.cancellationReason}</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        })}
    </div>
);

const TeamSchedule = ({ days, teamData }) => {
    const [selectedDay, setSelectedDay] = useState('Mandag');
    const timeSlots = {};
    Object.keys(teamData).forEach(fighter => {
        const data = teamData[fighter];
        if (!data) return; 
        const sessions = data[selectedDay] || [];
        sessions.forEach(s => {
            if (s.isRestDay) return;
            const timeKey = s.start || 'TBA';
            if (!timeSlots[timeKey]) timeSlots[timeKey] = [];
            timeSlots[timeKey].push({ ...s, fighter });
        });
    });
    const sortedTimes = Object.keys(timeSlots).sort();

    return (
        <div className="fade-in">
             <div className="bg-slate-900/50 mx-4 mb-4 rounded-xl p-2 flex space-x-2 overflow-x-auto hide-scroll">
                 {days.map(d => (
                     <button key={d} onClick={() => setSelectedDay(d)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all border ${selectedDay === d ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{d}</button>
                 ))}
             </div>
             <div className="px-4 space-y-4 pb-32">
                 {sortedTimes.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl"><User className="w-10 h-10 mb-2 opacity-50"/><p>Ingen fælles træning</p></div>
                 )}
                 {sortedTimes.map(time => {
                     const sessions = timeSlots[time];
                     return (
                        <div key={time} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                            <div className="bg-slate-800/80 p-3 flex justify-between items-center border-b border-slate-800">
                                <div className="flex items-center text-blue-400 font-bold font-mono text-lg">{time}</div>
                                <div className="flex items-center text-slate-500 text-[10px] font-medium uppercase bg-slate-950 px-2 py-1 rounded"><MapPin className="w-3 h-3 mr-1"/> {sessions[0].location}</div>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-2">
                                {sessions.map((s, i) => {
                                    const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                                    const isCancelled = s.status === 'cancelled';
                                    return (
                                        <div key={i} className="bg-slate-800/50 p-2.5 rounded border border-slate-700/50 flex items-center justify-between">
                                            <div className="flex items-center w-full">
                                                <span className={`w-1.5 h-6 rounded-full ${isCancelled ? 'bg-slate-700' : cat.color} mr-2.5 shadow-sm`}></span>
                                                <div className={`flex-1 ${isCancelled ? 'opacity-50 line-through' : ''}`}>
                                                    <div className="text-white text-xs font-bold leading-tight">{s.fighter}</div>
                                                    <div className="text-slate-400 text-[10px]">{s.name}</div>
                                                </div>
                                                {isCancelled && <span className="text-[9px] text-red-400 bg-red-900/50 px-1 rounded ml-auto">AFLYST</span>}
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

const SessionModal = ({ day, initialData, onClose, onSave, onDelete, isStandardMode }) => {
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

    const submit = () => {
        onSave({
            id: initialData?.id,
            ...form,
            status: form.cancel ? 'cancelled' : 'active',
            cancellationReason: form.cancel ? form.reason : null,
            cancellationTime: form.cancel ? (initialData?.cancellationTime || new Date().toISOString()) : null
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
             <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 shrink-0">
                    <h3 className="text-white font-bold text-lg flex items-center">
                        <span className="w-1 h-6 bg-blue-500 rounded-full mr-3"></span> {day}
                    </h3>
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
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
                             {GLOBAL_TEMPLATES.filter(t => t.day === day).map(t => {
                                 const cat = CATEGORIES.find(c => c.label === t.category) || CATEGORIES[6];
                                 return (
                                     <button key={t.id} onClick={() => onSave({...t, id: null})} className={`w-full text-left bg-slate-950 p-3 rounded-xl border ${cat.border} border-l-4 hover:bg-slate-900 transition-colors`}>
                                         <div className="font-bold text-sm text-white">{t.name}</div>
                                         <div className="text-xs text-slate-500">{t.start}-{t.end} • {t.location}</div>
                                     </button>
                                 );
                             })}
                             {GLOBAL_TEMPLATES.filter(t => t.day === day).length === 0 && <p className="text-slate-500 text-xs italic text-center">Ingen faste pas denne dag.</p>}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {isExisting && <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-xs text-yellow-200 mb-2">Du kan kun slette eller aflyse dette pas. For at ændre tid/sted, slet og opret på ny.</div>}
                            
                            <div>
                                <label className="block text-slate-400 text-xs uppercase font-bold mb-3">Kategori</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button 
                                            key={cat.label} 
                                            disabled={isExisting} 
                                            onClick={() => setForm({...form, category: cat.label})} 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${form.category === cat.label ? `${cat.color} text-white border-transparent` : 'bg-slate-900 border-slate-700 text-slate-400'} ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {cat.label}
                                        </button>
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
                                    <input disabled={isExisting} type="time" value={form.start} onChange={e => setForm({...form, start: e.target.value})} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}/>
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Slut</label>
                                    <input disabled={isExisting} type="time" value={form.end} onChange={e => setForm({...form, end: e.target.value})} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}/>
                                </div>
                            </div>

                            {/* Lokation Dropdown */}
                            <div>
                                <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Lokation</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                                    <select 
                                        disabled={isExisting}
                                        value={form.location} 
                                        onChange={e => setForm({...form, location: e.target.value})}
                                        className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none appearance-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="Rumble">Rumble</option>
                                        <option value="Burnell">Burnell</option>
                                        <option value="Roskilde">Roskilde</option>
                                        <option value="Andet">Andet</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
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

export default App;
