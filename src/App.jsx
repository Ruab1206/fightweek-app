import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, Lock, HelpCircle, Smartphone, ExternalLink, Copy, Check, MousePointerClick,
  ClipboardList, MessageSquarePlus, Download, ArrowRight, ArrowLeft, Tag, Share2, List, Layout, GripVertical, Edit2, ChevronUp, Monitor, Terminal, Upload, FileDown, RefreshCw, Eye, EyeOff, Search, Settings
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
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously
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

// Master Catalog (Templates) - Default values
const GLOBAL_TEMPLATES = [
  { id: 'g1', day: 'Mandag', name: 'Wall Wrestling', category: 'Brydning', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'g2', day: 'Mandag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:15', location: 'Rumble' },
  { id: 'g3', day: 'Mandag', name: 'MMA Grappling', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 'g5', day: 'Tirsdag', name: 'Nogi All', category: 'Grappling', start: '07:00', end: '08:00', location: 'Rumble' },
  { id: 'g9', day: 'Tirsdag', name: 'Brydning', category: 'Brydning', start: '19:00', end: '20:30', location: 'Roskilde' },
  { id: 'g10', day: 'Onsdag', name: 'MMA Sparring', category: 'MMA', start: '15:00', end: '16:00', location: 'Burnell' },
  { id: 'g12', day: 'Onsdag', name: 'MMA Adv', category: 'MMA', start: '16:30', end: '18:00', location: 'Rumble' },
  { id: 'g14', day: 'Torsdag', name: 'Kickboxing Adv', category: 'Kickboxing', start: '17:00', end: '18:15', location: 'Rumble' },
  { id: 'g17', day: 'Fredag', name: 'MMA Sparring', category: 'MMA', start: '18:00', end: '19:30', location: 'Rumble' },
  { id: 'g22', day: 'Lørdag', name: 'Brydning', category: 'Brydning', start: '14:00', end: '16:00', location: 'Roskilde' }
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
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fightweek-app';

// Path Helpers
const ROOT_COLLECTION = `artifacts/${appId}/users`; 
const PUBLIC_DATA_PATH = `artifacts/${appId}/public/data`; 

// --- UTILS ---
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

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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

// --- UI COMPONENTS ---

const BrowserBlockScreen = () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
            <Smartphone className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-white font-bold text-xl mb-2">Brug Safari eller Chrome</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Google tillader ikke login direkte i Messenger eller Instagram. 
                Tryk på de tre prikker og vælg "Åbn i browser" for at fortsætte.
            </p>
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-xs text-slate-400 font-mono break-all">
                {window.location.href}
            </div>
        </div>
    </div>
);

const LoginScreen = ({ onLogin, onRedirectLogin, error, loading }) => (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">v1.41</div>
            
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
                <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">FightWeek</h1>
            <p className="text-slate-400 mb-8 text-sm">Log ind for at se din personlige ugeplan</p>
            
            {error && (
                <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-6 text-xs text-red-200 text-left">
                    <AlertCircle className="w-4 h-4 mb-1" />
                    {error}
                </div>
            )}

            <div className="space-y-3">
                <button 
                    onClick={onLogin} 
                    disabled={loading}
                    className="w-full bg-white text-slate-900 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
                    {loading ? 'Logger ind...' : 'Log ind med Google'}
                </button>
                
                <button 
                    onClick={onRedirectLogin}
                    className="text-slate-500 text-xs hover:text-blue-400 transition-colors flex items-center justify-center gap-1 w-full pt-2"
                >
                    <ExternalLink className="w-3 h-3" />
                    Virker knappen ikke? Prøv Redirect
                </button>
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
            alert("Backlog opdateret med succes!");
        } catch (e) { alert("Import fejl: " + e.message); }
    };

    return (
        <div className="fixed inset-0 bg-slate-950 z-[100] overflow-y-auto pb-20">
            <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-10 shadow-lg">
                <div className="flex items-center">
                    <button onClick={onClose} className="mr-3 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5"/></button>
                    <div>
                        <h2 className="text-white font-bold">Admin Dashboard</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Project Flow</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { const csv = generateCSV(tasks); navigator.clipboard.writeText(csv); alert("CSV kopieret!"); }} className="bg-slate-800 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 flex items-center"><FileDown className="w-3 h-3 mr-2"/> Export</button>
                    <button onClick={() => setIsImportOpen(true)} className="bg-slate-800 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 flex items-center"><Upload className="w-3 h-3 mr-2"/> Import</button>
                </div>
            </div>

            <div className="p-4 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Liste</button>
                        <button onClick={() => setView('board')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'board' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Board</button>
                        <button onClick={() => setView('feedback')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'feedback' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Feedback ({feedback.length})</button>
                    </div>

                    <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 font-bold text-[10px] uppercase">
                        <button onClick={() => setStatusFilter('active')} className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'active' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Aktive</button>
                        <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Alle</button>
                        <button onClick={() => setStatusFilter('done')} className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'done' ? 'bg-green-900 text-green-400' : 'text-slate-500'}`}>Færdige</button>
                    </div>
                </div>

                {view === 'list' && (
                    <div className="space-y-3 fade-in">
                        <button onClick={() => { setForm({ title: '', status: 'backlog', priority: 'Medium', tag: 'APP', desc: '', acceptance: '', notes: '', release: '' }); setEditingTask(null); setIsFormOpen(true); }} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 font-bold hover:text-slate-300 hover:border-slate-600 transition-all flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/> Tilføj ny opgave</button>
                        {filteredTasks.map(t => (
                            <div key={t.id} onClick={() => { setEditingTask(t); setForm(t); setIsFormOpen(true); }} className="bg-slate-900 border border-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-800/80 transition-all group relative border-l-4 border-l-blue-600">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.status === 'done' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>{t.status.toUpperCase()}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{t.tag}</span>
                                    </div>
                                    <span className="text-slate-600 text-[10px] font-mono">#{t.order}</span>
                                </div>
                                <h3 className="text-white font-bold text-sm">{t.title}</h3>
                                {t.desc && <p className="text-slate-500 text-xs mt-1 line-clamp-1">{t.desc}</p>}
                                {t.acceptance && <div className="mt-3 p-2 bg-slate-950 rounded text-[10px] text-slate-400 font-mono whitespace-pre-wrap border border-slate-800/50">AC: {t.acceptance.slice(0, 120)}...</div>}
                            </div>
                        ))}
                    </div>
                )}

                {view === 'board' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 fade-in overflow-x-auto pb-4">
                        {['backlog', 'todo', 'doing', 'done'].map(status => {
                            if (status === 'done' && statusFilter === 'active') return null;
                            return (
                                <div key={status} className="bg-slate-900/50 rounded-xl border border-slate-800 p-3 min-w-[280px] min-h-[500px]">
                                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-4 px-1 flex justify-between">
                                        {status}
                                        <span className="bg-slate-800 px-2 rounded-full">{tasks.filter(t => t.status === status).length}</span>
                                    </h4>
                                    <div className="space-y-2">
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
                            <h3 className="text-white font-bold text-lg">{editingTask ? 'Rediger Opgave' : 'Ny Opgave'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Titel (User Story Overskrift)</label>
                                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="fx 'Opret Ugeplan'" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"/>
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
                                <div>
                                    <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Tag</label>
                                    <select value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none">
                                        <option value="APP">App Feature</option>
                                        <option value="TEAM">Team Opgave</option>
                                        <option value="TECH">Teknisk Gæld</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Release</label>
                                    <input value={form.release} onChange={e => setForm({...form, release: e.target.value})} placeholder="fx MVP" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Beskrivelse (Som [rolle] vil jeg...)</label>
                                <textarea value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Beskriv behovet..." rows="2" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none font-medium"/>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Acceptkriterier (Håndterer linjeskift)</label>
                                <textarea value={form.acceptance} onChange={e => setForm({...form, acceptance: e.target.value})} placeholder="1. Skal kunne..." rows="6" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none font-mono text-xs leading-relaxed"/>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5">Tekniske Noter</label>
                                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows="2" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none text-xs"/>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center">
                            {editingTask && (
                                <button onClick={async () => { if(confirm('Slet denne opgave permanent?')) { await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', editingTask.id)); setIsFormOpen(false); } }} className="text-red-500 text-xs font-bold px-4 py-2 hover:bg-red-900/20 rounded-lg transition-colors flex items-center"><Trash2 className="w-4 h-4 mr-2"/> Slet</button>
                            )}
                            <div className="flex gap-3 ml-auto">
                                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 px-4 py-2 font-bold text-sm hover:text-white transition-colors">Annuller</button>
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
                        <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-500"/> Importer fra CSV</h3>
                        <p className="text-slate-500 text-xs mb-4 leading-relaxed italic">Parseren understøtter nu linjeskift indkapslet i " ". Sørg for at Titlerne på kolonnerne matcher.</p>
                        <textarea id="importArea" placeholder="Titel;Status;Beskrivelse;Acceptkriterier..." rows="12" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none font-mono text-[10px] mb-4 shadow-inner"/>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsImportOpen(false)} className="text-slate-400 font-bold px-4 py-2 hover:text-white transition-colors">Luk</button>
                            <button onClick={() => handleImportCSV(document.getElementById('importArea').value, 'append')} className="bg-slate-800 text-blue-400 px-4 py-2 rounded-lg font-bold border border-slate-700 hover:bg-slate-700 transition-colors">Tilføj til liste</button>
                            <button onClick={() => handleImportCSV(document.getElementById('importArea').value, 'replace')} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-red-900/20 active:scale-95 transition-all">Erstat hele listen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP ---
const App = () => {
    // Auth & Basic State
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError] = useState(null);
    const [activeFighter, setActiveFighter] = useState('Karl');
    const [isLocked, setIsLocked] = useState(false);
    
    // Schedule State
    const [currentWeek, setCurrentWeek] = useState(getISOWeek());
    const [systemWeek] = useState(getISOWeek());
    const [scheduleData, setScheduleData] = useState({});
    const [teamData, setTeamData] = useState({});
    const [isStandardMode, setIsStandardMode] = useState(false);
    
    // UI State
    const [view, setView] = useState('personal'); 
    const [adminOpen, setAdminOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingDay, setEditingDay] = useState(null);
    const [editingSession, setEditingSession] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // --- AUTH FLOW ---
    useEffect(() => {
        if (checkInAppBrowser()) {
            setAuthLoading(false);
            return;
        }

        const handleAuthResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    const profile = USER_MAPPING[result.user.email.toLowerCase()];
                    if (profile) setActiveFighter(profile.name);
                }
            } catch (e) {
                setLoginError("Redirect login fejlede: " + e.message);
            }
        };
        handleAuthResult();

        const unsubAuth = onAuthStateChanged(auth, async (u) => {
            if (u) {
                const profile = USER_MAPPING[u.email.toLowerCase()];
                if (profile) {
                    setUser(u);
                    setActiveFighter(profile.name);
                } else {
                    setUser(u); // Logged in but not mapped
                }
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });

        const params = new URLSearchParams(window.location.search);
        const fParam = params.get('fighter');
        if (fParam && FIGHTERS.includes(fParam)) {
            setActiveFighter(fParam);
            setIsLocked(true);
        }

        return () => unsubAuth();
    }, []);

    // --- DATA SYNC ---
    useEffect(() => {
        if (!user) return;
        
        const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
        const collectionPath = isStandardMode ? 'templates' : 'weeks';
        const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);

        const unsubP = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setScheduleData(data);
                if (data.lastUpdated) {
                    setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
                }
            } else {
                setScheduleData({});
                setLastUpdated(null);
            }
        });

        // Team Sync (Weeks only)
        const unsubsT = FIGHTERS.map(f => {
            const fRef = doc(db, ROOT_COLLECTION, f, 'weeks', `week_${currentWeek}`);
            return onSnapshot(fRef, (snap) => {
                setTeamData(prev => ({...prev, [f]: snap.exists() ? snap.data() : {}}));
            });
        });

        return () => {
            unsubP();
            unsubsT.forEach(u => u());
        };
    }, [user, activeFighter, currentWeek, isStandardMode]);

    const handleLogin = async () => {
        setLoginError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (e) {
            setLoginError("Popup blokeret eller fejlet. Prøv Redirect metoden.");
        }
    };

    const handleRedirectLogin = () => {
        const provider = new GoogleAuthProvider();
        signInWithRedirect(auth, provider);
    };

    const handleSaveSession = async (session) => {
        const newData = JSON.parse(JSON.stringify(scheduleData));
        if (!newData[editingDay]) newData[editingDay] = [];
        
        if (session.id) {
            const idx = newData[editingDay].findIndex(s => s.id === session.id);
            if (idx > -1) newData[editingDay][idx] = session;
        } else {
            session.id = Date.now();
            newData[editingDay].push(session);
        }
        
        newData[editingDay].sort((a,b) => (a.start || "").localeCompare(b.start || ""));
        newData.lastUpdated = new Date().toISOString();
        
        const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
        const col = isStandardMode ? 'templates' : 'weeks';
        await setDoc(doc(db, ROOT_COLLECTION, activeFighter, col, docId), newData);
        setModalOpen(false);
    };

    const handleToggleRest = async (day) => {
        const newData = JSON.parse(JSON.stringify(scheduleData));
        const sessions = newData[day] || [];
        const isRest = sessions.some(s => s.isRestDay);
        
        if (isRest) {
            newData[day] = sessions.filter(s => !s.isRestDay);
        } else {
            if (sessions.length > 0 && !confirm("Dette vil fjerne dine træningspas for dagen. Fortsæt?")) return;
            newData[day] = [{ id: Date.now(), isRestDay: true }];
        }
        
        const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
        const col = isStandardMode ? 'templates' : 'weeks';
        await setDoc(doc(db, ROOT_COLLECTION, activeFighter, col, docId), newData);
    };

    const handleImportStandard = async () => {
        if (!confirm("Vil du overskrive denne uge med din standarduge?")) return;
        const stdRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
        const snap = await getDoc(stdRef);
        if (snap.exists()) {
            const stdData = snap.data();
            stdData.lastUpdated = new Date().toISOString();
            await setDoc(doc(db, ROOT_COLLECTION, activeFighter, 'weeks', `week_${currentWeek}`), stdData);
        } else {
            alert("Ingen standarduge fundet. Opret en først via 'Standard' knappen.");
        }
    };

    if (checkInAppBrowser()) return <BrowserBlockScreen />;
    if (authLoading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        INITIALIZING FIGHTWEEK...
    </div>;
    
    if (!user) return <LoginScreen onLogin={handleLogin} onRedirectLogin={handleRedirectLogin} error={loginError} loading={authLoading} />;

    const isAdmin = ['coach', 'admin'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);
    const isReadOnly = !isStandardMode && currentWeek < systemWeek;

    return (
        <div className="bg-slate-950 text-slate-200 min-h-screen pb-24 font-sans selection:bg-blue-500/30">
            {/* HEADER */}
            <header className="bg-slate-900 p-4 border-b border-slate-800 sticky top-0 z-50 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/20">
                        <ShieldCheck className="w-6 h-6 text-white"/>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none tracking-tight">FightWeek</h1>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-1">Production v1.41</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button onClick={() => setAdminOpen(true)} className="p-2 bg-slate-800 rounded-lg text-yellow-500 hover:bg-slate-700 hover:text-yellow-400 transition-all">
                            <ClipboardList className="w-5 h-5"/>
                        </button>
                    )}
                    <div className="relative">
                        <select 
                            disabled={isLocked}
                            value={activeFighter} 
                            onChange={e => setActiveFighter(e.target.value)} 
                            className="bg-slate-800 text-xs font-bold py-2 pl-3 pr-8 rounded-lg border border-slate-700 outline-none appearance-none disabled:opacity-80 shadow-sm"
                        >
                            {FIGHTERS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        {!isLocked && <ChevronDown className="w-3 h-3 absolute right-2.5 top-3 text-slate-500 pointer-events-none"/>}
                    </div>
                    <button onClick={() => signOut(auth)} className="p-2 text-slate-600 hover:text-white transition-colors">
                        <LogOut className="w-5 h-5"/>
                    </button>
                </div>
            </header>

            <main className="max-w-md mx-auto p-4">
                {/* NAVIGATION & MODE */}
                <div className="mb-6 space-y-4">
                    <div className="bg-slate-800 border border-slate-700 p-2.5 rounded-2xl flex items-center justify-between shadow-xl">
                        <button 
                            onClick={() => { setCurrentWeek(w => Math.max(1, w-1)); setIsStandardMode(false); }} 
                            className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
                        >
                            <ChevronLeft className="w-7 h-7"/>
                        </button>
                        <div className="text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-0.5">
                                {currentWeek === systemWeek ? 'Aktuel Uge' : currentWeek < systemWeek ? 'Historik' : 'Planlægning'}
                            </span>
                            <h2 className="text-xl font-bold text-white">Uge {currentWeek}</h2>
                        </div>
                        <button 
                            onClick={() => { setCurrentWeek(w => w+1); setIsStandardMode(false); }} 
                            className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
                        >
                            <ChevronRight className="w-7 h-7"/>
                        </button>
                    </div>

                    <div className="flex justify-between items-center px-1">
                        <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5 italic">
                            {lastUpdated ? <><Clock className="w-3 h-3"/> Opdateret {lastUpdated}</> : <><Info className="w-3 h-3"/> Ingen data</>}
                        </div>
                        <div className="flex gap-2">
                             {!isStandardMode && !isReadOnly && (
                                <button onClick={handleImportStandard} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-900/20 text-blue-400 border border-blue-800/50 flex items-center gap-1.5 hover:bg-blue-900/40 transition-all">
                                    <Download className="w-3 h-3"/> Hent Standard
                                </button>
                             )}
                            <button 
                                onClick={() => setIsStandardMode(!isStandardMode)} 
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${isStandardMode ? 'bg-yellow-900/30 border-yellow-700 text-yellow-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                            >
                                {isStandardMode ? <><X className="w-3 h-3"/> Luk Skabelon</> : <><Globe className="w-3 h-3"/> Rediger Standard</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* VIEWS */}
                {view === 'personal' ? (
                    <div className="space-y-4 pb-20 fade-in">
                        {DAYS.map(day => {
                            const sessions = scheduleData[day] || [];
                            const isRest = sessions.some(s => s.isRestDay);
                            return (
                                <div key={day} className={`rounded-2xl border p-4 transition-all shadow-sm ${isRest ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-900 border-slate-800'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                            {day} 
                                            {isRest && <span className="text-[9px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full border border-blue-800/50 uppercase tracking-tighter">Hvile</span>}
                                        </h3>
                                        <div className="flex gap-2">
                                            <button 
                                                disabled={isReadOnly} 
                                                onClick={() => handleToggleRest(day)} 
                                                className={`p-2 rounded-full border transition-all ${isRest ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'} ${isReadOnly ? 'hidden' : ''}`}
                                            >
                                                <Bed className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                disabled={isReadOnly} 
                                                onClick={() => { setEditingDay(day); setEditingSession(null); setModalOpen(true); }} 
                                                className={`p-2 bg-blue-600 rounded-full text-white shadow-lg active:scale-95 transition-all hover:bg-blue-500 ${isReadOnly ? 'hidden' : ''}`}
                                            >
                                                <Plus className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {sessions.filter(s => !s.isRestDay).length === 0 && !isRest && (
                                        <p className="text-slate-700 text-[10px] font-bold text-center py-4 border-2 border-dashed border-slate-800/50 rounded-xl">INGEN PLANLAGTE PAS</p>
                                    )}
                                    
                                    <div className="space-y-2">
                                        {sessions.filter(s => !s.isRestDay).map(s => {
                                            const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                                            return (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => !isReadOnly && (setEditingDay(day), setEditingSession(s), setModalOpen(true))} 
                                                    className={`bg-slate-800 p-3.5 rounded-xl border border-slate-700/50 flex justify-between items-center group transition-all ${!isReadOnly ? 'cursor-pointer active:scale-[0.98] hover:bg-slate-750' : 'opacity-80'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-8 rounded-full ${cat.color} shadow-sm`}></div>
                                                        <div>
                                                            <div className="text-sm font-bold text-white leading-none mb-1.5">{s.name}</div>
                                                            <div className="flex items-center text-[10px] text-slate-500 gap-3 font-bold uppercase tracking-tight">
                                                                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5"/> {s.start}-{s.end}</span>
                                                                <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/> {s.location}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isReadOnly && <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors"/>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <TeamScheduleView days={DAYS} teamData={teamData} />
                )}
            </main>

            {/* NAV BAR */}
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 px-10 flex justify-between z-50 max-w-md mx-auto rounded-t-3xl shadow-2xl">
                <button onClick={() => setView('personal')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'personal' ? 'text-blue-500 scale-110' : 'text-slate-600'}`}>
                    <Calendar className="w-6 h-6"/><span className="text-[9px] font-black uppercase tracking-widest">Plan</span>
                </button>
                <button onClick={() => setView('team')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'team' ? 'text-blue-500 scale-110' : 'text-slate-600'}`}>
                    <User className="w-6 h-6"/><span className="text-[9px] font-black uppercase tracking-widest">Team</span>
                </button>
            </nav>

            {/* MODALS */}
            {modalOpen && (
                <SessionModal 
                    day={editingDay} 
                    initialData={editingSession} 
                    onClose={() => setModalOpen(false)} 
                    onSave={handleSaveSession} 
                    onDelete={async (id) => {
                        if (!confirm("Slet dette træningspas?")) return;
                        const newData = JSON.parse(JSON.stringify(scheduleData));
                        newData[editingDay] = (newData[editingDay] || []).filter(s => s.id !== id);
                        const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
                        const col = isStandardMode ? 'templates' : 'weeks';
                        await setDoc(doc(db, ROOT_COLLECTION, activeFighter, col, docId), newData);
                        setModalOpen(false);
                    }}
                />
            )}
            {adminOpen && <AdminDashboard user={user} onClose={() => setAdminOpen(false)} />}
        </div>
    );
};

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
            <div className="flex gap-2 overflow-x-auto pb-4 hide-scroll px-1 mb-2">
                {days.map(d => (
                    <button key={d} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${selectedDay === d ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{d}</button>
                ))}
            </div>
            <div className="space-y-4">
                {aggregated.length === 0 && (
                    <div className="text-center py-20 text-slate-700 italic border-2 border-dashed border-slate-900 rounded-2xl">
                        <User className="w-10 h-10 mx-auto mb-2 opacity-20"/>
                        Ingen fælles pas planlagt denne dag
                    </div>
                )}
                {aggregated.map(slot => (
                    <div key={slot.time} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
                        <div className="bg-slate-800/60 p-3 px-4 flex justify-between items-center border-b border-slate-800">
                            <span className="font-mono text-blue-400 font-bold text-lg">{slot.time}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter bg-slate-950 px-2 py-0.5 rounded">{slot.sessions[0].location}</span>
                        </div>
                        <div className="p-3 space-y-2">
                            {slot.sessions.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1 h-5 rounded-full ${CATEGORIES.find(c => c.label === s.category)?.color || 'bg-slate-600'}`}></div>
                                        <span className="text-sm font-bold text-white">{s.fighter}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium uppercase">{s.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SessionModal = ({ day, initialData, onClose, onSave, onDelete }) => {
    const [tab, setTab] = useState(initialData ? 'adhoc' : 'favorites');
    const [form, setForm] = useState({
        name: initialData?.name || '',
        category: initialData?.category || 'MMA',
        start: initialData?.start || '17:00',
        end: initialData?.end || '18:30',
        location: initialData?.location || 'Rumble'
    });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
            <div className="bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                        {day} - {initialData ? 'Rediger pas' : 'Nyt pas'}
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
                </div>
                
                {!initialData && (
                    <div className="flex p-2 gap-2 bg-slate-950/50">
                        <button onClick={() => setTab('favorites')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${tab === 'favorites' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>Vælg fra Katalog</button>
                        <button onClick={() => setTab('adhoc')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${tab === 'adhoc' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>Opret Adhoc</button>
                    </div>
                )}

                <div className="p-6 space-y-6">
                    {tab === 'favorites' && !initialData ? (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 hide-scroll">
                            {GLOBAL_TEMPLATES.filter(t => t.day === day).map(t => (
                                <button key={t.id} onClick={() => onSave({...t, id: null})} className="w-full text-left bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-blue-500 transition-all group active:scale-[0.98]">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-blue-400">{t.name}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{t.start}-{t.end} • {t.location}</div>
                                        </div>
                                        <Plus className="w-5 h-5 text-slate-700 group-hover:text-blue-500"/>
                                    </div>
                                </button>
                            ))}
                            {GLOBAL_TEMPLATES.filter(t => t.day === day).length === 0 && (
                                <p className="text-center text-slate-600 text-xs py-10 font-medium">Ingen faste pas fundet for denne ugedag i kataloget.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-600 mb-3 tracking-widest">Aktivitets Type</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(c => (
                                        <button key={c.label} onClick={() => setForm({...form, category: c.label})} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${form.category === c.label ? `${c.color} text-white border-transparent shadow-lg scale-105` : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{c.label}</button>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-600 mb-2 tracking-widest">Navn på pas</label>
                                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="fx 'Sparring med teamet'" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-600 mb-2 tracking-widest">Start</label>
                                    <input type="time" value={form.start} onChange={e => setForm({...form, start: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all text-center font-bold"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-600 mb-2 tracking-widest">Slut</label>
                                    <input type="time" value={form.end} onChange={e => setForm({...form, end: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all text-center font-bold"/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex gap-3 shrink-0">
                    {initialData && (
                        <button onClick={() => onDelete(initialData.id)} className="p-4 bg-red-900/20 text-red-500 rounded-2xl hover:bg-red-900/40 transition-all">
                            <Trash2 className="w-6 h-6"/>
                        </button>
                    )}
                    <button onClick={() => onSave(form)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/30 active:scale-95 transition-all hover:bg-blue-500">
                        {initialData ? 'Opdater Pas' : 'Gem Træningspas'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;
