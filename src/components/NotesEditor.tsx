/**
 * NotesEditor — inline collapsible plain-text note for a session or event.
 * Shows a small link that expands into a textarea. Auto-saves via debounce.
 */
import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';

interface NotesEditorProps {
  noteKey: string;
  getNote: (key: string) => string;
  saveNote: (key: string, text: string) => Promise<void>;
  isDark: boolean;
}

/**
 * Decide what the textarea should show when an external value arrives (#1189).
 * While the user is editing we keep their in-progress local text — otherwise an
 * incoming snapshot (which is trimmed) would overwrite the edit, deleting a
 * trailing space and jumping the cursor to the end. When not editing, the
 * external value wins (first load, updates from another device).
 */
export function nextNoteText(params: { local: string; external: string; isEditing: boolean }): string {
  return params.isEditing ? params.local : params.external;
}

export function NotesEditor({ noteKey, getNote, saveNote, isDark }: NotesEditorProps) {
  const savedText = getNote(noteKey);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(savedText);
  const [isFocused, setIsFocused] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Latest values for flushing a pending save on unmount without stale closures.
  const pending = useRef({ noteKey, text: savedText, dirty: false });
  pending.current.noteKey = noteKey;

  // Grow the textarea to fit its content (Google-Calendar style, #1173), capped
  // at a max height after which it scrolls. Runs after the value changes.
  const MAX_HEIGHT = 320;
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  };

  // Sync from external value only when the user isn't actively editing (#1189).
  useEffect(() => {
    const next = nextNoteText({ local: text, external: savedText, isEditing: isFocused });
    if (next !== text) setText(next);
    if (!isFocused) { pending.current.text = savedText; pending.current.dirty = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedText, isFocused]);

  // Re-fit the height whenever the value changes or the editor opens.
  useEffect(() => {
    if (isOpen) autoGrow();
  }, [text, isOpen]);

  const handleChange = (val: string) => {
    setText(val);
    pending.current.text = val;
    pending.current.dirty = true;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      saveNote(noteKey, val);
      pending.current.dirty = false;
    }, 800);
  };

  const handleBlur = () => {
    setIsFocused(false);
    clearTimeout(debounce.current);
    if (pending.current.dirty) {
      saveNote(noteKey, text);
      pending.current.dirty = false;
    }
  };

  // Flush any pending change on unmount (e.g. parent sheet closes mid-edit).
  useEffect(() => () => {
    clearTimeout(debounce.current);
    if (pending.current.dirty) saveNote(pending.current.noteKey, pending.current.text);
  }, [saveNote]);

  const hasNote = !!savedText;

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${hasNote ? 'text-blue-500' : (isDark ? 'text-slate-500 hover:text-slate-400' : 'text-ds-text-subtlest hover:text-ds-text-subtle')}`}>
        <FileText className="w-3.5 h-3.5" />
        {hasNote ? 'Vis noter' : 'Tilføj note'}
      </button>
    );
  }

  return (
    <div>
      <button onClick={() => setIsOpen(false)}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400 mb-1.5">
        <FileText className="w-3.5 h-3.5" /> Skjul noter
      </button>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        rows={3}
        className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-surface-border text-ds-text placeholder-slate-400'}`}
        placeholder="Skriv noter til denne aktivitet..."
      />
    </div>
  );
}
