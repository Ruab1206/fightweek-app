// ──────────────────────────────────────────────
// BoardView — Kanban columns with drag-and-drop
// Light: Toolbox styling · Dark: slate palette
// ──────────────────────────────────────────────
import { useState, useCallback } from 'react';
import type { BacklogItem } from '../../types/backlog';
import { STATUS_CONFIG, STATUS_ORDER } from '../../types/backlog';
import { sortByOrder } from '../../services/firebaseBacklogService';
import { useTheme } from '../../hooks/useTheme';

const EXIT_CRITERIA: Record<string, string> = {
  backlog: 'Exit: Title and description written. PO has prioritised it into a release.',
  ready: 'Exit: DoR completed — understanding confirmed, files identified, risks flagged.',
  doing: 'Exit: Implementation complete. Type-checked. PO verified in browser.',
  done: 'Terminal state.',
};

export default function BoardView({ items, isAdmin, onEdit, onDrop }: {
  items: BacklogItem[];
  isAdmin: boolean;
  onEdit: (item: BacklogItem) => void;
  onDrop: (itemId: string, status: BacklogItem['status'], index: number) => void;
}) {
  const { isDark } = useTheme();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: BacklogItem['status']; index: number } | null>(null);

  const calcDropIndex = useCallback((e: React.DragEvent, colItems: BacklogItem[]) => {
    const col = e.currentTarget as HTMLElement;
    const cards = Array.from(col.querySelectorAll('[data-card-id]'));
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) return i;
    }
    return colItems.length;
  }, []);

  return (
    <div className="grid grid-cols-4 gap-4 h-full min-h-0">
      {STATUS_ORDER.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const colItems = sortByOrder(items.filter((i) => i.status === status));
        const isOverThis = dropTarget?.status === status;
        return (
          <div key={status} className="flex flex-col min-h-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${cfg.bg} cursor-default`} title={EXIT_CRITERIA[status] || ''}>
              <span className={`text-sm font-semibold ${cfg.colour}`}>{cfg.label}</span>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{colItems.length}</span>
            </div>
            <div
              className={`flex-1 overflow-y-auto rounded-b-lg p-2 space-y-2 transition-colors ${
                isOverThis
                  ? (isDark ? 'bg-blue-900/20 ring-2 ring-inset ring-blue-500/50' : 'bg-blue-50 ring-2 ring-inset ring-blue-300')
                  : (isDark ? 'bg-slate-900/50' : 'bg-gray-50')
              }`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const idx = calcDropIndex(e, colItems); setDropTarget((p) => p?.status === status && p?.index === idx ? p : { status, index: idx }); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget((p) => (p?.status === status ? null : p)); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && dropTarget) onDrop(id, status, dropTarget.index); setDragId(null); setDropTarget(null); }}
            >
              {colItems.map((item, idx) => {
                const isDragging = dragId === item.id;
                const showDropBar = isOverThis && dropTarget?.index === idx;
                return (
                  <div key={item.id}>
                    {showDropBar && <div className="h-1 bg-blue-400 rounded-full mb-2 transition-all" />}
                    <div data-card-id={item.id} draggable={isAdmin}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; setDragId(item.id); }}
                      onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                      onDoubleClick={() => onEdit(item)}
                      className={`rounded-lg border p-3 shadow-sm transition-all ${isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md'} ${isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-gray-200'}`}>
                      <p className={`text-sm font-medium mb-1.5 line-clamp-2 ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                        {item.number > 0 && <span className={`text-xs mr-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>#{item.number}</span>}
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>{item.tag}</span>
                        {item.release && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{item.release}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isOverThis && dropTarget?.index === colItems.length && <div className="h-1 bg-blue-400 rounded-full transition-all" />}
              {colItems.length === 0 && !isOverThis && <p className={`text-xs text-center py-4 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>No items</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
