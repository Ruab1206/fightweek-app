import { useState, useMemo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ArrowLeft, MapPin, Clock, ExternalLink, Trophy, BookOpen, PartyPopper, CalendarDays, Plus, Pencil, Trash2, Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';
import { CATEGORIES, FIGHTERS } from '../config/constants';
import { googleMapsUrl } from '../config/constants';
import { disciplineToCategory } from '../components/InlineCataloguePicker';
import type { FightweekEvent, EventType, EventSignupStatus } from '../types/event';

export type EventsPageHandle = { scrollToNext: (behavior?: ScrollBehavior) => void };
export { useEvents } from '../hooks/useEvents';

// ── Category color from discipline (reuses CATEGORIES from constants) ──
function getCategoryColor(discipline?: string): { color: string; border: string; label: string } {
  if (!discipline) return CATEGORIES[6]; // 'Andet'
  const catLabel = disciplineToCategory(discipline);
  return CATEGORIES.find(c => c.label === catLabel) || CATEGORIES[6];
}

// ── Event type styling ──
const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; darkColor: string; icon: typeof Trophy }> = {
  tournament: { label: 'Stævne', color: 'bg-red-100 text-red-700 border-red-200', darkColor: 'bg-red-900/30 text-red-400 border-red-800', icon: Trophy },
  seminar:    { label: 'Seminar', color: 'bg-blue-100 text-blue-700 border-blue-200', darkColor: 'bg-blue-900/30 text-blue-400 border-blue-800', icon: BookOpen },
  social:     { label: 'Socialt', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', darkColor: 'bg-emerald-900/30 text-emerald-400 border-emerald-800', icon: PartyPopper },
  other:      { label: 'Andet', color: 'bg-slate-100 text-slate-700 border-slate-200', darkColor: 'bg-slate-800 text-slate-400 border-slate-700', icon: CalendarDays },
};

function formatDateDa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateRange(date: string, endDate?: string): string {
  if (!endDate || endDate === date) return formatDateDa(date);
  return `${formatDateDa(date)} – ${formatDateDa(endDate)}`;
}

function isEventPast(evt: FightweekEvent): boolean {
  const checkDate = evt.endDate || evt.date;
  return new Date(checkDate + 'T23:59:59') < new Date();
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Haversine distance (km) ──
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Type badge ──
function TypeBadge({ type, isDark }: { type: EventType; isDark: boolean }) {
  const cfg = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isDark ? cfg.darkColor : cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Sign-up summary ──
function SignupSummary({ signups, isDark }: { signups: Record<string, EventSignupStatus>; isDark: boolean }) {
  const interested = Object.entries(signups).filter(([, s]) => s === 'interested').map(([n]) => n);
  const signedUp = Object.entries(signups).filter(([, s]) => s === 'signed-up').map(([n]) => n);
  if (interested.length === 0 && signedUp.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 mt-1.5 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
      {signedUp.map(n => (
        <span key={n} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{n}</span>
      ))}
      {interested.map(n => (
        <span key={n} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
      ))}
    </div>
  );
}

// ── Signup buttons ──
const SIGNUP_OPTIONS: { value: EventSignupStatus; label: string; activeColor: string; darkActiveColor: string }[] = [
  { value: 'signed-up', label: 'Tilmeldt', activeColor: 'bg-emerald-600 text-white border-emerald-600', darkActiveColor: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'interested', label: 'Interesseret', activeColor: 'bg-blue-600 text-white border-blue-600', darkActiveColor: 'bg-blue-600 text-white border-blue-600' },
  { value: 'declined', label: 'Ikke interesseret', activeColor: 'bg-red-600 text-white border-red-600', darkActiveColor: 'bg-red-600 text-white border-red-600' },
];

const DISCIPLINE_OPTIONS = CATEGORIES.map(c => c.label);
const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'tournament', label: 'Stævne' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'social', label: 'Socialt' },
  { value: 'other', label: 'Andet' },
];

// ── Event form (create / edit) ──
function EventForm({ isDark, event, userEmail, onSave, onCancel }: {
  isDark: boolean;
  event: FightweekEvent | null; // null = create mode
  userEmail: string;
  onSave: (data: Omit<FightweekEvent, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title || '');
  const [type, setType] = useState<EventType>(event?.type || 'other');
  const [discipline, setDiscipline] = useState(event?.discipline || '');
  const [date, setDate] = useState(event?.date || '');
  const [endDate, setEndDate] = useState(event?.endDate || '');
  const [startTime, setStartTime] = useState(event?.startTime || '');
  const [endTime, setEndTime] = useState(event?.endTime || '');
  const [location, setLocation] = useState(event?.location || '');
  const [address, setAddress] = useState(event?.address || '');
  const [description, setDescription] = useState(event?.description || '');
  const [organiser, setOrganiser] = useState(event?.organiser || '');
  const [url, setUrl] = useState(event?.url || '');
  const [cost, setCost] = useState(event?.cost || '');
  const [contactName, setContactName] = useState(event?.contactName || '');
  const [contactEmail, setContactEmail] = useState(event?.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(event?.contactPhone || '');
  const [registrationDeadline, setRegistrationDeadline] = useState(event?.registrationDeadline || '');
  const [latitude, setLatitude] = useState<number | null>(event?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(event?.longitude ?? null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && date.length > 0;

  const handleSubmit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const data: Omit<FightweekEvent, 'id'> = {
      title: title.trim(),
      type,
      date,
      signups: event?.signups || {},
      createdBy: event?.createdBy || userEmail,
      createdAt: event?.createdAt || now,
      updatedAt: now,
      ...(discipline ? { discipline } : {}),
      ...(endDate ? { endDate } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(organiser.trim() ? { organiser: organiser.trim() } : {}),
      ...(url.trim() ? { url: url.trim() } : {}),
      ...(cost.trim() ? { cost: cost.trim() } : {}),
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      ...(registrationDeadline ? { registrationDeadline } : {}),
      ...(latitude != null ? { latitude } : {}),
      ...(longitude != null ? { longitude } : {}),
    };
    await onSave(data);
    setSaving(false);
  };

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500' : 'bg-white border-surface-border text-ds-text placeholder-ds-text-subtlest focus:border-blue-500'}`;
  const labelCls = `block text-[11px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      {/* Header */}
      <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
        <button onClick={onCancel} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-ds-text'}`}>{isEdit ? 'Rediger event' : 'Nyt event'}</h2>
        <div className="flex-1" />
        <button onClick={handleSubmit} disabled={!canSave || saving}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${canSave && !saving ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'}`}>
          {saving ? 'Gemmer…' : 'Gem'}
        </button>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {/* Title */}
        <div>
          <label className={labelCls}>Titel *</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Fx DM i Brydning 2026" />
        </div>

        {/* Type + Discipline row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={type} onChange={e => setType(e.target.value as EventType)}>
              {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Disciplin</label>
            <select className={inputCls} value={discipline} onChange={e => setDiscipline(e.target.value)}>
              <option value="">— Vælg —</option>
              {DISCIPLINE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Date row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dato *</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Slutdato</label>
            <input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Time row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start</label>
            <input type="time" className={inputCls} value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Slut</label>
            <input type="time" className={inputCls} value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className={labelCls}>Sted</label>
          <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="Fx Burnell MMA & BJJ" />
        </div>
        <div>
          <label className={labelCls}>Adresse</label>
          <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="Fx Prags Boulevard 47, 2300 København" />
        </div>
        {/* Coordinates (auto-geocode from address) */}
        <div>
          <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Breddegrad</label>
                <input type="number" step="any" className={inputCls} value={latitude ?? ''} onChange={e => setLatitude(e.target.value ? parseFloat(e.target.value) : null)} placeholder="55.6761" />
              </div>
              <div>
                <label className={labelCls}>Længdegrad</label>
                <input type="number" step="any" className={inputCls} value={longitude ?? ''} onChange={e => setLongitude(e.target.value ? parseFloat(e.target.value) : null)} placeholder="12.5683" />
              </div>
            </div>
          </div>
          {address.trim() && latitude == null && (
            <button type="button" onClick={async () => {
              const q = encodeURIComponent(address.trim());
              setGeocoding(true);
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, { headers: { 'Accept-Language': 'da' } });
                const data = await res.json();
                if (data?.[0]) { setLatitude(parseFloat(data[0].lat)); setLongitude(parseFloat(data[0].lon)); }
              } catch { /* ignore */ }
              setGeocoding(false);
            }} disabled={geocoding}
              className={`mt-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-ds-text-subtle hover:bg-slate-200'}`}>
              {geocoding ? 'Søger…' : '📍 Hent koordinater fra adresse'}
            </button>
          )}
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Beskrivelse</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} value={description} onChange={e => setDescription(e.target.value)} placeholder="Valgfri beskrivelse af event" />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Arrangør</label>
            <input className={inputCls} value={organiser} onChange={e => setOrganiser(e.target.value)} placeholder="Fx DIF" />
          </div>
          <div>
            <label className={labelCls}>Pris</label>
            <input className={inputCls} value={cost} onChange={e => setCost(e.target.value)} placeholder="Fx 250 kr" />
          </div>
        </div>

        {/* Link + deadline */}
        <div>
          <label className={labelCls}>Link (URL)</label>
          <input type="url" className={inputCls} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className={labelCls}>Tilmeldingsfrist</label>
          <input type="date" className={inputCls} value={registrationDeadline} onChange={e => setRegistrationDeadline(e.target.value)} />
        </div>

        {/* Contact */}
        <div>
          <label className={labelCls}>Kontaktperson</label>
          <input className={inputCls} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Fx John Doe" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@eksempel.dk" />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input type="tel" className={inputCls} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+45 12 34 56 78" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Event detail view (full-screen overlay) ──
function EventDetail({ event, isDark, fighterName, isAdmin, onSignup, onClose, onEdit, onDelete }: {
  event: FightweekEvent;
  isDark: boolean;
  fighterName: string;
  isAdmin: boolean;
  onSignup: (status: EventSignupStatus | null) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const myStatus = event.signups?.[fighterName] || null;
  const deadlineDays = event.registrationDeadline ? daysUntil(event.registrationDeadline) : null;
  const past = isEventPast(event);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      {/* Header */}
      <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
        <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.title}</h2>
          <TypeBadge type={event.type} isDark={isDark} />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {/* Date & time */}
        <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <div className="flex items-center gap-2">
            <CalendarDays className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-ds-text'}`}>{formatDateRange(event.date, event.endDate)}</span>
          </div>
          {(event.startTime || event.endTime) && (
            <div className="flex items-center gap-2 mt-1.5">
              <Clock className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</span>
            </div>
          )}
        </div>

        {/* Location */}
        {(event.location || event.address) && (
          <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.location || event.address}</span>
            </div>
            {event.address && (
              <a href={googleMapsUrl(event.address)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1.5 text-xs text-blue-500 hover:text-blue-400 font-medium">
                <ExternalLink className="w-3 h-3" /> {event.address}
              </a>
            )}
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <p className={`text-sm whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{event.description}</p>
          </div>
        )}

        {/* Details row */}
        <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          {event.organiser && (
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Arrangør</span>
              <span className={`font-medium ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.organiser}</span>
            </div>
          )}
          {event.discipline && (
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Disciplin</span>
              <span className={`font-medium ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.discipline}</span>
            </div>
          )}
          {event.cost && (
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Pris</span>
              <span className={`font-medium ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.cost}</span>
            </div>
          )}
          {event.registrationDeadline && (
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Tilmeldingsfrist</span>
              <span className={`font-medium ${deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0 ? 'text-red-500' : (isDark ? 'text-white' : 'text-ds-text')}`}>
                {formatDateDa(event.registrationDeadline)}
                {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 && (
                  <span className="text-[10px] ml-1 text-red-500">({deadlineDays === 0 ? 'i dag!' : `${deadlineDays} dage`})</span>
                )}
              </span>
            </div>
          )}
          {event.url && (
            <a href={event.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-400 font-medium pt-1">
              <ExternalLink className="w-3.5 h-3.5" /> Læs mere
            </a>
          )}
          {(event.contactName || event.contactEmail || event.contactPhone) && (
            <div className={`pt-1 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Kontakt</p>
              {event.contactName && (
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Kontaktperson</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.contactName}</span>
                </div>
              )}
              {event.contactEmail && (
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Email</span>
                  <a href={`mailto:${event.contactEmail}`} className="text-sm text-blue-500 hover:text-blue-400 font-medium">{event.contactEmail}</a>
                </div>
              )}
              {event.contactPhone && (
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-slate-400' : 'text-ds-text-subtle'}>Telefon</span>
                  <a href={`tel:${event.contactPhone}`} className="text-sm text-blue-500 hover:text-blue-400 font-medium">{event.contactPhone}</a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Team sign-ups */}
        <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Holdet</p>
          <div className="space-y-1">
            {FIGHTERS.map(f => {
              const status = event.signups?.[f];
              const statusLabel = status === 'signed-up' ? 'Tilmeldt' : status === 'interested' ? 'Interesseret' : status === 'declined' ? 'Ikke interesseret' : '—';
              const statusColor = status === 'signed-up' ? 'text-emerald-500' : status === 'interested' ? 'text-blue-500' : status === 'declined' ? 'text-red-400' : (isDark ? 'text-slate-600' : 'text-ds-text-subtlest');
              return (
                <div key={f} className="flex justify-between items-center text-sm">
                  <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>{f}</span>
                  <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* My sign-up buttons */}
        {!past && (
          <div className="space-y-2">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Din status</p>
            <div className="flex gap-2">
              {SIGNUP_OPTIONS.map(opt => {
                const isActive = myStatus === opt.value;
                return (
                  <button key={opt.value}
                    onClick={() => onSignup(isActive ? null : opt.value)}
                    className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-colors ${isActive ? (isDark ? opt.darkActiveColor : opt.activeColor) : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-ds-text border-surface-border hover:bg-surface-hover')}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
}

const EventsPage = forwardRef<EventsPageHandle, EventsPageProps>(function EventsPage(
  { isDark, fighterName, isAdmin, userEmail, searchQuery, searchMode, initialEventId, onClearInitialEvent },
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
      listRef.current?.scrollTo({ top: 0 });
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
  }, [initialEventId, loading, events]);

  // Find the index of the first upcoming event (for auto-scroll)
  const nextUpcomingIndex = useMemo(() => {
    const idx = events.findIndex(e => !isEventPast(e));
    return idx >= 0 ? idx : -1;
  }, [events]);

  // Scroll to next upcoming event
  const scrollToNext = useCallback((behavior: ScrollBehavior = 'instant') => {
    const el = nextEventRef.current;
    if (el) el.scrollIntoView({ behavior, block: 'start' });
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

    return result;
  }, [events, searchQuery, includePast, filterDisciplines, filterDistance, userLocation, filterParticipants]);

  // Auto-scroll to next upcoming on first load
  useEffect(() => {
    if (!loading && events.length > 0 && !hasScrolled.current) {
      hasScrolled.current = true;
      scrollToNext();
    }
  }, [loading, events.length, scrollToNext]);

  // Scroll back to the event the user just viewed
  useEffect(() => {
    if (returnToId && returnRef.current) {
      returnRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
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
                <button onClick={async () => { await removeEvent(confirmDelete.id); setConfirmDelete(null); setSelectedEvent(null); }}
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
      <div ref={listRef} className="px-4 pt-3 pb-20 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 73px)' }}>
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
