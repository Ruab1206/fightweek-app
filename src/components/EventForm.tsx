/**
 * EventForm — full-screen create/edit form for events.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CATEGORIES } from '../config/constants';
import type { FightweekEvent, EventType } from '../types/event';

const DISCIPLINE_OPTIONS = CATEGORIES.map(c => c.label);
const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'tournament', label: 'Stævne' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'social', label: 'Socialt' },
  { value: 'other', label: 'Andet' },
];

export function EventForm({ isDark, event, userEmail, onSave, onCancel }: {
  isDark: boolean;
  event: FightweekEvent | null;
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        <div>
          <label className={labelCls}>Titel *</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Fx DM i Brydning 2026" />
        </div>

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

        <div>
          <label className={labelCls}>Sted</label>
          <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="Fx Burnell MMA & BJJ" />
        </div>
        <div>
          <label className={labelCls}>Adresse</label>
          <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="Fx Prags Boulevard 47, 2300 København" />
        </div>
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

        <div>
          <label className={labelCls}>Beskrivelse</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} value={description} onChange={e => setDescription(e.target.value)} placeholder="Valgfri beskrivelse af event" />
        </div>

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

        <div>
          <label className={labelCls}>Link (URL)</label>
          <input type="url" className={inputCls} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className={labelCls}>Tilmeldingsfrist</label>
          <input type="date" className={inputCls} value={registrationDeadline} onChange={e => setRegistrationDeadline(e.target.value)} />
        </div>

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
