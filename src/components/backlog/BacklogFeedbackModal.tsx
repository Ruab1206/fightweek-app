// ──────────────────────────────────────────────
// BacklogFeedbackModal — feedback submission (dark theme)
// Named differently from the schedule FeedbackModal
// ──────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';

interface Props {
  context?: string;
  onSubmit: (text: string, context: string) => void;
  onClose: () => void;
}

export default function BacklogFeedbackModal({ context = 'App', onSubmit, onClose }: Props) {
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 50); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), context);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">💬 Send Feedback</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-slate-400">Help us improve FightWeek! Your feedback goes directly to the team.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Context:</span>
            <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded">{context}</span>
          </div>
          <textarea
            ref={textRef} value={text} onChange={(e) => setText(e.target.value)} rows={4}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="What's on your mind? Bugs, ideas, praise — all welcome…"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-700 bg-slate-900">
          <span className="text-xs text-slate-500 mr-auto">Ctrl+Enter to send</span>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={!text.trim()} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-40">Send</button>
        </div>
      </div>
    </div>
  );
}
