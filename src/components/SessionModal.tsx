import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

import { CATEGORIES } from '../config/constants';
import { addMinutes, toLocalISODate } from '../utils/dateUtils';
import { useTheme } from '../hooks/useTheme';
import { NotesEditor } from './NotesEditor';
import { sessionNoteKey } from '../hooks/useActivityNotes';
import { InvitePicker, type InviteCandidate } from './shared/InvitePicker';
import { evaluateThisAndFollowingEligibility } from '../domain/calendar/seriesEditScopeEligibility';
import type { InvitationResponse } from '../types/invitation';
import { TrainingLogSummary } from './TrainingLogSummary';
import type { TrainingHistoryItem } from '../domain/calendar/types';

import { RECURRENCE_OPTIONS } from '../config/constants';

/**
 * Presentation-boundary view of `OccurrenceLogAssociation`
 * (`src/domain/calendar/logAssociation.ts`) with carried log(s) already
 * mapped to `TrainingHistoryItem` by the parent — SessionModal never sees the
 * raw `CompletedSelfPostedTrainingLog` domain record. Mirrors the same
 * `kind` discriminant so the component renders purely by `kind` and never
 * reconstructs none/one/conflict from a log count itself.
 */
export type TrainingLogAssociationView =
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'none' }
    | { kind: 'one'; log: TrainingHistoryItem }
    | { kind: 'conflict'; logs: TrainingHistoryItem[] };

/**
 * Decide whether saving the session should (re)apply a recurring series
 * (handleAddRecurring) vs. just update this single instance (handleSaveSession).
 *
 * #1183: existing recurring instances default `interval` to 1 for display, so
 * routing on `interval > 0` alone made every edit (incl. cancelling one instance)
 * rebuild the series and discard the change. Only apply recurrence for a NEW
 * session, or when the user explicitly changed the recurrence selector.
 */
export function shouldApplyRecurrence(params: { interval: number; isNew: boolean; recurrenceTouched: boolean }): boolean {
  const { interval, isNew, recurrenceTouched } = params;
  return interval > 0 && (isNew || recurrenceTouched);
}

/**
 * Explicit edit-scope intent emitted by the scope prompt for an existing
 * recurring self-posted session. The UI never decides series-member
 * selection, field propagation, or persistence itself — it only emits which
 * scope the user chose; the application layer (useSessionHandlers) owns the
 * rest. Deliberately has no 'all_occurrences' member — that scope is not
 * supported (see docs/fightweek_refactoring_plan.md).
 */
export type SessionEditScope = 'this_occurrence' | 'this_and_following';

/**
 * Whether the submitted form differs from the original persisted values in
 * any field SessionModal actually writes. Used to gate the edit-scope prompt
 * for an EXISTING recurring session — never based on whether the recurrence
 * dropdown itself was touched (that alone must not trigger the prompt).
 * `original` is `null` for a new session, which always returns false.
 */
export function hasPersistedSessionFieldChange(original: SessionForm | null, submitted: SessionForm): boolean {
  if (!original) return false;
  return (
    (original.name || '') !== (submitted.name || '') ||
    (original.category || '') !== (submitted.category || '') ||
    (original.start || '') !== (submitted.start || '') ||
    (original.end || '') !== (submitted.end || '') ||
    (original.location || '') !== (submitted.location || '') ||
    (original.status || '') !== (submitted.status || '') ||
    (original.cancellationReason || '') !== (submitted.cancellationReason || '') ||
    (original.cancellationTime ?? null) !== (submitted.cancellationTime ?? null)
  );
}

interface SessionForm {
    id?: string;
    name: string;
    category: string;
    start: string;
    end: string;
    location: string;
    status: string;
    cancellationReason: string;
    cancellationTime: string | null;
    catalogueClassId?: string;
}

interface SessionModalProps {
    day: string;
    weekNum: number;
    date: Date;
    initialData: SessionForm | null;
    existingSessions: SessionForm[];
    onClose: () => void;
    onSave: (form: SessionForm) => void;
    onDelete: (id: string) => void;
    onDeleteThisAndFuture: (day: string, name: string, start: string, fromWeek: number) => void;
    onRecurrenceSave: (session: SessionForm, dayName: string, startDate: Date, recurrence: { interval: number; endDate: string | null }) => void;
    onFeedback: (context: string) => void;
    getNote: (key: string) => string;
    saveNote: (key: string, text: string) => Promise<void>;
    // #1201 — invite FightWeek users to this activity. Optional so other callers
    // (and read-only contexts) don't need to provide it.
    inviteCandidates?: InviteCandidate[];
    existingInvitees?: Record<string, InvitationResponse>;
    onInvite?: (form: SessionForm, inviteeEmails: string[]) => void;
    /** Invite teammates to the WHOLE recurring series when this save (re)applies
     * recurrence (#1213). Falls back to single-occurrence onInvite otherwise. */
    onSeriesInvite?: (form: SessionForm, day: string, startDate: Date, recurrence: { interval: number; endDate: string | null }, inviteeEmails: string[]) => void;
    onUninvite?: (email: string) => void;
    /**
     * Phase 3 calendar-originated TrainingLog slice. The parent application
     * layer computes eligibility (self-posted + ownership) and supplies these
     * — SessionModal performs no conversion, persistence, or ownership checks
     * itself; it only displays the action and notifies the parent on click.
     */
    canLogTraining?: boolean;
    onLogTraining?: () => void;
    /**
     * Phase 3 read-side association slice (Slice A: read-side integrity
     * classification). Undefined means the parent has already decided (via
     * the shared eligibility predicate, not duplicated here) that this
     * session type does not get a "Træningslogs" section at all — e.g.
     * catalogue-linked, fravær, event, invitation, cancelled, rest-day, or
     * unsaved. When present, it is shown independently of
     * `canLogTraining`/`onLogTraining` (an admin viewing another fighter may
     * see existing logs without being able to create one). SessionModal
     * renders purely by `kind` — it does not infer none/one/conflict from a
     * raw log count itself; the parent already decided that via
     * `classifyOccurrenceLogAssociation`.
     */
    trainingLogAssociation?: TrainingLogAssociationView;
    onOpenTrainingLogDetail?: (item: TrainingHistoryItem) => void;
    /**
     * Edit-scope slice: fires ONLY for an edited (not new) recurring
     * self-posted session with an actual persisted-field change, after the
     * user resolves the explicit edit-scope prompt. SessionModal emits the
     * scope + original + submitted values only — it owns no series-member
     * selection, field propagation, or persistence itself; the application
     * layer (useSessionHandlers) owns all of that. When omitted, the modal
     * falls back to the pre-existing implicit save behaviour (defensive —
     * production always supplies this).
     */
    onRecurringEditScope?: (scope: SessionEditScope, original: SessionForm, submitted: SessionForm, dayName: string, startDate: Date) => void;
}

const SessionModal = ({ day, weekNum, date, initialData, existingSessions: _existingSessions, onClose, onSave, onDelete, onDeleteThisAndFuture, onRecurrenceSave, onFeedback: _onFeedback, getNote, saveNote, inviteCandidates, existingInvitees, onInvite, onSeriesInvite, onUninvite, canLogTraining, onLogTraining, trainingLogAssociation, onOpenTrainingLogDetail, onRecurringEditScope }: SessionModalProps) => {
    const { isDark } = useTheme();
    const isNew = !initialData;
    // Edit-scope slice: whether this is an EXISTING recurring session (needed
    // both to gate the Save routing below and to compute the this-and-
    // following eligibility for the JSX render further down).
    const isRecurringExisting = !isNew && !!(initialData as any)?.isRecurring;
    // Single shared source of truth (also used by legacySessionDetailAdapter) —
    // never re-derive the durable-seriesId/historical rule independently here.
    const thisAndFollowingEligibility = isRecurringExisting
        ? evaluateThisAndFollowingEligibility({
            isRecurring: true,
            seriesId: (initialData as any)?.seriesId,
            occurrenceDateISO: toLocalISODate(date),
            todayISO: toLocalISODate(new Date()),
        })
        : null;
    const [form, setForm] = useState<SessionForm>({
        name: '', category: 'MMA', start: '17:00', end: '18:30', location: '', status: 'active', cancellationReason: '', cancellationTime: null
    });
    const [recurrenceInterval, setRecurrenceInterval] = useState(0);
    // #1183: was the recurrence selector actually changed by the user this session?
    // Existing recurring instances default recurrenceInterval to 1 for display, but
    // editing/cancelling a single instance must NOT re-run handleAddRecurring (which
    // would discard the change and rebuild the series). Only (re)apply recurrence when
    // it's a new session or the user explicitly touched the Gentagelse selector.
    const [recurrenceTouched, setRecurrenceTouched] = useState(false);
    const [endType, setEndType] = useState<'never' | 'date'>('never');
    const [endDate, setEndDate] = useState('');
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);
    // Edit-scope slice: shown instead of persisting directly when the session
    // being edited is an EXISTING recurring one AND the submitted form has an
    // actual persisted-field change (never based on recurrence-dropdown touch
    // alone — see hasPersistedSessionFieldChange).
    const [showEditScopePrompt, setShowEditScopePrompt] = useState(false);
    // A4 (#1188): when deleting a session that has a training-log note, confirm first
    // so a logged session isn't silently removed. The note itself is preserved
    // (handleDeleteSession never deletes it); surfacing/recovering it is tracked in #1164.
    const [confirmNoteDelete, setConfirmNoteDelete] = useState(false);
    // #1201: emails of FightWeek users to invite to this activity on save.
    const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);

    useEffect(() => {
        if (initialData) {
            setForm(initialData);
            if (initialData.isRecurring) setRecurrenceInterval(1);
        }
    }, [initialData]);

    const handleChange = (field: keyof SessionForm, value: string) => {
        setForm(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'start' && value) newData.end = addMinutes(value, 90);
            return newData;
        });
    };

    const toggleStatus = () => {
        setForm(prev => ({
            ...prev,
            status: prev.status === 'active' ? 'cancelled' : 'active',
            cancellationReason: prev.status === 'active' ? 'Aflyst' : '',
            cancellationTime: prev.status === 'active' ? new Date().toISOString() : null
        }));
    };

    const cat = CATEGORIES.find(c => c.label === form.category) || CATEGORIES[6];
    const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
    const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`;

    // Slice A: rows to render for the association section, if any. SessionModal
    // does not decide none/one/conflict itself — it only maps the parent's
    // already-classified `trainingLogAssociation.kind` to a list of read-only
    // rows to display.
    const trainingLogAssociationItems: TrainingHistoryItem[] =
        trainingLogAssociation?.kind === 'one' ? [trainingLogAssociation.log]
        : trainingLogAssociation?.kind === 'conflict' ? trainingLogAssociation.logs
        : [];

    const handleSave = () => {
        // Edit-scope slice: an EXISTING recurring session with an actual
        // persisted-field change must always ask explicitly which occurrences
        // the change applies to — never silently pick a scope. A session with
        // no actual change (Save clicked with nothing edited) just closes;
        // there is nothing to persist and no scope to ask about.
        if (isRecurringExisting && onRecurringEditScope) {
            if (!hasPersistedSessionFieldChange(initialData, form)) {
                onClose();
                return;
            }
            setShowEditScopePrompt(true);
            return;
        }
        commitDirectSave();
    };

    // Existing (pre-edit-scope-slice) save routing: unchanged for a NEW
    // session, and for editing a session that isn't currently recurring.
    const commitDirectSave = () => {
        const applyRecurrence = shouldApplyRecurrence({ interval: recurrenceInterval, isNew, recurrenceTouched });
        const recurrence = {
            interval: recurrenceInterval,
            endDate: endType === 'date' && endDate ? endDate : null,
        };
        // #1201/#1213: fire any pending invitations alongside the save. The
        // invitation snapshots the current form (title/time/location). When this
        // save (re)applies recurrence, invite the WHOLE series so everyone is
        // invited to every occurrence — not just the edited one.
        if (selectedInvitees.length > 0) {
            if (applyRecurrence && onSeriesInvite) {
                onSeriesInvite(form, day, date, recurrence, selectedInvitees);
            } else if (onInvite) {
                onInvite(form, selectedInvitees);
            }
        }
        if (applyRecurrence) {
            onRecurrenceSave(form, day, date, recurrence);
        } else {
            onSave(form);
        }
    };

    // Edit-scope slice: fires once the user resolves the prompt. Invites go
    // out only for a single-occurrence save ("this and following" never reads
    // or writes invitations — they remain snapshots, see architecture notes).
    const resolveEditScope = (scope: SessionEditScope) => {
        setShowEditScopePrompt(false);
        if (scope === 'this_occurrence' && selectedInvitees.length > 0 && onInvite) {
            onInvite(form, selectedInvitees);
        }
        onRecurringEditScope!(scope, initialData as SessionForm, form, day, date);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
            <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-4" />

                    {/* Title row with category color */}
                    <div className="px-5 pb-4">
                        <div className="flex items-start gap-3">
                            <div className={`w-1.5 rounded-full self-stretch shrink-0 ${cat.color}`} />
                            <div className="flex-1 min-w-0">
                                <h3 className={`font-bold text-base leading-tight mb-3 ${isDark ? 'text-white' : 'text-ds-text'}`}>
                                    {isNew ? 'Ny egen træning' : 'Rediger træning'}
                                </h3>

                                {/* Name */}
                                <div className="mb-3">
                                    <label className={labelCls}>Aktivitet</label>
                                    <input type="text" className={inputCls} value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="F.eks. MMA Sparring" />
                                </div>

                                {/* Category + Location */}
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className={labelCls}>Kategori</label>
                                        <select className={inputCls} value={form.category} onChange={e => handleChange('category', e.target.value)}>
                                            {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Lokation</label>
                                        <input type="text" className={inputCls} value={form.location} onChange={e => handleChange('location', e.target.value)} placeholder="F.eks. Rumble Sports" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Day + time */}
                    <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <div className={`flex items-center gap-2 text-sm mb-3 ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium capitalize">
                                {date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Start</label>
                                <div className={`flex items-center gap-1.5 ${inputCls}`}>
                                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                                    <input type="time" className={`flex-1 bg-transparent outline-none font-mono text-sm ${isDark ? 'text-white' : 'text-ds-text'}`} value={form.start} onChange={e => handleChange('start', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Slut</label>
                                <div className={`flex items-center gap-1.5 ${inputCls}`}>
                                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
                                    <input type="time" className={`flex-1 bg-transparent outline-none font-mono text-sm ${isDark ? 'text-white' : 'text-ds-text'}`} value={form.end} onChange={e => handleChange('end', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recurrence */}
                    <div className={`px-5 py-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <div>
                            <label className={labelCls}>Gentagelse</label>
                            <select value={recurrenceInterval} onChange={e => { setRecurrenceInterval(Number(e.target.value)); setRecurrenceTouched(true); }} className={inputCls}>
                                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        {recurrenceInterval > 0 && (
                            <div>
                                <label className={labelCls}>Slutdato</label>
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
                                        min={date.toISOString().slice(0, 10)}
                                        className={`mt-2 ${inputCls}`} />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Invite people (#1201) */}
                    {onInvite && inviteCandidates && (
                        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            <InvitePicker
                                candidates={inviteCandidates}
                                selected={selectedInvitees}
                                onToggle={(email) => setSelectedInvitees(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])}
                                existing={existingInvitees}
                                onRemoveExisting={onUninvite}
                                isDark={isDark}
                            />
                            {selectedInvitees.length > 0 && (
                                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                                    {selectedInvitees.length} {selectedInvitees.length === 1 ? 'person' : 'personer'} inviteres når du gemmer.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Notes (existing sessions only) */}
                    {!isNew && (
                        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            <NotesEditor
                                noteKey={sessionNoteKey(date.toISOString().slice(0, 10), form.id || `${form.name}_${form.start}`)}
                                getNote={getNote}
                                saveNote={saveNote}
                                isDark={isDark}
                            />
                        </div>
                    )}

                    {/* Read-side association (Phase 3 strangler slice, Slice A):
                        existing TrainingLogs already associated with this exact
                        calendar occurrence, by explicit provenance only (never by
                        title/date/time). The parent has already classified the
                        result as loading/error/none/one/conflict — this component
                        renders purely by `kind` and never reconstructs that from a
                        raw log count. `none` renders nothing here — no empty list,
                        no "Ikke logget" placeholder — since that would imply a
                        completion state this slice does not define. */}
                    {!isNew && trainingLogAssociation && trainingLogAssociation.kind !== 'none' && (
                        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            {trainingLogAssociation.kind === 'error' && (
                                <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>Kunne ikke hente træningslogs.</p>
                            )}
                            {trainingLogAssociation.kind === 'loading' && (
                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Indlæser træningslogs…</p>
                            )}
                            {trainingLogAssociationItems.length > 0 && (
                                <div>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                                        {trainingLogAssociation.kind === 'one' ? 'Træningslog' : 'Træningslogs'}
                                    </p>
                                    {/* Data-integrity conflict: more than one TrainingLog for this
                                        occurrence. No log is selected as canonical; all remain
                                        inspectable read-only until a future explicit resolution. */}
                                    {trainingLogAssociation.kind === 'conflict' && (
                                        <p className={`text-xs mb-2 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                            Der findes flere træningslogs for denne træning. Oprettelse af en ny log er deaktiveret, indtil konflikten er afklaret.
                                        </p>
                                    )}
                                    <ul className="space-y-2">
                                        {trainingLogAssociationItems.map((item) => (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenTrainingLogDetail?.(item)}
                                                    aria-label={`Se træningslog: ${item.title}`}
                                                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/60' : 'border-surface-border hover:bg-surface-hover'}`}
                                                >
                                                    <TrainingLogSummary item={item} isDark={isDark} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Log completed training (Phase 3 calendar-originated TrainingLog slice).
                        Eligibility (self-posted + ownership) is decided entirely by the parent —
                        this button only appears/fires when told to. */}
                    {!isNew && canLogTraining && onLogTraining && (
                        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            <button
                                type="button"
                                onClick={onLogTraining}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'}`}
                            >
                                Log denne træning
                            </button>
                        </div>
                    )}

                    {/* Cancel toggle (existing non-standard only) */}
                    {!isNew && (
                        <div className={`px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            <div className="flex items-center gap-3">
                                <button onClick={toggleStatus} className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${form.status === 'cancelled' ? 'bg-red-600 border-red-600' : (isDark ? 'bg-slate-950 border-slate-600' : 'bg-surface-subtle border-surface-border')}`}>
                                    {form.status === 'cancelled' && <span className="text-white text-xs font-bold">✓</span>}
                                </button>
                                <label className={`text-xs font-bold uppercase cursor-pointer ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} onClick={toggleStatus}>Aflys</label>
                            </div>
                            {form.status === 'cancelled' && (
                                <div className="mt-3">
                                    <label className={labelCls}>Årsag til aflysning</label>
                                    <input type="text" className={`${inputCls} border-red-500/50`} value={form.cancellationReason} onChange={e => handleChange('cancellationReason', e.target.value)} placeholder="Sygdom, Skade, Andet..." />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {showEditScopePrompt ? (
                    <div className={`px-5 py-3 border-t space-y-1.5 shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Anvend ændringer på</p>
                        <button onClick={() => resolveEditScope('this_occurrence')}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'}`}>
                            Kun denne træning
                        </button>
                        {/* Historical occurrence: this-and-following is never offered at all
                            (not even disabled) — "Kun denne træning" remains the only forward option. */}
                        {thisAndFollowingEligibility?.reason !== 'historical' && (
                            thisAndFollowingEligibility?.eligible ? (
                                <button onClick={() => resolveEditScope('this_and_following')}
                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'}`}>
                                    Denne og alle fremtidige træninger
                                </button>
                            ) : (
                                <>
                                    {/* Legacy recurring occurrence (no durable seriesId): shown, but
                                        disabled with a concise explanation — never fails after a click. */}
                                    <button type="button" disabled aria-disabled="true"
                                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed opacity-40 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                                        Denne og alle fremtidige træninger
                                    </button>
                                    <p className={`px-4 text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                                        Kun tilgængelig for nyere gentagende træninger.
                                    </p>
                                </>
                            )
                        )}
                        <button onClick={() => setShowEditScopePrompt(false)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
                            Annuller
                        </button>
                    </div>
                ) : showDeleteOptions ? (
                    confirmNoteDelete ? (
                        <div className={`px-5 py-3 border-t space-y-1.5 shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-200' : 'text-ds-text'}`}>Denne træning har en træningslog (note).</p>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Vil du slette træningen alligevel? Noten bevares.</p>
                            <button onClick={() => { onDelete(form.id!); }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
                                Slet alligevel
                            </button>
                            <button onClick={() => { setConfirmNoteDelete(false); setShowDeleteOptions(false); }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
                                Behold træning
                            </button>
                        </div>
                    ) : (
                    <div className={`px-5 py-3 border-t space-y-1.5 shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Slet træning</p>
                        <button onClick={() => {
                            const hasNote = !!getNote(sessionNoteKey(date.toISOString().slice(0, 10), form.id || `${form.name}_${form.start}`)).trim();
                            if (hasNote) setConfirmNoteDelete(true);
                            else onDelete(form.id!);
                        }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
                            Denne træning
                        </button>
                        {(initialData as any)?.isRecurring && (
                            <button onClick={() => { onDeleteThisAndFuture(day, form.name, form.start, weekNum); }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'}`}>
                                Denne og alle fremtidige træninger
                            </button>
                        )}
                        <button onClick={() => setShowDeleteOptions(false)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>
                            Annuller
                        </button>
                    </div>
                    )
                ) : (
                    <div className={`px-5 py-4 border-t flex justify-between items-center shrink-0 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
                        {!isNew ? (
                            <button onClick={() => setShowDeleteOptions(true)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                                Slet
                            </button>
                        ) : <div />}
                        <div className="flex gap-3">
                            <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`}>Annuller</button>
                            <button onClick={handleSave} disabled={!form.name.trim()} className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40">Gem</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default SessionModal;
