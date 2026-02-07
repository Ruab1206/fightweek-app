import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, User, ChevronDown, Info, ChevronLeft, ChevronRight, 
  Clock, MapPin, Bed, Plus, AlertCircle, X, Trash2, Calendar, 
  History, Globe, LogOut, Lock, HelpCircle, Smartphone, ExternalLink, Copy, Check, MousePointerClick,
  ClipboardList, MessageSquarePlus, Download, ArrowRight, ArrowLeft, Tag, Share2, List, Layout, GripVertical, Edit2, Filter, ChevronUp, Monitor, Terminal
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, writeBatch 
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
      <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">v1.32</div>
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
                // Sæt en negativ timestamp som order, så den sorteres først (laveste tal først ved ASC sortering)
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

// --- ADMIN DASHBOARD (BACKLOG) ---
const AdminDashboard = ({ onClose }) => {
    const [tasks, setTasks] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [view, setView] = useState('board'); 
    const [filterTag, setFilterTag] = useState('ALL'); 
    
    // Task Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [linkedFeedbackId, setLinkedFeedbackId] = useState(null);

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

    useEffect(() => {
        const qBacklog = query(collection(db, PUBLIC_DATA_PATH, 'backlog'));
        const unsubBacklog = onSnapshot(qBacklog, (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            // Sorter efter 'order' ASC. Nyere items har mindre 'order' værdi (negativ timestamp), så de kommer først.
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setTasks(items);
        }, (err) => console.error("Backlog Error:", err));

        const qFeedback = query(collection(db, PUBLIC_DATA_PATH, 'feedback'));
        const unsubFeedback = onSnapshot(qFeedback, (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            // Sorter efter 'order' ASC.
            items.sort((a,b) => (a.order || 0) - (b.order || 0));
            setFeedback(items);
        }, (err) => console.error("Feedback Error:", err));

        return () => { unsubBacklog(); unsubFeedback(); }
    }, []);

    const filteredTasks = tasks.filter(t => filterTag === 'ALL' || t.tag === filterTag);

    const saveTask = async () => {
        if (!form.title) return;
        try {
            if (editingTask) {
                await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', editingTask.id), form);
            } else {
                await addDoc(collection(db, PUBLIC_DATA_PATH, 'backlog'), {
                    ...form,
                    createdAt: new Date().toISOString(),
                    order: -Date.now() // Negativ timestamp for at placere øverst
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

    const deleteTask = async (id) => {
        if(confirm('Er du sikker på, at du vil slette denne opgave? Handlingen kan ikke fortrydes.')) {
            try {
                await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', id));
                if (isFormOpen) setIsFormOpen(false);
            } catch (e) {
                alert("Kunne ikke slette: " + e.message);
            }
        }
    };
    
    const deleteFeedback = async (id) => {
        if(confirm('Er du sikker på, at du vil slette dette feedback item?')) {
            await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'feedback', id));
        }
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
             alert("Sortering virker kun når filtret er 'Alle'");
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

    const startConvertFeedback = (fbItem) => {
        setForm({
            title: fbItem.text,
            status: 'todo',
            priority: 'Medium',
            tag: 'APP',
            desc: `Feedback fra ${fbItem.userName} (${fbItem.context || 'App'}).\nOriginal: "${fbItem.text}"`,
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

    // DnD Refs
    const dragItem = useRef();
    const dragOverItem = useRef();
    
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
                    <button onClick={copyDataToClipboard} className="bg-blue-600/20 text-blue-400 border border-blue-600/50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                        <Copy className="w-3 h-3 mr-2"/> Kopier til AI
                    </button>
                </div>
                
                {/* GLOBAL FILTERS */}
                <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg self-start">
                    {['ALL', 'APP', 'TEAM'].map(tag => (
                        <button 
                            key={tag} 
                            onClick={() => setFilterTag(tag)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterTag === tag ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {tag === 'ALL' ? 'Alle' : tag}
                        </button>
                    ))}
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
                            {['backlog', 'todo', 'doing', 'done'].map(status => (
                                <div key={status} className="bg-slate-900/50 rounded-xl border border-slate-800 p-3 min-h-[300px]">
                                    <h3 className="text-slate-400 text-xs font-bold uppercase mb-3 flex justify-between items-center px-1">
                                        {status} <span className="bg-slate-800 px-2 rounded-full border border-slate-700">{filteredTasks.filter(t => t.status === status).length}</span>
                                    </h3>
                                    <div className="space-y-2">
                                        {filteredTasks.filter(t => t.status === status).map(task => (
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
                            ))}
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
                                <div key={task.id} className="p-3 flex items-center bg-slate-900 hover:bg-slate-800 transition-colors group">
                                    {/* Mobile Friendly Reorder Arrows */}
                                    <div className="flex flex-col gap-1 mr-3 text-slate-500">
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
  const [feedbackContext, setFeedbackContext] = useState(null); // String or null
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

  // Handlers (Login, CRUD, Logic)
  const handleSmartLogin = async () => {
      setLoginError(null);
      const provider = new GoogleAuthProvider();
      try { isMobile ? await signInWithRedirect(auth, provider) : await signInWithPopup(auth, provider); } 
      catch (error) { setLoginError(error.message); }
  };

  const handleLogout = () => { signOut(auth); setAccessDenied(false); setLoginError(null); };

  // Data Sync Hooks (Personal & Team)
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

  // Helper Wrappers for Modals
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

  // --- RENDERING ---
  if (isBrowserBlocked) return <BrowserBlockScreen />;
  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loader...</div>;
  if (!user) return <LoginScreen onLoginPopup={() => handleSmartLogin()} onLoginRedirect={() => handleSmartLogin()} error={loginError} />;
  if (accessDenied) return <div className="text-white text-center p-10">Ingen adgang <button onClick={handleLogout}>Log ud</button></div>;

  const isReadOnly = !isStandardMode && currentWeek < systemWeek;
  const userRole = USER_MAPPING[user.email.toLowerCase()]?.role;
  const isAdmin = userRole === 'admin' || userRole === 'coach';

  // Helper for Context Name
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

  // Trigger feedback with explicit context
  const openFeedback = (ctx) => setFeedbackContext(ctx || getCurrentContextName());

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen pb-24 font-sans selection:bg-blue-500/30">
      {/* HEADER */}
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
        {/* Banner: Standard Mode */}
        {isStandardMode && (
          <div className={`mx-4 mb-4 rounded-xl p-3 flex items-start space-x-3 fade-in ${view === 'team' ? 'bg-indigo-900/30 border-indigo-700/50' : 'bg-yellow-900/30 border-yellow-700/50'}`}>
              <Info className={`w-5 h-5 mt-0.5 ${view === 'team' ? 'text-indigo-400' : 'text-yellow-500'}`} />
              <div>
                <p className={`text-sm font-bold ${view === 'team' ? 'text-indigo-200' : 'text-yellow-200'}`}>{view === 'team' ? 'Teamets Standarduger' : 'Redigerer Standarduge'}</p>
                <p className="text-xs opacity-80 mt-1">{view === 'team' ? 'Her ser du teamets faste grundplan.' : 'Dette er din skabelon. Klik "Gem" når du er færdig.'}</p>
              </div>
          </div>
        )}

        {/* Controls (Week Selector) */}
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

        {/* VIEWS */}
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
                                <h3 className={`text-white font-bold text-lg ${isReadOnly ? 'text-slate-400' : ''}`}>{day}</h3>
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
             <TeamSchedule days={DAYS} teamData={teamData} />
        )}
      </div>

      {/* FOOTER & OVERLAYS */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe z-50">
        <div className="max-w-md mx-auto flex justify-between items-center p-2 px-6">
            <NavButton icon={Calendar} label="Min Plan" active={view === 'personal'} onClick={() => setView('personal')} />
            <button onClick={() => openFeedback()} className="flex flex-col items-center justify-center p-2 text-slate-500 hover:text-blue-400">
                <div className="bg-slate-800 p-2 rounded-full mb-1 border border-slate-700"><MessageSquarePlus className="w-5 h-5" /></div>
            </button>
            <NavButton icon={User} label="Teamet" active={view === 'team'} onClick={() => setView('team')} />
        </div>
      </div>

      {modalOpen && <SessionModal day={editingDay} initialData={editingSession} onClose={() => setModalOpen(false)} onSave={handleSaveSession} onDelete={handleDeleteSession} isStandardMode={isStandardMode} onFeedback={(ctx) => openFeedback(ctx)} />}
      {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      
      {/* NEW SYSTEM MODALS */}
      {feedbackContext && <FeedbackModal user={user} currentContext={feedbackContext} onClose={() => setFeedbackContext(null)} />}
      {adminOpen && <AdminDashboard onClose={() => setAdminOpen(false)} />}
    </div>
  );
};

// --- HELPER COMPONENTS ---
const NavButton = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl w-16 transition-colors ${active ? 'text-blue-500' : 'text-slate-500'}`}>
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
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
                    <h3 className="text-white font-bold text-lg flex items-center"><span className="w-1 h-6 bg-blue-500 rounded-full mr-3"></span> {day}</h3>
                    <div className="flex gap-2">
                        {/* FEEDBACK BUTTON IN MODAL */}
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
                                    <input disabled={isExisting} type="time" value={form.start} onChange={e => setForm({...form, start: e.target.value})} className={`w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isExisting ? 'opacity-50 cursor-not-allowed' : ''}`}/>
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
