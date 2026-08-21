/**
 * LogTrainingSheet — isolated bottom-sheet form for explicitly logging
 * completed training after the fact (Phase 3 active slice, Step 4.2).
 *
 * Deliberately knows nothing about Firestore, fighter keys, hooks, or
 * navigation — it only calls the injected `onSubmit`. Used both by the
 * standalone "Log træning" entry point (no `initialValues`) and by the
 * calendar-originated flow, which supplies `initialValues` built by the
 * application layer from `buildSelfPostedCalendarLogContext` (see
 * `src/domain/calendar/adapters.ts`) — this component itself performs no
 * conversion, persistence, or eligibility/ownership checks.
 *
 * Completion comes from using this flow, not from the presence of notes —
 * see `src/domain/calendar/selfPostedTraining.ts`. All business rules
 * (including the future-date/time rule and the required-discipline rule)
 * are enforced by that same pure domain validator, never re-implemented
 * here — this component only maps its returned error strings to Danish text.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES } from '../config/constants';
import { useTheme } from '../hooks/useTheme';
import {
  validateCompletedSelfPostedTrainingInput,
  type CompletedSelfPostedTrainingInput,
} from '../domain/calendar/selfPostedTraining';
import type { TrainingLogOrigin } from '../domain/calendar/types';

/**
 * Prefillable subset for a calendar-originated opening. Only values the
 * planned session already provides — the fighter still enters/adjusts actual
 * details (intensity, notes) themselves. `origin` travels separately from the
 * editable fields; it is never shown/edited in the form.
 */
export interface LogTrainingSheetInitialValues {
  title?: string;
  dateISO?: string;
  start?: string;
  durationMinutes?: number;
  discipline?: string;
  location?: string;
  origin?: TrainingLogOrigin;
}

export interface LogTrainingSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CompletedSelfPostedTrainingInput) => Promise<string | void>;
  /** Omit for the standalone flow — behavior is then unchanged from before. */
  initialValues?: LogTrainingSheetInitialValues;
}

interface FormState {
  title: string;
  dateISO: string;
  start: string;
  duration: string;
  discipline: string;
  location: string;
  intensity: string;
  notes: string;
}

function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyFormState(): FormState {
  return {
    title: '',
    dateISO: localDateISO(new Date()),
    start: '',
    duration: '',
    discipline: '',
    location: '',
    intensity: '',
    notes: '',
  };
}

/**
 * Seed the form from a calendar-originated prefill, falling back to the same
 * empty defaults as the standalone flow for anything not supplied. Intensity
 * and notes are never prefilled — they are always user-entered.
 */
function formStateFromInitialValues(initialValues?: LogTrainingSheetInitialValues): FormState {
  const base = emptyFormState();
  if (!initialValues) return base;
  return {
    ...base,
    title: initialValues.title ?? base.title,
    dateISO: initialValues.dateISO ?? base.dateISO,
    start: initialValues.start ?? base.start,
    duration: initialValues.durationMinutes !== undefined ? String(initialValues.durationMinutes) : base.duration,
    discipline: initialValues.discipline ?? base.discipline,
    location: initialValues.location ?? base.location,
  };
}

// Presentation-only Danish text for domain error strings — the domain
// strings themselves are never changed, this is purely a display mapping.
const DOMAIN_ERROR_DA: Record<string, string> = {
  'title is required': 'Titel er påkrævet',
  'dateISO is required and must be YYYY-MM-DD': 'Dato er påkrævet',
  'dateISO/start must not be in the future': 'Træningen kan ikke logges i fremtiden',
  'start must be a valid HH:mm time': 'Starttidspunkt er ugyldigt',
  'end must be a valid HH:mm time': 'Sluttidspunkt er ugyldigt',
  'either a valid end time or a positive durationMinutes is required': 'Angiv en varighed i minutter',
  'intensity must be between 1 and 5': 'Intensitet skal være mellem 1 og 5',
  'discipline is required': 'Vælg en disciplin/kategori',
};

function toDanish(error: string): string {
  return DOMAIN_ERROR_DA[error] ?? error;
}

// Which single field an error is displayed under. A plain substring match
// would show the combined "dateISO/start" future error under BOTH the date
// and start fields — this explicit map keeps each error attached to one field.
const ERROR_FIELD: Record<string, string> = {
  'title is required': 'title',
  'dateISO is required and must be YYYY-MM-DD': 'dateISO',
  'dateISO/start must not be in the future': 'dateISO',
  'start must be a valid HH:mm time': 'start',
  'end must be a valid HH:mm time': 'start',
  'either a valid end time or a positive durationMinutes is required': 'durationMinutes',
  'intensity must be between 1 and 5': 'intensity',
  'discipline is required': 'discipline',
};

export function LogTrainingSheet({ open, onClose, onSubmit, initialValues }: LogTrainingSheetProps) {
  const { isDark } = useTheme();
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [origin, setOrigin] = useState<TrainingLogOrigin | undefined>(undefined);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Fresh form + cleared feedback each time the sheet is (re)opened. Also
  // re-seeds whenever `initialValues` itself changes (a different selected
  // session) so no stale values/provenance leak from a previous opening.
  useEffect(() => {
    if (open) {
      setForm(formStateFromInitialValues(initialValues));
      setOrigin(initialValues?.origin);
      setErrors([]);
      setSubmitError(null);
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (open) titleInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, saving, onClose]);

  if (!open) return null;

  const update = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const fieldErrors = (field: string) =>
    errors.filter((e) => ERROR_FIELD[e] === field).map(toDanish);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const input: CompletedSelfPostedTrainingInput = {
      title: form.title,
      dateISO: form.dateISO,
      start: form.start || undefined,
      durationMinutes: form.duration !== '' ? Number(form.duration) : undefined,
      discipline: form.discipline || undefined,
      location: form.location.trim() ? form.location.trim() : undefined,
      intensity: form.intensity !== '' ? Number(form.intensity) : undefined,
      notes: form.notes.trim() ? form.notes.trim() : undefined,
      origin,
    };

    const domainErrors = validateCompletedSelfPostedTrainingInput(input);

    if (domainErrors.length > 0) {
      setErrors(domainErrors);
      return;
    }

    setErrors([]);
    setSubmitError(null);
    setSaving(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kunne ikke gemme træningen. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-surface-border text-ds-text'}`;
  const errorTextCls = 'text-red-500 text-xs mt-1';
  const today = localDateISO(new Date());

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-training-heading"
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}
      >
        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-10 h-1 rounded-full bg-slate-400 mx-auto mt-3 mb-4" />

          <div className="px-5 pb-2 flex items-start justify-between gap-3">
            <h3 id="log-training-heading" className={`font-bold text-base leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>
              Log træning
            </h3>
            <button
              type="button"
              aria-label="Luk"
              onClick={handleClose}
              disabled={saving}
              className={`p-1 rounded shrink-0 ${isDark ? 'text-slate-500 hover:text-white' : 'text-ds-text-subtlest hover:text-ds-text'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {submitError && (
            <div className="px-5 pb-2">
              <p role="alert" className={errorTextCls}>{submitError}</p>
            </div>
          )}

          <div className="px-5 pb-4 space-y-3">
            <div>
              <label htmlFor="log-training-title" className={labelCls}>Titel / træningstype</label>
              <input
                ref={titleInputRef}
                id="log-training-title"
                type="text"
                className={inputCls}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="F.eks. MMA Sparring"
                aria-describedby="log-training-title-error"
              />
              {fieldErrors('title').map((msg) => <p key={msg} id="log-training-title-error" className={errorTextCls}>{msg}</p>)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="log-training-date" className={labelCls}>Dato</label>
                <input
                  id="log-training-date"
                  type="date"
                  className={inputCls}
                  value={form.dateISO}
                  max={today}
                  onChange={(e) => update('dateISO', e.target.value)}
                  aria-describedby="log-training-date-error"
                />
                {fieldErrors('dateISO').map((msg) => <p key={msg} id="log-training-date-error" className={errorTextCls}>{msg}</p>)}
              </div>
              <div>
                <label htmlFor="log-training-start" className={labelCls}>Starttidspunkt</label>
                <input
                  id="log-training-start"
                  type="time"
                  className={inputCls}
                  value={form.start}
                  onChange={(e) => update('start', e.target.value)}
                  aria-describedby="log-training-start-error"
                />
                {fieldErrors('start').map((msg) => <p key={msg} id="log-training-start-error" className={errorTextCls}>{msg}</p>)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="log-training-duration" className={labelCls}>Varighed (minutter)</label>
                <input
                  id="log-training-duration"
                  type="number"
                  min={1}
                  className={inputCls}
                  value={form.duration}
                  onChange={(e) => update('duration', e.target.value)}
                  aria-describedby="log-training-duration-error"
                />
                {fieldErrors('durationMinutes').map((msg) => <p key={msg} id="log-training-duration-error" className={errorTextCls}>{msg}</p>)}
              </div>
              <div>
                <label htmlFor="log-training-discipline" className={labelCls}>Disciplin/kategori</label>
                <select
                  id="log-training-discipline"
                  className={inputCls}
                  value={form.discipline}
                  onChange={(e) => update('discipline', e.target.value)}
                  aria-describedby="log-training-discipline-error"
                >
                  <option value="">Vælg disciplin</option>
                  {CATEGORIES.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
                {fieldErrors('discipline').map((msg) => <p key={msg} id="log-training-discipline-error" className={errorTextCls}>{msg}</p>)}
              </div>
            </div>

            <div>
              <label htmlFor="log-training-location" className={labelCls}>Lokation (valgfri)</label>
              <input
                id="log-training-location"
                type="text"
                className={inputCls}
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="F.eks. Rumble Sports"
              />
            </div>

            <div>
              <label htmlFor="log-training-intensity" className={labelCls}>Intensitet (valgfri, 1-5)</label>
              <input
                id="log-training-intensity"
                type="number"
                min={1}
                max={5}
                className={inputCls}
                value={form.intensity}
                onChange={(e) => update('intensity', e.target.value)}
                aria-describedby="log-training-intensity-error"
              />
              {fieldErrors('intensity').map((msg) => <p key={msg} id="log-training-intensity-error" className={errorTextCls}>{msg}</p>)}
            </div>

            <div>
              <label htmlFor="log-training-notes" className={labelCls}>Noter (valgfri)</label>
              <textarea
                id="log-training-notes"
                rows={3}
                className={inputCls}
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Valgfrie noter om træningen"
              />
            </div>
          </div>

          <div className={`px-5 py-3 border-t flex gap-3 ${isDark ? 'border-slate-800' : 'border-surface-border'}`}>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isDark ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-ds-text-subtle bg-surface-raised hover:bg-surface-hover'}`}
            >
              Annuller
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg disabled:opacity-60"
            >
              {saving ? 'Gemmer…' : 'Gem træning'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default LogTrainingSheet;
