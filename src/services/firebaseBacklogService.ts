// ──────────────────────────────────────────────
// Firebase Backlog Service — Firestore-backed
// Same interface as Toolbox backlogService, backed by
// Firestore real-time sync instead of JSON file API.
// ──────────────────────────────────────────────
import {
  collection, doc, onSnapshot, query,
  addDoc, updateDoc, deleteDoc, writeBatch, deleteField,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { BacklogItem, BacklogData, BacklogStatus, FeedbackItem } from '../types/backlog';
import { STATUS_ORDER } from '../types/backlog';
import { ensureItemDefaults, backfillNumbers, normalizeTimestampOrders } from './backlog-normalizers';

// ────────── Real-time subscription ──────────

/** Subscribe to backlog + feedback collections. Returns unsubscribe function. */
export function subscribeBacklog(
  callback: (data: BacklogData) => void,
  onError?: (err: Error) => void,
): () => void {
  let items: BacklogItem[] = [];
  let feedback: FeedbackItem[] = [];
  let gotItems = false;
  let gotFeedback = false;

  const emit = () => {
    if (!gotItems || !gotFeedback) return;
    let data = backfillNumbers({ items, feedback });

    // Fix orders that look like Date.now() timestamps (one-time migration)
    const { data: normalized, changed: orderFixed } = normalizeTimestampOrders(data);
    data = normalized;

    // Persist any fixes back to Firestore so they stick
    const numbersToSave = data.items.filter((item) => {
      const original = items.find((i) => i.id === item.id);
      return original && item.number > 0 && (original.number ?? 0) !== item.number;
    });
    const allToSave = [...orderFixed];
    // Merge number fixes into the save list
    for (const item of numbersToSave) {
      if (!allToSave.find((i) => i.id === item.id)) allToSave.push(item);
    }
    if (allToSave.length > 0) {
      const batch = writeBatch(db);
      for (const item of allToSave) {
        batch.update(doc(db, PUBLIC_DATA_PATH, 'backlog', item.id), { order: item.order, number: item.number });
      }
      batch.commit().catch((err) => console.warn('[backlog] failed to persist normalised data:', err));
    }

    callback(data);
  };

  const handleError = (err: Error) => {
    console.error('[subscribeBacklog] error:', err);
    onError?.(err);
  };

  const unsubItems = onSnapshot(
    query(collection(db, PUBLIC_DATA_PATH, 'backlog')),
    (snap) => {
      items = snap.docs.map((d) => ensureItemDefaults({ id: d.id, ...d.data() } as Partial<BacklogItem>));
      gotItems = true;
      emit();
    },
    handleError,
  );

  const unsubFeedback = onSnapshot(
    query(collection(db, PUBLIC_DATA_PATH, 'feedback')),
    (snap) => {
      feedback = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackItem));
      gotFeedback = true;
      emit();
    },
    handleError,
  );

  return () => { unsubItems(); unsubFeedback(); };
}

// ────────── CRUD — Items ──────────

export async function createItemInDb(item: Partial<BacklogItem>): Promise<void> {
  const full = ensureItemDefaults(item);
  const { id, ...rest } = full;
  await addDoc(collection(db, PUBLIC_DATA_PATH, 'backlog'), rest);
}

export async function updateItemInDb(item: BacklogItem): Promise<void> {
  const { id, ...rest } = { ...item, updatedAt: new Date().toISOString() };
  // Convert undefined values to deleteField() so Firestore actually removes them
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(rest)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', id), payload);
}

export async function deleteItemFromDb(id: string): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'backlog', id));
}

export async function deleteItemsFromDb(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, PUBLIC_DATA_PATH, 'backlog', id)));
  await batch.commit();
}

/** Batch-update order values for multiple items. */
export async function batchUpdateOrders(updates: { id: string; order: number }[]): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  updates.forEach(({ id, order }) => {
    batch.update(doc(db, PUBLIC_DATA_PATH, 'backlog', id), { order, updatedAt: now });
  });
  await batch.commit();
}

/** Batch-update the release field for multiple items. */
export async function batchUpdateRelease(ids: string[], release: string): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  ids.forEach((id) => {
    batch.update(doc(db, PUBLIC_DATA_PATH, 'backlog', id), { release, updatedAt: now });
  });
  await batch.commit();
}

// ────────── CRUD — Feedback ──────────

export async function addFeedbackToDb(fb: Omit<FeedbackItem, 'id'>): Promise<void> {
  await addDoc(collection(db, PUBLIC_DATA_PATH, 'feedback'), fb);
}

export async function updateFeedbackStatusInDb(fbId: string, status: FeedbackItem['status']): Promise<void> {
  await updateDoc(doc(db, PUBLIC_DATA_PATH, 'feedback', fbId), { status });
}

export async function deleteFeedbackFromDb(fbId: string): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_DATA_PATH, 'feedback', fbId));
}

// ────────── Pure functions (no Firestore) ──────────

export function createItem(data: BacklogData, partial: Partial<BacklogItem>, afterId?: string): BacklogData {
  const now = new Date().toISOString();
  let order: number;
  if (afterId) {
    const afterItem = data.items.find((i) => i.id === afterId);
    const afterIdx = afterItem ? sortByOrder(data.items).indexOf(afterItem) : -1;
    const sorted = sortByOrder(data.items);
    const after = afterIdx >= 0 ? sorted[afterIdx].order : null;
    const before = afterIdx + 1 < sorted.length ? sorted[afterIdx + 1].order : null;
    order = reorderBetween(after, before);
  } else {
    // New items go to the TOP of the backlog (lowest order value)
    order = data.items.length > 0 ? Math.min(...data.items.map((i) => i.order)) - 1000 : 0;
  }

  // Assign the next sequential number (always max + 1)
  const maxNum = data.items.reduce((max, i) => Math.max(max, i.number ?? 0), 0);
  const item = ensureItemDefaults({
    ...partial,
    id: partial.id || crypto.randomUUID(),
    number: maxNum + 1,
    order,
    createdAt: now,
    updatedAt: now,
  });

  return { ...data, items: [...data.items, item] };
}

export function updateItem(data: BacklogData, item: BacklogItem): BacklogData {
  return {
    ...data,
    items: data.items.map((i) =>
      i.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : i,
    ),
  };
}

export function deleteItem(data: BacklogData, id: string): BacklogData {
  return { ...data, items: data.items.filter((i) => i.id !== id) };
}

export function moveStatus(item: BacklogItem, direction: 'forward' | 'backward'): BacklogItem {
  const idx = STATUS_ORDER.indexOf(item.status);
  const next = direction === 'forward'
    ? Math.min(idx + 1, STATUS_ORDER.length - 1)
    : Math.max(idx - 1, 0);
  return { ...item, status: STATUS_ORDER[next], updatedAt: new Date().toISOString() };
}

export function setStatus(item: BacklogItem, status: BacklogStatus): BacklogItem {
  return { ...item, status, updatedAt: new Date().toISOString() };
}

// ────────── Filtering ──────────

export function filterItems(
  items: BacklogItem[],
  statusFilter: 'active' | 'done' | 'all',
  tagFilter: string,
  searchTerm: string,
): BacklogItem[] {
  let result = items;
  if (statusFilter === 'active') result = result.filter((i) => i.status !== 'done');
  else if (statusFilter === 'done') result = result.filter((i) => i.status === 'done');

  if (tagFilter && tagFilter !== 'All') result = result.filter((i) => i.tag === tagFilter);

  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    const numQuery = q.startsWith('#') ? q.slice(1) : q;
    result = result.filter(
      (i) =>
        String(i.number) === numQuery ||
        String(i.number).includes(numQuery) ||
        i.title.toLowerCase().includes(q) ||
        i.desc.toLowerCase().includes(q) ||
        i.release.toLowerCase().includes(q) ||
        i.tag.toLowerCase().includes(q),
    );
  }
  return result;
}

export function sortByOrder(items: BacklogItem[]): BacklogItem[] {
  return [...items].sort((a, b) => {
    const orderDiff = a.order - b.order;
    if (orderDiff !== 0) return orderDiff;
    const dateDiff = a.createdAt.localeCompare(b.createdAt);
    if (dateDiff !== 0) return dateDiff;
    return a.id.localeCompare(b.id);
  });
}

export function getUniqueTags(items: BacklogItem[]): string[] {
  const tags = new Set(items.map((i) => i.tag).filter(Boolean));
  return Array.from(tags).sort();
}

export function getTagsByFrequency(items: BacklogItem[]): string[] {
  const freq = new Map<string, number>();
  for (const i of items) if (i.tag) freq.set(i.tag, (freq.get(i.tag) || 0) + 1);
  return Array.from(freq.keys()).sort((a, b) => {
    const diff = (freq.get(b) || 0) - (freq.get(a) || 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

export function getUniqueReleases(items: BacklogItem[]): string[] {
  const freq = new Map<string, number>();
  for (const item of items) {
    if (!item.release) continue;
    freq.set(item.release, (freq.get(item.release) ?? 0) + 1);
  }
  return Array.from(freq.keys()).sort((a, b) => {
    const diff = (freq.get(b) ?? 0) - (freq.get(a) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

export function getItemsByStatus(items: BacklogItem[], status: BacklogStatus): BacklogItem[] {
  return sortByOrder(items.filter((i) => i.status === status));
}

// ────────── Reorder helpers ──────────

export function moveItemToColumn(
  data: BacklogData,
  itemId: string,
  targetStatus: BacklogStatus,
  targetIndex: number,
): BacklogData {
  const item = data.items.find((i) => i.id === itemId);
  if (!item) return data;
  const colItems = sortByOrder(data.items.filter((i) => i.status === targetStatus && i.id !== itemId));
  const clamped = Math.max(0, Math.min(targetIndex, colItems.length));
  const before = clamped > 0 ? colItems[clamped - 1].order : null;
  const after = clamped < colItems.length ? colItems[clamped].order : null;
  const newOrder = reorderBetween(before, after);
  return {
    ...data,
    items: data.items.map((i) =>
      i.id === itemId
        ? { ...i, status: targetStatus, order: newOrder, updatedAt: new Date().toISOString() }
        : i,
    ),
  };
}

export function reorderItem(data: BacklogData, itemId: string, newOrder: number): BacklogData {
  return {
    ...data,
    items: data.items.map((i) =>
      i.id === itemId ? { ...i, order: newOrder, updatedAt: new Date().toISOString() } : i,
    ),
  };
}

export function normalizeOrders(data: BacklogData, sortedItems: BacklogItem[]): BacklogData {
  let result = data;
  sortedItems.forEach((item, idx) => {
    const target = idx * 1000;
    if (item.order !== target) result = reorderItem(result, item.id, target);
  });
  return result;
}

export function reorderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

// ────────── Feedback pure functions ──────────

export function addFeedback(data: BacklogData, fb: Omit<FeedbackItem, 'id'>): BacklogData {
  const item: FeedbackItem = { ...fb, id: crypto.randomUUID() };
  return { ...data, feedback: [item, ...data.feedback] };
}

export function updateFeedbackStatus(data: BacklogData, fbId: string, status: FeedbackItem['status']): BacklogData {
  return { ...data, feedback: data.feedback.map((f) => (f.id === fbId ? { ...f, status } : f)) };
}

export function deleteFeedback(data: BacklogData, fbId: string): BacklogData {
  return { ...data, feedback: data.feedback.filter((f) => f.id !== fbId) };
}

// ────────── Export helpers ──────────

export function exportCSV(items: BacklogItem[]): string {
  const headers = ['Title', 'Description', 'Acceptance Criteria', 'Notes', 'Status', 'Tag', 'Priority', 'Release', 'Order'];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = items.map((i) => [
    escape(i.title), escape(i.desc), escape(i.acceptance), escape(i.notes),
    escape(i.status), escape(i.tag), escape(i.priority), escape(i.release), String(i.order),
  ].join(','));
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function exportAIFormat(items: BacklogItem[]): string {
  return items.map((i) => [
    `TASK: ${i.title}`, `STATUS: ${i.status}`, `PRIORITY: ${i.priority}`,
    `TAG: ${i.tag}`, `DESCRIPTION: ${i.desc || '(None)'}`,
    `ACCEPTANCE CRITERIA:`, i.acceptance || '(None)',
    `NOTES: ${i.notes || '(None)'}`,
    '──────────────────────────────────────────',
  ].join('\n')).join('\n\n');
}
