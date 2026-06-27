/**
 * SessionDetailSheet — bottom sheet for viewing/editing a catalogue session
 * (calendar tap → full details, recurrence, delete).
 */
import React, { useState, useMemo } from 'react';
import {
  Clock, MapPin, Calendar, ExternalLink, Link2, Phone, Mail,
} from 'lucide-react';

import { CATEGORIES, DAY_NAMES, RECURRENCE_OPTIONS, googleMapsUrl } from '../config/constants';
import { getDateForWeekDay } from '../utils/dateUtils';
import { disciplineToCategory } from './InlineCataloguePicker';
import { useGyms } from '../hooks/useGyms';
import { NotesEditor } from './NotesEditor';
import { sessionNoteKey } from '../hooks/useActivityNotes';
import type { CatalogueClass } from '../types/catalogue';

export interface SessionDetailSheetProps {
  cls: CatalogueClass;
  session: any;
  day: string;
  weekNum: number;
  isDark: boolean;
  multiWeekData: Record<number, any>;
  systemWeek: number;
  saveWeekToDb: (weekNum: number, data: any) => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRecurrenceChange: (session: any, dayName: string, startDate: Date, recurrence: { interval: number; endDate: string | null }) => void;
  onClose: () => void;
  /** Called when the arranger removes/cancels this activity, so any invitation
   * they sent for it is cancelled too and invitees are notified (#1201). */
  onArrangerActivityRemoved?: (session: any, dayName: string, weekNum: number, scope: 'this' | 'future') => void;
  getNote: (key: string) => string;
  saveNote: (key: string, text: string) => Promise<void>;
}

const SessionDetailSheet = ({ cls, session, day, weekNum, isDark, multiWeekData, systemWeek: _systemWeek, saveWeekToDb, showToast, onRecurrenceChange, onClose, onArrangerActivityRemoved, getNote, saveNote }: SessionDetailSheetProps) => {
  const [showMore, setShowMore] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [interval, setRecurrenceInterval] = useState(session.isRecurring ? 1 : 0);
  const [endType, setEndType] = useState<'never' | 'date'>('never');
  const [endDate, setEndDate] = useState('');
  const [isCancelled, setIsCancelled] = useState(session.status === 'cancelled');
  const [cancelReason, setCancelReason] = useState(session.cancellationReason || '');
  const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
  const { gyms } = useGyms();
  const gymEntity = gyms.find(g => g.name === cls.gym);
  const labelCls = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
  const nameLC = (session.name || '').toLowerCase();
  const startTime = session.start || '';

  // Compute the date for this session's week+day
  const sessionDate = useMemo(() => getDateForWeekDay(weekNum, day) || new Date(), [weekNum, day]);

  const handleToggleCancel = () => {
    const nowCancelled = !isCancelled;
    setIsCancelled(nowCancelled);
    if (nowCancelled) setCancelReason('Aflyst');
    else setCancelReason('');
    // Persist immediately
    const weekData = multiWeekData[weekNum];
    if (!weekData) return;
    const newData = structuredClone(weekData);
    if (!newData[day]) return;
    const idx = newData[day].findIndex((s: any) => s.id === session.id);
    if (idx === -1) return;
    newData[day][idx] = {
      ...newData[day][idx],
      status: nowCancelled ? 'cancelled' : 'active',
      cancellationReason: nowCancelled ? 'Aflyst' : '',
      cancellationTime: nowCancelled ? new Date().toISOString() : null,
    };
    saveWeekToDb(weekNum, newData);
    // Cancelling the activity should notify anyone I invited (#1201).
    if (nowCancelled) onArrangerActivityRemoved?.(session, day, weekNum, 'this');
    showToast(nowCancelled ? `${session.name} aflyst` : `${session.name} genaktiveret`, 'success');
    onClose();
  };

  const handleSave = () => {
    const sessionPayload = {
      name: cls.title,
      category: disciplineToCategory(cls.discipline),
      start: session.start,
      end: session.end,
      location: cls.gym,
      catalogueClassId: cls.id,
    };
    onRecurrenceChange(sessionPayload, day, sessionDate, {
      interval,
      endDate: endType === 'date' && endDate ? endDate : null,
    });
  };

  const handleDeleteThis = () => {
    onClose();
    showToast(`${session.name} fjernet`, 'success');
    // Cancel any invitation I sent for this activity so invitees are notified (#1201).
    onArrangerActivityRemoved?.(session, day, weekNum, 'this');
    const weekData = multiWeekData[weekNum];
    if (!weekData) return;
    const newData = structuredClone(weekData);
    if (newData[day]) {
      newData[day] = newData[day].filter((s: any) => s.id !== session.id);
      saveWeekToDb(weekNum, newData);
    }
  };

  const handleDeleteThisAndFuture = () => {
    onClose();
    showToast(`${session.name} fjernet`, 'success');
    // Cancel invitations for this and every future occurrence too (#1201).
    onArrangerActivityRemoved?.(session, day, weekNum, 'future');
    (async () => {
      for (const wk of Object.keys(multiWeekData).map(Number).sort((a, b) => a - b)) {
        if (wk < weekNum) continue;
        const weekData = multiWeekData[wk];
        if (!weekData?.[day]) continue;
        const newData = structuredClone(weekData);
        const before = newData[day].length;
        newData[day] = newData[day].filter((s: any) =>
          (s.name || '').toLowerCase() !== nameLC || s.start !== startTime
        );
        if (newData[day].length < before) {
          await saveWeekToDb(wk, newData);
        }
      }
    })();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-4" />

        {/* Class info */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-1.5 rounded-full self-stretch shrink-0 ${cat.color}`} />
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-base leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>{cls.title}</h3>
              <div className={`mt-1 space-y-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.start} — {session.end}</div>
                <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cls.gym}{cls.location ? ` · ${cls.location}` : ''}</div>
                {cls.instructor && <div className="flex items-center gap-1">👤 {cls.instructor}</div>}
                {cls.discipline && <div>{cls.discipline}{cls.level ? ` · ${cls.level}` : ''}</div>}
              </div>
              {showMore && cls.description && (
                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>{cls.description}</p>
              )}
              {showMore && (
                <div className={`mt-3 space-y-3 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                  {cls.address && (
                    <div>
                      <p className={labelCls}>Adresse</p>
                      <a href={googleMapsUrl(cls.address)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 mt-0.5">
                        <MapPin className="w-3 h-3" />{cls.address}<ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
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
                  {cls.schedules.length > 1 && (
                    <div>
                      <p className={labelCls}>Ugentlige tider</p>
                      <div className="mt-1 space-y-0.5">
                        {cls.schedules.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((s, i) => (
                          <div key={i} className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                            <Calendar className={`w-3 h-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                            <span className="font-medium w-14">{DAY_NAMES[s.dayOfWeek]}</span>
                            <Clock className={`w-3 h-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                            <span>{s.startTime} — {s.endTime}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
              {sessionDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <NotesEditor
            noteKey={sessionNoteKey(sessionDate.toISOString().slice(0, 10), session.id || `${session.name}_${session.start}`)}
            getNote={getNote}
            saveNote={saveNote}
            isDark={isDark}
          />
        </div>

        {/* Cancel / Aflys toggle */}
        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div className="flex items-center gap-3">
            <button onClick={handleToggleCancel} className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${isCancelled ? 'bg-red-600 border-red-600' : (isDark ? 'bg-slate-950 border-slate-600' : 'bg-surface-subtle border-surface-border')}`}>
              {isCancelled && <span className="text-white text-xs font-bold">✓</span>}
            </button>
            <label className={`text-xs font-bold uppercase cursor-pointer ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} onClick={handleToggleCancel}>Aflys</label>
          </div>
          {isCancelled && (
            <div className="mt-3">
              <label className={labelCls}>Årsag til aflysning</label>
              <input type="text" className={`w-full px-3 py-2 rounded-lg border text-sm border-red-500/50 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`}
                value={cancelReason}
                onChange={e => {
                  setCancelReason(e.target.value);
                  // Persist reason change
                  const weekData = multiWeekData[weekNum];
                  if (!weekData) return;
                  const nd = structuredClone(weekData);
                  const idx = nd[day]?.findIndex((s: any) => s.id === session.id);
                  if (idx >= 0) { nd[day][idx].cancellationReason = e.target.value; saveWeekToDb(weekNum, nd); }
                }}
                placeholder="Sygdom, Skade, Andet..." />
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className={`px-5 py-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Gentagelse</label>
            <select value={interval} onChange={e => setRecurrenceInterval(Number(e.target.value))}
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
                  min={sessionDate.toISOString().slice(0, 10)}
                  className={`mt-2 w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`} />
              )}
            </div>
          )}
        </div>
        </div>{/* end scrollable area */}

        {/* Footer — either actions or delete options */}
        {showDeleteOptions ? (
          <div className={`px-5 py-3 border-t space-y-1.5 shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slet træning</p>
            <button onClick={handleDeleteThis}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
              Denne træning
            </button>
            {session?.isRecurring && (
            <button onClick={handleDeleteThisAndFuture}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
              Denne og alle fremtidige træninger
            </button>
            )}
            <button onClick={() => setShowDeleteOptions(false)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
              Annuller
            </button>
          </div>
        ) : (
          <div className={`px-5 py-4 border-t flex justify-between items-center shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            <button onClick={() => setShowDeleteOptions(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
              Slet
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>Annuller</button>
              <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Gem</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SessionDetailSheet;
