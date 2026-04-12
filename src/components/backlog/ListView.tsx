// ──────────────────────────────────────────────
// ListView — table rows with multi-select & drag-and-drop
// Light: Toolbox styling · Dark: slate palette
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import type { BacklogItem } from '../../types/backlog';
import { STATUS_CONFIG } from '../../types/backlog';
import { sortByOrder } from '../../services/firebaseBacklogService';
import { useTheme } from '../../hooks/useTheme';

export default function ListView({ items, isAdmin, selectedIndex, selectedIds, onSelect, onEdit, onStatusChange, onDelete, onReorder }: {
  items: BacklogItem[];
  isAdmin: boolean;
  selectedIndex: number;
  selectedIds: Set<string>;
  onSelect: (idx: number, e?: React.MouseEvent) => void;
  onEdit: (item: BacklogItem) => void;
  onStatusChange: (item: BacklogItem, dir: 'forward' | 'backward') => void;
  onDelete: (id: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}) {
  const { isDark } = useTheme();
  const sorted = useMemo(() => sortByOrder(items), [items]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const calcDropIdx = useCallback((e: React.DragEvent) => {
    const rows = Array.from(document.querySelectorAll('[data-row-index]'));
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) return i;
    }
    return rows.length;
  }, []);

  return (
    <div
      className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
      onDragOver={(e) => { if (!isAdmin || dragIdx === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropIdx(calcDropIdx(e)); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIdx(null); }}
      onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) onReorder(dragIdx, dropIdx); setDragIdx(null); setDropIdx(null); }}
    >
      {/* Header */}
      <div className={`grid grid-cols-12 gap-2 px-4 py-2 border-b text-xs font-semibold uppercase tracking-wide ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        <div className="col-span-5">Title</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Label</div>
        <div className="col-span-1">Release</div>
        <div className="col-span-2 text-right">{isAdmin ? 'Actions' : ''}</div>
      </div>
      {/* Rows */}
      {sorted.map((item, idx) => {
        const isSelected = selectedIds.has(item.id);
        const isFocused = idx === selectedIndex;
        const isDragging = dragIdx !== null && (selectedIds.size > 0 && selectedIds.has(sorted[dragIdx]?.id) ? isSelected : idx === dragIdx);
        const showDropBar = dropIdx === idx;

        return (
          <div key={item.id}>
            {showDropBar && <div className="h-0.5 bg-blue-400 mx-4" />}
            <div
              onClick={(e) => onSelect(idx, e)}
              onDoubleClick={() => onEdit(item)}
              data-row-index={idx}
              draggable={isAdmin}
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx); }}
              onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
              className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b items-center text-sm transition-all ${
                isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              } ${isDragging ? 'opacity-40 scale-[0.98]' : ''} ${
                isFocused
                  ? (isDark ? 'bg-blue-900/30 ring-2 ring-inset ring-blue-500' : 'bg-blue-50 ring-2 ring-inset ring-blue-400')
                  : isSelected
                    ? (isDark ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'bg-blue-50/60 border-l-2 border-l-blue-400')
                    : (isDark ? 'border-slate-700/50 hover:bg-slate-700/50' : 'border-gray-100 hover:bg-gray-50')
              }`}
            >
              <div className={`col-span-5 truncate font-medium ${isDark ? 'text-slate-200' : 'text-gray-900'}`} title={item.title}>
                {isSelected && <span className="text-blue-400 mr-1.5">✓</span>}
                {item.number > 0 && <span className={`text-xs mr-1.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>#{item.number}</span>}
                {item.title}
              </div>
              <div className="col-span-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${(STATUS_CONFIG[item.status] ?? STATUS_CONFIG.backlog).bg} ${(STATUS_CONFIG[item.status] ?? STATUS_CONFIG.backlog).colour}`}>
                  {(STATUS_CONFIG[item.status] ?? STATUS_CONFIG.backlog).label}
                </span>
              </div>
              <div className={`col-span-2 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{item.tag}</div>
              <div className={`col-span-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{item.release || '—'}</div>
              <div className="col-span-2 flex items-center justify-end gap-1">
                {isAdmin && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className={`p-1 ${isDark ? 'text-slate-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-600'}`} title="Edit">✏️</button>
                    {item.status !== 'backlog' && <button onClick={(e) => { e.stopPropagation(); onStatusChange(item, 'backward'); }} className={`p-1 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`} title="Move back">←</button>}
                    {item.status !== 'done' && <button onClick={(e) => { e.stopPropagation(); onStatusChange(item, 'forward'); }} className={`p-1 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`} title="Move forward">→</button>}
                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this item?')) onDelete(item.id); }} className={`p-1 ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}`} title="Delete">🗑</button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {dropIdx === sorted.length && <div className="h-0.5 bg-blue-400 mx-4" />}
      {sorted.length === 0 && <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No items match your filters</p>}
    </div>
  );
}
