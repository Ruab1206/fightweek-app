import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

import { CATEGORIES } from '../config/constants';
import { addMinutes } from '../utils/dateUtils';
import { useTheme } from '../hooks/useTheme';

import { RECURRENCE_OPTIONS } from '../config/constants';

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
    weekNum: number;
    date: Date;
    initialData: SessionForm | null;
    existingSessions: SessionForm[];
    onClose: () => void;
    onSave: (form: SessionForm) => void;
    onDelete: (id: string) => void;
    onDeleteThisAndFuture: (day: string, name: string, start: string, fromWeek: number) => void;
    onRecurrenceSave: (session: SessionForm, dayName: string, startDate: Date, recurrence: { interval: number; endDate: string | null }) => void;
    onFeedback: (context: string) => void;
}

const SessionModal = ({ day, weekNum, date, initialData, existingSessions: _existingSessions, onClose, onSave, onDelete, onDeleteThisAndFuture, onRecurrenceSave, onFeedback: _onFeedback }: SessionModalProps) => {
    const { isDark } = useTheme();
    const isNew = !initialData;
    const [form, setForm] = useState<SessionForm>({
        name: '', category: 'MMA', start: '17:00', end: '18:30', location: '', status: 'active', cancellationReason: '', cancellationTime: null
    });
    const [recurrenceInterval, setRecurrenceInterval] = useState(0);
    const [endType, setEndType] = useState<'never' | 'date'>('never');
    const [endDate, setEndDate] = useState('');
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);

    useEffect(() => {
        if (initialData) {
            setForm(initialData);
            if (initialData.isRecurring) setRecurrenceInterval(1);
        }
    }, [initialData]);

    const handleChange = (field: keyof SessionForm, value: string) => {
        setForm(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'start' && value) newData.end = addMinutes(value, 90);
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

    const cat = CATEGORIES.find(c => c.label === form.category) || CATEGORIES[6];
    const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
    const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`;

    const handleSave = () => {
        if (recurrenceInterval > 0) {
            onRecurrenceSave(form, day, date, {
                interval: recurrenceInterval,
                endDate: endType === 'date' && endDate ? endDate : null,
            });
        } else {
            onSave(form);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
            <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-4" />

                    {/* Title row with category color */}
                    <div className="px-5 pb-4">
                        <div className="flex items-start gap-3">
                            <div className={`w-1.5 rounded-full self-stretch shrink-0 ${cat.color}`} />
                            <div className="flex-1 min-w-0">
                                <h3 className={`font-bold text-base leading-tight mb-3 ${isDark ? 'text-white' : 'text-ds-text'}`}>
                                    {isNew ? 'Ny egen træning' : 'Rediger træning'}
                                </h3>

                                {/* Name */}
                                <div className="mb-3">
                                    <label className={labelCls}>Aktivitet</label>
                                    <input type="text" className={inputCls} value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="F.eks. MMA Sparring" />
                                </div>

                                {/* Category + Location */}
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className={labelCls}>Kategori</label>
                                        <select className={inputCls} value={form.category} onChange={e => handleChange('category', e.target.value)}>
                                            {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Lokation</label>
                                        <input type="text" className={inputCls} value={form.location} onChange={e => handleChange('location', e.target.value)} placeholder="F.eks. Rumble Sports" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Day + time */}
                    <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <div className={`flex items-center gap-2 text-sm mb-3 ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium capitalize">
                                {date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Start</label>
                                <div className={`flex items-center gap-1.5 ${inputCls}`}>
                                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                                    <input type="time" className={`flex-1 bg-transparent outline-none font-mono text-sm ${isDark ? 'text-white' : 'text-ds-text'}`} value={form.start} onChange={e => handleChange('start', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Slut</label>
                                <div className={`flex items-center gap-1.5 ${inputCls}`}>
                                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                                    <input type="time" className={`flex-1 bg-transparent outline-none font-mono text-sm ${isDark ? 'text-white' : 'text-ds-text'}`} value={form.end} onChange={e => handleChange('end', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recurrence */}
                    <div className={`px-5 py-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <div>
                            <label className={labelCls}>Gentagelse</label>
                            <select value={recurrenceInterval} onChange={e => setRecurrenceInterval(Number(e.target.value))} className={inputCls}>
                                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        {recurrenceInterval > 0 && (
                            <div>
                                <label className={labelCls}>Slutdato</label>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                        <input type="radio" checked={endType === 'never'} onChange={() => setEndType('never')} className="accent-blue-600" />
                                        <span className={isDark ? 'text-slate-300' : 'text-ds-text'}>Slutter ikke</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                        <input type="radio" checked={endType === 'date'} onChange={() => setEndType('date')} className="accent-blue-600" />
                                        <span className={isDark ? 'text-slate-300' : 'text-ds-text'}>På en dato</span>
                                    </label>
                                </div>
                                {endType === 'date' && (
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                        min={date.toISOString().slice(0, 10)}
                                        className={`mt-2 ${inputCls}`} />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Cancel toggle (existing non-standard only) */}
                    {!isNew && (
                        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            <div className="flex items-center gap-3">
                                <button onClick={toggleStatus} className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${form.status === 'cancelled' ? 'bg-red-600 border-red-600' : (isDark ? 'bg-slate-950 border-slate-600' : 'bg-surface-subtle border-surface-border')}`}>
                                    {form.status === 'cancelled' && <span className="text-white text-xs font-bold">✓</span>}
                                </button>
                                <label className={`text-xs font-bold uppercase cursor-pointer ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} onClick={toggleStatus}>Aflys</label>
                            </div>
                            {form.status === 'cancelled' && (
                                <div className="mt-3">
                                    <label className={labelCls}>Årsag til aflysning</label>
                                    <input type="text" className={`${inputCls} border-red-500/50`} value={form.cancellationReason} onChange={e => handleChange('cancellationReason', e.target.value)} placeholder="Sygdom, Skade, Andet..." />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {showDeleteOptions ? (
                    <div className={`px-5 py-3 border-t space-y-1.5 shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slet træning</p>
                        <button onClick={() => { onDelete(form.id!); }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
                            Denne træning
                        </button>
                        {(initialData as any)?.isRecurring && (
                            <button onClick={() => { onDeleteThisAndFuture(day, form.name, form.start, weekNum); }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
                                Denne og alle fremtidige træninger
                            </button>
                        )}
                        <button onClick={() => setShowDeleteOptions(false)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
                            Annuller
                        </button>
                    </div>
                ) : (
                    <div className={`px-5 py-4 border-t flex justify-between items-center shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        {!isNew ? (
                            <button onClick={() => setShowDeleteOptions(true)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                                Slet
                            </button>
                        ) : <div />}
                        <div className="flex gap-3">
                            <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>Annuller</button>
                            <button onClick={handleSave} disabled={!form.name.trim()} className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40">Gem</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default SessionModal;
