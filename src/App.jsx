import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe 
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot 
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

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

// Stamdata (Kataloget)
const GLOBAL_TEMPLATES = [
  { id: 'g1', day: 'Mandag', name: 'Wall Wrestling', category: 'Brydning', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'g2', day: 'Mandag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:15', location: 'Rumble' },
  { id: 'g3', day: 'Mandag', name: 'MMA Grappling', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 'g4', day: 'Mandag', name: 'Frodi Wall', category: 'Brydning', start: '19:30', end: '21:00', location: 'Rumble' },
  { id: 'g5', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 'g9', day: 'Tirsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '20:30', location: 'Roskilde' },
  { id: 'g10', day: 'Onsdag', name: 'MMA Sparring', category: 'MMA', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'g12', day: 'Onsdag', name: 'MMA Adv', category: 'MMA', start: '16:30', end: '18:00', location: 'Rumble' },
  { id: 'g14', day: 'Torsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:15', location: 'Rumble' },
  { id: 'g17', day: 'Fredag', name: 'MMA Sparring', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 'g22', day: 'Lørdag', name: 'Brydning', category: 'Brydning', start: '14:00', end: '16:00', location: 'Roskilde' }
];

const FIGHTERS = ['Karl', 'Frode', 'Anton'];

// --- FIREBASE SETUP ---
// Her er din rigtige konfiguration indsat:
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

// Data Path Helper - Bruger 'production' som ID hvis ikke andet er sat
const ROOT_COLLECTION = `artifacts/production/users`; 

// --- UTILS ---
const formatCancellationTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    // Hvis samme dag: Vis tidspunkt
    if (date.toDateString() === now.toDateString()) {
        return `Kl. ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    // Ellers vis ugedag
    const dayIndex = date.getDay(); // 0 = Søndag
    const dayName = dayIndex === 0 ? 'Søndag' : DAYS[dayIndex - 1];
    return dayName;
};

// --- COMPONENTS ---

const Header = ({ activeFighter, isLocked, onSwitchFighter }) => (
  <div className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 sticky top-0 z-20">
    <div className="flex justify-between items-center max-w-md mx-auto">
      <div className="flex items-center space-x-2">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">FightWeek</h1>
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">Production</p>
        </div>
      </div>
      
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
    </div>
  </div>
);

const App = () => {
  // State
  const [activeFighter, setActiveFighter] = useState('Karl');
  const [isLocked, setIsLocked] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(5); // Startede på 6 før, rettet til 5 jf. bug
  const [systemWeek] = useState(5); 
  const [view, setView] = useState('personal'); 
  const [isStandardMode, setIsStandardMode] = useState(false);
  const [scheduleData, setScheduleData] = useState({}); 
  const [teamData, setTeamData] = useState({}); 
  const [user, setUser] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null); 

  // --- AUTH & INIT ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fighterParam = params.get('fighter');
    if (fighterParam && FIGHTERS.includes(fighterParam)) {
      setActiveFighter(fighterParam);
      setIsLocked(true);
    }

    const initAuth = async () => {
        // Bruger anonymt login til MVP
        await signInAnonymously(auth); 
    };
    initAuth();
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubAuth();
  }, []);

  // --- DATA SYNC ---
  useEffect(() => {
    if (!user) return;

    const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const collectionPath = isStandardMode ? 'templates' : 'weeks';
    
    // A. Listen to Active Fighter's Plan
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

    // B. Listen to TEAM data (Dynamisk baseret på Standard/Uge)
    const teamDocId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const teamColPath = isStandardMode ? 'templates' : 'weeks';
    
    const unsubsTeam = [];
    
    // Vi lytter altid på teamet, så viewet er klar hvis man skifter
    FIGHTERS.forEach(fighter => {
        const fRef = doc(db, ROOT_COLLECTION, fighter, teamColPath, teamDocId);
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
  }, [user, activeFighter, currentWeek, isStandardMode]);

  // --- HELPERS ---
  const saveToDb = async (newData) => {
      const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
      const collectionPath = isStandardMode ? 'templates' : 'weeks';
      const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
      
      // Add Timestamp
      newData.lastUpdated = new Date().toISOString();
      
      await setDoc(docRef, newData);
  };

  // --- ACTIONS ---

  const handleSaveSession = async (session) => {
    if (!user) return;
    
    // Deep copy
    const newData = JSON.parse(JSON.stringify(scheduleData));
    if (!newData[editingDay]) newData[editingDay] = [];

    if (session.id) {
        const idx = newData[editingDay].findIndex(s => s.id === session.id);
        if (idx > -1) {
            newData[editingDay][idx] = session;
        } else {
            newData[editingDay].push(session); 
        }
    } else {
        session.id = Date.now();
        newData[editingDay].push(session);
    }
    
    // Sort logic
    newData[editingDay].sort((a,b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start.localeCompare(b.start);
    });

    setScheduleData(newData); // Optimistic UI
    await saveToDb(newData); // Sync DB
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

  const handleToggleRestDay = async (day) => {
    if (!user || (currentWeek < systemWeek && !isStandardMode)) return; 

    const newData = JSON.parse(JSON.stringify(scheduleData));
    let currentSessions = newData[day] || [];
    const isRest = currentSessions.some(s => s.isRestDay);

    if (isRest) {
        // Fjern hviledag -> Behold sessions, men fjern 'isRestDay' flaget
        // Hvis der var gamle sessions, vil de stadig ligge der som cancelled.
        // For simpelhedens skyld fjerner vi bare selve hviledags-objektet.
        newData[day] = currentSessions.filter(s => !s.isRestDay);
    } else {
        // Sæt hviledag
        const activeSessions = currentSessions.filter(s => s.status !== 'cancelled' && !s.isRestDay);
        
        if (activeSessions.length > 0) {
            if (!confirm(`Du har ${activeSessions.length} planlagte pas. Vil du aflyse dem og holde hviledag?`)) return;
            
            // Marker alle aktive som aflyst
            currentSessions = currentSessions.map(s => {
                if (s.status !== 'cancelled' && !s.isRestDay) {
                    return {
                        ...s,
                        status: 'cancelled',
                        cancellationReason: 'Hviledag',
                        cancellationTime: new Date().toISOString()
                    };
                }
                return s;
            });
        }
        // Tilføj hviledags markør
        currentSessions.push({ isRestDay: true, id: Date.now() });
        newData[day] = currentSessions;
    }

    await saveToDb(newData);
  };

  const handleAddClick = (day) => {
      const sessions = scheduleData[day] || [];
      const isRest = sessions.some(s => s.isRestDay);
      
      if (isRest) {
          if(!confirm("Dette er en hviledag. Vil du fjerne hviledagen og oprette et pas?")) return;
          handleToggleRestDay(day); // Fjerner hviledag
          // Vent lidt med at åbne modal til state er opdateret, eller bare åbn den nu
          setTimeout(() => {
             setEditingDay(day);
             setEditingSession(null);
             setModalOpen(true);
          }, 100);
          return;
      }
      
      setEditingDay(day);
      setEditingSession(null);
      setModalOpen(true);
  };

  const handleImportStandard = async () => {
    if (!user) return;
    if (!confirm("Dette vil overskrive hele ugen med din Standarduge. Er du sikker?")) return;

    try {
        const standardRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
        const standardSnap = await getDoc(standardRef);

        if (standardSnap.exists()) {
            const standardData = standardSnap.data();
            await saveToDb(standardData);
        } else {
            alert("Du har ikke oprettet en standarduge endnu. Gå til 'Rediger Standarduge' først.");
        }
    } catch (error) {
        console.error("Fejl ved import:", error);
        alert("Der skete en fejl ved hentning af standarduge.");
    }
  };

  // --- NAVIGATION ---
  const changeWeek = (delta) => {
    const nextWeek = currentWeek + delta;
    if (nextWeek < 1) return; 
    if (nextWeek > systemWeek + 1) return; 
    setCurrentWeek(nextWeek);
    setIsStandardMode(false);
  };

  const isReadOnly = !isStandardMode && currentWeek < systemWeek;

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen pb-24 font-sans selection:bg-blue-500/30">
      <Header activeFighter={activeFighter} isLocked={isLocked} onSwitchFighter={setActiveFighter} />

      <div className="max-w-md mx-auto relative pt-4 min-h-[85vh]">
        
        {/* Banner: Standard Mode */}
        {isStandardMode && (
          <div className="mx-4 mb-4 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3 flex items-start space-x-3 fade-in">
            <Info className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-200 font-bold">Redigerer Standarduge</p>
              <p className="text-xs text-yellow-400/80 mt-1">Dette er din skabelon. Klik "Gem" når du er færdig.</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mx-4 mb-4 space-y-3">
          <div className="flex items-center justify-between bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-md">
            <button 
                onClick={() => changeWeek(-1)} 
                className={`p-2 hover:bg-slate-700 rounded-lg text-slate-400 active:scale-95 transition-all ${currentWeek <= 1 ? 'invisible' : ''}`}
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                {currentWeek === systemWeek ? "Aktuel Uge" : currentWeek < systemWeek ? "Tidligere Uge" : "Næste Uge"}
              </span>
              <div className="text-white font-bold text-xl">Uge {currentWeek}</div>
            </div>
            <button 
                onClick={() => changeWeek(1)} 
                className={`p-2 hover:bg-slate-700 rounded-lg text-slate-400 active:scale-95 transition-all ${currentWeek >= systemWeek + 1 ? 'invisible' : ''}`}
            >
                <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex justify-between items-center px-1">
            <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-medium">
                {!isStandardMode && lastUpdated && (
                    <>
                        <Clock className="w-3 h-3" />
                        <span>Opdateret: {lastUpdated}</span>
                    </>
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
                                <Globe className="w-3 h-3 mr-1.5"/> Rediger Standarduge
                            </button>
                            {/* Viser altid Hent Standard hvis vi er i fremtiden eller aktuel uge (og data er tom ELLER brugeren vil overskrive) */}
                            <button onClick={handleImportStandard} className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-blue-900/20 text-blue-400 border-blue-800/50 hover:bg-blue-900/40 transition-colors flex items-center">
                                <ChevronDown className="w-3 h-3 mr-1.5"/> Hent Standard
                            </button>
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

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe z-50">
        <div className="max-w-md mx-auto flex justify-around p-2">
            <NavButton icon={Calendar} label="Min Plan" active={view === 'personal'} onClick={() => setView('personal')} />
            <NavButton icon={User} label="Teamet" active={view === 'team'} onClick={() => setView('team')} />
        </div>
      </div>

      {/* MODAL */}
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
            
            // Vi filtrerer ikke cancelled væk, men viser dem hvis hviledag
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
    
    // Aggregate Data
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

    const isExisting = !!initialData; // Are we editing?

    // Pre-save formatter
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
                            {/* Hvis det er et eksisterende pas, kan man ikke redigere detaljer */}
                            {isExisting && <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-xs text-yellow-200 mb-2">Du kan kun slette eller aflyse dette pas. For at ændre tid/sted, slet og opret på ny.</div>}
                            
                            <div>
                                <label className="block text-slate-400 text-xs uppercase font-bold mb-3">Kategori</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button 
                                            key={cat.label} 
                                            disabled={isExisting} // Låst hvis edit
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
                            
                            {/* Aflysning vises kun hvis vi redigerer et eksisterende pas (isExisting) OG ikke er i standard mode */}
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
                    {/* Knappen er kun aktiv hvis det er 'Opret' ELLER 'Gem & Aflys' ELLER 'Gem Standard'. Hvis det er alm edit uden aflysning, giver knappen ikke mening medmindre vi tillader at gemme uændret, men lad os holde den */}
                    <button onClick={submit} className={`flex-1 py-3.5 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex justify-center items-center ${form.cancel ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>{form.cancel ? 'Gem & Aflys' : 'Gem'}</button>
                </div>
             </div>
        </div>
    );
};

export default App;
