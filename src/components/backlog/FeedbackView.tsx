// ──────────────────────────────────────────────
// FeedbackView — inbox
// Light: Toolbox styling · Dark: slate palette
// ──────────────────────────────────────────────
import { useMemo } from 'react';
import type { BacklogData } from '../../types/backlog';
import { useTheme } from '../../hooks/useTheme';

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function FeedbackView({ feedback, isAdmin, onConvert, onDismiss, onDelete }: {
  feedback: BacklogData['feedback'];
  isAdmin: boolean;
  onConvert: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const sorted = useMemo(() => [...feedback].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [feedback]);

  return (
    <div className="space-y-3 max-w-2xl">
      {sorted.length === 0 && (
        <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No feedback yet</p>
      )}
      {sorted.map((fb) => (
        <div key={fb.id}
          className={`rounded-lg border p-4 ${
            fb.status === 'new'
              ? (isDark ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-200')
              : fb.status === 'converted'
                ? (isDark ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-white border-gray-200 opacity-60')
                : (isDark ? 'bg-slate-800 border-slate-700 opacity-40' : 'bg-white border-gray-200 opacity-40')
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {fb.userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>{fb.userName}</span>
              <span className={`text-xs ml-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{fmtDateTime(fb.timestamp)}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>{fb.context}</span>
            {fb.status !== 'new' && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                fb.status === 'converted'
                  ? (isDark ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                  : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500')
              }`}>{fb.status}</span>
            )}
          </div>
          <p className={`text-sm rounded-md px-3 py-2 ${isDark ? 'text-slate-300 bg-slate-900/50' : 'text-gray-800 bg-gray-900/5'}`}>{fb.text}</p>
          {isAdmin && fb.status === 'new' && (
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => onConvert(fb.id)} className={`text-xs font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>Create Task</button>
              <button onClick={() => onDismiss(fb.id)} className={`text-xs font-medium ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>Dismiss</button>
            </div>
          )}
          {isAdmin && (
            <button onClick={() => { if (window.confirm('Delete this feedback?')) onDelete(fb.id); }} className={`text-xs mt-1 ${isDark ? 'text-slate-600 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}>Delete</button>
          )}
        </div>
      ))}
    </div>
  );
}
