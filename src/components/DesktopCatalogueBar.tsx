import { useState, useMemo } from 'react';
import { Search, MapPin, Plus, PenLine, X, SlidersHorizontal } from 'lucide-react';

import { CATEGORIES, DAYS } from '../config/constants';
import { useCatalogue } from '../hooks/useCatalogue';
import { useTheme } from '../hooks/useTheme';
import { disciplineToCategory } from './InlineCataloguePicker';
import type { CatalogueAddPayload } from './InlineCataloguePicker';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';

interface Props {
    onAdd: (day: string, session: CatalogueAddPayload) => void;
    onManual: (day: string) => void;
    onClose: () => void;
}

/** Full-width 7-day catalogue grid shown below the desktop schedule */
const DesktopCatalogueBar = ({ onAdd, onManual, onClose }: Props) => {
    const { isDark } = useTheme();
    const { classes, loading } = useCatalogue();

    const [search, setSearch] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selDiscipline, setSelDiscipline] = useState<string | null>(null);
    const [selGym, setSelGym] = useState<string | null>(null);

    // Build per-day lists
    const byDay = useMemo(() => {
        const map = new Map<number, { cls: CatalogueClass; schedule: ClassSchedule }[]>();
        for (let d = 1; d <= 7; d++) map.set(d, []);
        for (const cls of classes) {
            for (const sched of cls.schedules) {
                map.get(sched.dayOfWeek)?.push({ cls, schedule: sched });
            }
        }
        for (const [, list] of map) list.sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
        return map;
    }, [classes]);

    // Global filters apply across all days
    const allDisciplines = useMemo(() => [...new Set(classes.map(c => c.discipline))].sort(), [classes]);
    const allGyms = useMemo(() => [...new Set(classes.map(c => c.gym))].sort(), [classes]);
    const activeFilterCount = (selDiscipline ? 1 : 0) + (selGym ? 1 : 0);

    const filterList = (list: { cls: CatalogueClass; schedule: ClassSchedule }[]) => {
        let out = list;
        if (selDiscipline) out = out.filter(o => o.cls.discipline === selDiscipline);
        if (selGym) out = out.filter(o => o.cls.gym === selGym);
        if (search.trim()) {
            const q = search.toLowerCase();
            out = out.filter(o =>
                o.cls.title.toLowerCase().includes(q) ||
                o.cls.discipline.toLowerCase().includes(q) ||
                o.cls.gym.toLowerCase().includes(q) ||
                (o.cls.instructor && o.cls.instructor.toLowerCase().includes(q))
            );
        }
        return out;
    };

    const handleAdd = (day: string, cls: CatalogueClass, schedule: ClassSchedule) => {
        onAdd(day, {
            name: cls.title,
            category: disciplineToCategory(cls.discipline),
            start: schedule.startTime,
            end: schedule.endTime,
            location: cls.gym,
            catalogueClassId: cls.id,
        });
    };

    return (
        <div className={`rounded-2xl border shadow-md fade-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            {/* Header + search + filters */}
            <div className="p-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>Katalog — alle dage</h3>
                    <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-surface-subtle border-surface-border'}`}>
                        <Search className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Søg hold..."
                            className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-slate-500' : 'text-ds-text placeholder-ds-text-subtlest'}`} />
                        {search && <button onClick={() => setSearch('')}><X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} /></button>}
                    </div>
                    <button onClick={() => setFiltersOpen(!filtersOpen)}
                        className={`relative p-2 rounded-lg border transition-colors ${filtersOpen || activeFilterCount ? (isDark ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-brand-50 border-brand-200 text-brand-500') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-surface-raised border-surface-border text-ds-text-subtle')}`}>
                        <SlidersHorizontal className="w-4 h-4" />
                        {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-[9px] text-white flex items-center justify-center font-bold">{activeFilterCount}</span>}
                    </button>
                </div>
                {filtersOpen && (
                    <div className={`mt-3 pt-3 border-t space-y-2 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <div className="flex flex-wrap gap-1.5">
                            {allDisciplines.map(d => (
                                <button key={d} onClick={() => setSelDiscipline(selDiscipline === d ? null : d)}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${selDiscipline === d ? 'bg-blue-600 text-white border-blue-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>{d}</button>
                            ))}
                        </div>
                        {allGyms.length > 1 && (
                            <div className="flex flex-wrap gap-1.5">
                                {allGyms.map(g => (
                                    <button key={g} onClick={() => setSelGym(selGym === g ? null : g)}
                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${selGym === g ? 'bg-emerald-600 text-white border-emerald-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>{g}</button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 7-day column grid */}
            <div className={`grid grid-cols-7 gap-px border-t ${isDark ? 'border-slate-800 bg-slate-800' : 'border-surface-border bg-surface-border'}`}>
                {DAYS.map((day, i) => {
                    const dayNum = i + 1;
                    const items = filterList(byDay.get(dayNum) || []);
                    return (
                        <div key={day} className={`flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            {/* Day header */}
                            <div className={`px-2 py-2 text-center border-b ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>{day.slice(0, 3)}</span>
                                <span className={`ml-1 text-[10px] ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>({items.length})</span>
                            </div>
                            {/* Classes */}
                            <div className="flex-1 p-1.5 space-y-1 min-h-[80px]">
                                {loading && <div className={`text-center py-3 text-[10px] ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>...</div>}
                                {!loading && items.length === 0 && <div className={`text-center py-3 text-[10px] ${isDark ? 'text-slate-700' : 'text-ds-text-subtlest/50'}`}>—</div>}
                                {items.map(({ cls, schedule }) => {
                                    const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
                                    return (
                                        <button key={`${cls.id}-${schedule.startTime}`}
                                            onClick={() => handleAdd(day, cls, schedule)}
                                            className={`w-full text-left p-1.5 rounded-lg border transition-colors active:scale-[0.97] group ${isDark ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600' : 'bg-surface-subtle border-surface-border hover:bg-surface-hover'}`}>
                                            <div className="flex items-start gap-1">
                                                <div className={`w-1 mt-0.5 rounded-full shrink-0 h-3 ${cat.color}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-[10px] font-bold leading-tight line-clamp-2 ${isDark ? 'text-slate-200' : 'text-ds-text'}`}>{cls.title}</div>
                                                    <div className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                                                        {schedule.startTime}–{schedule.endTime}
                                                    </div>
                                                    <div className={`text-[9px] flex items-center ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
                                                        <MapPin className="w-2 h-2 mr-0.5 shrink-0" />{cls.gym}
                                                    </div>
                                                </div>
                                                <Plus className={`w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-blue-400' : 'text-brand-500'}`} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Manual add per day */}
                            <div className={`px-1.5 py-1.5 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                                <button onClick={() => onManual(day)}
                                    className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-ds-text-subtlest hover:text-ds-text-subtle hover:bg-surface-hover'}`}>
                                    <PenLine className="w-2.5 h-2.5" /> Manuelt
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DesktopCatalogueBar;
