import { useState, useEffect } from 'react';
import { X, Check, Trash2, MessageSquarePlus, Save } from 'lucide-react';

import { CATEGORIES } from '../config/constants';
import { addMinutes } from '../utils/dateUtils';
import { useTheme } from '../hooks/useTheme';

interface SessionForm {
    id?: string;
    name: string;
    category: string;
    start: string;
    end: string;
    location: string;
    status: string;
    cancellationReason: string;
    cancellationTime: string | null;
    catalogueClassId?: string;
}

interface SessionModalProps {
    day: string;
    initialData: SessionForm | null;
    existingSessions: SessionForm[];
    onClose: () => void;
    onSave: (form: SessionForm) => void;
    onDelete: (id: string) => void;
    isStandardMode: boolean;
    onFeedback: (context: string) => void;
}

const SessionModal = ({ day, initialData, existingSessions: _existingSessions, onClose, onSave, onDelete, isStandardMode, onFeedback }: SessionModalProps) => {
    const { isDark } = useTheme();
    const isNew = !initialData;
    const [form, setForm] = useState<SessionForm>({
        name: '', category: 'MMA', start: '', end: '', location: '', status: 'active', cancellationReason: '', cancellationTime: null
    });

    useEffect(() => {
        if (initialData) setForm(initialData);
    }, [initialData]);

    const handleChange = (field: keyof SessionForm, value: string) => {
        setForm(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'start' && value && !prev.end) newData.end = addMinutes(value, 90);
            return newData;
        });
    };
    
    const toggleStatus = () => {
        setForm(prev => ({
            ...prev,
            status: prev.status === 'active' ? 'cancelled' : 'active',
            cancellationReason: prev.status === 'active' ? 'Aflyst' : '',
            cancellationTime: prev.status === 'active' ? new Date().toISOString() : null
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4 fade-in">
            <div className={`w-full max-w-lg sm:rounded-2xl rounded-t-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-surface-subtle border-surface-border'}`}>
                    <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-ds-text'}`}>{isNew ? `Nyt Pas: ${day}` : 'Rediger Pas'}</h3>
                    <button onClick={onClose} className={`p-1 rounded-full ${isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text bg-surface-hover'}`}><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-5">
                    <div>
                        <label className={`block text-xs font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Aktivitet</label>
                        <input type="text" className={`w-full border rounded-xl p-3 font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`} value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="F.eks. MMA Sparring" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Kategori</label>
                            <select className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none appearance-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`} value={form.category} onChange={e => handleChange('category', e.target.value)}>
                                {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Lokation</label>
                            <input type="text" className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`} value={form.location} onChange={e => handleChange('location', e.target.value)} placeholder="F.eks. Rumble Sports" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Start</label>
                            <input type="time" className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none text-center font-mono ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`} value={form.start} onChange={e => handleChange('start', e.target.value)} />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Slut</label>
                            <input type="time" className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none text-center font-mono ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`} value={form.end} onChange={e => handleChange('end', e.target.value)} />
                        </div>
                    </div>
                    
                    {!isStandardMode && !isNew && (
                        <div className={`pt-2 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                             <div className="flex items-center gap-3">
                                <button onClick={toggleStatus} className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${form.status === 'cancelled' ? 'bg-red-600 border-red-600' : (isDark ? 'bg-slate-950 border-slate-600' : 'bg-surface-subtle border-surface-border')}`}>
                                    {form.status === 'cancelled' && <Check className="w-3.5 h-3.5 text-white" />}
                                </button>
                                <label className={`text-xs font-bold uppercase cursor-pointer ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} onClick={toggleStatus}>Aflys</label>
                             </div>
                             {form.status === 'cancelled' && (
                                <div className="mt-3">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Årsag til aflysning</label>
                                    <input type="text" className="w-full bg-red-900/20 border border-red-900/50 rounded-xl p-2 text-red-200 text-sm placeholder-red-400/50 focus:outline-none focus:ring-2 focus:ring-red-600" value={form.cancellationReason} onChange={e => handleChange('cancellationReason', e.target.value)} placeholder="Sygdom, Skade, Andet..." />
                                </div>
                             )}
                        </div>
                    )}
                </div>

                <div className={`p-4 border-t flex justify-between items-center pb-safe ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-surface-border bg-surface-subtle'}`}>
                    <div className="flex gap-2">
                         {!isNew && <button onClick={() => onDelete(form.id)} className={`p-3 rounded-xl transition-colors ${isDark ? 'text-slate-500 hover:text-red-500 hover:bg-red-900/20' : 'text-ds-text-subtlest hover:text-red-500 hover:bg-red-50'}`}><Trash2 className="w-5 h-5" /></button>}
                         {!isNew && !isStandardMode && <button onClick={() => { onClose(); onFeedback(`Pas: ${form.name}`); }} className={`p-3 rounded-xl transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-blue-900/20' : 'text-ds-text-subtlest hover:text-brand-500 hover:bg-brand-50'}`}><MessageSquarePlus className="w-5 h-5" /></button>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className={`font-bold text-sm px-4 ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}>Annuller</button>
                        <button onClick={() => onSave(form)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 flex items-center">
                            <Save className="w-4 h-4 mr-2" /> Gem
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionModal;
