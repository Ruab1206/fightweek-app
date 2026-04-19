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

export function NotesEditor({ noteKey, getNote, saveNote, isDark }: NotesEditorProps) {
  const savedText = getNote(noteKey);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(savedText);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  // Sync when external value changes (e.g. first load)
  useEffect(() => { setText(savedText); }, [savedText]);

  const handleChange = (val: string) => {
    setText(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { saveNote(noteKey, val); }, 800);
  };

  // Flush on unmount
  useEffect(() => () => clearTimeout(debounce.current), []);

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
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={3}
        className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-surface-border text-ds-text placeholder-slate-400'}`}
        placeholder="Skriv noter til denne aktivitet..."
      />
    </div>
  );
}
