// ──────────────────────────────────────────────
// PersonaCard — sketch persona index-card (Jeff Patton style)
// Inline editable, deletable, collapsible, theme-aware
// Adopted from Toolbox pattern
// ──────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import type { Persona } from '../../types/story-map';
import { Pencil, Trash2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  persona: Persona;
  isDark: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdate: (id: string, patch: Partial<Persona>) => void;
  onDelete: (id: string) => void;
}

export default function PersonaCard({ persona, isDark, collapsed, onToggleCollapse, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(persona);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(persona); }, [persona]);
  useEffect(() => { if (editing) nameRef.current?.focus(); }, [editing]);

  const save = () => {
    onUpdate(persona.id, draft);
    setEditing(false);
  };
  const cancel = () => { setDraft(persona); setEditing(false); };

  const updateList = (field: 'goals' | 'activities' | 'painPoints', idx: number, val: string) => {
    const arr = [...draft[field]];
    arr[idx] = val;
    setDraft({ ...draft, [field]: arr });
  };
  const addToList = (field: 'goals' | 'activities' | 'painPoints') => {
    setDraft({ ...draft, [field]: [...draft[field], ''] });
  };
  const removeFromList = (field: 'goals' | 'activities' | 'painPoints', idx: number) => {
    setDraft({ ...draft, [field]: draft[field].filter((_: string, i: number) => i !== idx) });
  };

  // Theme classes
  const card = isDark
    ? 'border-slate-700 bg-slate-900 shadow-md hover:shadow-lg'
    : 'border-gray-200 bg-white shadow-sm hover:shadow-md';
  const headerBorder = isDark ? 'border-slate-800' : 'border-gray-100';
  const nameText = isDark ? 'text-white' : 'text-gray-900';
  const roleText = isDark ? 'text-slate-400' : 'text-gray-500';
  const labelText = isDark ? 'text-slate-300' : 'text-gray-700';
  const bodyText = isDark ? 'text-slate-400' : 'text-gray-600';
  const mutedText = isDark ? 'text-slate-500' : 'text-gray-400';
  const inputCls = isDark
    ? 'bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500'
    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500';
  const btnGhost = isDark
    ? 'text-slate-500 hover:text-slate-300'
    : 'text-gray-400 hover:text-gray-600';

  // When editing, always show body
  const showBody = editing || !collapsed;

  return (
    <div className={`border rounded-xl transition-shadow max-w-sm w-full ${card}`}>
      {/* Header — always visible, clickable to collapse/expand */}
      <div
        className={`flex items-center gap-3 p-4 cursor-pointer select-none ${showBody ? `border-b ${headerBorder}` : ''}`}
        onClick={() => { if (!editing) onToggleCollapse(); }}
      >
        <span className="text-3xl select-none">{editing
          ? <input className={`text-3xl w-12 text-center border rounded ${inputCls}`} value={draft.avatar}
              onClick={e => e.stopPropagation()}
              onChange={e => setDraft({ ...draft, avatar: e.target.value })} />
          : persona.avatar
        }</span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <>
              <input ref={nameRef} className={`font-semibold w-full border-b outline-none ${inputCls} bg-transparent`}
                onClick={e => e.stopPropagation()}
                value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              <input className={`text-sm w-full border-b outline-none mt-1 ${inputCls} bg-transparent`}
                onClick={e => e.stopPropagation()}
                value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })} placeholder="Role" />
            </>
          ) : (
            <>
              <h3 className={`font-semibold truncate ${nameText}`}>{persona.name}</h3>
              <p className={`text-sm truncate ${roleText}`}>{persona.role}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {editing ? (
            <>
              <button onClick={save} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              <button onClick={cancel} className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className={`p-1 ${btnGhost}`} title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(persona.id)} className={`p-1 ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`} title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {/* Collapse chevron */}
          {!editing && (
            <button onClick={onToggleCollapse} className={`p-1 ${btnGhost}`} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Body — hidden when collapsed */}
      {showBody && (
        <div className="p-4 space-y-3 text-sm">
          <ListSection label="🎯 Goals" items={editing ? draft.goals : persona.goals} field="goals"
            editing={editing} onUpdate={updateList} onAdd={addToList} onRemove={removeFromList}
            isDark={isDark} labelText={labelText} bodyText={bodyText} mutedText={mutedText} inputCls={inputCls} />
          <ListSection label="📋 Activities" items={editing ? draft.activities : persona.activities} field="activities"
            editing={editing} onUpdate={updateList} onAdd={addToList} onRemove={removeFromList}
            isDark={isDark} labelText={labelText} bodyText={bodyText} mutedText={mutedText} inputCls={inputCls} />
          <ListSection label="😤 Pain Points" items={editing ? draft.painPoints : persona.painPoints} field="painPoints"
            editing={editing} onUpdate={updateList} onAdd={addToList} onRemove={removeFromList}
            isDark={isDark} labelText={labelText} bodyText={bodyText} mutedText={mutedText} inputCls={inputCls} />

          {/* Context */}
          <div>
            <span className={`font-medium ${labelText}`}>🌍 Context</span>
            {editing ? (
              <textarea className={`mt-1 w-full text-sm border rounded p-2 outline-none resize-none ${inputCls}`}
                rows={2} value={draft.context} onChange={e => setDraft({ ...draft, context: e.target.value })} />
            ) : (
              <p className={`mt-1 ${bodyText}`}>{persona.context || '—'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────── Reusable list section ──────────

function ListSection({ label, items, field, editing, onUpdate, onAdd, onRemove, isDark, labelText, bodyText, mutedText, inputCls }: {
  label: string;
  items: string[];
  field: 'goals' | 'activities' | 'painPoints';
  editing: boolean;
  onUpdate: (field: 'goals' | 'activities' | 'painPoints', idx: number, val: string) => void;
  onAdd: (field: 'goals' | 'activities' | 'painPoints') => void;
  onRemove: (field: 'goals' | 'activities' | 'painPoints', idx: number) => void;
  isDark: boolean;
  labelText: string;
  bodyText: string;
  mutedText: string;
  inputCls: string;
}) {
  return (
    <div>
      <span className={`font-medium ${labelText}`}>{label}</span>
      {items.length === 0 && !editing && <p className={`mt-1 ${mutedText}`}>—</p>}
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1">
            {editing ? (
              <>
                <input className={`flex-1 border-b outline-none text-sm py-0.5 bg-transparent ${inputCls}`}
                  value={item} onChange={e => onUpdate(field, i, e.target.value)} />
                <button onClick={() => onRemove(field, i)} className={`shrink-0 mt-0.5 ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <span className={`shrink-0 ${mutedText}`}>•</span>
                <span className={bodyText}>{item}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <button onClick={() => onAdd(field)} className="mt-1 text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </button>
      )}
    </div>
  );
}
