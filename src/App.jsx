import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, Lock, HelpCircle, Smartphone, ExternalLink, Copy, Check, MousePointerClick,
  ClipboardList, MessageSquarePlus, Download, ArrowRight, ArrowLeft, Tag, Share2, List, Layout, GripVertical, Edit2, Filter, ChevronUp, Monitor, Terminal, Upload, FileDown, RefreshCw, MoreHorizontal, MoreVertical, Table, Sparkles, CheckSquare, Square, Search, ArrowUpCircle, ArrowDownCircle, CornerDownLeft, Keyboard, Save
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

// Calculate actual date for a given week number and day name
const getDateForWeekDay = (weekNumber, dayName) => {
    const dayIndex = DAYS.indexOf(dayName); // 0 = Mandag
    if (dayIndex === -1) return null;

    const simpleDate = new Date();
    const currentYear = simpleDate.getFullYear();
    const simple = new Date(currentYear, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    // ISOweekStart is now Monday of the given week
    const targetDate = new Date(ISOweekStart);
    targetDate.setDate(ISOweekStart.getDate() + dayIndex);
    
    return targetDate;
};

// Returns { "Mandag": "12. feb", "Tirsdag": ... }
const getWeekDateMap = (weekNumber) => {
    const map = {};
    DAYS.forEach(day => {
        const date = getDateForWeekDay(weekNumber, day);
        if (date) {
            map[day] = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }).replace('.', '');
        }
    });
    return map;
};

// Returns { "Mandag": "12/2", ... } for compact view
const getCompactWeekDateMap = (weekNumber) => {
    const map = {};
    DAYS.forEach(day => {
        const date = getDateForWeekDay(weekNumber, day);
        if (date) {
            map[day] = `${date.getDate()}/${date.getMonth() + 1}`;
        }
    });
    return map;
};

// FIX: Force HH:MM format for HTML input compatibility
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

// --- CSV PARSER & GENERATOR ---
const parseCSV = (text) => {
    if (!text) return [];
    
    // Auto-detect delimiter
    const firstLine = text.split('\n')[0];
    let delimiter = ';';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';

    const result = [];
    let row = [];
    let current = "";
    let inQuotes = false;
    
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; 
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
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
    if (current || row.length > 0) {
        row.push(current);
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) result.push(row);
    }

    if (result.length === 0) return [];
    
    const headers = result[0].map(h => h.trim().replace(/^"|"$/g, ''));
    
    return result.slice(1).map(values => {
        const obj = {};
        headers.forEach((h, i) => {
            let val = values[i] || '';
            obj[h] = val.trim();
        });
        return obj;
    });
};

const generateCSV = (tasks, forSheets = false) => {
    const headers = ['Titel', 'Status', 'Beskrivelse', 'Acceptkriterier', 'Noter', 'Datafelter', 'Release', 'Tag', 'Prioritet', 'ID', 'Order'];
    // For Sheets: Use TAB and replace newlines with a symbol to prevent breaking
    // For Excel: Use SEMICOLON and keep newlines in quotes
    const separator = forSheets ? '\t' : ';'; 
    const csvRows = [headers.join(separator)];

    tasks.forEach(task => {
        const fields = [
            task.title,
            task.status || 'backlog',
            task.desc,
            task.acceptance,
            task.notes,
            task.dataFields,
            task.release,
            task.tag || 'APP',
            task.priority || 'Medium',
            task.id,
            task.order || 0
        ];

        const row = fields.map(field => {
            let val = String(field || '');
            
            if (forSheets) {
                // Flatten newlines for safe pasting into Sheets/Excel manually
                val = val.replace(/\r\n|\r|\n/g, ' ¶ '); // Paragraph symbol as visual separator
                // No need to quote if we remove newlines and use tabs (usually)
                // But let's quote just in case there are tabs in the text
                if (val.includes(separator)) {
                     val = val.replace(/"/g, '""');
                     return `"${val}"`;
                }
                return val;
            } else {
                // Standard CSV compliance for file download
                val = val.replace(/"/g, '""');
                return `"${val}"`;
            }
        });

        csvRows.push(row.join(separator));
    });

    return (forSheets ? '' : '\uFEFF') + csvRows.join('\n');
};

const generateFeedbackCSV = (feedbackItems) => {
    const headers = ['Bruger', 'Kontekst', 'Tekst', 'Device', 'Status', 'Dato', 'ID'];
    const separator = ';';
    const csvRows = [headers.join(separator)];

    feedbackItems.forEach(item => {
        const fields = [
            item.userName,
            item.context,
            item.text,
            item.device,
            item.status || 'new',
            item.timestamp,
            item.id
        ];

        const row = fields.map(field => {
            let val = String(field || '').replace(/"/g, '""');
            return `"${val}"`;
        });
        csvRows.push(row.join(separator));
    });
    
    return '\uFEFF' + csvRows.join('\n');
};

// --- COMPONENTS ---

const ShortcutModal = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4 fade-in" onClick={onClose}>
        <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold text-lg flex items-center"><Keyboard className="w-5 h-5 mr-2 text-blue-500"/>Tastatur Genveje</h3>
                <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                    <h4 className="text-slate-500 font-bold uppercase text-xs mb-2">Navigation</h4>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Ned / Op</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">J / K</span></div>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Åbn opgave</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">Enter</span></div>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Vælg opgave</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">X</span></div>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Ryd valg</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">Esc</span></div>
                </div>
                <div>
                    <h4 className="text-slate-500 font-bold uppercase text-xs mb-2">Redigering</h4>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Gem (i kort)</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">⌘ + Enter</span></div>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Flyt op/ned</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">⇧J / ⇧K</span></div>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Top / Bund</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">T / B</span></div>
                    <div className="flex justify-between py-1 border-b border-slate-800"><span>Status (H/V)</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">F / A</span></div>
                </div>
                <div className="col-span-2 mt-2">
                    <h4 className="text-slate-500 font-bold uppercase text-xs mb-2">Power Tools</h4>
                     <div className="flex justify-between py-1 border-b border-slate-800"><span>Kopier til AI</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">I</span></div>
                     <div className="flex justify-between py-1 border-b border-slate-800"><span>Ny Opgave</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">N</span></div>
                     <div className="flex justify-between py-1 border-b border-slate-800"><span>Søg</span> <span className="font-mono bg-slate-800 px-1.5 rounded text-white">Æ</span></div>
                </div>
            </div>
            <div className="mt-6 text-center text-xs text-slate-500">
                Tryk <span className="font-bold text-slate-400">?</span> overalt for at se denne oversigt.
            </div>
        </div>
    </div>
);

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
                <h2 className="text-white font-bold text-xl mb-2">Brug Chrome eller Safari</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Google tillader ikke login direkte i Messenger.
                </p>
                <button onClick={copyLink} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Link kopieret!" : "Kopier Link"}
                </button>
            </div>
        </div>
    );
}

const LoginScreen = ({ onLoginPopup, onLoginRedirect, error }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full text-center relative">
      <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">v1.65</div>
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
        Log ind med Google (Popup)
      </button>

      <button onClick={onLoginRedirect} className="text-slate-500 text-xs hover:text-blue-400 underline flex items-center justify-center w-full mt-2">
        <MousePointerClick className="w-3 h-3 mr-1" />
        Alternativ Login (Redirect)
      </button>
    </div>
  </div>
);

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 fade-in">
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
            alert("Tak for dit input!");
        } catch (e) {
            console.error("Fejl:", e);
            alert("Fejl. Prøv igen.");
        }
        setSending(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 fade-in">
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 p-6">
                <h3 className="text-white font-bold text-lg mb-2 flex items-center"><MessageSquarePlus className="w-5 h-5 mr-2 text-blue-500"/>Send Feedback</h3>
                <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-blue-600 outline-none mb-4"
                    rows="4"
                    placeholder="Skriv her, hvis du har feedback til træningen, teamet eller app'en."
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

const ImportModal = ({ onClose, onImport }) => {
    const [text, setText] = useState('');
    const [mode, setMode] = useState('append'); 

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-6">
                 <h3 className="text-white font-bold text-lg mb-4">Importer Backlog (CSV)</h3>
                 <p className="text-slate-500 text-xs mb-4">Understøtter Excel (tabs) og semikolon-format.</p>
                 <div className="flex gap-4 mb-4">
                     <button onClick={() => setMode('append')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center ${mode === 'append' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                         <Plus className="w-6 h-6 mb-2"/>
                         <span className="font-bold text-sm">Tilføj til liste</span>
                     </button>
                     <button onClick={() => setMode('replace')} className={`flex-1 p-3 rounded-xl border flex flex-col items-center ${mode === 'replace' ? 'bg-red-900/30 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                         <RefreshCw className="w-6 h-6 mb-2"/>
                         <span className="font-bold text-sm">Erstat liste</span>
                     </button>
                 </div>
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
    
    // Filters & Search
    const [filterTag, setFilterTag] = useState('ALL'); 
    const [statusFilter, setStatusFilter] = useState('active'); 
    const [searchQuery, setSearchQuery] = useState('');
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState(new Set());
    
    // Focus for Keyboard Nav
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const searchInputRef = useRef(null);

    // Task Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [linkedFeedbackId, setLinkedFeedbackId] = useState(null);
    const [adminConfirm, setAdminConfirm] = useState(null);
    const [showMenu, setShowMenu] = useState(false); // Mobile Menu State

    const [form, setForm] = useState({
        title: '', status: 'backlog', priority: 'Medium', tag: 'APP',
        desc: '', notes: '', acceptance: '', dataFields: '', release: '', order: 0
    });

    const isMobile = isMobileDevice();
    const dragItem = useRef();
    const dragOverItem = useRef();

    useEffect(() => {
        const qBacklog = query(collection(db, PUBLIC_DATA_PATH, 'backlog'));
        const unsubBacklog = onSnapshot(qBacklog, (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setTasks(items);
        });

        const qFeedback = query(collection(db, PUBLIC_DATA_PATH, 'feedback'));
        const unsubFeedback = onSnapshot(qFeedback, (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setFeedback(items);
        });

        return () => { unsubBacklog(); unsubFeedback(); }
    }, []);
    
    // FEATURE: Unique releases for datalist
    const uniqueReleases = useMemo(() => {
        const releases = new Set();
        tasks.forEach(t => { if(t.release) releases.add(t.release); });
        return Array.from(releases).sort();
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        let result = tasks.filter(t => {
            const tagMatch = filterTag === 'ALL' || t.tag === filterTag;
            let statusMatch = true;
            if (statusFilter === 'active') statusMatch = t.status !== 'done';
            if (statusFilter === 'done') statusMatch = t.status === 'done';
            return tagMatch && statusMatch;
        });

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t => 
                t.title.toLowerCase().includes(q) || 
                (t.desc && t.desc.toLowerCase().includes(q)) ||
                (t.release && t.release.toLowerCase().includes(q))
            );
        }
        return result;
    }, [tasks, filterTag, statusFilter, searchQuery]);

    // FEATURE: Bulk Move Status
    const bulkMoveStatus = async (direction, targetStatus = null) => {
        const itemsToProcess = selectedIds.size > 0 
            ? tasks.filter(t => selectedIds.has(t.id)) 
            : (focusedIndex >= 0 && filteredTasks[focusedIndex] ? [filteredTasks[focusedIndex]] : []);

        if (itemsToProcess.length === 0) return;

        const statuses = ['backlog', 'todo', 'doing', 'done'];
        const batch = writeBatch(db);
        let count = 0;

        itemsToProcess.forEach(task => {
            let newStatus = targetStatus;
            
            if (!newStatus) {
                const currentIdx = statuses.indexOf(task.status || 'backlog');
                let newIdx = currentIdx + direction;
                // Clamp
                if (newIdx < 0) newIdx = 0;
                if (newIdx >= statuses.length) newIdx = statuses.length - 1;
                newStatus = statuses[newIdx];
            }

            if (newStatus !== task.status) {
                const ref = doc(db, PUBLIC_DATA_PATH, 'backlog', task.id);
                batch.update(ref, { status: newStatus });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }
    };

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Handle Modal Actions
            if (adminConfirm) {
                 if (e.key === 'Escape') { e.preventDefault(); setAdminConfirm(null); }
                 return;
            }

            if (isFormOpen) {
                 // SHORTCUT: Ctrl+Enter or Cmd+Enter to SAVE
                 if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                     e.preventDefault();
                     saveTask();
                     return;
                 }
                 
                 // SHORTCUT: Escape to CLOSE (with dirty check)
                 if (e.key === 'Escape') {
                     e.preventDefault();
                     // Dirty Check Logic
                     const isNew = !editingTask;
                     // Robust check for changes including all fields
                     const hasChanges = isNew 
                        ? (form.title || form.desc || form.notes || form.acceptance) 
                        : (
                            form.title !== (editingTask.title || '') || 
                            form.status !== (editingTask.status || 'backlog') ||
                            form.desc !== (editingTask.desc || '') ||
                            form.notes !== (editingTask.notes || '') ||
                            form.acceptance !== (editingTask.acceptance || '') ||
                            form.priority !== (editingTask.priority || 'Medium') ||
                            form.tag !== (editingTask.tag || 'APP') ||
                            form.release !== (editingTask.release || '') ||
                            form.dataFields !== (editingTask.dataFields || '')
                          );
                     
                     if (hasChanges) {
                         setAdminConfirm({
                             title: "Ugemte ændringer",
                             message: "Du har ændringer, der ikke er gemt. Vil du lukke uden at gemme?",
                             onConfirm: () => { setIsFormOpen(false); setAdminConfirm(null); }
                         });
                     } else {
                         setIsFormOpen(false);
                     }
                 }
                 return; // Block other shortcuts
            }

            if (isImportOpen) return;
            if (document.activeElement === searchInputRef.current) {
                if (e.key === 'Escape') {
                    searchInputRef.current.blur();
                    e.preventDefault();
                }
                return;
            }

            // Global Shortcuts
            if (e.key === 'æ') {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }
            if (e.key === '?' || (e.shiftKey && e.key === '+')) { 
                e.preventDefault();
                setShowShortcuts(prev => !prev);
                return;
            }
            if (showShortcuts && e.key === 'Escape') {
                setShowShortcuts(false);
                return;
            }

            // GLOBAL: AI Copy - moved outside 'list' view check
            if (e.key === 'i') { 
                e.preventDefault();
                handleCopyForAI();
                return;
            }

            if (view !== 'list') return; 

            switch(e.key) {
                case 'J': // Shift+j
                    e.preventDefault();
                    if (focusedIndex < filteredTasks.length - 1) {
                        moveItemOrder(focusedIndex, 1, filteredTasks, 'backlog');
                        setFocusedIndex(prev => prev + 1); // Follow item
                    }
                    break;
                case 'K': // Shift+k
                    e.preventDefault();
                    if (focusedIndex > 0) {
                        moveItemOrder(focusedIndex, -1, filteredTasks, 'backlog');
                        setFocusedIndex(prev => prev - 1); // Follow item
                    }
                    break;
                case 'j': 
                    e.preventDefault();
                    setFocusedIndex(prev => Math.min(prev + 1, filteredTasks.length - 1));
                    break;
                case 'k': 
                    e.preventDefault();
                    setFocusedIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'x': 
                    if (focusedIndex >= 0 && filteredTasks[focusedIndex]) {
                         e.preventDefault();
                         toggleSelection(filteredTasks[focusedIndex].id);
                    }
                    break;
                case 'o': 
                case 'Enter':
                    if (focusedIndex >= 0 && filteredTasks[focusedIndex]) {
                         e.preventDefault();
                         editTask(filteredTasks[focusedIndex]);
                    }
                    break;
                case 'c': 
                    if (selectedIds.size > 0) {
                         deleteSelected();
                    } else if (focusedIndex >= 0) {
                        deleteTask(filteredTasks[focusedIndex].id);
                    }
                    break;
                case 'Escape':
                    if (selectedIds.size > 0) clearSelection();
                    setFocusedIndex(-1);
                    break;
                case 'f': // Forward (Right)
                    e.preventDefault();
                    bulkMoveStatus(1);
                    break;
                case 'a': // Back (Left)
                    e.preventDefault();
                    bulkMoveStatus(-1);
                    break;
                case 'd': // Done
                    e.preventDefault();
                    bulkMoveStatus(0, 'done');
                    break;
                case 't': // Top
                    e.preventDefault();
                    moveSelectedTo('top');
                    break;
                case 'b': // Bottom
                    e.preventDefault();
                    moveSelectedTo('bottom');
                    break;
                case 'n': // New Task
                     e.preventDefault();
                     setEditingTask(null); 
                     resetForm();
                     
                     // 3. FEATURE: CALCULATE SMART ORDER
                     let newOrder = -Date.now(); // Default top
                     if (focusedIndex >= 0 && filteredTasks[focusedIndex]) {
                         const currentItem = filteredTasks[focusedIndex];
                         const nextItem = filteredTasks[focusedIndex + 1];
                         
                         if (nextItem) {
                             // Insert between current and next
                             newOrder = (currentItem.order + nextItem.order) / 2;
                         } else {
                             // Insert at bottom (larger value than current)
                             newOrder = currentItem.order + 1000; 
                         }
                     }
                     setForm(prev => ({ ...prev, order: newOrder }));
                     
                     setIsFormOpen(true);
                     break;
                default: break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFormOpen, isImportOpen, adminConfirm, view, filteredTasks, focusedIndex, selectedIds, showShortcuts, form, editingTask]);

    // Scroll focused item into view
    useEffect(() => {
        if (focusedIndex >= 0 && view === 'list') {
            const el = document.getElementById(`task-${filteredTasks[focusedIndex]?.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [focusedIndex]);


    // Selection Handlers
    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const clearSelection = () => setSelectedIds(new Set());

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        setAdminConfirm({
            title: `Slet ${selectedIds.size} opgaver?`,
            message: "Er du sikker? Dette kan ikke fortrydes.",
            onConfirm: async () => {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    batch.delete(doc(db, PUBLIC_DATA_PATH, 'backlog', id));
                });
                await batch.commit();
                clearSelection();
                setAdminConfirm(null);
            }
        });
    };

    // FEATURE: Move to Top/Bottom (Bulk)
    const moveSelectedTo = async (position) => {
        const itemsToMove = selectedIds.size > 0 
            ? tasks.filter(t => selectedIds.has(t.id)) 
            : (focusedIndex >= 0 && filteredTasks[focusedIndex] ? [filteredTasks[focusedIndex]] : []);
        
        if (itemsToMove.length === 0) return;
        
        // Find extreme order value
        let targetOrder = 0;
        const allOrders = tasks.map(t => t.order || 0);
        if (position === 'top') {
            const minOrder = Math.min(...allOrders);
            targetOrder = minOrder - 1000;
        } else {
            const maxOrder = Math.max(...allOrders);
            targetOrder = maxOrder + 1000;
        }

        const batch = writeBatch(db);
        let counter = 0;
        
        itemsToMove.forEach(task => {
            const ref = doc(db, PUBLIC_DATA_PATH, 'backlog', task.id);
            batch.update(ref, { order: targetOrder + (position === 'top' ? -counter : counter) });
            counter++;
        });

        await batch.commit();
        if (selectedIds.size === 0) {
            // If moved focused item, re-focusing is hard as index changes, but we try to scroll
            // Actually, keep focusedIndex logic simple for now.
        }
        clearSelection();
    };

    const saveTask = async () => {
        if (!form.title) return;
        try {
            if (editingTask) {
                await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', editingTask.id), form);
            } else {
                await addDoc(collection(db, PUBLIC_DATA_PATH, 'backlog'), {
                    ...form,
                    // If custom order is set (from 'n' shortcut), use it. Else default top.
                    order: form.order !== 0 ? form.order : -Date.now(), 
                    createdAt: new Date().toISOString()
                });
                if (linkedFeedbackId) {
                    await updateDoc(doc(db, PUBLIC_DATA_PATH, 'feedback', linkedFeedbackId), { status: 'converted' });
                }
            }
            setIsFormOpen(false);
            setEditingTask(null);
            setLinkedFeedbackId(null);
            resetForm();
        } catch (e) { alert("Fejl: " + e.message); }
    };

    const handleCopyForSheets = async () => {
         try {
            const items = selectedIds.size > 0 ? tasks.filter(t => selectedIds.has(t.id)) : tasks;
            const tsv = generateCSV(items, true);
            await navigator.clipboard.writeText(tsv);
            alert(`${items.length} opgaver kopieret til Sheets!`);
         } catch (e) { alert("Fejl: " + e.message); }
    };

    const handleExportCSV = async () => {
        try {
            const items = selectedIds.size > 0 ? tasks.filter(t => selectedIds.has(t.id)) : tasks;
            const csv = generateCSV(items, false);
            await navigator.clipboard.writeText(csv);
            alert(`${items.length} opgaver kopieret som CSV!`);
        } catch (e) { alert("Kunne ikke eksportere: " + e.message); }
    };
    
    // NEW: Copy formatted text for AI prompting
    const handleCopyForAI = async (singleTask = null) => {
        try {
            let itemsToExport = [];
            if (singleTask && singleTask.id) {
                itemsToExport = [singleTask];
            } else {
                itemsToExport = selectedIds.size > 0 
                    ? tasks.filter(t => selectedIds.has(t.id))
                    : (focusedIndex >= 0 && filteredTasks[focusedIndex] ? [filteredTasks[focusedIndex]] : []);
            }
            
            if (itemsToExport.length === 0) {
                // FALLBACK: If nothing is selected or focused, copy ALL visible filtered tasks
                // itemsToExport = filteredTasks;
                // Actually, let's keep it safe. If user has no selection, do nothing to avoid accidental huge clipboard.
                // alert("Vælg en opgave først (J/K eller X)");
                return;
            }

            const formatAcceptance = (text) => {
                if (!text) return '(Ingen)';
                // If text already has numbering, leave it. If it has newlines but no numbers, add numbers.
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                const hasNumbering = lines.length > 0 && /^\d+[\.)]/.test(lines[0]);
                
                if (!hasNumbering && lines.length > 0) {
                    return lines.map((l, i) => `${i+1}. ${l}`).join('\n');
                }
                return text;
            };

            const text = itemsToExport.map(t => `
OPGAVE: ${t.title}
STATUS: ${t.status}
BESKRIVELSE: ${t.desc || '(Ingen)'}
ACCEPTKRITERIER: 
${formatAcceptance(t.acceptance)}
NOTER: ${t.notes || ''}
--------------------------------------------------
`).join('\n');
            
            await navigator.clipboard.writeText(text);
            alert(`${itemsToExport.length} opgaver kopieret til AI-format!`);
            if (singleTask) return; // Don't clear selection if specific task copy
            clearSelection();
        } catch (e) { alert("Fejl: " + e.message); }
    };

    const handleExportFeedbackCSV = async () => {
        try {
            const csv = generateFeedbackCSV(feedback);
            await navigator.clipboard.writeText(csv);
            alert("Feedback CSV kopieret!");
        } catch (e) { alert("Fejl: " + e.message); }
    };

    const handleImportCSV = async (csvText, mode) => {
        try {
            const parsed = parseCSV(csvText);
            if (!parsed || parsed.length === 0) { alert("Ingen gyldige data."); return; }
            const batch = writeBatch(db);
            let count = 0;
            const now = Date.now();
            
            if (mode === 'replace') {
                const snapshot = await getDocs(collection(db, PUBLIC_DATA_PATH, 'backlog'));
                snapshot.forEach(doc => batch.delete(doc.ref));
            }
            
            const mapStatus = (s) => {
                s = (s || '').toLowerCase();
                if (s.includes('done') || s === 'færdig') return 'done';
                if (s.includes('doing') || s === 'igang') return 'doing';
                if (s.includes('todo') || s === 'to do') return 'todo';
                return 'backlog';
            };

            parsed.forEach((row, idx) => {
                if (!row.Titel) return;
                let ref = (row.ID && row.ID.length > 5) ? doc(db, PUBLIC_DATA_PATH, 'backlog', row.ID) : doc(collection(db, PUBLIC_DATA_PATH, 'backlog'));
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
            alert(`Importerede ${count} opgaver.`);
        } catch (e) { alert("Fejl: " + e.message); }
    };

    const resetForm = () => {
        setForm({
            title: '', status: 'backlog', priority: 'Medium', tag: 'APP',
            desc: '', notes: '', acceptance: '', dataFields: '', release: '', order: 0
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
            release: task.release || '',
            order: task.order || 0
        });
        setIsFormOpen(true);
    };

    const deleteTask = (id) => {
        setAdminConfirm({
            title: "Slet Opgave?",
            message: "Er du sikker? Handlingen kan ikke fortrydes.",
            onConfirm: async () => {
                await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', id));
                if (isFormOpen) setIsFormOpen(false);
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
            await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', task.id), { status: statuses[newIdx] });
        }
    };

    const moveItemOrder = async (index, direction, list, collectionName) => {
        if (filterTag !== 'ALL' && !searchQuery) { alert("Sortering kræver 'Alle' tags og ingen søgning"); return; }
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;
        const itemA = list[index];
        const itemB = list[targetIndex];
        const batch = writeBatch(db);
        batch.update(doc(db, PUBLIC_DATA_PATH, collectionName, itemA.id), { order: itemB.order || 0 });
        batch.update(doc(db, PUBLIC_DATA_PATH, collectionName, itemB.id), { order: itemA.order || 0 });
        await batch.commit();
    };

    // --- DRAG AND DROP HANDLERS (DESKTOP ONLY) ---
    const handleDragStart = (e, index) => {
        if (isMobile) return; 
        dragItem.current = index;
        e.dataTransfer.effectAllowed = "move";
        e.target.style.opacity = "0.5";
    };

    const handleDragEnter = (e, index) => {
        if (isMobile) return;
        dragOverItem.current = index;
        e.preventDefault();
    };

    const handleDragEnd = async (e) => {
        if (isMobile) return;
        e.target.style.opacity = "1";
        const srcIdx = dragItem.current;
        const destIdx = dragOverItem.current;

        if (srcIdx === undefined || destIdx === undefined || srcIdx === destIdx) return;
        if (filterTag !== 'ALL' || searchQuery) { alert("Slå filtre/søgning fra for at bruge Drag'n Drop sortering."); return; }

        const newList = [...filteredTasks];
        const itemToMove = newList[srcIdx];
        
        newList.splice(srcIdx, 1);
        newList.splice(destIdx, 0, itemToMove);
        
        const batch = writeBatch(db);
        
        const orders = filteredTasks.map(t => t.order || 0).sort((a,b) => a-b);
        
        newList.forEach((task, i) => {
            if (task.order !== orders[i]) {
                const ref = doc(db, PUBLIC_DATA_PATH, 'backlog', task.id);
                batch.update(ref, { order: orders[i] });
            }
        });

        try {
            await batch.commit();
        } catch(err) {
            console.error("Reorder failed", err);
            alert("Kunne ikke gemme sortering.");
        }
        
        dragItem.current = null;
        dragOverItem.current = null;
    };


    const startConvertFeedback = (fbItem) => {
        setForm({
            title: fbItem.text, status: 'todo', priority: 'Medium', tag: 'APP',
            desc: `Feedback fra ${fbItem.userName} (${fbItem.context || 'App'}).\n\nOriginal: "${fbItem.text}"\n\nDevice: ${fbItem.device || '?' }`,
            notes: '', acceptance: '', dataFields: '', release: '', order: 0
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
        } catch (e) { alert("Fejl: " + e.message); }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-950 z-[60] overflow-y-auto pb-safe">
            {/* HEADER - RESPONSIVE */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 flex flex-col gap-4 shadow-md">
                <div className="flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={onClose} className="mr-3 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5"/></button>
                        <div>
                            <h2 className="text-white font-bold text-lg">Admin Center</h2>
                            <p className="text-xs text-slate-500 hidden md:block">RTE Dashboard</p>
                        </div>
                    </div>
                    
                    {/* DESKTOP ACTIONS */}
                    <div className="hidden md:flex gap-2">
                         {selectedIds.size > 0 ? (
                            <>
                                <button onClick={() => handleCopyForAI()} className="bg-indigo-600 text-white border border-indigo-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-indigo-500 shadow-lg animate-pulse">
                                    <Sparkles className="w-3 h-3 mr-2"/> Kopier {selectedIds.size} til AI
                                </button>
                                <button onClick={() => moveSelectedTo('top')} className="bg-slate-800 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:text-white hover:bg-slate-700">
                                    <ArrowUpCircle className="w-3 h-3 mr-2"/> Top
                                </button>
                                <button onClick={() => moveSelectedTo('bottom')} className="bg-slate-800 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:text-white hover:bg-slate-700">
                                    <ArrowDownCircle className="w-3 h-3 mr-2"/> Bund
                                </button>
                                <button onClick={() => deleteSelected()} className="bg-red-900/30 text-red-400 border border-red-700/50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-red-900/50">
                                    <Trash2 className="w-3 h-3 mr-2"/> Slet {selectedIds.size}
                                </button>
                                <button onClick={() => clearSelection()} className="bg-slate-800 text-slate-400 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:text-white">
                                    <X className="w-3 h-3 mr-2"/> Ryd
                                </button>
                            </>
                         ) : (
                             <>
                                <button onClick={handleCopyForSheets} className="bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-emerald-900/50">
                                    <Table className="w-3 h-3 mr-2"/> Sheets
                                </button>
                                <button onClick={handleExportCSV} className="bg-slate-800 text-green-400 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-700">
                                    <FileDown className="w-3 h-3 mr-2"/> Excel CSV
                                </button>
                                <button onClick={handleExportFeedbackCSV} className="bg-slate-800 text-purple-400 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-700">
                                    <FileDown className="w-3 h-3 mr-2"/> Feedback
                                </button>
                                <button onClick={() => setIsImportOpen(true)} className="bg-slate-800 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-700">
                                    <Upload className="w-3 h-3 mr-2"/> Import
                                </button>
                                <button onClick={copyDataToClipboard} className="bg-blue-600/20 text-blue-400 border border-blue-600/50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                                    <Copy className="w-3 h-3 mr-2"/> Backup
                                </button>
                             </>
                         )}
                    </div>

                    {/* MOBILE ACTIONS MENU */}
                    <div className="md:hidden relative">
                         <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-slate-800 rounded-lg text-white border border-slate-700">
                             <MoreHorizontal className="w-6 h-6" />
                         </button>
                         {showMenu && (
                             <div className="absolute right-0 top-12 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 flex flex-col gap-2 w-48 z-50">
                                {selectedIds.size > 0 ? (
                                    <>
                                        <button onClick={() => { handleCopyForAI(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-indigo-400 text-xs font-bold flex items-center"><Sparkles className="w-3 h-3 mr-2"/> Kopier {selectedIds.size} til AI</button>
                                        <button onClick={() => { moveSelectedTo('top'); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center"><ArrowUpCircle className="w-3 h-3 mr-2"/> Flyt til Top</button>
                                        <button onClick={() => { moveSelectedTo('bottom'); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center"><ArrowDownCircle className="w-3 h-3 mr-2"/> Flyt til Bund</button>
                                        <button onClick={() => { deleteSelected(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-red-400 text-xs font-bold flex items-center"><Trash2 className="w-3 h-3 mr-2"/> Slet {selectedIds.size}</button>
                                        <button onClick={() => { clearSelection(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-400 text-xs font-bold flex items-center"><X className="w-3 h-3 mr-2"/> Ryd Valg</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { handleCopyForSheets(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-emerald-400 text-xs font-bold flex items-center"><Table className="w-3 h-3 mr-2"/> Kopier til Sheets</button>
                                        <button onClick={() => { handleExportCSV(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-green-400 text-xs font-bold flex items-center"><FileDown className="w-3 h-3 mr-2"/> Eksport CSV</button>
                                        <button onClick={() => { handleExportFeedbackCSV(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-purple-400 text-xs font-bold flex items-center"><FileDown className="w-3 h-3 mr-2"/> Eksport Feedback</button>
                                        <button onClick={() => { setIsImportOpen(true); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center"><Upload className="w-3 h-3 mr-2"/> Import CSV</button>
                                        <button onClick={() => { copyDataToClipboard(); setShowMenu(false); }} className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-blue-400 text-xs font-bold flex items-center"><Copy className="w-3 h-3 mr-2"/> Backup JSON</button>
                                    </>
                                )}
                             </div>
                         )}
                    </div>
                </div>
                
                {/* SEARCH & FILTERS */}
                <div className="flex flex-col gap-2">
                     <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Søg i backlog... (æ)" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none placeholder:text-slate-600"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                     </div>
                     <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-linear">
                        {['ALL', 'APP', 'TEAM'].map(tag => (
                            <button key={tag} onClick={() => setFilterTag(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${filterTag === tag ? 'bg-slate-700 text-white border-slate-600 shadow' : 'bg-slate-800/50 text-slate-500 border-transparent hover:text-slate-300'}`}>
                                {tag === 'ALL' ? 'Alle Tags' : tag}
                            </button>
                        ))}
                         <div className="w-px h-6 bg-slate-800 mx-1 self-center"></div>
                        {['active', 'all', 'done'].map(status => (
                            <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all border ${statusFilter === status ? 'bg-blue-900 text-blue-100 border-blue-800 shadow' : 'bg-slate-800/50 text-slate-500 border-transparent hover:text-slate-300'}`}>
                                {status === 'active' ? 'Aktive' : status === 'all' ? 'Alle' : 'Færdige'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex space-x-2 bg-slate-900 p-1 rounded-xl inline-flex">
                        <button onClick={() => setView('board')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${view === 'board' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><Layout className="w-4 h-4 mr-2"/> Board</button>
                        <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><List className="w-4 h-4 mr-2"/> Liste</button>
                        <button onClick={() => setView('feedback')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${view === 'feedback' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><MessageSquarePlus className="w-4 h-4 mr-2"/> Inbox ({feedback.filter(f => f.status === 'new').length})</button>
                    </div>
                    {view === 'list' && <div className="hidden md:flex items-center text-slate-500 text-[10px] gap-2"><CornerDownLeft className="w-3 h-3"/> <span>Naviger: <b>J</b>/<b>K</b> &bull; Flyt: <b>⇧J</b>/<b>⇧K</b> &bull; Status: <b>A</b>/<b>F</b> &bull; Vælg: <b>X</b> &bull; Ny: <b>N</b> &bull; Hjælp: <b>?</b></span></div>}
                </div>

                {view === 'board' && (
                    <div className="space-y-6 fade-in">
                        <button onClick={() => { setEditingTask(null); resetForm(); setIsFormOpen(true); }} className="w-full py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white hover:border-slate-400 flex justify-center items-center">
                            <Plus className="w-5 h-5 mr-2"/> Opret Ny Opgave
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {['backlog', 'todo', 'doing', 'done'].map(status => {
                                if (statusFilter === 'active' && status === 'done') return null;
                                const count = filteredTasks.filter(t => t.status === status).length;
                                return (
                                    <div key={status} className="bg-slate-900/50 rounded-xl border border-slate-800 p-2 min-h-[300px]">
                                        <div className="flex justify-between items-center mb-3 px-1">
                                             <h3 className="text-slate-400 text-xs font-bold uppercase">{status}</h3>
                                             <div className="bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700 text-xs font-bold text-white">{count}</div>
                                        </div>
                                        <div className="space-y-2">
                                            {filteredTasks.filter(t => t.status === status).map(task => {
                                                const isSelected = selectedIds.has(task.id);
                                                return (
                                                <div key={task.id} className={`bg-slate-800 p-2 rounded-lg border shadow-sm transition-all group hover:bg-slate-700 relative ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-900/20' : 'border-slate-700 hover:border-slate-600'}`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                             <button onClick={(e) => { e.stopPropagation(); toggleSelection(task.id); }} className={`p-1 rounded ${isSelected ? 'text-blue-400' : 'text-slate-600 hover:text-slate-300'}`}>
                                                                {isSelected ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                                                             </button>
                                                             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${task.tag === 'APP' ? 'bg-indigo-900 text-indigo-200' : 'bg-orange-900 text-orange-200'}`}>{task.tag}</span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {task.priority === 'Critical' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mt-1"/>}
                                                            <button onClick={(e) => { e.stopPropagation(); handleCopyForAI(task); }} className="text-slate-600 hover:text-indigo-400 p-0.5" title="Kopier til AI"><Sparkles className="w-3 h-3"/></button>
                                                        </div>
                                                    </div>
                                                    <div className="cursor-pointer" onClick={() => editTask(task)}>
                                                        <p className="text-sm font-bold text-white mb-1 leading-tight">{task.title}</p>
                                                        <p className="text-xs text-slate-400 line-clamp-5 leading-relaxed">{task.desc}</p>
                                                    </div>
                                                    <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/50">
                                                        <button onClick={() => moveTaskStatus(task, -1)} disabled={status === 'backlog'} className={`p-1 rounded ${status === 'backlog' ? 'text-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-600'}`}><ArrowLeft className="w-3 h-3"/></button>
                                                        <button onClick={() => moveTaskStatus(task, 1)} disabled={status === 'done'} className={`p-1 rounded ${status === 'done' ? 'text-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-600'}`}><ArrowRight className="w-3 h-3"/></button>
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {view === 'list' && (
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden fade-in">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="font-bold text-white text-sm">Prioriteret Liste ({filteredTasks.length})</h3>
                            <button onClick={() => { setEditingTask(null); resetForm(); setIsFormOpen(true); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center"><Plus className="w-3 h-3 mr-1"/> Ny</button>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {filteredTasks.map((task, index) => {
                                const isSelected = selectedIds.has(task.id);
                                const isFocused = index === focusedIndex;
                                return (
                                <div 
                                    id={`task-${task.id}`}
                                    key={task.id} 
                                    className={`p-3 flex items-center transition-all group border-l-4 ${isSelected ? 'bg-blue-900/20 border-l-blue-500' : isFocused ? 'bg-slate-800 border-l-blue-400/50' : 'bg-slate-900 border-l-transparent hover:bg-slate-800'}`}
                                    draggable={!isMobile}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <div className="mr-3 flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); toggleSelection(task.id); }} className={`p-1 rounded ${isSelected ? 'text-blue-400' : 'text-slate-600 hover:text-slate-300'}`}>
                                            {isSelected ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                                        </button>
                                        
                                        <div className="text-slate-600 cursor-grab flex flex-col items-center">
                                            {isMobile ? (
                                                <div className="flex flex-col gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); moveItemOrder(index, -1, filteredTasks, 'backlog'); }} disabled={index === 0 || filterTag !== 'ALL' || searchQuery} className="p-1 hover:text-white disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); moveItemOrder(index, 1, filteredTasks, 'backlog'); }} disabled={index === filteredTasks.length - 1 || filterTag !== 'ALL' || searchQuery} className="p-1 hover:text-white disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                                                </div>
                                            ) : (
                                                <GripVertical className="w-5 h-5 hover:text-white" />
                                            )}
                                        </div>
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
                                        <button onClick={(e) => { e.stopPropagation(); handleCopyForAI(task); }} className="p-2 text-slate-500 hover:text-indigo-400" title="Kopier til AI"><Sparkles className="w-4 h-4"/></button>
                                        <button onClick={() => editTask(task)} className="p-2 text-slate-500 hover:text-blue-400"><Edit2 className="w-4 h-4"/></button>
                                        <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )}

                {view === 'feedback' && (
                    <div className="space-y-3 fade-in">
                        {feedback.length === 0 && <p className="text-slate-500 text-center py-10">Ingen feedback endnu.</p>}
                        {feedback.map((item, index) => (
                            <div key={item.id} className={`p-4 rounded-xl border ${item.status === 'new' ? 'bg-slate-800 border-blue-900/50' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col gap-0.5 mr-1 text-slate-600">
                                            <button onClick={() => moveItemOrder(index, -1, feedback, 'feedback')} disabled={index === 0} className="hover:text-white disabled:opacity-30"><ChevronUp className="w-3 h-3"/></button>
                                            <button onClick={() => moveItemOrder(index, 1, feedback, 'feedback')} disabled={index === feedback.length -1} className="hover:text-white disabled:opacity-30"><ChevronDown className="w-3 h-3"/></button>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold">{item.userName.charAt(0)}</div>
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
                                            <button onClick={() => startConvertFeedback(item)} className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-600/30 hover:bg-blue-600/30 font-bold transition-colors">Opret Opgave</button>
                                        )}
                                        <button onClick={() => deleteFeedback(item.id)} className="p-1.5 text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-lg text-sm text-slate-300 border border-slate-800 mb-2">{item.text}</div>
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
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Titel</label>
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
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tag</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})}>
                                        <option value="APP">App Feature</option>
                                        <option value="TEAM">Team Opgave</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Beskrivelse</label>
                                    <textarea rows="2" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})}/>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Acceptkriterier</label>
                                    <textarea rows="3" placeholder="Skriv kriterier her. De nummereres automatisk ved AI eksport." className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.acceptance} onChange={e => setForm({...form, acceptance: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Noter</label>
                                    <textarea rows="2" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Datafelter</label>
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
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Release</label>
                                    <input type="text" list="releases" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-600 outline-none" value={form.release} onChange={e => setForm({...form, release: e.target.value})}/>
                                    <datalist id="releases">
                                        {uniqueReleases.map(r => <option key={r} value={r}/>)}
                                    </datalist>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-800/50 flex justify-between">
                            {editingTask ? <button onClick={() => deleteTask(editingTask.id)} className="text-red-400 hover:text-red-300 px-4 py-2 text-sm font-bold flex items-center"><Trash2 className="w-4 h-4 mr-2"/> Slet</button> : <div/>}
                            <div className="flex gap-3">
                                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white px-4 py-2 font-bold text-sm">Annuller</button>
                                <button onClick={saveTask} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2"><Save className="w-4 h-4"/> Gem Opgave</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
            {isImportOpen && <ImportModal onClose={() => setIsImportOpen(false)} onImport={handleImportCSV} />}
            {adminConfirm && <ConfirmModal title={adminConfirm.title} message={adminConfirm.message} onConfirm={adminConfirm.onConfirm} onCancel={() => setAdminConfirm(null)} />}
        </div>
    );
};

// --- MAIN APP COMPONENT ---
const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isBrowserBlocked, setIsBrowserBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [activeFighter, setActiveFighter] = useState('Karl');
  const [isLocked, setIsLocked] = useState(true);
  const [systemWeek] = useState(getISOWeek()); 
  const [currentWeek, setCurrentWeek] = useState(getISOWeek()); 
  const [view, setView] = useState('personal'); 
  const [isStandardMode, setIsStandardMode] = useState(false);
  const [scheduleData, setScheduleData] = useState({}); 
  const [teamData, setTeamData] = useState({}); 
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingSession, setEditingSession] = useState(null); 
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feedbackContext, setFeedbackContext] = useState(null); 
  const [adminOpen, setAdminOpen] = useState(false);

  // Date Logic
  const [weekDates, setWeekDates] = useState({});

  useEffect(() => {
    setIsMobile(isMobileDevice());
    if (checkInAppBrowser()) { setIsBrowserBlocked(true); setAuthLoading(false); return; }
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

  // Update dates when week changes
  useEffect(() => {
    setWeekDates(getWeekDateMap(currentWeek));
  }, [currentWeek]);

  // SEPARATE LOGIN HANDLERS
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

  const handleLogout = () => { signOut(auth); setAccessDenied(false); setLoginError(null); };

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
    
    // ARCHITECTURAL CHANGE: Calculate and save session date
    // This allows future calendar views to query by exact date without knowing the week number structure
    if (!isStandardMode) {
        const sessionDate = getDateForWeekDay(currentWeek, editingDay);
        if (sessionDate) {
            // Set time to session start time if available, otherwise noon
            if (session.start) {
                const [h, m] = session.start.split(':').map(Number);
                sessionDate.setHours(h, m);
            }
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
              title: "Fjern Hviledag?", message: "Dette er en hviledag. Vil du fjerne hviledagen og oprette et pas?",
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
            else alert("Ingen standarduge fundet.");
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

  const getWeekLabel = () => {
        if (currentWeek === systemWeek) return `Uge ${currentWeek} (Aktuel)`;
        if (currentWeek > systemWeek) return `Uge ${currentWeek} (Næste)`;
        return `Uge ${currentWeek} (Tidligere)`;
    };
    const getCurrentContextName = () => {
        if (view === 'team') {
            if (isStandardMode) return 'Standarduge - Teamet';
            return `${getWeekLabel()} - Teamet`;
        }
        if (isStandardMode) return 'Standarduge - Min';
        return `${getWeekLabel()} - Min Plan`;
    };
  const openFeedback = (ctx) => setFeedbackContext(ctx || getCurrentContextName());

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
            {isAdmin && (
                <button onClick={() => setAdminOpen(true)} className="p-2 bg-slate-800 rounded-lg text-yellow-500 border border-yellow-900/30 shadow-sm">
                    <ClipboardList className="w-5 h-5" />
                </button>
            )}
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
            <button onClick={() => openFeedback()} className="flex flex-col items-center justify-center p-2 text-slate-500 hover:text-blue-400">
                <div className="bg-slate-800 p-2 rounded-full mb-1 border border-slate-700"><MessageSquarePlus className="w-5 h-5" /></div>
            </button>
            <NavButton icon={User} label="Teamet" active={view === 'team'} onClick={() => setView('team')} />
        </div>
      </div>

      {modalOpen && <SessionModal day={editingDay} initialData={editingSession} existingSessions={scheduleData[editingDay] || []} onClose={() => setModalOpen(false)} onSave={handleSaveSession} onDelete={handleDeleteSession} isStandardMode={isStandardMode} onFeedback={(ctx) => openFeedback(ctx)} />}
      {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} />}
      {adminOpen && <AdminDashboard onClose={() => setAdminOpen(false)} />}
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl w-16 transition-colors ${active ? 'text-blue-500' : 'text-slate-500'}`}>
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

const TeamSchedule = ({ days, teamData, currentWeek, isStandardMode }) => {
    // 2. FEATURE: DEFAULT TO CURRENT DAY
    const getCurrentDayName = () => {
        const dayIndex = new Date().getDay(); // 0 is Sunday
        const day = dayIndex === 0 ? 'Søndag' : DAYS[dayIndex - 1];
        return day;
    };
    
    const [selectedDay, setSelectedDay] = useState(getCurrentDayName);
    const [compactDates, setCompactDates] = useState({});

    useEffect(() => {
        setCompactDates(getCompactWeekDateMap(currentWeek));
    }, [currentWeek]);

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
                     <button key={d} onClick={() => setSelectedDay(d)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all border flex flex-col items-center ${selectedDay === d ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                         <span>{d.slice(0, 3)}</span>
                         {!isStandardMode && compactDates[d] && <span className="text-[10px] opacity-70">{compactDates[d]}</span>}
                     </button>
                 ))}
             </div>
             <div className="px-4 space-y-4 pb-32">
                 {sortedTimes.length === 0 && <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl"><User className="w-10 h-10 mb-2 opacity-50"/><p>Ingen fælles træning</p></div>}
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
    
    // 3. FEATURE: AUTO-CALCULATE END TIME
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
    
    // 4. FEATURE: HIDE CHOSEN SESSIONS
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

export default App;
