import { useState, useMemo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MapPin, CalendarDays, Plus, Search, X, SlidersHorizontal, ExternalLink, Trophy } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';
import { decideEventDeletion, isEventCancelled } from '../hooks/eventDelete';
import { FIGHTERS } from '../config/constants';
import { googleMapsUrl } from '../config/constants';
import type { FightweekEvent } from '../types/event';
import { getCategoryColor, isEventPast, daysUntil, formatDateRange, TypeBadge, SignupSummary, haversineKm, EVENT_TYPE_CONFIG } from '../components/eventHelpers';
import { EventForm } from '../components/EventForm';
import { EventDetail } from '../components/EventDetail';

export type EventsPageHandle = { scrollToNext: (behavior?: ScrollBehavior) => void };
export { useEvents } from '../hooks/useEvents';

// ── Event card ──
function EventCard({ event, isDark, onClick, innerRef }: { event: FightweekEvent; isDark: boolean; onClick: () => void; innerRef?: React.Ref<HTMLButtonElement> }) {
  const past = isEventPast(event);
  const days = daysUntil(event.date);
  const cat = getCategoryColor(event.discipline);

  return (
    <button ref={innerRef} onClick={onClick}
      style={{ scrollMarginTop: '72px' }}
      className={`w-full text-left relative rounded-xl border p-3 transition-all active:scale-[0.98] ${past ? 'opacity-60' : ''} ${isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-surface-border hover:shadow-md'}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${past ? 'opacity-50' : ''}`} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TypeBadge type={event.type} isDark={isDark} />
            {isEventCancelled(event) && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-red-950/40 text-red-400' : 'bg-red-100 text-red-600'}`}>
                Aflyst
              </span>
            )}
            {event.discipline && (
              <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{event.discipline}</span>
            )}
          </div>
          <h3 className={`font-bold text-sm leading-tight mb-1 ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.title}</h3>
          <div className={`flex flex-col gap-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3 shrink-0" />
              {formatDateRange(event.date, event.endDate)}
              {(event.startTime || event.endTime) && (
                <span className="ml-1">{event.startTime}{event.endTime ? `–${event.endTime}` : ''}</span>
              )}
            </span>
            {(event.location || event.address) && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />{event.location || event.address}
              </span>
            )}
            {event.address && (
              <a href={googleMapsUrl(event.address)} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-400 font-medium">
                <ExternalLink className="w-2.5 h-2.5" />{event.address}
              </a>
            )}
          </div>
          <SignupSummary signups={event.signups || {}} isDark={isDark} />
        </div>
        {!past && days >= 0 && days <= 14 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${days <= 3 ? 'bg-red-100 text-red-600' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}`}>
            {days === 0 ? 'I dag' : days === 1 ? 'I morgen' : `${days} dage`}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Main page (headerless — header lives in App.tsx) ──

interface EventsPageProps {
  isDark: boolean;
  fighterName: string;
  isAdmin: boolean;
  userEmail: string;
  searchQuery: string;
  searchMode?: boolean;
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
  getNote: (key: string) => string;
  saveNote: (key: string, text: string) => Promise<void>;
}

const EventsPage = forwardRef<EventsPageHandle, EventsPageProps>(function EventsPage(
  { isDark, fighterName, isAdmin, userEmail, searchQuery, searchMode, initialEventId, onClearInitialEvent, getNote, saveNote },
  ref
) {
  const { events, loading, updateSignup, createEvent, saveEvent, removeEvent } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<FightweekEvent | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingEvent, setEditingEvent] = useState<FightweekEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FightweekEvent | null>(null);
  const nextEventRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const [returnToId, setReturnToId] = useState<string | null>(null);

  // ── Filters ──
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([]);
  const [filterDistance, setFilterDistance] = useState<number | null>(null); // km
  const [filterParticipants, setFilterParticipants] = useState<string[]>([]);
  const [includePast, setIncludePast] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const hasActiveFilters = filterDisciplines.length > 0 || filterDistance !== null || filterParticipants.length > 0;

  // Reset filters when search mode closes; scroll to top when it opens
  useEffect(() => {
    if (searchMode) {
      window.scrollTo({ top: 0 });
    } else {
      setFilterOpen(false);
      setFilterDisciplines([]);
      setFilterDistance(null);
      setFilterParticipants([]);
      setIncludePast(false);
    }
  }, [searchMode]);

  // Grab user geolocation when distance filter is set
  useEffect(() => {
    if (filterDistance && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently fail
      );
    }
  }, [filterDistance, userLocation]);

  // Unique disciplines from all events
  const availableDisciplines = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.discipline) set.add(e.discipline);
    return [...set].sort();
  }, [events]);

  // Auto-open a specific event when navigating from calendar
  useEffect(() => {
    if (initialEventId && !loading && events.length > 0) {
      const ev = events.find(e => e.id === initialEventId);
      if (ev) setSelectedEvent(ev);
      onClearInitialEvent?.();
    }
  }, [initialEventId, loading, events, onClearInitialEvent]);

  // Find the index of the first not-yet-started event (for auto-scroll).
  // Prefer events whose start date is today or later; fall back to any non-past event.
  const nextUpcomingIndex = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const idx = events.findIndex(e => e.date >= todayStr);
    if (idx >= 0) return idx;
    return events.findIndex(e => !isEventPast(e));
  }, [events]);

  // Scroll to next upcoming event
  const scrollToNext = useCallback((behavior: ScrollBehavior = 'instant') => {
    const el = nextEventRef.current;
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior, block: 'start' }));
  }, []);

  // Expose scrollToNext to parent via ref
  useImperativeHandle(ref, () => ({ scrollToNext }), [scrollToNext]);

  // Filter events by search query + active filters
  const filteredEvents = useMemo(() => {
    let result = events;

    // Hide past events unless includePast is checked
    if (!includePast) {
      result = result.filter(e => !isEventPast(e));
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.address || '').toLowerCase().includes(q) ||
        (e.discipline || '').toLowerCase().includes(q) ||
        (e.organiser || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        EVENT_TYPE_CONFIG[e.type]?.label.toLowerCase().includes(q)
      );
    }

    // Discipline filter
    if (filterDisciplines.length > 0) {
      result = result.filter(e => e.discipline && filterDisciplines.includes(e.discipline));
    }

    // Distance filter
    if (filterDistance && userLocation) {
      result = result.filter(e => {
        if (e.latitude == null || e.longitude == null) return false;
        return haversineKm(userLocation.lat, userLocation.lng, e.latitude, e.longitude) <= filterDistance;
      });
    }

    // Participants filter
    if (filterParticipants.length > 0) {
      result = result.filter(e => {
        const signups = e.signups || {};
        return filterParticipants.some(p => signups[p] === 'interested' || signups[p] === 'signed-up');
      });
    }

    // Sort: upcoming (start date >= today) first by date asc, then ongoing (started in past) by endDate asc
    const todayStr = new Date().toISOString().slice(0, 10);
    result.sort((a, b) => {
      const aStarted = a.date < todayStr;
      const bStarted = b.date < todayStr;
      if (aStarted !== bStarted) return aStarted ? 1 : -1;
      return a.date.localeCompare(b.date);
    });

    return result;
  }, [events, searchQuery, includePast, filterDisciplines, filterDistance, userLocation, filterParticipants]);

  // Auto-scroll to next upcoming on first load
  useEffect(() => {
    if (!loading && events.length > 0 && !hasScrolled.current) {
      hasScrolled.current = true;
      scrollToNext();
    }
  }, [loading, events.length, scrollToNext]);

  // Scroll to top when filters change (prevents iOS scroll-past-content bug)
  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }, [filterDisciplines, filterDistance, filterParticipants, includePast]);

  // Scroll back to the event the user just viewed
  useEffect(() => {
    if (returnToId && returnRef.current) {
      requestAnimationFrame(() => returnRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' }));
      setReturnToId(null);
    }
  }, [returnToId]);

  // Detail view (full-screen overlay)
  if (selectedEvent) {
    const live = events.find(e => e.id === selectedEvent.id) || selectedEvent;
    return (
      <>
        <EventDetail
          event={live}
          isDark={isDark}
          fighterName={fighterName}
          isAdmin={isAdmin}
          onSignup={(status) => updateSignup(live.id, fighterName, status)}
          onClose={() => { setReturnToId(live.id); setSelectedEvent(null); }}
          onEdit={() => { setEditingEvent(live); setFormMode('edit'); }}
          onDelete={() => setConfirmDelete(live)}
          getNote={getNote}
          saveNote={saveNote}
        />
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(null)}>
            <div className={`mx-6 max-w-sm w-full rounded-2xl p-5 space-y-4 ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-surface-border shadow-xl'}`} onClick={e => e.stopPropagation()}>
              <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>Slet event?</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                Er du sikker på du vil slette <strong>{confirmDelete.title}</strong>? Handlingen kan ikke fortrydes.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmDelete(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-ds-text hover:bg-slate-200'}`}>
                  Annuller
                </button>
                <button onClick={async () => {
                  // Phase 2b Step 3: an event with a note/log (e_{eventId}) is
                  // soft-cancelled via the existing update path rather than
                  // hard-deleted, preserving the full document. A missing id
                  // cannot be resolved to a note key, so soft-cancel fails safe
                  // by aborting the delete (never hard-delete) and keeping the event.
                  const mode = decideEventDeletion({ eventId: confirmDelete.id, getNote });
                  if (mode === 'soft-cancel') {
                    if (!confirmDelete.id) { setConfirmDelete(null); return; }
                    await saveEvent(confirmDelete.id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
                  } else {
                    await removeEvent(confirmDelete.id);
                  }
                  setConfirmDelete(null); setSelectedEvent(null);
                }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500">
                  Slet
                </button>
              </div>
            </div>
          </div>
        )}
        {formMode === 'edit' && editingEvent && (
          <EventForm isDark={isDark} event={editingEvent} userEmail={userEmail}
            onSave={async (data) => { await saveEvent(editingEvent.id, data); setFormMode(null); setEditingEvent(null); }}
            onCancel={() => { setFormMode(null); setEditingEvent(null); }} />
        )}
      </>
    );
  }

  // Create form (full-screen overlay)
  if (formMode === 'create') {
    return (
      <EventForm isDark={isDark} event={null} userEmail={userEmail}
        onSave={async (data) => { await createEvent(data); setFormMode(null); }}
        onCancel={() => setFormMode(null)} />
    );
  }

  // Event list
  return (
    <>
      <div ref={listRef} className="px-4 pt-3 pb-20 space-y-3">
        {/* Filter bar — only in search mode */}
        {searchMode && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setFilterOpen(!filterOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${hasActiveFilters || includePast ? 'bg-blue-600 text-white border-blue-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-ds-text-subtle border-surface-border hover:bg-surface-hover')}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {(hasActiveFilters || includePast) && <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-bold flex items-center justify-center">{filterDisciplines.length + (filterDistance ? 1 : 0) + filterParticipants.length + (includePast ? 1 : 0)}</span>}
              </button>
              {/* Active filter chips */}
              {includePast && (
                <button onClick={() => setIncludePast(false)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  Inkl. historik <X className="w-3 h-3" />
                </button>
              )}
              {filterDisciplines.map(d => (
                <button key={d} onClick={() => setFilterDisciplines(prev => prev.filter(x => x !== d))}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {d} <X className="w-3 h-3" />
                </button>
              ))}
              {filterDistance && (
                <button onClick={() => setFilterDistance(null)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  ≤{filterDistance} km <X className="w-3 h-3" />
                </button>
              )}
              {filterParticipants.map(p => (
                <button key={p} onClick={() => setFilterParticipants(prev => prev.filter(x => x !== p))}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                  {p} <X className="w-3 h-3" />
                </button>
              ))}
              {(hasActiveFilters || includePast) && (
                <button onClick={() => { setFilterDisciplines([]); setFilterDistance(null); setFilterParticipants([]); setIncludePast(false); }}
                  className={`text-[10px] font-bold ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-ds-text-subtlest hover:text-ds-text-subtle'}`}>
                  Ryd
                </button>
              )}
            </div>

            {/* Filter panel */}
            {filterOpen && (
              <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border shadow-sm'}`}>
                {/* Include past events */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={includePast} onChange={e => setIncludePast(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>Inkl. historiske events</span>
                </label>

                {/* Discipline */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Disciplin</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDisciplines.map(d => {
                      const active = filterDisciplines.includes(d);
                      return (
                        <button key={d} onClick={() => setFilterDisciplines(prev => active ? prev.filter(x => x !== d) : [...prev, d])}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>
                          {d}
                        </button>
                      );
                    })}
                    {availableDisciplines.length === 0 && (
                      <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>Ingen discipliner registreret</span>
                    )}
                  </div>
                </div>

                {/* Distance */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Afstand</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[50, 100, 500].map(km => {
                      const active = filterDistance === km;
                      return (
                        <button key={km} onClick={() => setFilterDistance(active ? null : km)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>
                          ≤{km} km
                        </button>
                      );
                    })}
                  </div>
                  {filterDistance && !userLocation && (
                    <p className={`text-[10px] mt-1.5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>Venter på din placering…</p>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Deltagere</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FIGHTERS.map(f => {
                      const active = filterParticipants.includes(f);
                      return (
                        <button key={f} onClick={() => setFilterParticipants(prev => active ? prev.filter(x => x !== f) : [...prev, f])}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-emerald-600 text-white border-emerald-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-surface-raised text-ds-text-subtle border-surface-border')}`}>
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className={`text-center py-20 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
            {searchQuery.trim() || hasActiveFilters ? (
              <>
                <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">
                  {searchQuery.trim() ? `Ingen resultater for \u201c${searchQuery}\u201d` : 'Ingen events matcher filtrene'}
                </p>
                {hasActiveFilters && (
                  <button onClick={() => { setFilterDisciplines([]); setFilterDistance(null); setFilterParticipants([]); setIncludePast(false); }}
                    className="mt-2 text-xs font-bold text-blue-500 hover:text-blue-400">Ryd filtre</button>
                )}
              </>
            ) : (
              <>
                <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Ingen events endnu</p>
              </>
            )}
          </div>
        ) : (
          filteredEvents.map((e) => {
            const origIdx = events.indexOf(e);
            return (
              <EventCard
                key={e.id}
                event={e}
                isDark={isDark}
                onClick={() => setSelectedEvent(e)}
                innerRef={e.id === returnToId ? returnRef : (origIdx === nextUpcomingIndex ? nextEventRef : undefined)}
              />
            );
          })
        )}
      </div>

      {/* FAB — blue overlay "+" button */}
      {isAdmin && (
        <button onClick={() => setFormMode('create')}
          className="fixed z-[51] bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </button>
      )}
    </>
  );
});

export default EventsPage;
