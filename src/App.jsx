import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, Lock, HelpCircle, Smartphone, ExternalLink, Copy, Check, MousePointerClick,
  ClipboardList, MessageSquarePlus, Download, ArrowRight, ArrowLeft, Tag, Share2, List, Layout, GripVertical, Edit2, ChevronUp, Monitor, Terminal, Upload, FileDown, RefreshCw
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

// Stamdata (Kataloget) - V12 Liste
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

// USER MAPPING & CONFIGURATION
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

// Data Path Helper
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

// Helper: Calculate ISO Week Number
const getISOWeek = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Helper: Detect In-App Browser & Mobile
const checkInAppBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Instagram") > -1);
};

const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getDeviceInfo = () => {
    return navigator.userAgent;
};

// --- ROBUST CSV PARSER ---
const parseCSV = (text) => {
    if (!text) return [];
    
    // Normalize text: Handle smart quotes and consistent newlines
    const cleanText = text
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Replace smart quotes with straight quotes
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    // Auto-detect delimiter
    const firstLine = cleanText.split('\n')[0];
    let delimiter = ';';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';

    console.log(`Parser: Using delimiter '${delimiter === '\t' ? 'TAB' : delimiter}'`);

    const result = [];
    let row = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];
        
        // Handle Quotes
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; // Skip escape quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            // Check for start of quote (allow leading whitespace before quote)
            if (char === '"' && current.trim() === "") {
                inQuotes = true;
                // If there was whitespace, we discard it by resetting current, 
                // effectively trimming leading space before the quote
                current = ""; 
            } else if (char === delimiter) {
                row.push(current);
                current = "";
            } else if (char === '\n') {
                row.push(current);
                if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
                     result.push(row);
                }
                row = [];
                current = "";
            } else {
                current += char;
            }
        }
    }
    // Handle last item/row
    if (current || row.length > 0) {
        row.push(current);
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) result.push(row);
    }

    if (result.length === 0) return [];
    
    // Header Processing
    const headers = result[0].map(h => h.trim().replace(/^"|"$/g, ''));
    
    return result.slice(1).map(values => {
        const obj = {};
        headers.forEach((h, i) => {
            let val = values[i] || '';
            // Final trim of values (removes quotes if they were wrapping the whole cell)
            obj[h] = val.trim(); 
        });
        return obj;
    });
};

const generateCSV = (tasks) => {
    const headers = ['Titel', 'Status', 'Beskrivelse', 'Acceptkriterier', 'Noter', 'Datafelter', 'Release', 'Tag', 'Prioritet', 'ID', 'Order'];
    const separator = ';';
    const csvRows = [headers.join(separator)];

    tasks.forEach(task => {
        const row = [
            `"${(task.title || '').replace(/"/g, '""')}"`,
            `"${(task.status || 'backlog')}"`,
            `"${(task.desc || '').replace(/"/g, '""')}"`,
            `"${(task.acceptance || '').replace(/"/g, '""')}"`,
            `"${(task.notes || '').replace(/"/g, '""')}"`,
            `"${(task.dataFields || '').replace(/"/g, '""')}"`,
            `"${(task.release || '').replace(/"/g, '""')}"`,
            `"${(task.tag || 'APP')}"`,
            `"${(task.priority || 'Medium')}"`,
            `"${task.id}"`,
            `"${task.order || 0}"`
        ];
        csvRows.push(row.join(separator));
    });
    return csvRows.join('\n');
};

const generateFeedbackCSV = (feedbackItems) => {
    const headers = ['Bruger', 'Kontekst', 'Tekst', 'Device', 'Status', 'Dato', 'ID'];
    const separator = ';';
    const csvRows = [headers.join(separator)];

    feedbackItems.forEach(item => {
        const row = [
            `"${(item.userName || '').replace(/"/g, '""')}"`,
            `"${(item.context || '').replace(/"/g, '""')}"`,
            `"${(item.text || '').replace(/"/g, '""')}"`,
            `"${(item.device || '').replace(/"/g, '""')}"`,
            `"${(item.status || 'new')}"`,
            `"${item.timestamp}"`,
            `"${item.id}"`
        ];
        csvRows.push(row.join(separator));
    });
    return csvRows.join('\n');
};


// --- COMPONENTS ---

const BrowserBlockScreen = () => {
    const [copied, setCopied] = useState(false);
    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Messenger Browseren dur ikke</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Google tillader ikke login direkte i Messenger. Du skal åbne appen i din rigtige browser (Safari eller Chrome).
                </p>
                <button onClick={copyLink} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Link kopieret!" : "Kopier Link og åbn selv"}
                </button>
            </div>
        </div>
    );
}

const LoginScreen = ({ onLoginPopup, onLoginRedirect, error }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center relative">
      <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">v1.38</div>
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

      <button onClick={onLoginPopup} className="w-full bg-white text-slate-900 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 mb-4">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
        Log ind med Google
      </button>

      <button onClick={onLoginRedirect} className="text-slate-500 text-xs hover:text-blue-400 underline flex items-center justify-center w-full mt-2">
        <MousePointerClick className="w-3 h-3 mr-1" />
        Virker knappen ikke? Tryk her (Redirect)
      </button>
    </div>
  </div>
);

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 fade-in">
    <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl overflow-hidden p-6 text-center">
      <div className="mx-auto w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
        <HelpCircle className="w-6 h-6 text-blue-500" />
      </div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex space-x-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors">Annuller</button>
        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg">Bekræft</button>
      </div>
    </div>
  </div>
);

// --- FEEDBACK MODAL ---
const FeedbackModal = ({ user, currentContext, onClose }) => {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const sendFeedback = async () => {
        if (!text.trim()) return;
        setSending(true);
        try {
            await addDoc(collection(db, PUBLIC_DATA_PATH, 'feedback'), {
                text,
                user: user.email,
                userName: USER_MAPPING[user.email.toLowerCase()]?.name || user.email,
                timestamp: new Date().toISOString(),
                context: currentContext || 'App',
                device: getDeviceInfo(),
                status: 'new',
                order: -Date.now() 
            });
            onClose();
            alert("Tak for dit input! Det er sendt til teamet.");
        } catch (e) {
            console.error("Fejl ved afsendelse:", e);
            alert("Der skete en fejl. Prøv igen.");
        }
        setSending(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 fade-in">
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 p-6">
                <h3 className="text-white font-bold text-lg mb-2 flex items-center"><MessageSquarePlus className="w-5 h-5 mr-2 text-blue-500"/>Send Feedback</h3>
                
                <div className="bg-slate-800/50 p-3 rounded-xl mb-4 text-xs text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300">Hvad har du på hjerte?</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Feedback til træningen eller teamet?</li>
                        <li>Fandt du en fejl i appen?</li>
                        <li>Har du en god idé til en ny funktion?</li>
                    </ul>
                </div>
                <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-blue-600 outline-none mb-4"
                    rows="4"
                    placeholder="Skriv din besked her..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                ></textarea>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="text-slate-400 px-4 py-2 text-sm">Luk</button>
                    <button onClick={sendFeedback} disabled={sending} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center">
                        {sending ? 'Sender...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- IMPORT CSV MODAL ---
const ImportModal = ({ onClose, onImport }) => {
    const [text, setText] = useState('');
    const [mode, setMode] = useState('append'); // 'append' | 'replace'

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-6">
                 <h3 className="text-white font-bold text-lg mb-4">Importer Backlog (CSV)</h3>
                 <p className="text-slate-500 text-xs mb-4">Understøtter nu både Excel (tabs) og semikolon-format med linjeskift.</p>
                 
                 <div className="flex gap-4 mb-4">
                     <button onClick={() => setMode('append')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center ${mode === 'append' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                         <Plus className="w-6 h-6 mb-2"/>
                         <span className="font-bold text-sm">Tilføj til liste</span>
                         <span className="text-[10px] opacity-70">Bevarer eksisterende</span>
                     </button>
                     <button onClick={() => setMode('replace')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center ${mode === 'replace' ? 'bg-red-900/30 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                         <RefreshCw className="w-6 h-6 mb-2"/>
                         <span className="font-bold text-sm">Erstat hele listen</span>
                         <span className="text-[10px] opacity-70">Sletter alt før import</span>
                     </button>
                 </div>

                 {mode === 'replace' && (
                     <div className="bg-red-900/30 border border-red-800 p-3 rounded-lg mb-4 text-xs text-red-200 flex items-start">
                         <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5"/>
                         <p>Advarsel: Dette vil slette ALLE nuværende opgaver i backloggen og erstatte dem med indholdet herunder. Feedback slettes ikke.</p>
                     </div>
                 )}

                 <p className="text-slate-400 text-xs mb-2">Indsæt CSV data (inkl. overskrifter):</p>
                 <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-mono h-32 focus:ring-2 focus:ring-blue-600 outline-none mb-4"
                    placeholder="Titel;Status;Beskrivelse..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                 />
                 <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="text-slate-400 px-4 py-2 text-sm font-bold">Annuller</button>
                    <button onClick={() => onImport(text, mode)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center text-white ${mode === 'replace' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                        <Upload className="w-4 h-4 mr-2"/> {mode === 'replace' ? 'Erstat Data' : 'Importer'}
                    </button>
                 </div>
            </div>
        </div>
    );
};

// --- ADMIN DASHBOARD (BACKLOG) ---
const AdminDashboard = ({ onClose }) => {
    const [tasks, setTasks] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [view, setView] = useState('board'); 
    const [filterTag, setFilterTag] = useState('ALL'); 
    const [filterStatus, setFilterStatus] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'DONE'
    
    // Task Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [linkedFeedbackId, setLinkedFeedbackId] = useState(null);
    const [adminConfirm, setAdminConfirm] = useState(null);

    const [form, setForm] = useState({
        title: '',
        status: 'backlog', 
        priority: 'Medium',
        tag: 'APP',
        desc: '',
        notes: '',
        acceptance: '',
        dataFields: '',
        release: ''
    });

    // Drag and Drop State
    const dragItem = useRef();
    const dragOverItem = useRef();

    useEffect(() => {
        const qBacklog = query(collection(db, PUBLIC_DATA_PATH, 'backlog'));
        const unsubBacklog = onSnapshot(qBacklog, (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setTasks(items);
        }, (err) => console.error("Backlog Error:", err));

        const qFeedback = query(collection(db, PUBLIC_DATA_PATH, 'feedback'));
        const unsubFeedback = onSnapshot(qFeedback, (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setFeedback(items);
        }, (err) => console.error("Feedback Error:", err));

        return () => { unsubBacklog(); unsubFeedback(); }
    }, []);

    // FILTER LOGIC
    const filteredTasks = tasks.filter(t => {
        const tagMatch = filterTag === 'ALL' || t.tag === filterTag;
        let statusMatch = true;
        if (filterStatus === 'ACTIVE') statusMatch = t.status !== 'done';
        if (filterStatus === 'DONE') statusMatch = t.status === 'done';
        return tagMatch && statusMatch;
    });

    const saveTask = async () => {
        if (!form.title) return;
        try {
            if (editingTask) {
                await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', editingTask.id), form);
            } else {
                await addDoc(collection(db, PUBLIC_DATA_PATH, 'backlog'), {
                    ...form,
                    createdAt: new Date().toISOString(),
                    order: -Date.now() 
                });
                if (linkedFeedbackId) {
                    await updateDoc(doc(db, PUBLIC_DATA_PATH, 'feedback', linkedFeedbackId), { status: 'converted' });
                }
            }
            setIsFormOpen(false);
            setEditingTask(null);
            setLinkedFeedbackId(null);
            resetForm();
        } catch (e) {
            console.error("Save Error:", e);
            alert("Fejl ved gemning: " + e.message);
        }
    };

    const handleExportCSV = async () => {
        try {
            const csv = generateCSV(tasks);
            await navigator.clipboard.writeText(csv);
            alert("CSV (semikolon-separeret) kopieret til udklipsholder!");
        } catch (e) {
            alert("Kunne ikke eksportere: " + e.message);
        }
    };

    const handleExportFeedbackCSV = async () => {
        try {
            const csv = generateFeedbackCSV(feedback);
            await navigator.clipboard.writeText(csv);
            alert("Feedback CSV (semikolon-separeret) kopieret til udklipsholder!");
        } catch (e) {
            alert("Kunne ikke eksportere feedback: " + e.message);
        }
    };

    const handleImportCSV = async (csvText, mode) => {
        try {
            const parsed = parseCSV(csvText);
            
            if (!parsed || parsed.length === 0) {
                 alert("Ingen gyldige data fundet i CSV. Tjek formatet.");
                 return;
            }

            const batch = writeBatch(db);
            let count = 0;
            const now = Date.now();
            
            // If REPLACE mode, delete all existing docs first
            if (mode === 'replace') {
                const snapshot = await getDocs(collection(db, PUBLIC_DATA_PATH, 'backlog'));
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }
            
            // Status Mapping Helper
            const mapStatus = (s) => {
                s = (s || '').toLowerCase();
                if (s.includes('done') || s === 'færdig') return 'done';
                if (s.includes('doing') || s === 'igang') return 'doing';
                if (s.includes('todo') || s === 'to do') return 'todo';
                return 'backlog'; 
            };

            parsed.forEach((row, idx) => {
                if (!row.Titel) return;
                
                let ref;
                if (row.ID && row.ID.length > 5) { 
                     ref = doc(db, PUBLIC_DATA_PATH, 'backlog', row.ID);
                } else {
                     ref = doc(collection(db, PUBLIC_DATA_PATH, 'backlog'));
                }

                batch.set(ref, {
                    title: row.Titel || '',
                    desc: row.Beskrivelse || '',
                    acceptance: row.Acceptkriterier || '',
                    notes: row.Noter || '',
                    dataFields: row['Datafelter'] || '',
                    status: mapStatus(row.Status),
                    release: row.Release || '',
                    tag: row.Tag || 'APP',
                    priority: row.Prioritet || 'Medium',
                    order: row.Order ? Number(row.Order) : -(now + idx), 
                    createdAt: new Date().toISOString()
                });
                count++;
            });
            await batch.commit();
            setIsImportOpen(false);
            alert(`Succes! ${mode === 'replace' ? 'Backloggen er erstattet med' : 'Tilføjede'} ${count} opgaver.`);
        } catch (e) {
            alert("Fejl under import: " + e.message);
        }
    };

    const resetForm = () => {
        setForm({
            title: '', status: 'backlog', priority: 'Medium', tag: 'APP',
            desc: '', notes: '', acceptance: '', dataFields: '', release: ''
        });
    };

    const editTask = (task) => {
        setEditingTask(task);
        setForm({
            title: task.title || '',
            status: task.status || 'backlog',
            priority: task.priority || 'Medium',
            tag: task.tag || 'APP',
            desc: task.desc || '',
            notes: task.notes || '',
            acceptance: task.acceptance || '',
            dataFields: task.dataFields || '',
            release: task.release || ''
        });
        setIsFormOpen(true);
    };

    const deleteTask = (id) => {
        setAdminConfirm({
            title: "Slet Opgave?",
            message: "Er du sikker på, at du vil slette denne opgave? Handlingen kan ikke fortrydes.",
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', id));
                    if (isFormOpen) setIsFormOpen(false);
                } catch (e) {
                    console.error("Delete Error", e);
                }
                setAdminConfirm(null);
            }
        });
    };
    
    const deleteFeedback = (id) => {
         setAdminConfirm({
            title: "Slet Feedback?",
            message: "Er du sikker? Dette kan ikke fortrydes.",
            onConfirm: async () => {
                await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'feedback', id));
                setAdminConfirm(null);
            }
        });
    };

    const moveTaskStatus = async (task, direction) => {
        const statuses = ['backlog', 'todo', 'doing', 'done'];
        const currentIdx = statuses.indexOf(task.status);
        let newIdx = currentIdx + direction;
        if (newIdx < 0) newIdx = 0;
        if (newIdx >= statuses.length) newIdx = statuses.length - 1;
        
        if (newIdx !== currentIdx) {
            await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', task.id), {
                status: statuses[newIdx]
            });
        }
    };

    const moveItemOrder = async (index, direction, list, collectionName) => {
        if (list === tasks && filterTag !== 'ALL') {
             alert("Sortering virker kun når filtret er 'Alle' og Status er 'Alle/Aktive'");
             return;
        }

        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const itemA = list[index];
        const itemB = list[targetIndex];
        
        const orderA = itemA.order || 0;
        const orderB = itemB.order || 0;
        
        const batch = writeBatch(db);
        batch.update(doc(db, PUBLIC_DATA_PATH, collectionName, itemA.id), { order: orderB });
        batch.update(doc(db, PUBLIC_DATA_PATH, collectionName, itemB.id), { order: orderA });
        
        await batch.commit();
    };

    const dragStart = (e, position) => {
        dragItem.current = position;
        e.dataTransfer.effectAllowed = "move";
    };

    const dragEnter = (e, position) => {
        dragOverItem.current = position;
        e.preventDefault();
    };

    const dragEnd = async () => {
        if (filterTag !== 'ALL' || filterStatus === 'DONE') {
             alert("Sortering virker bedst med 'Alle tags' og 'Aktive'");
             dragItem.current = null;
             dragOverItem.current = null;
             return;
        }
        
        const sourceIdx = dragItem.current;
        const destIdx = dragOverItem.current;

        if (sourceIdx === null || destIdx === null || sourceIdx === destIdx) return;

        const copyList = [...tasks];
        const itemToMove = copyList[sourceIdx];
        copyList.splice(sourceIdx, 1);
        copyList.splice(destIdx, 0, itemToMove);
        
        setTasks(copyList);
        
        const batch = writeBatch(db);
        copyList.forEach((t, i) => {
            const newOrder = i; 
            if (t.order !== newOrder) {
                 batch.update(doc(db, PUBLIC_DATA_PATH, 'backlog', t.id), { order: newOrder });
            }
        });
        
        try {
            await batch.commit();
        } catch(e) { console.error("Reorder failed", e); }

        dragItem.current = null;
        dragOverItem.current = null;
    };

    const startConvertFeedback = (fbItem) => {
        setForm({
            title: fbItem.text,
            status: 'todo',
            priority: 'Medium',
            tag: 'APP',
            desc: `Feedback fra ${fbItem.userName} (${fbItem.context || 'App'}).\n\nOriginal: "${fbItem.text}"\n\nDevice: ${fbItem.device || 'Ikke oplyst'}`,
            notes: '', acceptance: '', dataFields: '', release: ''
        });
        setEditingTask(null);
        setLinkedFeedbackId(fbItem.id);
        setIsFormOpen(true);
        setView('board'); 
    }

    const copyDataToClipboard = async () => {
        try {
            const data = { backlog: tasks, feedback: feedback, exportedAt: new Date().toISOString() };
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            alert("Data kopieret!");
        } catch (e) {
            console.error("Clipboard Error:", e);
            alert("Kunne ikke kopiere. Fejl: " + e.message);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-950 z-[60] overflow-y-auto pb-safe">
            {/* HEADER */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 flex flex-col gap-4 shadow-md">
                <div className="flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={onClose} className="mr-3 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5"/></button>
                        <div>
                            <h2 className="text-white font-bold text-lg">Admin Center</h2>
                            <p className="text-xs text-slate-500">RTE Dashboard</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportCSV} className="bg-slate-800 text-green-400 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-700" title="Kopier Backlog CSV">
                            <FileDown className="w-3 h-3 mr-2"/> Backlog
                        </button>
                        <button onClick={handleExportFeedbackCSV} className="bg-slate-800 text-purple-400 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-700" title="Kopier Feedback CSV">
                            <FileDown className="w-3 h-3 mr-2"/> Feedback
                        </button>
                        <button onClick={() => setIsImportOpen(true)} className="bg-slate-800 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-700">
                            <Upload className="w-3 h-3 mr-2"/> Import
                        </button>
                        <button onClick={copyDataToClipboard} className="bg-blue-600/20 text-blue-400 border border-blue-600/50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                            <Copy className="w-3 h-3 mr-2"/> Backup
                        </button>
                    </div>
                </div>
                
                {/* GLOBAL FILTERS */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
                        {['ALL', 'APP', 'TEAM'].map(tag => (
                            <button 
                                key={tag} 
                                onClick={() => setFilterTag(tag)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterTag === tag ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {tag === 'ALL' ? 'Alle Tags' : tag}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
                        <button onClick={() => setFilterStatus('ALL')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterStatus === 'ALL' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Alle Status</button>
                        <button onClick={() => setFilterStatus('ACTIVE')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterStatus === 'ACTIVE' ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'text-slate-500 hover:text-slate-300'}`}>
                             Kun Aktive
                        </button>
                        <button onClick={() => setFilterStatus('DONE')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterStatus === 'DONE' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                             Kun Færdige
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-6xl mx-auto">
                {/* TABS */}
                <div className="flex space-x-2 mb-6 bg-slate-900 p-1 rounded-xl inline-flex">
                    <button onClick={() => setView('board')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${view === 'board' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                        <Layout className="w-4 h-4 mr-2"/> Board
                    </button>
                    <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                        <List className="w-4 h-4 mr-2"/> Backlog Liste
                    </button>
                    <button onClick={() => setView('feedback')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${view === 'feedback' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                        <MessageSquarePlus className="w-4 h-4 mr-2"/> Inbox ({feedback.filter(f => f.status === 'new').length})
                    </button>
                </div>

                {/* VIEW: BOARD (KANBAN) */}
                {view === 'board' && (
                    <div className="space-y-6 fade-in">
                        <button onClick={() => { setEditingTask(null); resetForm(); setIsFormOpen(true); }} className="w-full py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white hover:border-slate-400 flex justify-center items-center">
                            <Plus className="w-5 h-5 mr-2"/> Opret Ny Opgave
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {['backlog', 'todo', 'doing', 'done'].map(status => {
                                // Skip 'done' column if hiding inactive, unless specifically showing DONE
                                if (status === 'done' && filterStatus === 'ACTIVE') return null;
                                
                                const colTasks = filteredTasks.filter(t => t.status === status);
                                return (
                                    <div key={status} className="bg-slate-900/50 rounded-xl border border-slate-800 p-3 min-h-[300px]">
                                        <h3 className="text-slate-400 text-xs font-bold uppercase mb-3 flex justify-between items-center px-1">
                                            {status} <span className="bg-slate-800 px-2 rounded-full border border-slate-700">{colTasks.length}</span>
                                        </h3>
                                        <div className="space-y-2">
                                            {colTasks.map(task => (
                                                <div key={task.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm transition-all group hover:bg-slate-700 relative">
                                                    <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => editTask(task)}>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${task.tag === 'APP' ? 'bg-indigo-900 text-indigo-200' : 'bg-orange-900 text-orange-200'}`}>{task.tag}</span>
                                                        <div className="flex gap-1">
                                                            {task.priority === 'Critical' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mt-1"/>}
                                                            <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="text-slate-600 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3"/></button>
                                                        </div>
                                                    </div>
                                                    <div className="cursor-pointer" onClick={() => editTask(task)}>
                                                        <p className="text-sm font-bold text-white mb-1 line-clamp-2">{task.title}</p>
                                                        <p className="text-xs text-slate-500 line-clamp-2">{task.desc}</p>
                                                    </div>
                                                    {/* Kanban Arrows */}
                                                    <div className="flex justify-between mt-3 pt-2 border-t border-slate-700/50">
                                                        <button onClick={() => moveTaskStatus(task, -1)} disabled={status === 'backlog'} className={`p-1 rounded ${status === 'backlog' ? 'text-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-600'}`}><ArrowLeft className="w-3 h-3"/></button>
                                                        <button onClick={() => moveTaskStatus(task, 1)} disabled={status === 'done'} className={`p-1 rounded ${status === 'done' ? 'text-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-600'}`}><ArrowRight className="w-3 h-3"/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* VIEW: LIST (PRIORITY ARROWS) */}
                {view === 'list' && (
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden fade-in">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="font-bold text-white">Prioriteret Liste {filterTag !== 'ALL' && '(Sortering deaktiveret ved filtrering)'}</h3>
                            <button onClick={() => { setEditingTask(null); resetForm(); setIsFormOpen(true); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center"><Plus className="w-3 h-3 mr-1"/> Ny</button>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {filteredTasks.map((task, index) => (
                                <div 
                                    key={task.id} 
                                    className="p-3 flex items-center bg-slate-900 hover:bg-slate-800 transition-colors group"
                                    draggable={filterTag === 'ALL' && filterStatus !== 'DONE'} 
                                    onDragStart={(e) => dragStart(e, index)}
                                    onDragEnter={(e) => dragEnter(e, index)}
                                    onDragEnd={dragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    {/* DRAG HANDLE FOR DESKTOP */}
                                    <div className="hidden md:flex text-slate-600 cursor-grab active:cursor-grabbing mr-2 hover:text-slate-400">
                                        <GripVertical className="w-5 h-5" />
                                    </div>

                                    {/* Mobile Friendly Reorder Arrows (Visible on mobile, hidden on MD if you prefer, or keep both) */}
                                    <div className="flex md:hidden flex-col gap-1 mr-3 text-slate-500">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); moveItemOrder(index, -1, filteredTasks, 'backlog'); }} 
                                            disabled={index === 0 || filterTag !== 'ALL'}
                                            className="p-1 hover:text-white disabled:opacity-30"
                                        ><ChevronUp className="w-4 h-4"/></button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); moveItemOrder(index, 1, filteredTasks, 'backlog'); }}
                                            disabled={index === filteredTasks.length - 1 || filterTag !== 'ALL'}
                                            className="p-1 hover:text-white disabled:opacity-30"
                                        ><ChevronDown className="w-4 h-4"/></button>
                                    </div>
                                    
                                    <div className="flex-1 cursor-pointer" onClick={() => editTask(task)}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${task.status === 'done' ? 'bg-green-900 text-green-200' : 'bg-slate-700 text-slate-300'}`}>{task.status}</span>
                                            <span className="text-white font-bold text-sm">{task.title}</span>
                                        </div>
                                        <div className="flex gap-4 text-xs text-slate-500">
                                            <span>{task.tag}</span>
                                            {task.release && <span className="text-blue-400">Release: {task.release}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => editTask(task)} className="p-2 text-slate-500 hover:text-blue-400"><Edit2 className="w-4 h-4"/></button>
                                        <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VIEW: INBOX */}
                {view === 'feedback' && (
                    <div className="space-y-3 fade-in">
                        {feedback.length === 0 && <p className="text-slate-500 text-center py-10">Ingen feedback endnu.</p>}
                        {feedback.map((item, index) => (
                            <div key={item.id} className={`p-4 rounded-xl border ${item.status === 'new' ? 'bg-slate-800 border-blue-900/50' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        {/* FEEDBACK PRIORITY CONTROLS */}
                                        <div className="flex flex-col gap-0.5 mr-1 text-slate-600">
                                            <button onClick={() => moveItemOrder(index, -1, feedback, 'feedback')} disabled={index === 0} className="hover:text-white disabled:opacity-30"><ChevronUp className="w-3 h-3"/></button>
                                            <button onClick={() => moveItemOrder(index, 1, feedback, 'feedback')} disabled={index === feedback.length -1} className="hover:text-white disabled:opacity-30"><ChevronDown className="w-3 h-3"/></button>
                                        </div>

                                        <div className="w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold">
                                            {item.userName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{item.userName}</p>
                                            <p className="text-[10px] text-slate-500 flex items-center gap-2">
                                                <span>{new Date(item.timestamp).toLocaleString()}</span>
                                                <span className="bg-slate-800 px-1.5 rounded text-slate-400 border border-slate-700">{item.context || 'App'}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.status === 'new' && (
                                            <button onClick={() => startConvertFeedback(item)} className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-600/30 hover:bg-blue-600/30 font-bold transition-colors">
                                                Opret Opgave
                                            </button>
                                        )}
                                        <button onClick={() => deleteFeedback(item.id)} className="p-1.5 text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-lg text-sm text-slate-300 border border-slate-800 mb-2">
                                    {item.text}
                                </div>
                                
                                {/* DEVICE INFO AT BOTTOM */}
                                {item.device && (
                                    <div className="mt-2 pt-2 border-t border-slate-800/50">
                                        <div className="flex items-start text-[9px] text-slate-600 font-mono">
                                            <Terminal className="w-3 h-3 mr-1.5 mt-0.5 opacity-50 shrink-0"/> 
                                            <span className="break-all opacity-70 leading-relaxed">{item.device}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* TASK FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-white font-bold text-lg">{editingTask ? 'Rediger Opgave' : 'Ny Opgave'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Titel (Påkrævet)</label>
                                    <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} autoFocus/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                        <option value="backlog">Backlog / Idé</option>
                                        <option value="todo">To Do</option>
                                        <option value="doing">Doing</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tag / Type</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})}>
                                        <option value="APP">App Feature</option>
                                        <option value="TEAM">Team Opgave</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Beskrivelse (User Story)</label>
                                    <textarea rows="2" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Som [Rolle] vil jeg..."/>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Acceptkriterier</label>
                                    <textarea rows="3" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.acceptance} onChange={e => setForm({...form, acceptance: e.target.value})} placeholder="- Skal kunne..."/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Noter / Tech Specs</label>
                                    <textarea rows="2" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Datafelter (Udkast)</label>
                                    <textarea rows="2" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.dataFields} onChange={e => setForm({...form, dataFields: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Prioritet</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                                        <option>Critical</option>
                                        <option>High</option>
                                        <option>Medium</option>
                                        <option>Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Release / Sprint</label>
                                    <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.release} onChange={e => setForm({...form, release: e.target.value})} placeholder="fx MVP eller Sprint 1"/>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-800/50 flex justify-between">
                            {editingTask ? <button onClick={() => deleteTask(editingTask.id)} className="text-red-400 hover:text-red-300 px-4 py-2 text-sm font-bold flex items-center"><Trash2 className="w-4 h-4 mr-2"/> Slet</button> : <div/>}
                            <div className="flex gap-3">
                                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white px-4 py-2 font-bold text-sm">Annuller</button>
                                <button onClick={saveTask} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-sm">Gem Opgave</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* IMPORT MODAL */}
            {isImportOpen && (
                <ImportModal onClose={() => setIsImportOpen(false)} onImport={handleImportCSV} />
            )}
            
            {/* ADMIN CONFIRM DIALOG */}
            {adminConfirm && (
                <ConfirmModal 
                    title={adminConfirm.title}
                    message={adminConfirm.message}
                    onConfirm={adminConfirm.onConfirm}
                    onCancel={() => setAdminConfirm(null)}
                />
            )}
        </div>
    );
};

export default App;
