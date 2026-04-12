// ──────────────────────────────────────────────
// ShortcutHelpOverlay — dark-theme keyboard help
// ──────────────────────────────────────────────
import { useEffect, useMemo } from 'react';

export interface ShortcutEntry {
  section?: string;
  key?: string;
  desc?: string;
  scope?: 'global' | 'page';
  role?: 'admin' | 'all';
}

interface Props {
  shortcuts: ShortcutEntry[];
  onClose: () => void;
  isAdmin?: boolean;
}

export default function ShortcutHelpOverlay({ shortcuts, onClose, isAdmin = false }: Props) {
  const visible = useMemo(() => {
    return shortcuts.filter((s) => {
      if (s.section !== undefined && !s.key) return true;
      if (s.role === 'admin' && !isAdmin) return false;
      return true;
    });
  }, [shortcuts, isAdmin]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">⌨ Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {visible.map((item, i) =>
            'section' in item && item.section !== undefined && !('key' in item && item.key) ? (
              item.section ? (
                <h3 key={i} className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2 first:mt-0">{item.section}</h3>
              ) : (
                <div key={i} className="border-t border-slate-700 my-3" />
              )
            ) : (
              <div key={i} className="flex items-center justify-between py-1.5 gap-2">
                <span className="text-sm text-slate-300 flex items-center gap-1.5">
                  {item.desc}
                  {item.scope === 'global' && (
                    <span className="text-[9px] px-1 py-px rounded bg-blue-900/50 text-blue-400 font-medium uppercase">global</span>
                  )}
                </span>
                <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-900 text-slate-300 rounded border border-slate-600 shrink-0">{item.key}</kbd>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
