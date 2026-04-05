// CataloguePage — Public-facing class catalogue (no auth required)
// Admin/coach users see CRUD controls when signed in
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Sun, Moon, ShieldCheck, Clock, MapPin, Plus, Search, X as XIcon, SlidersHorizontal, Navigation, ChevronUp } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useCatalogue } from '../hooks/useCatalogue';
import { useGyms } from '../hooks/useGyms';
import { USER_MAPPING } from '../config/constants';
import { addCatalogueClass, updateCatalogueClass, deleteCatalogueClass } from '../services/firebaseCatalogueService';
import CatalogueModal from '../components/CatalogueModal';
import CatalogueDetailModal from '../components/CatalogueDetailModal';
import type { CatalogueForm } from '../components/CatalogueModal';
import type { CatalogueClass } from '../types/catalogue';

// ── Danish day helpers ──
const DAY_LABELS: Record<number, string> = { 1: 'Man', 2: 'Tir', 3: 'Ons', 4: 'Tor', 5: 'Fre', 6: 'Lør', 7: 'Søn' };
const DAY_FULL: Record<number, string> = { 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag', 4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag', 7: 'Søndag' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

// ── Discipline stripe colours (matching CATEGORIES in constants.ts) ──
const DISC_STRIPE: Record<string, string> = {
  'Muay Thai': 'bg-orange-500',   // Kickboxing family
  'BJJ':       'bg-purple-600',   // Grappling
  'MMA':       'bg-red-600',      // MMA
  'Boxing':    'bg-yellow-600',   // Boksning
  'Wrestling': 'bg-emerald-600',  // Brydning
};
const DEFAULT_STRIPE = 'bg-slate-500';

// ── 2-letter abbreviations for the mobile scroll spy strip ──
const DAY_SHORT: Record<number, string> = { 1: 'Ma', 2: 'Ti', 3: 'On', 4: 'To', 5: 'Fr', 6: 'Lø', 7: 'Sø' };

// ── Search synonym map (DA↔EN martial arts terms) ──
const SYNONYMS: Record<string, string[]> = {
  'fristil': ['freestyle'], 'freestyle': ['fristil'],
  'brydning': ['wrestling'], 'wrestling': ['brydning'],
  'boksning': ['boxing'], 'boxing': ['boksning'],
  'børn': ['kids', 'tumling', 'mini'], 'kids': ['børn', 'tumling', 'mini'],
  'begynder': ['intro', 'basis', 'beginner'], 'beginner': ['begynder', 'intro', 'basis'], 'intro': ['begynder', 'basis', 'beginner'], 'basis': ['begynder', 'intro', 'beginner'],
  'øvet': ['advanced', 'avanceret'], 'advanced': ['øvet', 'avanceret'], 'avanceret': ['øvet', 'advanced'],
  'kamp': ['sparring', 'fight'], 'sparring': ['kamp', 'fight'], 'fight': ['kamp', 'sparring'],
  'grappling': ['bjj', 'jiu jitsu'], 'bjj': ['grappling', 'jiu jitsu'], 'jiu jitsu': ['bjj', 'grappling'],
  'muay thai': ['thaiboxing', 'thaiboksning'], 'thaiboksning': ['muay thai', 'thaiboxing'], 'thaiboxing': ['muay thai', 'thaiboksning'],
  'mma': ['mixed martial arts'], 'mixed martial arts': ['mma'],
  'kvinder': ['ladies', 'women', 'powerladies'], 'ladies': ['kvinder', 'powerladies'],
};

function expandSearch(query: string): string[] {
  const terms = [query];
  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (query.includes(key)) terms.push(...syns);
  }
  return terms;
}

// ── Haversine distance (km) ──
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DISTANCE_OPTIONS = [5, 10, 15, 25, 50] as const;

// ── Predefined locations for manual override ──
const LOCATION_PRESETS: { label: string; lat: number; lng: number }[] = [
  { label: 'Roskilde',       lat: 55.6416, lng: 12.0803 },
  { label: 'København',      lat: 55.6761, lng: 12.5683 },
  { label: 'Frederiksberg',  lat: 55.6811, lng: 12.5342 },
  { label: 'Valby',          lat: 55.6632, lng: 12.5131 },
  { label: 'Søborg',         lat: 55.7323, lng: 12.4619 },
  { label: 'Hillerød',       lat: 55.9267, lng: 12.3107 },
  { label: 'NV / Nørrebro',  lat: 55.7010, lng: 12.5390 },
];

// ── Helpers ──
function toggleSet<T>(set: Set<T>, val: T): Set<T> {
  const next = new Set(set);
  if (next.has(val)) next.delete(val); else next.add(val);
  return next;
}

function dayTimeSlots(cls: CatalogueClass, dayOfWeek: number): string {
  return cls.schedules
    .filter((s) => s.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s) => `${s.startTime}–${s.endTime}`)
    .join(', ');
}

/* ── Mobile Day Scroll Spy ─────────────────────────────── */
function DayScrollSpy({ isDark }: { isDark: boolean }) {
  const [activeDay, setActiveDay] = useState<number | null>(null);

  useEffect(() => {
    const els = DAY_ORDER.map((d) => document.getElementById(`day-${d}`)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveDay(Number(visible[0].target.id.split('-')[1]));
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (d: number) => {
    document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const bg = isDark ? 'bg-slate-900/80' : 'bg-white/80';
  const border = isDark ? 'border-slate-700' : 'border-surface-border';
  const inactiveText = isDark ? 'text-slate-500' : 'text-ds-text-subtlest';

  return (
    <nav
      aria-label="Gå til ugedag"
      className={`md:hidden fixed right-1.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-0.5 rounded-full py-1.5 px-0.5 backdrop-blur-sm border shadow-lg ${bg} ${border}`}
    >
      <button
        onClick={scrollTop}
        className={`w-7 h-7 flex items-center justify-center rounded-full ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}
        aria-label="Scroll til toppen"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      {DAY_ORDER.map((d) => (
        <button
          key={d}
          onClick={() => scrollTo(d)}
          className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
            activeDay === d ? 'bg-blue-600 text-white' : `${inactiveText}`
          }`}
          aria-label={DAY_FULL[d]}
        >
          {DAY_SHORT[d]}
        </button>
      ))}
    </nav>
  );
}

// ── Filter chip component ──
function Chip({ label, active, onClick, isDark, small }: { label: string; active: boolean; onClick: () => void; isDark: boolean; small?: boolean }) {
  const base = small
    ? 'px-2 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer select-none'
    : 'px-3 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer select-none';
  const colors = active
    ? 'bg-blue-600 text-white'
    : isDark
      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      : 'bg-surface-raised text-ds-text-subtle hover:bg-surface-hover';
  return <button className={`${base} ${colors}`} onClick={onClick}>{label}</button>;
}

export default function CataloguePage() {
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { classes, loading } = useCatalogue();
  const { gyms: gymEntities } = useGyms();

  // Admin detection — admins/coaches see CRUD controls
  const isAdmin = !!user?.email && ['admin', 'coach'].includes(USER_MAPPING[user.email.toLowerCase()]?.role);

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [selDisc, setSelDisc] = useState<Set<string>>(new Set());

  const [selGym, setSelGym] = useState<Set<string>>(new Set());
  const [selLevel, setSelLevel] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Geolocation + distance state
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posLabel, setPosLabel] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const requestLocation = useCallback(() => {
    if (userPos && maxDistance) { setMaxDistance(null); setShowLocationPicker(false); return; }
    if (userPos) { setMaxDistance(25); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPosLabel('Min position'); setMaxDistance(25); setGeoLoading(false); },
      () => { setGeoLoading(false); setShowLocationPicker(true); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [userPos, maxDistance]);

  const pickLocation = useCallback((preset: typeof LOCATION_PRESETS[number]) => {
    setUserPos({ lat: preset.lat, lng: preset.lng });
    setPosLabel(preset.label);
    setMaxDistance(25);
    setShowLocationPicker(false);
  }, []);

  // Build gym→distance map
  const gymDistances = useMemo(() => {
    if (!userPos) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const g of gymEntities) {
      if (g.lat && g.lng) map.set(g.name, haversineKm(userPos.lat, userPos.lng, g.lat, g.lng));
    }
    return map;
  }, [userPos, gymEntities]);

  // Close filters on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<CatalogueClass | null>(null);
  const [copySource, setCopySource] = useState<CatalogueClass | null>(null);
  const [preselectedDay, setPreselectedDay] = useState<number | null>(null);
  const [detailClass, setDetailClass] = useState<CatalogueClass | null>(null);

  const openNew = (day?: number) => { setEditingClass(null); setCopySource(null); setPreselectedDay(day ?? null); setModalOpen(true); };
  const openEdit = (cls: CatalogueClass) => { setDetailClass(null); setEditingClass(cls); setCopySource(null); setPreselectedDay(null); setModalOpen(true); };
  const openCopy = (cls: CatalogueClass) => { setDetailClass(null); setEditingClass(null); setCopySource(cls); setPreselectedDay(null); setModalOpen(true); };
  const openDetail = (cls: CatalogueClass) => { setDetailClass(cls); };
  const closeModal = () => { setModalOpen(false); setEditingClass(null); setCopySource(null); setPreselectedDay(null); };
  const closeDetail = () => { setDetailClass(null); };

  const handleSave = async (data: CatalogueForm) => {
    const raw: Record<string, unknown> = {
      ...data,
      subDiscipline: data.subDiscipline || null,
      ageGroup: data.ageGroup || null,
      address: data.address || null,
      instructor: data.instructor || null,
      description: data.description || null,
      showRatings: editingClass?.showRatings ?? false,
      source: editingClass?.source ?? 'manual',
    };
    // Strip null values so Firestore doesn't store empty fields
    const payload = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== undefined)
    ) as unknown as Omit<CatalogueClass, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
    if (editingClass) {
      await updateCatalogueClass(editingClass.id, payload);
    } else {
      await addCatalogueClass(payload, user?.email ?? undefined);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    await deleteCatalogueClass(id);
    closeModal();
  };

  // Derive unique filter options from data
  const disciplines = useMemo(() => [...new Set(classes.map((c) => c.discipline))].sort(), [classes]);
  const gyms = useMemo(() => [...new Set(classes.map((c) => c.gym))].sort(), [classes]);
  const levels = useMemo(() => [...new Set(classes.map((c) => c.level))].sort(), [classes]);

  // Filter
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const terms = q ? expandSearch(q) : [];
    // Build set of gyms within distance
    const nearGyms = maxDistance && userPos
      ? new Set(gymEntities.filter(g => g.lat && g.lng && haversineKm(userPos.lat, userPos.lng, g.lat, g.lng) <= maxDistance).map(g => g.name))
      : null;
    return classes.filter((c) => {
      if (selDisc.size > 0 && !selDisc.has(c.discipline)) return false;
      if (selGym.size > 0 && !selGym.has(c.gym)) return false;
      if (selLevel.size > 0 && !selLevel.has(c.level)) return false;

      if (nearGyms && !nearGyms.has(c.gym)) return false;
      if (terms.length > 0) {
        const hay = [c.title, c.discipline, c.gym, c.level, c.location, c.address, c.instructor, c.description, c.subDiscipline, c.ageGroup]
          .filter(Boolean).join(' ').toLowerCase();
        if (!terms.some((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }, [classes, selDisc, selGym, selLevel, searchText, maxDistance, userPos, gymEntities]);

  // Group filtered classes by day of week
  const classesByDay = useMemo(() => {
    const map = new Map<number, { cls: CatalogueClass; timeSlot: string }[]>();
    for (const d of DAY_ORDER) map.set(d, []);
    for (const cls of filtered) {
      for (const s of cls.schedules) {
        const bucket = map.get(s.dayOfWeek);
        if (bucket && !bucket.find((b) => b.cls.id === cls.id)) {
          bucket.push({ cls, timeSlot: dayTimeSlots(cls, s.dayOfWeek) });
        }
      }
    }
    // Sort each day by earliest start time
    for (const [, bucket] of map) {
      bucket.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    }
    return map;
  }, [filtered]);

  const activeFilterCount = selDisc.size + selGym.size + (searchText.trim() ? 1 : 0) + (maxDistance ? 1 : 0);

  const clearAll = () => { setSearchText(''); setSelDisc(new Set()); setSelGym(new Set()); setSelLevel(new Set()); setMaxDistance(null); setShowLocationPicker(false); };

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-500/30 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text'}`}>
      {/* Header — matches App.tsx pattern (Design System: App Header) */}
      <div className={`p-4 shadow-lg border-b sticky top-0 z-20 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border shadow-sm'}`}>
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`font-bold text-lg leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>FightWeek</h1>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">Træningskatalog</p>
            </div>
          </div>
          {/* Theme toggle — Design System: Theme Toggle Button */}
          <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-yellow-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <main className="px-4 sm:px-6 py-6">
        {/* Title + count */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>Træningskatalog</h2>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
              Find træningshold på tværs af klubber
            </p>
          </div>
          {!loading && (
            <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
              {filtered.length} hold
            </span>
          )}
        </div>

        {/* Search + filter bar */}
        <div className={`rounded-xl border mb-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          {/* Row 1: search + filter toggle + distance toggle */}
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Søg hold, klub, instruktør…"
                className={`w-full pl-9 pr-8 py-2 rounded-lg text-sm border transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500' : 'bg-surface-subtle border-surface-border text-ds-text placeholder:text-ds-text-subtlest focus:border-blue-500'} outline-none`}
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-ds-text-subtlest hover:text-ds-text'}`}>
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* Distance toggle */}
            <button
              onClick={requestLocation}
              disabled={geoLoading}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
                maxDistance
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500'
                    : 'bg-surface-subtle border-surface-border text-ds-text-subtle hover:border-blue-500'
              }`}
              title="Filtrer på afstand"
            >
              <Navigation className="w-3.5 h-3.5" />
              {geoLoading ? '…' : maxDistance ? `${posLabel ?? 'Position'} · ${maxDistance} km` : 'Nær mig'}
            </button>
            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                filtersOpen || (activeFilterCount - (searchText.trim() ? 1 : 0) - (maxDistance ? 1 : 0)) > 0
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500'
                    : 'bg-surface-subtle border-surface-border text-ds-text-subtle hover:border-blue-500'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {(activeFilterCount - (searchText.trim() ? 1 : 0) - (maxDistance ? 1 : 0)) > 0 && (
                <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {activeFilterCount - (searchText.trim() ? 1 : 0) - (maxDistance ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Distance options (shown when distance is active) */}
          {maxDistance && userPos && (
            <div className={`px-3 pb-2 flex flex-wrap items-center gap-2 border-t pt-2 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Afstand</span>
              {DISTANCE_OPTIONS.map((km) => (
                <Chip key={km} label={`${km} km`} small active={maxDistance === km} isDark={isDark} onClick={() => setMaxDistance(km)} />
              ))}
              <button onClick={() => setShowLocationPicker(!showLocationPicker)} className={`text-[11px] font-medium ml-1 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-ds-text-subtle hover:text-ds-text'}`}>
                📍 {posLabel ?? 'Skift'}
              </button>
              <button onClick={() => { setMaxDistance(null); setShowLocationPicker(false); }} className="text-[11px] text-blue-500 hover:text-blue-400 ml-1">Ryd</button>
            </div>
          )}

          {/* Location picker */}
          {showLocationPicker && (
            <div className={`px-3 pb-2 flex flex-wrap items-center gap-1.5 border-t pt-2 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wide mr-1 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Vælg område</span>
              {LOCATION_PRESETS.map((p) => (
                <Chip key={p.label} label={p.label} small active={posLabel === p.label} isDark={isDark} onClick={() => pickLocation(p)} />
              ))}
              {userPos && posLabel !== 'Min position' && (
                <button
                  onClick={() => {
                    setGeoLoading(true);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPosLabel('Min position'); setGeoLoading(false); setShowLocationPicker(false); },
                      () => setGeoLoading(false),
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }}
                  className={`px-2 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer select-none ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-surface-raised text-ds-text-subtle hover:bg-surface-hover'}`}
                >
                  📡 Auto-detect
                </button>
              )}
            </div>
          )}

          {/* Active filter pills */}
          {(selDisc.size + selGym.size) > 0 && (
            <div className={`px-3 pb-2 flex flex-wrap items-center gap-1.5 border-t pt-2 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
              {[...selDisc].map((d) => (
                <span key={`d-${d}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 text-[11px] font-medium">
                  {d} <button onClick={() => setSelDisc(toggleSet(selDisc, d))}><XIcon className="w-3 h-3" /></button>
                </span>
              ))}

              {[...selGym].map((g) => (
                <span key={`g-${g}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 text-[11px] font-medium">
                  {g} <button onClick={() => setSelGym(toggleSet(selGym, g))}><XIcon className="w-3 h-3" /></button>
                </span>
              ))}

              <button onClick={clearAll} className="text-[11px] text-blue-500 hover:text-blue-400 font-medium ml-1">
                Ryd alle
              </button>
            </div>
          )}

          {/* Collapsible filter panel */}
          {filtersOpen && (
            <div className={`border-t px-3 pb-3 pt-2 space-y-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
              {/* Discipline */}
              <div>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Disciplin</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {disciplines.map((d) => (
                    <Chip key={d} label={d} small active={selDisc.has(d)} isDark={isDark} onClick={() => setSelDisc(toggleSet(selDisc, d))} />
                  ))}
                </div>
              </div>

              {/* Gym — scrollable if many */}
              <div>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Klub</span>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
                  {gyms.map((g) => {
                    const dist = gymDistances.get(g);
                    const label = dist !== undefined ? `${g} (${Math.round(dist)} km)` : g;
                    return <Chip key={g} label={label} small active={selGym.has(g)} isDark={isDark} onClick={() => setSelGym(toggleSet(selGym, g))} />;
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className={`text-center py-16 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
            Henter hold…
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className={`text-center py-16 border-2 border-dashed rounded-xl ${isDark ? 'text-slate-600 border-slate-800' : 'text-ds-text-subtlest border-surface-border'}`}>
            {activeFilterCount > 0 ? 'Ingen hold matcher dine filtre' : 'Ingen hold fundet'}
          </div>
        )}

        {/* Weekday columns */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {DAY_ORDER.map((d) => {
              const items = classesByDay.get(d) ?? [];
              return (
                <div key={d} id={`day-${d}`} className={`rounded-2xl p-3 border shadow-md scroll-mt-20 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-bold text-sm text-center flex-1 ${isDark ? 'text-white' : 'text-ds-text'}`}>
                      {DAY_FULL[d]}
                    </h3>
                    {isAdmin && (
                      <button onClick={() => openNew(d)} className="text-blue-500 hover:text-blue-400 p-0.5" title="Tilføj hold">
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {items.length === 0 && (
                    <div className={`text-xs py-3 text-center border-2 border-dashed rounded-xl ${isDark ? 'text-slate-600 border-slate-800/50' : 'text-ds-text-subtlest border-surface-border'}`}>Ingen hold</div>
                  )}
                  <div className="space-y-2">
                    {items.map(({ cls, timeSlot }) => (
                      <DayClassCard key={cls.id} cls={cls} timeSlot={timeSlot} isDark={isDark} distKm={gymDistances.get(cls.gym)} onClick={() => openDetail(cls)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile day scroll spy */}
        {!loading && filtered.length > 0 && <DayScrollSpy isDark={isDark} />}
      </main>

      {/* Admin: floating add button (mobile-friendly) */}
      {isAdmin && (
        <button onClick={() => openNew()} className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg shadow-blue-900/30 z-30" title="Tilføj hold">
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Catalogue edit modal */}
      {modalOpen && (
        <CatalogueModal
          initialData={editingClass}
          copySource={copySource}
          preselectedDay={preselectedDay}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {/* Catalogue detail modal (read-only) */}
      {detailClass && (
        <CatalogueDetailModal
          cls={detailClass}
          isAdmin={isAdmin}
          onClose={closeDetail}
          onEdit={() => openEdit(detailClass)}
          onCopy={() => openCopy(detailClass)}
        />
      )}
    </div>
  );
}

// ── Day class card — compact session card for weekday column view ──
function DayClassCard({ cls, timeSlot, isDark, distKm, onClick }: { cls: CatalogueClass; timeSlot: string; isDark: boolean; distKm?: number; onClick?: () => void }) {
  const stripe = DISC_STRIPE[cls.discipline] ?? DEFAULT_STRIPE;

  return (
    <div
      onClick={onClick}
      className={`relative flex items-start p-2 rounded-xl border shadow-sm transition-all cursor-pointer hover:ring-2 hover:ring-blue-500/40 ${isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-surface-raised border-surface-border'}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${stripe}`} />
      <div className="flex-1 pl-2.5 min-w-0">
        <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 min-h-[2lh] ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</h4>
        <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
          <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{timeSlot}</span>
          <span className="flex items-center truncate">
            <MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />
            {cls.gym}
            {distKm !== undefined && (
              <span className={`ml-1 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>· {Math.round(distKm)} km</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
