import { useState, useEffect } from 'react';
import { X, Trash2, Save, Plus, Minus } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useGyms } from '../hooks/useGyms';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';

// ── Helpers ──
const formatDate = (v: unknown): string => {
  const d = v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate() : new Date(v as string | number);
  return isNaN(d.getTime()) ? '–' : d.toLocaleString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mandag' },
  { value: 2, label: 'Tirsdag' },
  { value: 3, label: 'Onsdag' },
  { value: 4, label: 'Torsdag' },
  { value: 5, label: 'Fredag' },
  { value: 6, label: 'Lørdag' },
  { value: 7, label: 'Søndag' },
];

const DISCIPLINE_OPTIONS = ['MMA', 'BJJ', 'Boxing', 'Muay Thai', 'Wrestling', 'S&C', 'Andet'];
const LEVEL_OPTIONS = ['Beginner', 'Advanced', 'Kamphold', 'Elite', 'Pro', 'Alle niveauer'];

interface CatalogueForm {
  title: string;
  discipline: string;
  subDiscipline: string;
  level: string;
  ageGroup: string;
  gym: string;
  location: string;
  address: string;
  instructor: string;
  description: string;
  schedules: ClassSchedule[];
}

interface CatalogueModalProps {
  initialData: CatalogueClass | null;
  copySource: CatalogueClass | null;
  preselectedDay: number | null;
  onClose: () => void;
  onSave: (data: CatalogueForm) => void;
  onDelete: (id: string) => void;
}

function emptySchedule(day?: number): ClassSchedule {
  return { dayOfWeek: day ?? 1, startTime: '', endTime: '' };
}

function formFromClass(cls: CatalogueClass): CatalogueForm {
  return {
    title: cls.title,
    discipline: cls.discipline,
    subDiscipline: cls.subDiscipline ?? '',
    level: cls.level,
    ageGroup: cls.ageGroup ?? '',
    gym: cls.gym,
    location: cls.location,
    address: cls.address ?? '',
    instructor: cls.instructor ?? '',
    description: cls.description ?? '',
    schedules: cls.schedules.length > 0 ? [...cls.schedules] : [emptySchedule()],
  };
}

export default function CatalogueModal({ initialData, copySource, preselectedDay, onClose, onSave, onDelete }: CatalogueModalProps) {
  const { isDark } = useTheme();
  const { gyms } = useGyms();
  const isNew = !initialData;
  const isCopy = isNew && !!copySource;
  const prefill = initialData ?? copySource;

  const [form, setForm] = useState<CatalogueForm>(() =>
    prefill
      ? formFromClass(prefill)
      : {
          title: '', discipline: 'MMA', subDiscipline: '', level: 'Alle niveauer',
          ageGroup: '', gym: '', location: '', address: '', instructor: '', description: '',
          schedules: [emptySchedule(preselectedDay ?? undefined)],
        }
  );

  useEffect(() => {
    if (initialData) setForm(formFromClass(initialData));
  }, [initialData]);

  const set = <K extends keyof CatalogueForm>(field: K, value: CatalogueForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setSchedule = (idx: number, patch: Partial<ClassSchedule>) =>
    setForm((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));

  const addSchedule = () => setForm((prev) => ({ ...prev, schedules: [...prev.schedules, emptySchedule()] }));
  const removeSchedule = (idx: number) => setForm((prev) => ({ ...prev, schedules: prev.schedules.filter((_, i) => i !== idx) }));

  // ── Styling tokens (matches SessionModal) ──
  const labelCls = `block text-xs font-bold uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`;
  const inputCls = `w-full border rounded-xl p-3 font-bold focus:ring-2 focus:ring-blue-600 outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`;
  const selectCls = `w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none appearance-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`;
  const timeCls = `w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none text-center font-mono ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-surface-subtle border-surface-border text-ds-text'}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4 fade-in">
      <div className={`w-full max-w-lg sm:rounded-2xl rounded-t-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>

        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-surface-subtle border-surface-border'}`}>
          <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-ds-text'}`}>
            {isCopy ? 'Kopier Hold' : isNew ? 'Nyt Hold' : 'Rediger Hold'}
          </h3>
          <button onClick={onClose} className={`p-1 rounded-full ${isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text bg-surface-hover'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Title */}
          <div>
            <label className={labelCls}>Holdnavn</label>
            <input type="text" className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="F.eks. Thaiboksning Elite" />
          </div>

          {/* Discipline + Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Disciplin</label>
              <select className={selectCls} value={form.discipline} onChange={(e) => set('discipline', e.target.value)}>
                {DISCIPLINE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Niveau</label>
              <select className={selectCls} value={form.level} onChange={(e) => set('level', e.target.value)}>
                {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* SubDiscipline + AgeGroup */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Underfokus</label>
              <input type="text" className={inputCls} value={form.subDiscipline} onChange={(e) => set('subDiscipline', e.target.value)} placeholder="Thai clinch, Wall wrestling…" />
            </div>
            <div>
              <label className={labelCls}>Aldersgruppe</label>
              <input type="text" className={inputCls} value={form.ageGroup} onChange={(e) => set('ageGroup', e.target.value)} placeholder="6-12 år, 13-17 år…" />
            </div>
          </div>

          {/* Gym + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Klub</label>
              <select className={selectCls} value={form.gym} onChange={(e) => {
                const gymName = e.target.value;
                set('gym', gymName);
                const gym = gyms.find((g) => g.name === gymName);
                if (gym?.address) set('address', gym.address);
              }}>
                <option value="">Vælg…</option>
                {gyms.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Lokation</label>
              <input type="text" className={inputCls} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Sal 1, Kælderen…" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelCls}>Adresse</label>
            <input type="text" className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Gade, postnr. by" />
          </div>

          {/* Instructor */}
          <div>
            <label className={labelCls}>Instruktør</label>
            <input type="text" className={inputCls} value={form.instructor} onChange={(e) => set('instructor', e.target.value)} placeholder="Navn" />
          </div>

          {/* Schedules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>Tider</label>
              <button onClick={addSchedule} className="text-blue-500 hover:text-blue-400 p-1">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {form.schedules.map((s, i) => (
                <div key={i} className={`flex items-end gap-2 p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-surface-raised border-surface-border'}`}>
                  <div className="flex-1">
                    <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Dag</label>
                    <select className={selectCls} value={s.dayOfWeek} onChange={(e) => setSchedule(i, { dayOfWeek: Number(e.target.value) })}>
                      {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Start</label>
                    <input type="time" className={timeCls} value={s.startTime} onChange={(e) => setSchedule(i, { startTime: e.target.value })} />
                  </div>
                  <div className="w-24">
                    <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slut</label>
                    <input type="time" className={timeCls} value={s.endTime} onChange={(e) => setSchedule(i, { endTime: e.target.value })} />
                  </div>
                  {form.schedules.length > 1 && (
                    <button onClick={() => removeSchedule(i)} className={`p-2 rounded-lg ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-ds-text-subtlest hover:text-red-500'}`}>
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Beskrivelse</label>
            <textarea className={inputCls + ' h-20 resize-none'} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Valgfrit – forudsætninger, fokus mv." />
          </div>

          {/* Metadata (read-only, only for existing items) */}
          {!isNew && initialData && (
            <div className={`pt-4 mt-2 border-t space-y-1 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Metadata</p>
              <div className={`text-xs space-y-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                <p>Kilde: {initialData.source}</p>
                {initialData.createdBy && <p>Oprettet af: {initialData.createdBy}</p>}
                <p>Oprettet: {formatDate(initialData.createdAt)}</p>
                <p>Opdateret: {formatDate(initialData.updatedAt)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-between items-center pb-safe ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-surface-border bg-surface-subtle'}`}>
          <div className="flex gap-2">
            {!isNew && (
              <button onClick={() => onDelete(initialData!.id)} className={`p-3 rounded-xl transition-colors ${isDark ? 'text-slate-500 hover:text-red-500 hover:bg-red-900/20' : 'text-ds-text-subtlest hover:text-red-500 hover:bg-red-50'}`}>
                <Trash2 className="w-5 h-5" />
              </button>
            )}
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
}

export type { CatalogueForm };
