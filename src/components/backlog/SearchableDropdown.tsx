// ──────────────────────────────────────────────
// SearchableDropdown — combobox
// Light: Toolbox styling · Dark: slate palette
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  allText?: string;
  allowCreate?: boolean;
  onCreate?: (value: string) => void;
  className?: string;
}

export default function SearchableDropdown({
  label, options, value, onChange, allText = 'All',
  allowCreate = false, onCreate, className = '',
}: Props) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  const canCreate = allowCreate && search.trim() && !options.some((o) => o.toLowerCase() === search.toLowerCase().trim());
  const select = (v: string) => { onChange(v); setOpen(false); setSearch(''); };
  const handleCreate = () => { const t = search.trim(); if (!t) return; onCreate?.(t); onChange(t); setOpen(false); setSearch(''); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); setSearch(''); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered.length === 1) select(filtered[0]); else if (canCreate) handleCreate(); }
  };

  const displayText = value || allText;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-sm border rounded-md transition-colors ${
          value
            ? (isDark ? 'bg-blue-900/30 border-blue-700/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700')
            : (isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')
        }`}>
        <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{label}:</span>
        <span className="font-medium truncate max-w-[120px]">{displayText}</span>
        {value ? (
          <span role="button" onClick={(e) => { e.stopPropagation(); onChange(''); }} className={`ml-0.5 ${isDark ? 'text-blue-500 hover:text-blue-300' : 'text-blue-400 hover:text-blue-600'}`} title="Clear">×</span>
        ) : (
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>▾</span>
        )}
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 z-50 border rounded-lg shadow-lg min-w-[200px] max-w-[280px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className={`p-1.5 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
            <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleKeyDown}
              className={`w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${
                isDark ? 'bg-slate-900 border-slate-600 text-slate-200 placeholder-slate-500' : 'border-gray-200'
              }`} placeholder="Search…" />
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            <button onClick={() => select('')} className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
              !value
                ? (isDark ? 'font-medium text-blue-400' : 'font-medium text-blue-600')
                : (isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-50')
            }`}>{allText}</button>
            {filtered.map((opt) => (
              <button key={opt} onClick={() => select(opt)} className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${
                opt === value
                  ? (isDark ? 'font-medium text-blue-400' : 'font-medium text-blue-600')
                  : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50')
              }`} title={opt}>{opt}</button>
            ))}
            {filtered.length === 0 && !canCreate && <div className={`px-3 py-2 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No matches</div>}
            {canCreate && (
              <button onClick={handleCreate} className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-900/30' : 'text-blue-600 hover:bg-blue-50'}`}>
                Create "<span className="font-medium">{search.trim()}</span>"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
