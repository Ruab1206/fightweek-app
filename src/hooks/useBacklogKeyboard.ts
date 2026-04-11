// ──────────────────────────────────────────────
// useBacklogKeyboard — keyboard shortcuts for BacklogPage
// ──────────────────────────────────────────────
import { useEffect } from 'react';
import type { BacklogItem, BacklogData } from '../types/backlog';
import {
  moveStatus, setStatus, updateItem, normalizeOrders, sortByOrder,
  batchUpdateOrders, updateItemInDb,
} from '../services/firebaseBacklogService';
import type { ShortcutEntry } from '../components/backlog/ShortcutHelpOverlay';

type ViewTab = 'board' | 'list' | 'feedback';

export interface UseBacklogKeyboardParams {
  showTaskModal: boolean;
  showFeedbackModal: boolean;
  showReleasePicker: boolean;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showShortcuts: boolean;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  filtered: BacklogItem[];
  data: BacklogData;
  persist: (d: BacklogData) => void;
  isAdmin: boolean;
  search: { handleKey: (e: KeyboardEvent) => boolean; term: string; clear: () => void };
  openEdit: (item: BacklogItem) => void;
  openCreate: () => void;
  showToast: (msg: string) => void;
  setActiveTab: React.Dispatch<React.SetStateAction<ViewTab>>;
  setShowReleasePicker: React.Dispatch<React.SetStateAction<boolean>>;
  statusFilter: string;
  tagFilter: string;
  activeTab: ViewTab;
}

export function useBacklogKeyboard(p: UseBacklogKeyboardParams): void {
  const {
    showTaskModal, showFeedbackModal, showReleasePicker, showShortcuts,
    selectedIndex, setSelectedIndex, selectedIds, setSelectedIds,
    setShowShortcuts, filtered, data, persist, isAdmin, search,
    openEdit, openCreate, showToast, setActiveTab, setShowReleasePicker,
    statusFilter, tagFilter, activeTab,
  } = p;

  // Reset selection when filters/tab change
  useEffect(() => {
    setSelectedIndex(-1);
    setSelectedIds(new Set());
  }, [activeTab, statusFilter, tagFilter, search.term]);

  // Scroll the selected row into view
  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = document.querySelector(`[data-row-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    if (showTaskModal || showFeedbackModal || showReleasePicker) return;

    const handler = (e: KeyboardEvent) => {
      if (search.handleKey(e)) return;

      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('list'); return; }
        if (e.key === '2') { e.preventDefault(); setActiveTab('board'); return; }
        if (e.key === '3') { e.preventDefault(); setActiveTab('feedback'); return; }
        if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1)); return; }
        if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((prev) => Math.max(prev - 1, 0)); return; }
        if (e.key === 't' || e.key === 'Home') { e.preventDefault(); setSelectedIndex(0); return; }
        if (e.key === 'g' || e.key === 'End') { e.preventDefault(); setSelectedIndex(Math.max(filtered.length - 1, 0)); return; }
        if (e.key === 'x') {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < filtered.length) {
            const id = filtered[selectedIndex].id;
            setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
          }
          return;
        }
        if (e.key === 'o' || e.key === 'Enter') { e.preventDefault(); if (selectedIndex >= 0 && selectedIndex < filtered.length) openEdit(filtered[selectedIndex]); return; }
        if (e.key === 'n') { e.preventDefault(); if (isAdmin) openCreate(); return; }
        if (e.key === 'f') {
          e.preventDefault();
          if (isAdmin && selectedIndex >= 0 && selectedIndex < filtered.length) {
            const targets = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : [filtered[selectedIndex]];
            const wouldDone = targets.filter(i => moveStatus(i, 'forward').status === 'done' && !i.release);
            if (wouldDone.length > 0) { showToast(`Assign a release first (r) — ${wouldDone.length} item${wouldDone.length !== 1 ? 's' : ''} missing release`); return; }
            let d = data;
            const moved: BacklogItem[] = [];
            targets.forEach(item => { const m = moveStatus(item, 'forward'); moved.push(m); d = updateItem(d, m); });
            persist(d);
            moved.forEach(m => updateItemInDb(m));
          }
          return;
        }
        if (e.key === 'a') {
          e.preventDefault();
          if (isAdmin && selectedIndex >= 0 && selectedIndex < filtered.length) {
            const targets = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : [filtered[selectedIndex]];
            let d = data;
            const moved: BacklogItem[] = [];
            targets.forEach(item => { const m = moveStatus(item, 'backward'); moved.push(m); d = updateItem(d, m); });
            persist(d);
            moved.forEach(m => updateItemInDb(m));
          }
          return;
        }
        if (e.key === 'd') {
          e.preventDefault();
          if (isAdmin && selectedIndex >= 0 && selectedIndex < filtered.length) {
            const targets = selectedIds.size > 0 ? filtered.filter(i => selectedIds.has(i.id)) : [filtered[selectedIndex]];
            const blocked = targets.filter(i => !i.release);
            if (blocked.length > 0) { showToast(`Assign a release first (r) — ${blocked.length} item${blocked.length !== 1 ? 's' : ''} missing release`); return; }
            let d = data;
            const moved: BacklogItem[] = [];
            targets.forEach(item => { const m = setStatus(item, 'done'); moved.push(m); d = updateItem(d, m); });
            persist(d);
            moved.forEach(m => updateItemInDb(m));
          }
          return;
        }
        if (e.key === 'r' && isAdmin) {
          e.preventDefault();
          if (selectedIndex >= 0 || selectedIds.size > 0) setShowReleasePicker(true);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (search.term) { search.clear(); return; }
        setSelectedIndex(-1);
        setSelectedIds(new Set());
        return;
      }
      if (e.key === 'z' && isAdmin) { e.preventDefault(); setSelectedIds(new Set()); return; }
      if (e.key === '?' || (e.shiftKey && e.key === '?')) { e.preventDefault(); setShowShortcuts((v) => !v); return; }

      // Shift shortcuts: reorder items
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Helper: optimistic local persist + Firestore batch write
        const persistReorder = (reordered: BacklogItem[]) => {
          const next = normalizeOrders(data, reordered);
          persist(next);
          const updates = next.items
            .filter((item) => item.order !== data.items.find((o) => o.id === item.id)?.order)
            .map((item) => ({ id: item.id, order: item.order }));
          if (updates.length > 0) batchUpdateOrders(updates);
        };

        if ((e.key === 'J' || e.key === 'ArrowDown') && isAdmin && selectedIndex >= 0 && selectedIndex < filtered.length - 1) {
          e.preventDefault();
          const sorted = sortByOrder(filtered);
          const moveIds = selectedIds.size > 0 ? selectedIds : new Set([sorted[selectedIndex].id]);
          let bottomIdx = -1;
          sorted.forEach((item, i) => { if (moveIds.has(item.id) && i > bottomIdx) bottomIdx = i; });
          if (bottomIdx >= sorted.length - 1) return;
          const selected = sorted.filter(i => moveIds.has(i.id));
          const rest = sorted.filter(i => !moveIds.has(i.id));
          const belowItem = sorted[bottomIdx + 1];
          const restIdx = rest.indexOf(belowItem);
          const reordered = [...rest.slice(0, restIdx + 1), ...selected, ...rest.slice(restIdx + 1)];
          persistReorder(reordered);
          setSelectedIndex(selectedIndex + 1);
          return;
        }
        if ((e.key === 'K' || e.key === 'ArrowUp') && isAdmin && selectedIndex > 0 && selectedIndex < filtered.length) {
          e.preventDefault();
          const sorted = sortByOrder(filtered);
          const moveIds = selectedIds.size > 0 ? selectedIds : new Set([sorted[selectedIndex].id]);
          let topIdx = sorted.length;
          sorted.forEach((item, i) => { if (moveIds.has(item.id) && i < topIdx) topIdx = i; });
          if (topIdx <= 0) return;
          const selected = sorted.filter(i => moveIds.has(i.id));
          const rest = sorted.filter(i => !moveIds.has(i.id));
          const aboveItem = sorted[topIdx - 1];
          const restIdx = rest.indexOf(aboveItem);
          const reordered = [...rest.slice(0, restIdx), ...selected, ...rest.slice(restIdx)];
          persistReorder(reordered);
          setSelectedIndex(selectedIndex - 1);
          return;
        }
        if ((e.key === 'T' || e.key === 'Home') && isAdmin && selectedIndex >= 0 && selectedIndex < filtered.length) {
          e.preventDefault();
          const sorted = sortByOrder(filtered);
          const moveIds = selectedIds.size > 0 ? selectedIds : new Set([sorted[selectedIndex].id]);
          const selected = sorted.filter(i => moveIds.has(i.id));
          const rest = sorted.filter(i => !moveIds.has(i.id));
          persistReorder([...selected, ...rest]);
          setSelectedIndex(0);
          return;
        }
        if ((e.key === 'G' || e.key === 'End') && isAdmin && selectedIndex >= 0 && selectedIndex < filtered.length) {
          e.preventDefault();
          const sorted = sortByOrder(filtered);
          const moveIds = selectedIds.size > 0 ? selectedIds : new Set([sorted[selectedIndex].id]);
          const selected = sorted.filter(i => moveIds.has(i.id));
          const rest = sorted.filter(i => !moveIds.has(i.id));
          const reordered = [...rest, ...selected];
          persistReorder(reordered);
          setSelectedIndex(reordered.length - selected.length);
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showTaskModal, showFeedbackModal, showReleasePicker, showShortcuts, filtered, selectedIndex, selectedIds, isAdmin, search, openEdit, openCreate, data, persist, showToast, setActiveTab, setShowReleasePicker, setSelectedIndex, setSelectedIds, setShowShortcuts]);
}

// Keyboard shortcut definitions
export const BACKLOG_SHORTCUTS: ShortcutEntry[] = [
  { section: 'Navigation' },
  { key: 'j / ↓', desc: 'Next item' },
  { key: 'k / ↑', desc: 'Previous item' },
  { key: 't / Home', desc: 'Jump to top' },
  { key: 'g / End', desc: 'Jump to bottom' },
  { key: '1', desc: 'List view' },
  { key: '2', desc: 'Board view' },
  { key: '3', desc: 'Feedback view' },
  { key: 'o / Enter', desc: 'Open selected item' },
  { key: 'æ / Æ', desc: 'Focus search field' },
  { key: 'Esc', desc: 'Blur search → close help → clear filter → clear selection' },
  { section: 'Selection' },
  { key: 'x', desc: 'Toggle selection on focused item' },
  { key: 'z', desc: 'Deselect all', role: 'admin' },
  { key: 'Shift+Click', desc: 'Select range from focused to clicked' },
  { key: 'Ctrl+Click', desc: 'Add / remove item from selection' },
  { section: 'Status', role: 'admin' },
  { key: 'f', desc: 'Move forward (bulk if multi-selected)', role: 'admin' },
  { key: 'a', desc: 'Move backward (bulk if multi-selected)', role: 'admin' },
  { key: 'd', desc: 'Mark as done (bulk if multi-selected)', role: 'admin' },
  { key: 'r', desc: 'Assign release (bulk if multi-selected)', role: 'admin' },
  { section: 'Reorder', role: 'admin' },
  { key: 'n', desc: 'New item', role: 'admin' },
  { key: 'Shift+J / Shift+↓', desc: 'Move item(s) down', role: 'admin' },
  { key: 'Shift+K / Shift+↑', desc: 'Move item(s) up', role: 'admin' },
  { key: 'Shift+T / Shift+Home', desc: 'Move item(s) to top', role: 'admin' },
  { key: 'Shift+G / Shift+End', desc: 'Move item(s) to bottom', role: 'admin' },
  { key: 'Drag', desc: 'Reorder by dragging (list & board)', role: 'admin' },
  { section: 'In edit modal' },
  { key: 'Ctrl+Enter', desc: 'Save', role: 'admin' },
  { key: 'Esc', desc: 'Close modal' },
  { section: '' },
  { key: '?', desc: 'Show / hide this help' },
];
