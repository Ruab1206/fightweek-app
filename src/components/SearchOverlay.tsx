import { Search, Clock, MapPin, AlertCircle } from 'lucide-react';
import { CATEGORIES } from '../config/constants';

interface SearchOverlayProps {
  searchQuery: string;
  scrollDays: { date: Date; dayName: string; weekNumber: number; key: string }[];
  multiWeekData: Record<number, any>;
  isDark: boolean;
  onOpenSession: (dayName: string, session: any, weekNum: number) => void;
  onOpenEvent: (eventId: string) => void;
}

const SearchOverlay = ({ searchQuery, scrollDays, multiWeekData, isDark, onOpenSession, onOpenEvent }: SearchOverlayProps) => {
  const q = searchQuery.trim().toLowerCase();

  if (!q) return (
    <div className={`fixed inset-0 top-[73px] z-[18] overflow-y-auto pb-32 ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      <div className={`flex flex-col items-center justify-center pt-24 px-8 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
        <Search className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Søg efter holdnavn, kategori, sted...</p>
      </div>
    </div>
  );

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const results: { date: Date; dayName: string; weekNum: number; session: any; key: string }[] = [];
  for (const sd of scrollDays) {
    if (sd.date < today) continue;
    const weekData = multiWeekData[sd.weekNumber] || {};
    const sessions = weekData[sd.dayName] || [];
    for (const s of sessions) {
      if (s.isRestDay || s.isDeleted) continue;
      const fields = [s.name, s.category, s.location, s.start, s.end, s.cancellationReason].filter(Boolean).map((f: string) => f.toLowerCase());
      if (fields.some((f: string) => f.includes(q))) {
        results.push({ date: sd.date, dayName: sd.dayName, weekNum: sd.weekNumber, session: s, key: sd.key });
      }
    }
  }

  if (results.length === 0) return (
    <div className={`fixed inset-0 top-[73px] z-[18] overflow-y-auto pb-32 ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      <div className={`flex flex-col items-center justify-center pt-24 px-8 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
        <Search className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Ingen resultater for &quot;{searchQuery}&quot;</p>
      </div>
    </div>
  );

  const grouped: { label: string; date: Date; items: typeof results }[] = [];
  let currentLabel = '';
  for (const r of results) {
    const label = r.date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
    if (label !== currentLabel) {
      currentLabel = label;
      grouped.push({ label, date: r.date, items: [] });
    }
    grouped[grouped.length - 1].items.push(r);
  }

  return (
    <div className={`fixed inset-0 top-[73px] z-[18] overflow-y-auto pb-32 ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      <div className="px-4 pt-2 space-y-3">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{results.length} resultat{results.length !== 1 ? 'er' : ''}</p>
        {grouped.map(group => (
          <div key={group.label}>
            <div className={`text-xs font-bold capitalize mb-1.5 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{group.label}</div>
            <div className="space-y-1.5">
              {group.items.map(r => {
                const cat = CATEGORIES.find(c => c.label === r.session.category) || CATEGORIES[6];
                const isCancelled = r.session.status === 'cancelled';
                return (
                  <button key={`${r.key}-${r.session.id}`} onClick={() => {
                    if (r.session.type === 'event' && r.session.eventId) { onOpenEvent(r.session.eventId); return; }
                    onOpenSession(r.dayName, r.session, r.weekNum);
                  }}
                    className={`w-full text-left relative flex items-start p-2.5 rounded-xl border shadow-sm transition-all active:scale-[0.98] ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border')}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`} />
                    <div className="flex-1 pl-2.5 min-w-0">
                      <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{r.session.name}</h4>
                      <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                        <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{r.session.start} - {r.session.end}</span>
                        <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{r.session.location}</span>
                      </div>
                      {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{r.session.cancellationReason ? `: ${r.session.cancellationReason}` : ''}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchOverlay;
