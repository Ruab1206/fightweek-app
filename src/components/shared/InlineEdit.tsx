// ──────────────────────────────────────────────
// InlineEdit — click-to-edit text field (theme-aware)
// ──────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  tag?: 'h2' | 'h3' | 'span' | 'p';
  multiline?: boolean;
  isDark?: boolean;
}

export default function InlineEdit({ value, onSave, className = '', placeholder = 'Click to edit', tag: Tag = 'span', multiline, isDark = true }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) commit();
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  };

  if (editing) {
    const cls = `${className} w-full border-b border-blue-400 outline-none bg-transparent`;
    return multiline
      ? <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} className={cls} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={handleKey} rows={2} />
      : <input ref={ref as React.RefObject<HTMLInputElement>} className={cls} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={handleKey} />;
  }

  const hoverBg = isDark ? 'hover:bg-slate-700/50' : 'hover:bg-surface-hover';
  const emptyClass = isDark ? 'text-slate-500 italic' : 'text-ds-text-subtlest italic';

  return (
    <Tag className={`${className} cursor-pointer ${hoverBg} rounded px-0.5 -mx-0.5 ${!value ? emptyClass : ''}`}
      onClick={() => setEditing(true)}>
      {value || placeholder}
    </Tag>
  );
}
