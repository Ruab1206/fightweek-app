// ──────────────────────────────────────────────
// ReleasePicker — assign release to selected items (dark theme)
// ──────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

interface Props {
  releases: string[];
  itemCount: number;
  onSelect: (release: string) => void;
  onClose: () => void;
}

export default function ReleasePicker({ releases, itemCount, onSelect, onClose }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const filtered = value
    ? releases.filter((r) => r.toLowerCase().includes(value.toLowerCase()))
    : releases;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSelect(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-sm font-semibold text-white">
            Assign release{itemCount > 1 ? ` to ${itemCount} items` : ''}
          </p>
        </div>
        <div className="px-4 py-2">
          <input
            ref={inputRef} type="text" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type or pick a release…"
          />
        </div>
        {filtered.length > 0 && (
          <div className="max-h-40 overflow-y-auto border-t border-slate-700">
            {filtered.map((r) => (
              <button key={r} onClick={() => onSelect(r)} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-blue-900/30 hover:text-blue-400 transition-colors">
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="border-t border-slate-700">
          <button onClick={() => onSelect('')} className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors">
            ✕ Remove release
          </button>
        </div>
      </div>
    </div>
  );
}
