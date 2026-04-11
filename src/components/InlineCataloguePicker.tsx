import { useState, useMemo } from 'react';
import { Search, MapPin, Plus, X, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

import { CATEGORIES, DAYS } from '../config/constants';
import { useCatalogue } from '../hooks/useCatalogue';
import { useTheme } from '../hooks/useTheme';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';

const DISCIPLINE_CATEGORY: Record<string, string> = {
    MMA: 'MMA', BJJ: 'Grappling', Grappling: 'Grappling', 'No-Gi': 'Grappling',
    Wrestling: 'Brydning', Brydning: 'Brydning', Boxing: 'Boksning', Boksning: 'Boksning',
    'Muay Thai': 'Kickboxing', Kickboksning: 'Kickboxing', Kickboxing: 'Kickboxing',
    'S&C': 'Fysisk træning', Fitness: 'Fysisk træning',
};
export const disciplineToCategory = (d: string) => DISCIPLINE_CATEGORY[d] || 'Andet';

export interface CatalogueAddPayload {
    name: string; category: string; start: string; end: string; location: string; catalogueClassId: string;
}

const INITIAL_SHOW = 5;

interface Props {
    day: string;
    onAdd: (session: CatalogueAddPayload) => void;
    onClose: () => void;
}

const InlineCataloguePicker = ({ day, onAdd, onClose }: Props) => {
    const { isDark } = useTheme();
    const { classes, loading } = useCatalogue();
    const dayIndex = DAYS.indexOf(day) + 1;

    const [search, setSearch] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selDiscipline, setSelDiscipline] = useState<string | null>(null);
    const [selGym, setSelGym] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const allOptions = useMemo(() => {
        const opts: { cls: CatalogueClass; schedule: ClassSchedule }[] = [];
        for (const cls of classes) {
            for (const sched of cls.schedules) {
                if (sched.dayOfWeek === dayIndex) opts.push({ cls, schedule: sched });
            }
        }
        return opts.sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
    }, [classes, dayIndex]);

    const disciplines = useMemo(() => [...new Set(allOptions.map(o => o.cls.discipline))].sort(), [allOptions]);
    const gyms = useMemo(() => [...new Set(allOptions.map(o => o.cls.gym))].sort(), [allOptions]);

    const activeFilterCount = (selDiscipline ? 1 : 0) + (selGym ? 1 : 0);

    const filtered = useMemo(() => {
        let list = allOptions;
        if (selDiscipline) list = list.filter(o => o.cls.discipline === selDiscipline);
        if (selGym) list = list.filter(o => o.cls.gym === selGym);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(o => {
                const c = o.cls;
                return c.title.toLowerCase().includes(q) ||
                    c.discipline.toLowerCase().includes(q) ||
                    disciplineToCategory(c.discipline).toLowerCase().includes(q) ||
                    c.gym.toLowerCase().includes(q) ||
                    (c.location && c.location.toLowerCase().includes(q)) ||
                    (c.address && c.address.toLowerCase().includes(q)) ||
                    (c.level && c.level.toLowerCase().includes(q)) ||
                    (c.subDiscipline && c.subDiscipline.toLowerCase().includes(q)) ||
                    (c.instructor && c.instructor.toLowerCase().includes(q));
            });
        }
        return list;
    }, [allOptions, selDiscipline, selGym, search]);

    const handleAdd = (cls: CatalogueClass, schedule: ClassSchedule) => {
        onAdd({
            name: cls.title,
            category: disciplineToCategory(cls.discipline),
            start: schedule.startTime,
            end: schedule.endTime,
            location: cls.gym,
            catalogueClassId: cls.id,
        });
    };

    return (
        <div className={`mt-2 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-surface-subtle border-surface-border'}`}>
            {/* Header row */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Tilføj fra katalog</span>
                <button onClick={onClose} className={`p-0.5 rounded ${isDark ? 'text-slate-500 hover:text-white' : 'text-ds-text-subtlest hover:text-ds-text'}`}><ChevronUp className="w-3.5 h-3.5" /></button>
            </div>

            {/* Search + filter toggle row */}
            <div className="px-3 pb-2 flex items-center gap-2">
                <div className={`flex-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-surface-border'}`}>
                    <Search className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Søg..."
                        className={`flex-1 bg-transparent outline-none text-xs ${isDark ? 'text-white placeholder-slate-500' : 'text-ds-text placeholder-ds-text-subtlest'}`} />
                    {search && <button onClick={() => setSearch('')}><X className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} /></button>}
                </div>
                <button onClick={() => setFiltersOpen(!filtersOpen)}
                    className={`relative p-1.5 rounded-lg border transition-colors ${filtersOpen || activeFilterCount ? (isDark ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-brand-50 border-brand-200 text-brand-500') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-surface-border text-ds-text-subtle')}`}>
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-[8px] text-white flex items-center justify-center font-bold">{activeFilterCount}</span>}
                </button>
            </div>

            {/* Collapsible filter chips — wrapping, not scrolling */}
            {filtersOpen && (
                <div className={`px-3 pb-2 space-y-1.5 border-t pt-2 ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                    <div className="flex flex-wrap gap-1.5">
                        {disciplines.map(d => (
                            <button key={d} onClick={() => setSelDiscipline(selDiscipline === d ? null : d)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${selDiscipline === d ? 'bg-blue-600 text-white border-blue-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>{d}</button>
                        ))}
                    </div>
                    {gyms.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            {gyms.map(g => (
                                <button key={g} onClick={() => setSelGym(selGym === g ? null : g)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${selGym === g ? 'bg-emerald-600 text-white border-emerald-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>{g}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Class list — no inner scroll, show-more pattern */}
            <div className="px-2 pb-2 space-y-1.5">
                {loading && <div className={`text-center py-4 text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Henter...</div>}
                {!loading && filtered.length === 0 && <div className={`text-center py-4 text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{allOptions.length === 0 ? 'Ingen hold' : 'Ingen match'}</div>}
                {(showAll ? filtered : filtered.slice(0, INITIAL_SHOW)).map(({ cls, schedule }) => {
                    const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
                    return (
                        <button key={`${cls.id}-${schedule.startTime}`} onClick={() => handleAdd(cls, schedule)}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors active:scale-[0.98] ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-surface-border hover:bg-surface-hover'}`}>
                            <div className={`w-1 self-stretch rounded-full shrink-0 ${cat.color}`} />
                            <div className="flex-1 min-w-0">
                                <div className={`text-xs font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</div>
                                <div className={`text-[10px] flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                                    <span>{schedule.startTime}–{schedule.endTime}</span>
                                    <span className="flex items-center"><MapPin className="w-2.5 h-2.5 mr-0.5" />{cls.gym}</span>
                                </div>
                            </div>
                            <Plus className={`w-4 h-4 shrink-0 ${isDark ? 'text-blue-400' : 'text-brand-500'}`} />
                        </button>
                    );
                })}
                {!showAll && filtered.length > INITIAL_SHOW && (
                    <button onClick={() => setShowAll(true)}
                        className={`w-full flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-slate-800' : 'text-brand-500 hover:bg-surface-hover'}`}>
                        <ChevronDown className="w-3.5 h-3.5" /> Vis alle ({filtered.length})
                    </button>
                )}
                {showAll && filtered.length > INITIAL_SHOW && (
                    <button onClick={() => setShowAll(false)}
                        className={`w-full flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
                        <ChevronUp className="w-3.5 h-3.5" /> Vis færre
                    </button>
                )}
            </div>
        </div>
    );
};

export default InlineCataloguePicker;
