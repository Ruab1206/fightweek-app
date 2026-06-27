import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Search, MapPin, X, SlidersHorizontal,
  ChevronDown, ChevronUp, PenLine, Calendar, Clock, Repeat,
  Link2, ExternalLink, Phone, Mail, ChevronLeft, ChevronRight, Trash2, UserPlus,
} from 'lucide-react';

import { CATEGORIES, DAYS, DAY_NAMES, RECURRENCE_OPTIONS, googleMapsUrl } from '../config/constants';
import { useCatalogue } from '../hooks/useCatalogue';
import { useGyms } from '../hooks/useGyms';
import { disciplineToCategory } from './InlineCataloguePicker';
import { InvitePicker, type InviteCandidate } from './shared/InvitePicker';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';

// ─── Types ───
export type AddType = 'træning' | 'fravær';

interface RecurrenceRule {
  interval: number; // 0 = none, 1 = weekly, 2 = bi-weekly, etc.
  endDate: string | null; // ISO date or null = no end
}

export interface AddScreenProps {
  defaultType: AddType;
  activeDay: { dayName: string; weekNumber: number; date: Date; key: string };
  multiWeekData: Record<number, any>;
  isDark: boolean;
  editingFravær?: { groupId: string; titel: string; beskrivelse: string; startDate: string; startTime: string; endDate: string; endTime: string } | null;
  onAddFromCatalogue: (session: any, day: string, weekNum: number) => void;
  onAddRecurring: (session: any, day: string, startDate: Date, recurrence: RecurrenceRule) => void;
  onManualAdd: (day: string, weekNum: number) => void;
  onAddFravær: (fravær: { titel: string; beskrivelse: string; startDate: string; startTime: string; endDate: string; endTime: string }) => void;
  onDeleteFravær?: (groupId: string) => void;
  onEditFravær?: (oldGroupId: string, fravær: { titel: string; beskrivelse: string; startDate: string; startTime: string; endDate: string; endTime: string }) => void;
  onClose: () => void;
  /** Invite teammates while adding a single (non-recurring) Hold (#1214). */
  inviteCandidates?: InviteCandidate[];
  onInviteToActivity?: (session: any, day: string, weekNum: number, inviteeEmails: string[]) => void | Promise<void>;
}

const INITIAL_SHOW = 5;

// ─── Hold detail bottom sheet ───
const HoldBottomSheet = ({ cls, schedule, activeDay, isDark, inviteCandidates, onSave, onClose }: {
  cls: CatalogueClass;
  schedule: ClassSchedule;
  activeDay: { dayName: string; weekNumber: number; date: Date };
  isDark: boolean;
  inviteCandidates?: InviteCandidate[];
  onSave: (session: any, recurrence: RecurrenceRule, inviteeEmails: string[]) => void;
  onClose: () => void;
}) => {
  const [interval, setInterval] = useState(0);
  const [endType, setEndType] = useState<'never' | 'date'>('never');
  const [endDate, setEndDate] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
  const { gyms } = useGyms();
  const gymEntity = gyms.find(g => g.name === cls.gym);
  const labelCls = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;

  const handleSave = () => {
    const session = {
      name: cls.title,
      category: disciplineToCategory(cls.discipline),
      start: schedule.startTime,
      end: schedule.endTime,
      location: cls.gym,
      catalogueClassId: cls.id,
    };
    onSave(session, {
      interval,
      endDate: endType === 'date' && endDate ? endDate : null,
    }, interval === 0 ? selectedInvitees : []);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
        <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-4" />

        {/* Class info */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-1.5 rounded-full self-stretch shrink-0 ${cat.color}`} />
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-base leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</h3>
              <div className={`mt-1 space-y-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{schedule.startTime} – {schedule.endTime}</div>
                <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cls.gym}{cls.location ? ` · ${cls.location}` : ''}</div>
                {cls.instructor && <div className="flex items-center gap-1">👤 {cls.instructor}</div>}
                {cls.discipline && <div>{cls.discipline}{cls.level ? ` · ${cls.level}` : ''}</div>}
              </div>
              {showMore && cls.description && (
                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{cls.description}</p>
              )}
              {showMore && (
                <div className={`mt-3 space-y-3 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                  {/* Address */}
                  {cls.address && (
                    <div>
                      <p className={labelCls}>Adresse</p>
                      <a href={googleMapsUrl(cls.address)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 mt-0.5">
                        <MapPin className="w-3 h-3" />{cls.address}<ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                  {/* Contact */}
                  {(gymEntity?.phone || gymEntity?.email) && (
                    <div className="flex flex-wrap gap-4">
                      {gymEntity?.phone && (
                        <div>
                          <p className={labelCls}>Telefon</p>
                          <a href={`tel:${gymEntity.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
                            <Phone className="w-3 h-3" />{gymEntity.phone}
                          </a>
                        </div>
                      )}
                      {gymEntity?.email && (
                        <div>
                          <p className={labelCls}>Email</p>
                          <a href={`mailto:${gymEntity.email}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400">
                            <Mail className="w-3 h-3" />{gymEntity.email}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Weekly schedule */}
                  {cls.schedules.length > 1 && (
                    <div>
                      <p className={labelCls}>Ugentlige tider</p>
                      <div className="mt-1 space-y-0.5">
                        {cls.schedules.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((s, i) => (
                          <div key={i} className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                            <Calendar className={`w-3 h-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                            <span className="font-medium w-14">{DAY_NAMES[s.dayOfWeek]}</span>
                            <Clock className={`w-3 h-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                            <span>{s.startTime} – {s.endTime}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Holdoversigt link */}
                  {gymEntity?.scheduleUrl && (
                    <a href={gymEntity.scheduleUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400">
                      <Link2 className="w-3 h-3" />Holdoversigt<ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              )}
              <button onClick={() => setShowMore(!showMore)} className={`mt-1 text-[10px] font-bold ${isDark ? 'text-blue-400' : 'text-brand-500'}`}>
                {showMore ? 'Skjul info' : 'Mere info'}
              </button>
            </div>
          </div>
        </div>

        {/* Day + time (read-only) */}
        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
            <Calendar className="w-4 h-4" />
            <span className="font-medium capitalize">
              {activeDay.date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>

        {/* Recurrence */}
        <div className={`px-5 py-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Gentagelse</label>
            <select value={interval} onChange={e => setInterval(Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`}>
              {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {interval > 0 && (
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slutdato</label>
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
                  min={activeDay.date.toISOString().slice(0, 10)}
                  className={`mt-2 w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`} />
              )}
            </div>
          )}
        </div>

        {/* Invite people — single occurrence only (#1214). Series invite = #1213 (deferred). */}
        {inviteCandidates && (
          <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            {interval === 0 ? (
              <>
                <InvitePicker
                  candidates={inviteCandidates}
                  selected={selectedInvitees}
                  onToggle={(email) => setSelectedInvitees(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])}
                  isDark={isDark}
                />
                {selectedInvitees.length > 0 && (
                  <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                    <UserPlus className="w-3.5 h-3.5" />
                    {selectedInvitees.length} {selectedInvitees.length === 1 ? 'person' : 'personer'} inviteres når du gemmer.
                  </p>
                )}
              </>
            ) : (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                Invitationer til en hel serie kommer senere — tilføj en enkelt træning for at invitere holdkammerater.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className={`px-5 py-4 border-t flex justify-end gap-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>Annuller</button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Gem</button>
        </div>
      </div>
    </>
  );
};

// ─── Inline month calendar picker ───
const MonthCalendarPicker = ({ value, isDark, onSelect, onClose, minDate }: {
  value: string; // ISO date string
  isDark: boolean;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
  minDate?: string;
}) => {
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1);
  const lastDay = new Date(year, mo + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const toLocalISO = (dt: Date) => {
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = toLocalISO(today);

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className={`absolute left-0 right-0 top-full mt-1 z-30 rounded-2xl border shadow-xl p-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMonth(new Date(year, mo - 1, 1))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronLeft className="w-4 h-4" /></button>
          <span className={`text-xs font-bold capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>{month.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setMonth(new Date(year, mo + 1, 1))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-surface-hover text-ds-text-subtle'}`}><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
            <div key={d} className={`text-[9px] font-bold py-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{d}</div>
          ))}
          {Array.from({ length: startPad }, (_, i) => <div key={`p-${i}`} />)}
          {Array.from({ length: lastDay.getDate() }, (_, i) => {
            const d = i + 1;
            const date = new Date(year, mo, d);
            const dateStr = toLocalISO(date);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === value;
            const isDisabled = minDate && dateStr < minDate;
            return (
              <button key={d} disabled={!!isDisabled}
                onClick={() => { onSelect(dateStr); onClose(); }}
                className={`w-7 h-7 mx-auto rounded-full text-[11px] font-medium transition-colors ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''} ${isSelected ? 'bg-blue-600 text-white font-bold' : isToday ? 'ring-1 ring-blue-500 text-blue-500 font-bold' : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-ds-text hover:bg-surface-hover')}`}>{d}</button>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ─── Main AddScreen ───
const AddScreen = ({ defaultType, activeDay, multiWeekData, isDark, editingFravær, onAddFromCatalogue, onAddRecurring, onManualAdd, onAddFravær, onDeleteFravær, onEditFravær, onClose, inviteCandidates, onInviteToActivity }: AddScreenProps) => {
  const [type, setType] = useState<AddType>(defaultType);
  const [selectedDay, setSelectedDay] = useState(activeDay);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [holdSheet, setHoldSheet] = useState<{ cls: CatalogueClass; schedule: ClassSchedule } | null>(null);

  // Lock body scroll while AddScreen is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Derive sessions for the currently selected day from multiWeekData
  const existingSessions = useMemo(() => {
    const weekData = multiWeekData[selectedDay.weekNumber] || {};
    return (weekData[selectedDay.dayName] || []).filter((s: any) => !s.isRestDay);
  }, [multiWeekData, selectedDay.weekNumber, selectedDay.dayName]);

  // Fravær form - pre-fill from editingFravær if present
  const isEditingFravær = !!editingFravær;
  const [fraværTitel, setFraværTitel] = useState(editingFravær?.titel || '');
  const [fraværBeskrivelse, setFraværBeskrivelse] = useState(editingFravær?.beskrivelse || '');
  const [fraværStartDate, setFraværStartDate] = useState(editingFravær?.startDate || activeDay.key);
  const [fraværStartTime, setFraværStartTime] = useState(editingFravær?.startTime || '09:00');
  const [fraværEndDate, setFraværEndDate] = useState(editingFravær?.endDate || activeDay.key);
  const [fraværEndTime, setFraværEndTime] = useState(editingFravær?.endTime || '17:00');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Catalogue search/filter
  const { classes, loading } = useCatalogue();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selDiscipline, setSelDiscipline] = useState<string | null>(null);
  const [selGym, setSelGym] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const dayIndex = DAYS.indexOf(selectedDay.dayName) + 1;

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
        return c.title.toLowerCase().includes(q) || c.discipline.toLowerCase().includes(q) ||
          disciplineToCategory(c.discipline).toLowerCase().includes(q) || c.gym.toLowerCase().includes(q) ||
          (c.location && c.location.toLowerCase().includes(q)) || (c.address && c.address.toLowerCase().includes(q)) ||
          (c.level && c.level.toLowerCase().includes(q)) || (c.subDiscipline && c.subDiscipline.toLowerCase().includes(q)) ||
          (c.instructor && c.instructor.toLowerCase().includes(q));
      });
    }
    return list;
  }, [allOptions, selDiscipline, selGym, search]);

  const visibleSessions = existingSessions.filter((s: any) => !s.isRestDay && s.status !== 'cancelled');

  const handleHoldSave = (session: any, recurrence: RecurrenceRule, inviteeEmails: string[]) => {
    if (recurrence.interval === 0) {
      onAddFromCatalogue(session, selectedDay.dayName, selectedDay.weekNumber);
      if (inviteeEmails.length > 0) {
        onInviteToActivity?.(session, selectedDay.dayName, selectedDay.weekNumber, inviteeEmails);
      }
    } else {
      onAddRecurring(session, selectedDay.dayName, selectedDay.date, recurrence);
    }
    setHoldSheet(null);
    onClose();
  };

  const handleDateChange = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
    const dayName = dayNames[d.getDay()];
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const dow = target.getDay();
    const targetMonday = new Date(target);
    targetMonday.setDate(target.getDate() - ((dow + 6) % 7));
    const jan4 = new Date(target.getFullYear(), 0, 4);
    const jan4Monday = new Date(jan4);
    jan4Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diffMs = targetMonday.getTime() - jan4Monday.getTime();
    const weekNum = 1 + Math.round(diffMs / (7 * 86400000));

    setSelectedDay({ dayName, weekNumber: weekNum, date: d, key: dateStr });
    setShowDatePicker(false);
  };

  const handleSaveFravær = () => {
    if (isEditingFravær && editingFravær && onEditFravær) {
      onEditFravær(editingFravær.groupId, {
        titel: fraværTitel,
        beskrivelse: fraværBeskrivelse,
        startDate: fraværStartDate,
        startTime: fraværStartTime,
        endDate: fraværEndDate,
        endTime: fraværEndTime,
      });
    } else {
      onAddFravær({
        titel: fraværTitel,
        beskrivelse: fraværBeskrivelse,
        startDate: fraværStartDate,
        startTime: fraværStartTime,
        endDate: fraværEndDate,
        endTime: fraværEndTime,
      });
    }
    onClose();
  };

  const formatDateDa = (dateStr: string) => {
    if (!dateStr) return 'Vælg dato';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`;
  const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;

  return (
    <div className={`fixed inset-0 z-40 overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 p-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={`font-bold text-base ${isDark ? 'text-white' : 'text-ds-text'}`}>
            {isEditingFravær ? 'Rediger fravær' : 'Tilføj'}
          </h1>
        </div>
      </div>

      <div className="px-4 pt-4 pb-32">
        {/* Type tiles (hidden when editing fravær) */}
        {!isEditingFravær && (
          <div className="flex gap-2 mb-4">
            {(['træning', 'fravær'] as AddType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-colors ${type === t ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-ds-text border border-surface-border')}`}>
                {t === 'træning' ? 'Træning' : 'Fravær'}
              </button>
            ))}
          </div>
        )}

        {/* Selected day (only shown for Træning tab) */}
        {type === 'træning' && (
          <div className={`relative p-3 rounded-xl border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
                <span className={`text-sm font-medium capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>
                  {selectedDay.date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <button onClick={() => setShowDatePicker(!showDatePicker)} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-surface-hover text-brand-500 hover:bg-surface-raised'}`}>
                Skift dag
              </button>
            </div>
            {showDatePicker && (
              <MonthCalendarPicker value={selectedDay.key} isDark={isDark} onSelect={handleDateChange} onClose={() => setShowDatePicker(false)} />
            )}
          </div>
        )}

        {/* Træning content */}
        {type === 'træning' && (
          <div className="space-y-4">
            {visibleSessions.length > 0 && (
              <div>
                <h3 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Planlagt</h3>
                <div className="space-y-1.5">
                  {visibleSessions.map((s: any) => {
                    const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                    const isRecurring = !!s.isRecurring;
                    return (
                      <div key={s.id} className={`relative flex items-start p-2 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-surface-raised border-surface-border'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color}`} />
                        <div className="flex-1 pl-2.5 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-ds-text'}`}>{s.name}</h4>
                            {isRecurring && <Repeat className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />}
                          </div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                            {s.start} - {s.end} · {s.location}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => { onManualAdd(selectedDay.dayName, selectedDay.weekNumber); onClose(); }}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-surface-border text-ds-text hover:bg-surface-hover'}`}>
              <PenLine className="w-4 h-4" /> Tilføj egen træning
            </button>

            <div>
              <h3 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Tilføj hold</h3>

              <div className="flex items-center gap-2 mb-2">
                <div className={`flex-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
                  <Search className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg hold..."
                    className={`flex-1 bg-transparent outline-none text-xs ${isDark ? 'text-white placeholder-slate-500' : 'text-ds-text placeholder-ds-text-subtlest'}`} />
                  {search && <button onClick={() => setSearch('')}><X className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} /></button>}
                </div>
                <button onClick={() => setFiltersOpen(!filtersOpen)}
                  className={`relative p-1.5 rounded-lg border transition-colors ${filtersOpen || activeFilterCount ? (isDark ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-brand-50 border-brand-200 text-brand-500') : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-surface-border text-ds-text-subtle')}`}>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-[8px] text-white flex items-center justify-center font-bold">{activeFilterCount}</span>}
                </button>
              </div>

              {filtersOpen && (
                <div className={`mb-2 space-y-1.5 border rounded-lg p-2 ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
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

              <div className="space-y-1.5">
                {loading && <div className={`text-center py-4 text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Henter...</div>}
                {!loading && filtered.length === 0 && <div className={`text-center py-4 text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{allOptions.length === 0 ? 'Ingen hold denne dag' : 'Ingen match'}</div>}
                {(showAll ? filtered : filtered.slice(0, INITIAL_SHOW)).map(({ cls, schedule }) => {
                  const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
                  return (
                    <button key={`${cls.id}-${schedule.startTime}`} onClick={() => setHoldSheet({ cls, schedule })}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors active:scale-[0.98] ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-surface-border hover:bg-surface-hover'}`}>
                      <div className={`w-1 self-stretch rounded-full shrink-0 ${cat.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</div>
                        <div className={`text-[10px] flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                          <span>{schedule.startTime}–{schedule.endTime}</span>
                          <span className="flex items-center"><MapPin className="w-2.5 h-2.5 mr-0.5" />{cls.gym}</span>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 shrink-0 -rotate-90 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                    </button>
                  );
                })}
                {!showAll && filtered.length > INITIAL_SHOW && (
                  <button onClick={() => setShowAll(true)}
                    className={`w-full flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-lg ${isDark ? 'text-blue-400 hover:bg-slate-800' : 'text-brand-500 hover:bg-surface-hover'}`}>
                    <ChevronDown className="w-3.5 h-3.5" /> Vis alle ({filtered.length})
                  </button>
                )}
                {showAll && filtered.length > INITIAL_SHOW && (
                  <button onClick={() => setShowAll(false)}
                    className={`w-full flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-lg ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
                    <ChevronUp className="w-3.5 h-3.5" /> Vis færre
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fravær content */}
        {type === 'fravær' && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Titel</label>
              <input type="text" value={fraværTitel} onChange={e => setFraværTitel(e.target.value)} placeholder="F.eks. Kursus, Arbejdsrejse..."
                className={`${inputCls} ${isDark ? 'placeholder-slate-500' : 'placeholder-ds-text-subtlest'}`} />
            </div>
            <div>
              <label className={labelCls}>Beskrivelse</label>
              <textarea value={fraværBeskrivelse} onChange={e => setFraværBeskrivelse(e.target.value)} placeholder="Valgfrit..."
                rows={2}
                className={`${inputCls} resize-none ${isDark ? 'placeholder-slate-500' : 'placeholder-ds-text-subtlest'}`} />
            </div>

            {/* Start date + time */}
            <div>
              <label className={labelCls}>Fra</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <button onClick={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`}>
                    <Calendar className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                    <span className="capitalize">{formatDateDa(fraværStartDate)}</span>
                  </button>
                  {showStartPicker && (
                    <MonthCalendarPicker value={fraværStartDate} isDark={isDark}
                      onSelect={(d) => { setFraværStartDate(d); if (fraværEndDate < d) setFraværEndDate(d); }}
                      onClose={() => setShowStartPicker(false)} />
                  )}
                </div>
                <div className="w-24">
                  <div className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                    <input type="time" value={fraværStartTime} onChange={e => setFraværStartTime(e.target.value)}
                      className={`flex-1 bg-transparent outline-none font-mono text-sm w-full ${isDark ? 'text-white' : 'text-ds-text'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* End date + time */}
            <div>
              <label className={labelCls}>Til</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <button onClick={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`}>
                    <Calendar className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                    <span className="capitalize">{formatDateDa(fraværEndDate)}</span>
                  </button>
                  {showEndPicker && (
                    <MonthCalendarPicker value={fraværEndDate} isDark={isDark} minDate={fraværStartDate}
                      onSelect={(d) => setFraværEndDate(d)}
                      onClose={() => setShowEndPicker(false)} />
                  )}
                </div>
                <div className="w-24">
                  <div className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                    <input type="time" value={fraværEndTime} onChange={e => setFraværEndTime(e.target.value)}
                      className={`flex-1 bg-transparent outline-none font-mono text-sm w-full ${isDark ? 'text-white' : 'text-ds-text'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Save / Delete */}
            <button onClick={handleSaveFravær} disabled={!fraværStartDate || !fraværEndDate}
              className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isEditingFravær ? 'Gem ændringer' : 'Gem fravær'}
            </button>
            {isEditingFravær && editingFravær && onDeleteFravær && (
              <button onClick={() => onDeleteFravær(editingFravær.groupId)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20 border border-red-900/40' : 'text-red-600 hover:bg-red-50 border border-red-200'}`}>
                <Trash2 className="w-4 h-4" /> Slet fravær
              </button>
            )}
          </div>
        )}
      </div>

      {holdSheet && (
        <HoldBottomSheet
          cls={holdSheet.cls}
          schedule={holdSheet.schedule}
          activeDay={selectedDay}
          isDark={isDark}
          inviteCandidates={inviteCandidates}
          onSave={handleHoldSave}
          onClose={() => setHoldSheet(null)}
        />
      )}
    </div>
  );
};

export default AddScreen;
