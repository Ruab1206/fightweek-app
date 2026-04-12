import { X, Clock, MapPin, User, Calendar, Pencil, ExternalLink, Link2, Copy, Phone, Mail } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useGyms } from '../hooks/useGyms';
import type { CatalogueClass } from '../types/catalogue';

// ── Helpers ──
const formatDate = (v: unknown): string => {
  const d = v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate() : new Date(v as string | number);
  return isNaN(d.getTime()) ? '–' : d.toLocaleString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

import { DAY_NAMES, googleMapsUrl } from '../config/constants';

const DISC_BADGE: Record<string, string> = {
  'Muay Thai': 'bg-orange-500/20 text-orange-400',
  'BJJ':       'bg-purple-600/20 text-purple-400',
  'MMA':       'bg-red-600/20 text-red-400',
  'Boxing':    'bg-yellow-600/20 text-yellow-400',
  'Wrestling': 'bg-emerald-600/20 text-emerald-400',
  'S&C':       'bg-stone-600/20 text-stone-400',
};
const DEFAULT_BADGE = 'bg-slate-500/20 text-slate-400';

interface CatalogueDetailModalProps {
  cls: CatalogueClass;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
}

export default function CatalogueDetailModal({ cls, isAdmin, onClose, onEdit, onCopy }: CatalogueDetailModalProps) {
  const { isDark } = useTheme();
  const { gyms } = useGyms();
  const gymEntity = gyms.find((g) => g.name === cls.gym);

  const badgeCls = DISC_BADGE[cls.discipline] ?? DEFAULT_BADGE;
  const subtleCls = isDark ? 'text-slate-400' : 'text-ds-text-subtle';
  const labelCls = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
  const valCls = `text-sm font-medium ${isDark ? 'text-white' : 'text-ds-text'}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4 fade-in">
      <div className={`w-full max-w-lg sm:rounded-2xl rounded-t-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>

        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-surface-subtle border-surface-border'}`}>
          <div className="flex-1 min-w-0 mr-3">
            <h3 className={`font-bold text-lg truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{cls.discipline}</span>
              <span className={`text-xs ${subtleCls}`}>{cls.level}</span>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-full shrink-0 ${isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text bg-surface-hover'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">

          {/* Sub-discipline + age group row */}
          {(cls.subDiscipline || cls.ageGroup) && (
            <div className="flex flex-wrap gap-4">
              {cls.subDiscipline && (
                <div>
                  <p className={labelCls}>Underfokus</p>
                  <p className={valCls}>{cls.subDiscipline}</p>
                </div>
              )}
              {cls.ageGroup && (
                <div>
                  <p className={labelCls}>Aldersgruppe</p>
                  <p className={valCls}>{cls.ageGroup}</p>
                </div>
              )}
            </div>
          )}

          {/* Gym + Location */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className={labelCls}>Klub</p>
              <p className={valCls}>{cls.gym}</p>
              {gymEntity?.scheduleUrl && (
                <a
                  href={gymEntity.scheduleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 mt-0.5"
                >
                  <Link2 className="w-3 h-3" />
                  Holdoversigt
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            {cls.location && (
              <div>
                <p className={labelCls}>Lokation</p>
                <p className={valCls}>{cls.location}</p>
              </div>
            )}
          </div>

          {/* Address with Google Maps link */}
          {cls.address && (
            <div>
              <p className={labelCls}>Adresse</p>
              <a
                href={googleMapsUrl(cls.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400"
              >
                <MapPin className="w-3.5 h-3.5" />
                {cls.address}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Contact info */}
          {(gymEntity?.phone || gymEntity?.email) && (
            <div className="flex flex-wrap gap-4">
              {gymEntity.phone && (
                <div>
                  <p className={labelCls}>Telefon</p>
                  <a href={`tel:${gymEntity.phone}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400">
                    <Phone className="w-3.5 h-3.5" />
                    {gymEntity.phone}
                  </a>
                </div>
              )}
              {gymEntity.email && (
                <div>
                  <p className={labelCls}>Email</p>
                  <a href={`mailto:${gymEntity.email}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400">
                    <Mail className="w-3.5 h-3.5" />
                    {gymEntity.email}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Schedule */}
          {cls.schedules.length > 0 && (
            <div>
              <p className={labelCls}>Ugentlige tider</p>
              <div className="mt-1.5 space-y-1.5">
                {cls.schedules
                  .slice()
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                  .map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                      <Calendar className={`w-3.5 h-3.5 shrink-0 ${subtleCls}`} />
                      <span className="font-medium w-16">{DAY_NAMES[s.dayOfWeek]}</span>
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${subtleCls}`} />
                      <span>{s.startTime} – {s.endTime}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Instructor */}
          {cls.instructor && (
            <div className="flex items-center gap-2">
              <User className={`w-4 h-4 ${subtleCls}`} />
              <div>
                <p className={labelCls}>Instruktør</p>
                <p className={valCls}>{cls.instructor}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {cls.description && (
            <div>
              <p className={labelCls}>Beskrivelse</p>
              <p className={`text-sm mt-1 whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>{cls.description}</p>
            </div>
          )}

          {/* Metadata footer */}
          <div className={`pt-4 mt-2 border-t space-y-0.5 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            <div className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
              <p>Kilde: {cls.source}</p>
              <p>Oprettet: {formatDate(cls.createdAt)}</p>
              <p>Opdateret: {formatDate(cls.updatedAt)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-between items-center pb-safe ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-surface-border bg-surface-subtle'}`}>
          <div>
            {isAdmin && (
              <button onClick={onCopy} className={`p-3 rounded-xl transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-blue-900/20' : 'text-ds-text-subtlest hover:text-blue-500 hover:bg-blue-50'}`} title="Kopier hold">
                <Copy className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className={`font-bold text-sm px-4 ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}>Luk</button>
            {isAdmin && (
              <button onClick={onEdit} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 flex items-center">
                <Pencil className="w-4 h-4 mr-2" /> Rediger
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
