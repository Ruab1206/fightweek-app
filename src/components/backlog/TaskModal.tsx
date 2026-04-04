// ──────────────────────────────────────────────
// TaskModal — Create / Edit backlog item (theme-aware)
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import type { BacklogItem, BacklogStatus } from '../../types/backlog';
import { STATUS_ORDER, STATUS_CONFIG } from '../../types/backlog';
import SearchableDropdown from './SearchableDropdown';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  item: BacklogItem | null;
  onSave: (item: BacklogItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  readOnly?: boolean;
  releases?: string[];
  tags?: string[];
}

const EMPTY: BacklogItem = {
  id: '', number: 0, title: '', desc: '', acceptance: '', notes: '',
  status: 'backlog', tag: 'General', priority: 'Medium', release: '',
  order: 0, createdAt: '', updatedAt: '',
};

export default function TaskModal({ item, onSave, onDelete, onClose, readOnly = false, releases = [], tags = [] }: Props) {
  const { isDark } = useTheme();
  const [form, setForm] = useState<BacklogItem>(item ?? { ...EMPTY });
  const [dirty, setDirty] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!readOnly && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const set = useCallback(<K extends keyof BacklogItem>(key: K, value: BacklogItem[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleSave = () => {
    if (!form.title.trim()) { titleRef.current?.focus(); return; }
    onSave(form);
  };

  const handleClose = () => {
    if (!readOnly && dirty && !window.confirm('You have unsaved changes. Discard?')) return;
    onClose();
  };

  const isNew = !item;

  // Theme-aware classes
  const inputClasses = isDark
    ? `w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'opacity-60 cursor-default' : ''}`
    : `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white'}`;

  const labelClasses = isDark
    ? 'block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1'
    : 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

  const modalBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const headerBorder = isDark ? 'border-b border-slate-700' : 'border-b border-gray-200';
  const titleColor = isDark ? 'text-white' : 'text-gray-900';
  const numberColor = isDark ? 'text-slate-500' : 'text-gray-400';
  const closeBtnColor = isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-600';
  const footerClasses = isDark ? 'border-t border-slate-700 bg-slate-900' : 'border-t border-gray-200 bg-gray-50';
  const deleteColor = isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700';
  const hintColor = isDark ? 'text-slate-500' : 'text-gray-400';
  const cancelClasses = isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60" onClick={handleClose}>
      <div className={`${modalBg} rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[80vh] flex flex-col border`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 ${headerBorder}`}>
          <h2 className={`text-lg font-semibold ${titleColor}`}>
            {readOnly ? 'View Item' : isNew ? 'New Item' : 'Edit Item'}
            {!isNew && form.number > 0 && <span className={`ml-2 text-sm font-normal ${numberColor}`}>#{form.number}</span>}
          </h2>
          <button onClick={handleClose} className={`${closeBtnColor} text-xl leading-none`}>&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className={labelClasses}>Title *</label>
            <input ref={titleRef} value={form.title} onChange={(e) => set('title', e.target.value)} readOnly={readOnly} className={inputClasses} placeholder="What needs to be done?" />
          </div>

          <div>
            <label className={labelClasses}>Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} readOnly={readOnly} rows={2} className={`${inputClasses} resize-none`} placeholder="Internal notes…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as BacklogStatus)} disabled={readOnly} className={inputClasses}>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Label</label>
              {readOnly ? (
                <div className={inputClasses}>{form.tag || '—'}</div>
              ) : (
                <SearchableDropdown label="Label" options={tags} value={form.tag} onChange={(v) => set('tag', v || 'General')} allText="General" allowCreate className="w-full" />
              )}
            </div>
          </div>

          <div>
            <label className={labelClasses}>Release / Milestone</label>
            <input value={form.release} onChange={(e) => set('release', e.target.value)} readOnly={readOnly} list="release-options" className={inputClasses} placeholder="e.g. v1.0, Sprint 3" />
            <datalist id="release-options">{releases.map((r) => <option key={r} value={r} />)}</datalist>
          </div>

          <div>
            <label className={labelClasses}>Description</label>
            <textarea value={form.desc} onChange={(e) => set('desc', e.target.value)} readOnly={readOnly} rows={3} className={`${inputClasses} resize-none`} placeholder="Detailed description…" />
          </div>

          <div>
            <label className={labelClasses}>Acceptance Criteria</label>
            <textarea value={form.acceptance} onChange={(e) => set('acceptance', e.target.value)} readOnly={readOnly} rows={3} className={`${inputClasses} resize-none`} placeholder={"1. First criterion\n2. Second criterion"} />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 ${footerClasses}`}>
          <div>
            {!readOnly && !isNew && onDelete && (
              <button onClick={() => { if (window.confirm('Delete this item? This cannot be undone.')) onDelete(form.id); }} className={`${deleteColor} text-sm font-medium`}>Delete</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {readOnly ? (
              <button onClick={onClose} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">Close</button>
            ) : (
              <>
                <span className={`text-xs ${hintColor}`}>Ctrl+Enter to save</span>
                <button onClick={handleClose} className={`px-4 py-2 text-sm ${cancelClasses} rounded-lg`}>Cancel</button>
                <button onClick={handleSave} disabled={!form.title.trim()} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-40">{isNew ? 'Create' : 'Save'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
