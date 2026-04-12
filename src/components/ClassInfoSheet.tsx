import { X, Clock, MapPin, Calendar, Phone, Mail, Link2, ExternalLink, User } from 'lucide-react';
import { useGyms } from '../hooks/useGyms';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';

import { DAY_NAMES, googleMapsUrl } from '../config/constants';

const DISC_BADGE: Record<string, string> = {
  'Muay Thai': 'bg-orange-500/20 text-orange-400',
  'BJJ':       'bg-purple-600/20 text-purple-400',
  'MMA':       'bg-red-600/20 text-red-400',
  'Boxing':    'bg-yellow-600/20 text-yellow-400',
  'Wrestling': 'bg-emerald-600/20 text-emerald-400',
  'S&C':       'bg-stone-600/20 text-stone-400',
};

interface ClassInfoSheetProps {
  cls: CatalogueClass;
  schedule?: ClassSchedule;
  isDark: boolean;
  onAdd?: () => void;        // If provided, show "Tilføj" button
  onClose: () => void;
}

export default function ClassInfoSheet({ cls, schedule, isDark, onAdd, onClose }: ClassInfoSheetProps) {
  const { gyms } = useGyms();
  const gymEntity = gyms.find((g) => g.name === cls.gym);
  const badgeCls = DISC_BADGE[cls.discipline] ?? 'bg-slate-500/20 text-slate-400';
  const labelCls = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
  const valCls = `text-sm font-medium ${isDark ? 'text-white' : 'text-ds-text'}`;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
        <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-2" />

        {/* Header */}
        <div className="px-5 pb-3 flex items-start justify-between">
          <div className="min-w-0 mr-3">
            <h3 className={`font-bold text-base leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{cls.discipline}</span>
              {cls.level && <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{cls.level}</span>}
              {cls.subDiscipline && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>· {cls.subDiscipline}</span>}
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-full shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Time for selected schedule */}
        {schedule && (
          <div className={`px-5 py-2.5 border-t flex items-center gap-2 text-sm ${isDark ? 'border-slate-800 text-slate-300' : 'border-surface-border text-ds-text'}`}>
            <Clock className="w-4 h-4 shrink-0" />
            <span className="font-medium">{schedule.startTime} – {schedule.endTime}</span>
          </div>
        )}

        <div className={`px-5 py-4 border-t space-y-4 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          {/* Gym + Holdoversigt */}
          <div>
            <p className={labelCls}>Klub</p>
            <p className={valCls}>{cls.gym}</p>
            {cls.location && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{cls.location}</p>}
            {gymEntity?.scheduleUrl && (
              <a href={gymEntity.scheduleUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 mt-1">
                <Link2 className="w-3 h-3" />Holdoversigt<ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>

          {/* Address */}
          {cls.address && (
            <div>
              <p className={labelCls}>Adresse</p>
              <a href={googleMapsUrl(cls.address)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400">
                <MapPin className="w-3.5 h-3.5" />{cls.address}<ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Contact */}
          {(gymEntity?.phone || gymEntity?.email) && (
            <div className="flex flex-wrap gap-4">
              {gymEntity.phone && (
                <div>
                  <p className={labelCls}>Telefon</p>
                  <a href={`tel:${gymEntity.phone}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400">
                    <Phone className="w-3.5 h-3.5" />{gymEntity.phone}
                  </a>
                </div>
              )}
              {gymEntity.email && (
                <div>
                  <p className={labelCls}>Email</p>
                  <a href={`mailto:${gymEntity.email}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400">
                    <Mail className="w-3.5 h-3.5" />{gymEntity.email}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Weekly schedule */}
          {cls.schedules.length > 0 && (
            <div>
              <p className={labelCls}>Ugentlige tider</p>
              <div className="mt-1.5 space-y-1">
                {cls.schedules
                  .slice()
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                  .map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                      <Calendar className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                      <span className="font-medium w-16">{DAY_NAMES[s.dayOfWeek]}</span>
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                      <span>{s.startTime} – {s.endTime}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Instructor */}
          {cls.instructor && (
            <div className="flex items-center gap-2">
              <User className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
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
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex justify-end gap-3 pb-safe ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <button onClick={onClose} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>Luk</button>
          {onAdd && (
            <button onClick={onAdd} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Tilføj til kalender
            </button>
          )}
        </div>
      </div>
    </>
  );
}
