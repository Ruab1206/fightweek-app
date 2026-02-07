import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, Lock, HelpCircle, Smartphone, ExternalLink, Copy, Check, MousePointerClick,
  ClipboardList, MessageSquarePlus, Download, ArrowRight, ArrowLeft, Tag, Share2, List, Layout, GripVertical, Edit2, Filter, ChevronUp, Monitor, Terminal, Upload, FileDown, RefreshCw, Eye, EyeOff, Search, Settings
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, writeBatch, getDocs 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,  
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

// Stamdata (Kataloget)
const GLOBAL_TEMPLATES = [
  { id: 'm1', day: 'Mandag', name: 'Wall Wrestling', category: 'Brydning', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'm2', day: 'Mandag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '19:00', location: 'Rumble' },
  { id: 'm3', day: 'Mandag', name: 'MMA Grappling', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 't1', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 't2', day: 'Tirsdag', name: 'Grappling', category: 'Grappling', start: '17:00', end: '18:00', location: 'Burnell' },
  { id: 't7', day: 'Tirsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '21:00', location: 'Roskilde' },
  { id: 'o1', day: 'Onsdag', name: 'MMA Sparring', category: 'MMA', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'o3', day: 'Onsdag', name: 'MMA Adv', category: 'MMA', start: '16:30', end: '18:00', location: 'Rumble' },
  { id: 'th3', day: 'Torsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:30', location: 'Rumble' },
  { id: 'f2', day: 'Fredag', name: 'MMA Sparring', category: 'MMA', start: '18:00', end: '19:00', location: 'Rumble' },
  { id: 'sa5', day: 'Lørdag', name: 'Brydning', category: 'Brydning', start: '14:00', end: '16:00', location: 'Roskilde' },
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

const ROOT_COLLECTION = `artifacts/production/users`; 
const PUBLIC_DATA_PATH = `artifacts/production/public/data`; 

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

const getISOWeek = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const checkInAppBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Instagram") > -1);
};

const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- POKA-YOKE CSV PARSER (v5) ---
const parseCSV = (text) => {
    if (!text) return [];
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    const firstLine = cleanText.split('\n')[0];
    let delimiter = ';';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';

    const result = [];
    let row = [];
    let currentField = "";
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++; 
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                row.push(currentField.trim());
                currentField = "";
            } else if (char === '\n') {
                row.push(currentField.trim());
                if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
                    result.push(row);
                }
                row = [];
                currentField = "";
            } else {
                currentField += char;
            }
        }
    }
    if (currentField || row.length > 0) {
        row.push(currentField.trim());
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) result.push(row);
    }

    if (result.length === 0) return [];
    
    const headers = result[0].map(h => h.replace(/^"|"$/g, '').trim());
    return result.slice(1).map(values => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = (values[i] || "").replace(/^"|"$/g, '').trim();
        });
        return obj;
    });
};

const generateCSV = (tasks) => {
    const headers = ['Titel', 'Status', 'Beskrivelse', 'Acceptkriterier', 'Noter', 'Datafelter', 'Release', 'Tag', 'Prioritet', 'ID', 'Order'];
    const rows = [headers.join(';')];
    tasks.forEach(t => {
        const wrap = (v) => `"${(v || "").toString().replace(/"/g, '""')}"`;
        rows.push([
            wrap(t.title), wrap(t.status), wrap(t.desc), wrap(t.acceptance), 
            wrap(t.notes), wrap(t.dataFields), wrap(t.release), wrap(t.tag), 
            wrap(t.priority), wrap(t.id), wrap(t.order)
        ].join(';'));
    });
    return rows.join('\n');
};

// --- COMPONENTS ---

const BrowserBlockScreen = () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
            <Smartphone className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-white font-bold text-xl mb-2">Brug Safari eller Chrome</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Google tillader ikke login direkte i Messenger eller Instagram. 
                Åbn venligst linket i din rigtige browser for at fortsætte.
            </p>
        </div>
    </div>
);

const LoginScreen = ({ onLoginPopup, onLoginRedirect, error, loading }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center relative">
      <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono italic tracking-tighter">v1.44 Stable</div>
      <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
        <ShieldCheck className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">FightWeek</h1>
      <p className="text-slate-400 mb-8 text-sm">Log ind for at se din personlige ugeplan</p>
      
      {error && <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-6 text-xs text-red-200 text-left leading-relaxed">{error}</div>}

      <button onClick={onLoginPopup} disabled={loading} className="w-full bg-white text-slate-900 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 mb-4 active:scale-95 disabled:opacity-50">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
        {loading ? 'Initialiserer...' : 'Log ind med Google'}
      </button>

      <button onClick={onLoginRedirect} className="text-slate-500 text-xs hover:text-blue-400 underline flex items-center justify-center w-full mt-2 transition-colors">
        <ExternalLink className="w-3 h-3 mr-1" />
        Virker knappen ikke? Brug Redirect
      </button>
    </div>
  </div>
);

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 fade-in">
    <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 text-center">
      <HelpCircle className="w-10 h-10 text-blue-500 mx-auto mb-4" />
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">{message}</p>
      <div className="flex space-x-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-all">Annuller</button>
        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">Bekræft</button>
      </div>
    </div>
  </div>
);

// --- ADMIN DASHBOARD ---
const AdminDashboard = ({ user, onClose }) => {
    const [tasks, setTasks] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [view, setView] = useState('list'); 
    const [statusFilter, setStatusFilter] = useState('active'); 
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [form, setForm] = useState({ title: '', status: 'backlog', priority: 'Medium', tag: 'APP', desc: '', acceptance: '', notes: '', release: '' });

    useEffect(() => {
        if (!user) return;
        const unsubT = onSnapshot(collection(db, PUBLIC_DATA_PATH, 'backlog'), (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setTasks(items);
        });
        const unsubF = onSnapshot(collection(db, PUBLIC_DATA_PATH, 'feedback'), (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setFeedback(items);
        });
        return () => { unsubT(); unsubF(); };
    }, [user]);

    const filteredTasks = tasks.filter(t => {
        if (statusFilter === 'active') return t.status !== 'done';
        if (statusFilter === 'done') return t.status === 'done';
        return true;
    });

    const handleSaveTask = async () => {
        if (!form.title) return;
        const payload = { ...form, updatedAt: new Date().toISOString() };
        if (editingTask) {
            await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', editingTask.id), payload);
        } else {
            await addDoc(collection(db, PUBLIC_DATA_PATH, 'backlog'), { ...payload, createdAt: new Date().toISOString(), order: Date.now() });
        }
        setIsFormOpen(false);
        setEditingTask(null);
    };

    const handleImportCSV = async (csvText, mode) => {
        try {
            const parsed = parseCSV(csvText);
            const batch = writeBatch(db);
            if (mode === 'replace') {
                const snap = await getDocs(collection(db, PUBLIC_DATA_PATH, 'backlog'));
                snap.forEach(d => batch.delete(d.ref));
            }
            parsed.forEach((row, i) => {
                if (!row.Titel) return;
                const ref = doc(collection(db, PUBLIC_DATA_PATH, 'backlog'));
                batch.set(ref, {
                    title: row.Titel,
                    status: (row.Status || 'backlog').toLowerCase().replace('færdig', 'done').replace('igang', 'doing'),
                    desc: row.Beskrivelse || '',
                    acceptance: row.Acceptkriterier || '',
                    notes: row.Noter || '',
                    tag: row.Tag || 'APP',
                    priority: row.Prioritet || 'Medium',
                    release: row.Release || '',
                    order: row.Order ? Number(row.Order) : i,
                    createdAt: new Date().toISOString()
                });
            });
            await batch.commit();
            setIsImportOpen(false);
            alert("Import fuldført!");
        } catch (e) { alert("Fejl ved import: " + e.message); }
    };

    return (
        <div className="fixed inset-0 bg-slate-950 z-[100] overflow-y-auto pb-20 fade-in">
            <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-10 shadow-lg">
                <div className="flex items-center">
                    <button onClick={onClose} className="mr-3 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5"/></button>
                    <div>
                        <h2 className="text-white font-bold">Admin Dashboard</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">System Management</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { const csv = generateCSV(tasks); navigator.clipboard.writeText(csv); alert("CSV kopieret!"); }} className="bg-slate-800 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 flex items-center hover:bg-slate-700 transition-colors"><FileDown className="w-3 h-3 mr-2"/> Export</button>
                    <button onClick={() => setIsImportOpen(true)} className="bg-slate-800 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 flex items-center hover:bg-slate-700 transition-colors"><Upload className="w-3 h-3 mr-2"/> Import</button>
                </div>
            </div>

            <div className="p-4 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                        <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Liste</button>
                        <button onClick={() => setView('board')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'board' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Board</button>
                        <button onClick={() => setView('feedback')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'feedback' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Feedback ({feedback.length})</button>
                    </div>

                    <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 font-bold text-[10px] uppercase shadow-inner">
                        <button onClick={() => setStatusFilter('active')} className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'active' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}>Aktive</button>
                        <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}>Alle</button>
                        <button onClick={() => setStatusFilter('done')} className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'done' ? 'bg-green-900 text-green-400 border border-green-800/30 shadow-sm' : 'text-slate-500'}`}>Færdige</button>
                    </div>
                </div>

                {view === 'list' && (
                    <div className="space-y-3">
                        <button onClick={() => { setForm({ title: '', status: 'backlog', priority: 'Medium', tag: 'APP', desc: '', acceptance: '', notes: '', release: '' }); setEditingTask(null); setIsFormOpen(true); }} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 font-bold hover:text-slate-300 hover:border-slate-600 transition-all flex justify-center items-center group"><Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform"/> Tilføj ny opgave</button>
                        {filteredTasks.map(t => (
                            <div key={t.id} onClick={() => { setEditingTask(t); setForm(t); setIsFormOpen(true); }} className="bg-slate-900 border border-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-800 transition-all border-l-4 border-l-blue-600 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.status === 'done' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>{t.status.toUpperCase()}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{t.tag}</span>
                                    </div>
                                    <span className="text-slate-600 text-[10px] font-mono">#{t.order}</span>
                                </div>
                                <h3 className="text-white font-bold text-sm leading-snug">{t.title}</h3>
                                {t.desc && <p className="text-slate-500 text-xs mt-1 line-clamp-1">{t.desc}</p>}
                                {t.acceptance && <div className="mt-3 p-2 bg-slate-950 rounded text-[10px] text-slate-400 font-mono whitespace-pre-wrap border border-slate-800/50 leading-relaxed">AC: {t.acceptance.slice(0, 150)}...</div>}
                            </div>
                        ))}
                    </div>
                )}

                {view === 'board' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                        {['backlog', 'todo', 'doing', 'done'].map(status => {
                            if (status === 'done' && statusFilter === 'active') return null;
                            return (
                                <div key={status} className="bg-slate-900/50 rounded-xl border border-slate-800 p-3 min-w-[280px] min-h-[500px] flex flex-col">
                                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-4 px-1 flex justify-between items-center">{status} <span className="bg-slate-800 px-2 rounded-full font-mono">{tasks.filter(t => t.status === status).length}</span></h4>
                                    <div className="space-y-2 flex-1">
                                        {filteredTasks.filter(t => t.status === status).map(t => (
                                            <div key={t.id} onClick={() => { setEditingTask(t); setForm(t); setIsFormOpen(true); }} className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-sm hover:border-slate-500 transition-all cursor-pointer">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`w-2 h-2 rounded-full ${t.priority === 'Critical' ? 'bg-red-500 animate-pulse' : t.priority === 'High' ? 'bg-orange-500' : 'bg-slate-600'}`}></span>
                                                    <span className="text-[8px] text-slate-500 font-bold uppercase">{t.tag}</span>
                                                </div>
                                                <p className="text-xs font-bold text-white leading-tight">{t.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* TASK FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[110] fade-in">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-white font-bold">{editingTask ? 'Rediger' : 'Ny'} Opgave</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Titel</label>
                                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="fx 'Opret Ugeplan'" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner font-bold"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Status</label>
                                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none">
                                        <option value="backlog">Backlog / Ideer</option>
                                        <option value="todo">To Do</option>
                                        <option value="doing">Doing</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Prioritet</label>
                                    <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none">
                                        <option>Critical</option>
                                        <option>High</option>
                                        <option>Medium</option>
                                        <option>Low</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Beskrivelse (User Story)</label>
                                <textarea value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} rows="2" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none" placeholder="Som [rolle] vil jeg..."/>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Acceptkriterier (Håndterer linjeskift korrekt)</label>
                                <textarea value={form.acceptance} onChange={e => setForm({...form, acceptance: e.target.value})} rows="8" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none font-mono text-xs leading-relaxed" placeholder="- Punkt 1..."/>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center">
                            {editingTask && <button onClick={async () => { if(confirm('Slet opgaven permanent?')) { await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', editingTask.id)); setIsFormOpen(false); } }} className="text-red-500 text-xs font-bold px-4 py-2 hover:bg-red-900/20 rounded-lg transition-colors flex items-center"><Trash2 className="w-4 h-4 mr-2"/> Slet</button>}
                            <div className="flex gap-3 ml-auto">
                                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 px-4 py-2 font-bold text-sm">Annuller</button>
                                <button onClick={handleSaveTask} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30 active:scale-95 transition-all">Gem Opgave</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {isImportOpen && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[120] fade-in">
                    <div className="bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-700 p-6 shadow-2xl">
                        <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-500"/> Importer CSV / Excel</h3>
                        <p className="text-slate-500 text-xs mb-4 italic leading-relaxed text-balance">Den avancerede v5 parser håndterer linjeskift indkapslet i anførselstegn.</p>
                        <textarea id="importArea" placeholder="Titel;Status;Beskrivelse;Acceptkriterier..." rows="12" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none font-mono text-[10px] mb-4 shadow-inner"/>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsImportOpen(false)} className="text-slate-400 font-bold px-4 py-2 hover:text-white transition-colors">Luk</button>
                            <button onClick={() => handleImportCSV(document.getElementById('importArea').value, 'append')} className="bg-slate-800 text-blue-400 px-4 py-2 rounded-lg font-bold border border-slate-700 hover:bg-slate-700 transition-colors">Tilføj</button>
                            <button onClick={() => handleImportCSV(document.getElementById('importArea').value, 'replace')} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-red-900/20 active:scale-95 transition-all">Erstat hele listen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP COMPONENT ---
const App = () => {
  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isBrowserBlocked, setIsBrowserBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // App State
  const [activeFighter, setActiveFighter] = useState('Karl');
  const [isLocked, setIsLocked] = useState(true);
  const [systemWeek] = useState(getISOWeek()); 
  const [currentWeek, setCurrentWeek] = useState(getISOWeek()); 
  const [view, setView] = useState('personal'); 
  const [isStandardMode, setIsStandardMode] = useState(false);
  const [scheduleData, setScheduleData] = useState({}); 
  const [teamData, setTeamData] = useState({}); 
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // UI States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null); 
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feedbackContext, setFeedbackContext] = useState(null); 
  const [adminOpen, setAdminOpen] = useState(false);

  // Auth & Init
  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    if (checkInAppBrowser()) {
        setIsBrowserBlocked(true);
        setAuthLoading(false); 
        return; 
    }

    // Initial Auth Listener
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
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
      setAuthLoading(false);
    });

    // Check Redirect Results
    getRedirectResult(auth).catch((error) => {
        if (error.code !== 'auth/popup-closed-by-user') setLoginError(error.message);
    });

    // URL Parameter Logic
    const params = new URLSearchParams(window.location.search);
    const fighterParam = params.get('fighter');
    if (fighterParam && FIGHTERS.includes(fighterParam)) {
      setActiveFighter(fighterParam);
      setIsLocked(true);
    }

    return () => unsubAuth();
  }, []);

  // Sync Data
  useEffect(() => {
    if (!user || accessDenied || isBrowserBlocked) return;
    
    const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const collectionPath = isStandardMode ? 'templates' : 'weeks';
    
    // Personal Snapshot
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
    const unsubPersonal = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScheduleData(data);
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
      } else { 
        setScheduleData({}); 
        setLastUpdated('Ingen data'); 
      }
    }, (err) => console.error("Personal Sync Error:", err));

    // Team Snapshot (Weeks only)
    const unsubsTeam = [];
    if (!isStandardMode) {
        FIGHTERS.forEach(fighter => {
            const fRef = doc(db, ROOT_COLLECTION, fighter, 'weeks', `week_${currentWeek}`);
            const unsub = onSnapshot(fRef, (snap) => {
                if (snap.exists()) setTeamData(prev => ({...prev, [fighter]: snap.data()}));
                else setTeamData(prev => ({...prev, [fighter]: {}}));
            });
            unsubsTeam.push(unsub);
        });
    }

    return () => { 
        unsubPersonal(); 
        unsubsTeam.forEach(u => u()); 
    };
  }, [user, activeFighter, currentWeek, isStandardMode, accessDenied]);

  // Handlers
  const handleSmartLogin = async (mode) => {
      setLoginError(null);
      const provider = new GoogleAuthProvider();
      try { 
          if (mode === 'redirect') {
              await signInWithRedirect(auth, provider);
          } else {
              await signInWithPopup(auth, provider); 
          }
      } catch (error) { setLoginError(error.message); }
  };

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
            if (currentSessions.length > 0 && !confirm("Dette sletter dagens pas for at holde hviledag. Fortsæt?")) return;
            newData[day] = [{ isRestDay: true, id: Date.now() }];
        }
        await saveToDb(newData);
        setConfirmDialog(null);
    };
    executeToggle();
  };

  // --- RENDER ---
  if (isBrowserBlocked) return <BrowserBlockScreen />;
  if (authLoading) return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="font-mono text-[10px] tracking-widest uppercase font-bold">Initialiserer FightWeek...</p>
      </div>
  );
  
  if (!user) return <LoginScreen onLoginPopup={() => handleSmartLogin('popup')} onLoginRedirect={() => handleSmartLogin('redirect')} error={loginError} loading={authLoading} />;
  if (accessDenied) return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
          <Lock className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">Ingen adgang</h2>
          <p className="text-slate-400 text-sm mb-6">Din e-mail ({user.email}) er ikke registreret i systemet.</p>
          <button onClick={() => signOut(auth)} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Log ud
          </button>
      </div>
  );

  const isAdmin = ['coach', 'admin'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);
  const isReadOnly = !isStandardMode && currentWeek < systemWeek;

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen pb-24 font-sans selection:bg-blue-500/30">
      {/* HEADER */}
      <header className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 sticky top-0 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight tracking-tight">FightWeek</h1>
              <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">v1.44 Stable</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && (
                <button onClick={() => setAdminOpen(true)} className="p-2 bg-slate-800 rounded-lg text-yellow-500 border border-slate-700 hover:bg-slate-700 transition-colors">
                    <ClipboardList className="w-5 h-5" />
                </button>
            )}
            <div className="relative">
                <select 
                    disabled={isLocked}
                    value={activeFighter} 
                    onChange={(e) => setActiveFighter(e.target.value)} 
                    className="appearance-none bg-slate-800 text-white pl-3 pr-8 py-2 rounded-lg border border-slate-700 text-xs font-bold shadow-sm disabled:opacity-80"
                >
                    {FIGHTERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {!isLocked && <ChevronDown className="w-3 h-3 absolute right-2.5 top-3 text-slate-500 pointer-events-none" />}
            </div>
            <button onClick={() => signOut(auth)} className="p-2 text-slate-500 hover:text-white transition-colors"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto relative pt-4 min-h-[85vh]">
        {/* Banner: Standard Mode */}
        {isStandardMode && (
          <div className="mx-4 mb-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3 flex items-start space-x-3 fade-in">
            <Globe className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-100 font-bold leading-tight">Redigerer Standarduge</p>
              <p className="text-[10px] text-yellow-500/80 mt-1 uppercase font-bold tracking-widest">Din faste skabelon</p>
            </div>
          </div>
        )}

        {/* Week Selector */}
        <div className="mx-4 mb-6 space-y-4">
          <div className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-2xl border border-slate-700/50 shadow-xl">
            <button onClick={() => { setCurrentWeek(Math.max(1, currentWeek - 1)); setIsStandardMode(false); }} className={`p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors ${currentWeek <= 1 ? 'invisible' : ''}`}><ChevronLeft className="w-7 h-7" /></button>
            <div className="text-center">
              <span className="text-slate-500 text-[10px] uppercase tracking-widest font-black block mb-0.5">{currentWeek === systemWeek ? "Aktuel Uge" : "Ugeplan"}</span>
              <div className="text-white font-black text-xl">Uge {currentWeek}</div>
            </div>
            <button onClick={() => { setCurrentWeek(currentWeek + 1); setIsStandardMode(false); }} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"><ChevronRight className="w-7 h-7" /></button>
          </div>

          <div className="flex justify-between items-center px-1">
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                {lastUpdated && <><Clock className="w-3 h-3" /><span>Update: {lastUpdated}</span></>}
                {isReadOnly && <span className="flex items-center text-slate-400 ml-2 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"><History className="w-3 h-3 mr-1"/> Historik</span>}
            </div>
            <div className="flex gap-2">
                {!isReadOnly && !isStandardMode && (
                    <button onClick={async () => {
                        if(confirm("Hent din standarduge? Dette overskriver nuværende plan.")) {
                            const snap = await getDoc(doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard'));
                            if (snap.exists()) await saveToDb(snap.data());
                            else alert("Ingen skabelon fundet.");
                        }
                    }} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-900/20 text-blue-400 border border-blue-800/50 flex items-center gap-1.5 transition-all hover:bg-blue-900/40">
                        <Download className="w-3 h-3"/> Hent Standard
                    </button>
                )}
                <button onClick={() => setIsStandardMode(!isStandardMode)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 shadow-sm ${isStandardMode ? 'bg-yellow-900/40 text-yellow-100 border-yellow-700 shadow-yellow-900/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                    {isStandardMode ? <><X className="w-3 h-3"/> Luk Skabelon</> : <><Globe className="w-3 h-3"/> Rediger Skabelon</>}
                </button>
            </div>
          </div>
        </div>

        {/* VIEWS */}
        {view === 'personal' ? (
          <div className="px-4 space-y-4 pb-32 fade-in">
             {DAYS.map(day => {
                const sessions = scheduleData[day] || [];
                const isRestDay = sessions.some(s => s.isRestDay);
                const visibleSessions = sessions.filter(s => !s.isRestDay);
                return (
                    <div key={day} className={`rounded-2xl p-4 border transition-all shadow-md ${isRestDay ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-black text-lg flex items-center gap-2">
                                {day} 
                                {isRestDay && <span className="text-[9px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full border border-blue-800/50 uppercase tracking-tighter font-black">Hvile</span>}
                            </h3>
                            <div className="flex space-x-1.5">
                                 <button disabled={isReadOnly} onClick={() => handleToggleRestDay(day)} className={`p-2 rounded-full transition-all border shadow-sm ${isRestDay ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'} ${isReadOnly ? 'hidden' : ''}`}><Bed className="w-4 h-4" /></button>
                                 <button disabled={isReadOnly} onClick={() => { setEditingDay(day); setEditingSession(null); setModalOpen(true); }} className={`bg-blue-600 rounded-full p-2 text-white shadow-lg shadow-blue-900/30 transition-all active:scale-90 ${isReadOnly ? 'hidden' : ''}`}><Plus className="w-5 h-5" /></button>
                            </div>
                        </div>
                        {visibleSessions.length === 0 && !isRestDay && <div className="text-slate-700 text-[10px] font-black py-4 text-center border-2 border-dashed border-slate-800/50 rounded-xl uppercase tracking-widest">Ingen planlagte pas</div>}
                        {visibleSessions.map(s => {
                            const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                            const isCancelled = s.status === 'cancelled';
                            return (
                                <div key={s.id} onClick={() => !isReadOnly && (setEditingDay(day), setEditingSession(s), setModalOpen(true))} className={`relative flex items-center justify-between p-3.5 rounded-xl mb-2.5 border shadow-sm transition-all ${isCancelled ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-slate-800 border-slate-700/50'} ${!isReadOnly ? 'cursor-pointer active:scale-[0.98] hover:bg-slate-750' : 'opacity-80'}`}>
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${isCancelled ? 'bg-red-900' : cat.color}`}></div>
                                    <div className="flex-1 pl-3">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <h4 className={`font-black text-sm leading-tight ${isCancelled ? 'line-through text-slate-500' : 'text-white'}`}>{s.name}</h4>
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600 uppercase">{s.category}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center text-slate-500 text-[10px] space-x-3 font-black uppercase tracking-tight">
                                                <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {s.start} - {s.end}</span>
                                                <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/> {s.location}</span>
                                            </div>
                                            {isCancelled && <div className="mt-1.5 text-[9px] text-red-500 font-bold flex items-center uppercase tracking-tighter"><AlertCircle className="w-3 h-3 mr-1"/> Aflyst: {s.cancellationReason}</div>}
                                        </div>
                                    </div>
                                    {!isReadOnly && <ChevronRight className="w-4 h-4 text-slate-700" />}
                                </div>
                            );
                        })}
                    </div>
                );
             })}
          </div>
        ) : (
             <TeamScheduleView days={DAYS} teamData={teamData} />
        )}
      </div>

      {/* FOOTER NAV */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe z-50 rounded-t-3xl shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around p-3 px-8">
            <button onClick={() => setView('personal')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'personal' ? 'text-blue-500 scale-110' : 'text-slate-600'}`}>
                <Calendar className="w-6 h-6"/><span className="text-[9px] font-black uppercase tracking-widest">Plan</span>
            </button>
            <button onClick={() => setFeedbackContext('App Feedback')} className="flex flex-col items-center justify-center p-2 text-slate-600 hover:text-blue-400 transition-colors">
                <div className="bg-slate-800 p-2 rounded-full border border-slate-700 shadow-inner"><MessageSquarePlus className="w-5 h-5" /></div>
            </button>
            <button onClick={() => setView('team')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'team' ? 'text-blue-500 scale-110' : 'text-slate-600'}`}>
                <User className="w-6 h-6"/><span className="text-[9px] font-black uppercase tracking-widest">Team</span>
            </button>
        </div>
      </footer>

      {/* MODALS */}
      {modalOpen && (
          <SessionModal 
            day={editingDay} 
            initialData={editingSession} 
            onClose={() => setModalOpen(false)} 
            onSave={handleSaveSession} 
            onDelete={handleDeleteSession} 
            isStandardMode={isStandardMode} 
            onFeedback={(ctx) => setFeedbackContext(ctx)} 
          />
      )}
      
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} />}
      {adminOpen && <AdminDashboard user={user} onClose={() => setAdminOpen(false)} />}
    </div>
  );
};

// --- SUB COMPONENTS ---

const TeamScheduleView = ({ days, teamData }) => {
    const [selectedDay, setSelectedDay] = useState(days[0]);
    const aggregated = useMemo(() => {
        const slots = {};
        FIGHTERS.forEach(f => {
            const sessions = teamData[f]?.[selectedDay] || [];
            sessions.forEach(s => {
                if (s.isRestDay) return;
                const time = s.start || 'TBA';
                if (!slots[time]) slots[time] = [];
                slots[time].push({ ...s, fighter: f });
            });
        });
        return Object.keys(slots).sort().map(time => ({ time, sessions: slots[time] }));
    }, [teamData, selectedDay]);

    return (
        <div className="fade-in pb-20">
            <div className="flex gap-2 overflow-x-auto pb-4 hide-scroll px-4 mb-2">
                {days.map(d => (
                    <button key={d} onClick={() => setSelectedDay(d)} className={`px-5 py-2 rounded-xl text-xs font-black border transition-all flex-shrink-0 uppercase tracking-widest ${selectedDay === d ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{d}</button>
                ))}
            </div>
            <div className="px-4 space-y-4">
                {aggregated.length === 0 && <div className="text-center py-20 text-slate-700 italic border-2 border-dashed border-slate-900 rounded-2xl flex flex-col items-center"><User className="w-10 h-10 mb-2 opacity-20"/><p className="text-xs font-black uppercase tracking-widest">Ingen fælles pas planlagt</p></div>}
                {aggregated.map(slot => (
                    <div key={slot.time} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="bg-slate-800/60 p-3.5 px-5 flex justify-between items-center border-b border-slate-800">
                            <span className="font-mono text-blue-400 font-black text-xl leading-none">{slot.time}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest bg-slate-950 px-2.5 py-1 rounded border border-slate-800 shadow-inner">{slot.sessions[0].location}</span>
                        </div>
                        <div className="p-3.5 space-y-2.5">
                            {slot.sessions.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-6 rounded-full ${CATEGORIES.find(c => c.label === s.category)?.color || 'bg-slate-600'} shadow-sm`}></div>
                                        <span className="text-sm font-black text-white">{s.fighter}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SessionModal = ({ day, initialData, onClose, onSave, onDelete, isStandardMode, onFeedback }) => {
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

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
             <div className="bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 shrink-0">
                    <h3 className="text-white font-black text-lg flex items-center"><span className="w-1.5 h-6 bg-blue-500 rounded-full mr-3 shadow-sm shadow-blue-500/20"></span> {day}</h3>
                    <div className="flex gap-2">
                        {initialData && (
                            <button onClick={() => onFeedback(`Pas: ${initialData.name} (${day})`)} className="p-2.5 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700 shadow-inner transition-colors"><MessageSquarePlus className="w-5 h-5"/></button>
                        )}
                        <button onClick={onClose} className="p-2.5 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700"><X className="w-5 h-5"/></button>
                    </div>
                </div>
                {!initialData && (
                    <div className="flex p-2 bg-slate-950/50 gap-2 shrink-0">
                        <button onClick={() => setTab('favorites')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm ${tab === 'favorites' ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-slate-800 text-slate-500'}`}>Hent Katalog</button>
                        <button onClick={() => setTab('adhoc')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm ${tab === 'adhoc' ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-slate-800 text-slate-500'}`}>Adhoc</button>
                    </div>
                )}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {tab === 'favorites' && !initialData ? (
                        <div className="space-y-2">
                             {GLOBAL_TEMPLATES.filter(t => t.day === day).map(t => (
                                 <button key={t.id} onClick={() => onSave({...t, id: null})} className="w-full text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-blue-500 transition-all group active:scale-[0.98] shadow-inner">
                                     <div className="font-black text-sm text-white group-hover:text-blue-400 transition-colors">{t.name}</div>
                                     <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1.5">{t.start}-{t.end} • {t.location}</div>
                                 </button>
                             ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-black mb-3 tracking-widest">Aktivitet</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat.label} onClick={() => setForm({...form, category: cat.label})} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all shadow-sm tracking-tight ${form.category === cat.label ? `${cat.color} text-white border-transparent scale-105 shadow-lg` : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{cat.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-black mb-2 tracking-widest">Navn</label>
                                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none shadow-inner"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-[10px] uppercase font-black mb-2 tracking-widest text-center">Start</label>
                                    <input type="time" value={form.start} onChange={e => setForm({...form, start: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm font-black focus:ring-2 focus:ring-blue-600 outline-none text-center shadow-inner"/>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] uppercase font-black mb-2 tracking-widest text-center">Slut</label>
                                    <input type="time" value={form.end} onChange={e => setForm({...form, end: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm font-black focus:ring-2 focus:ring-blue-600 outline-none text-center shadow-inner"/>
                                </div>
                            </div>
                            
                            {!isStandardMode && initialData && (
                                <div className="pt-6 border-t border-slate-800">
                                    <label className="flex items-center space-x-3 cursor-pointer group mb-4">
                                        <div className={`w-6 h-6 rounded border border-slate-700 flex items-center justify-center transition-all ${form.cancel ? 'bg-red-600 border-red-500 shadow-lg shadow-red-900/20' : 'bg-slate-800'}`}>
                                            {form.cancel && <Check className="w-4 h-4 text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={form.cancel} onChange={e => setForm({...form, cancel: e.target.checked})} />
                                        <span className="text-sm font-black uppercase tracking-widest text-slate-300 group-hover:text-red-400 transition-colors">Aflys Træning</span>
                                    </label>
                                    {form.cancel && (
                                        <input type="text" placeholder="Årsag (fx Sygdom)" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full bg-red-950/20 border border-red-900/50 text-red-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-red-600 outline-none animate-slide-up"/>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex space-x-4 shrink-0 shadow-inner">
                    {initialData && <button onClick={() => onDelete(initialData.id)} className="py-4 px-5 rounded-2xl font-black text-red-500 bg-red-950/20 hover:bg-red-950/40 transition-all border border-red-900/30 active:scale-95"><Trash2 className="w-6 h-6"/></button>}
                    <button onClick={() => onSave({ id: initialData?.id, ...form, status: form.cancel ? 'cancelled' : 'active', cancellationReason: form.cancel ? form.reason : null, cancellationTime: form.cancel ? (initialData?.cancellationTime || new Date().toISOString()) : null })} className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2 ${form.cancel ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}>
                        {form.cancel ? <><AlertCircle className="w-5 h-5"/> Bekræft Aflysning</> : 'Gem Træningspas'}
                    </button>
                </div>
             </div>
        </div>
    );
};

export default App;
