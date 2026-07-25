/**
 * EventDetail — full-screen detail overlay for a single event.
 */
import { ArrowLeft, MapPin, Clock, ExternalLink, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { FIGHTERS } from '../config/constants';
import { googleMapsUrl } from '../config/constants';
import type { FightweekEvent, EventSignupStatus } from '../types/event';
import { TypeBadge, formatDateRange, formatDateDa, isEventPast, daysUntil, SIGNUP_OPTIONS } from './eventHelpers';
import { NotesEditor } from './NotesEditor';
import { eventNoteKey } from '../hooks/useActivityNotes';
import { isEventCancelled } from '../hooks/eventDelete';

export function EventDetail({ event, isDark, fighterName, isAdmin, onSignup, onClose, onEdit, onDelete, getNote, saveNote }: {
  event: FightweekEvent;
  isDark: boolean;
  fighterName: string;
  isAdmin: boolean;
  onSignup: (status: EventSignupStatus | null) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getNote: (key: string) => string;
  saveNote: (key: string, text: string) => Promise<void>;
}) {
  const myStatus = event.signups?.[fighterName] || null;
  const deadlineDays = event.registrationDeadline ? daysUntil(event.registrationDeadline) : null;
  const past = isEventPast(event);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
        <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{event.title}</h2>
          <div className="flex items-center gap-2">
            <TypeBadge type={event.type} isDark={isDark} />
            {isEventCancelled(event) && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-red-950/40 text-red-400' : 'bg-red-100 text-red-600'}`}>
                Aflyst
              </span>
            )}
          </div>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
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

        {event.description && (
          <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <p className={`text-sm whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{event.description}</p>
          </div>
        )}

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

        {/* Notes */}
        <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Mine noter</p>
          <NotesEditor
            noteKey={eventNoteKey(event.id)}
            getNote={getNote}
            saveNote={saveNote}
            isDark={isDark}
          />
        </div>
      </div>
    </div>
  );
}
