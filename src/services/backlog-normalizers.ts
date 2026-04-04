// ──────────────────────────────────────────────
// Backlog — normalize / default helpers
// ──────────────────────────────────────────────
import type { BacklogData, BacklogItem } from '../types/backlog';
import { STATUS_ORDER } from '../types/backlog';

const VALID_STATUSES = new Set<string>(STATUS_ORDER);

/** Coerce a Firestore Timestamp (or any non-string) to an ISO string. */
function toISOString(val: unknown): string {
  if (typeof val === 'string' && val.length > 0) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return new Date().toISOString();
}

/** Ensure every field on a BacklogItem has a safe default. */
export function ensureItemDefaults(item: Partial<BacklogItem>): BacklogItem {
  return {
    id: item.id || crypto.randomUUID(),
    number: item.number ?? 0,
    title: item.title || '',
    desc: item.desc || '',
    acceptance: item.acceptance || '',
    notes: item.notes || '',
    status: (item.status && VALID_STATUSES.has(item.status) ? item.status : 'backlog') as BacklogItem['status'],
    tag: item.tag || 'General',
    priority: item.priority || 'Medium',
    release: item.release || '',
    order: item.order ?? 0,
    createdAt: toISOString(item.createdAt),
    updatedAt: toISOString(item.updatedAt),
    // Story-map placement (optional, preserved if present)
    ...(item.userTaskId != null ? { userTaskId: item.userTaskId } : {}),
    ...(item.releaseSliceId != null ? { releaseSliceId: item.releaseSliceId } : {}),
    ...(item.mapOrder != null ? { mapOrder: item.mapOrder } : {}),
  };
}

/**
 * Assign running numbers to items that don't have one.
 * Numbers are assigned by creation date (oldest first) so they're stable.
 * Items that already have a number > 0 are never reassigned.
 */
export function backfillNumbers(data: BacklogData): BacklogData {
  const needsNumber = data.items.filter((i) => !i.number || i.number <= 0);
  if (needsNumber.length === 0) return data;

  // Find the current max across ALL items (including those with numbers)
  let maxNum = data.items.reduce((max, i) => Math.max(max, i.number ?? 0), 0);
  const byDate = [...needsNumber].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const assignments = new Map<string, number>();
  for (const item of byDate) {
    maxNum += 1;
    assignments.set(item.id, maxNum);
  }

  return {
    ...data,
    items: data.items.map((i) => {
      const num = assignments.get(i.id);
      return num != null ? { ...i, number: num } : i;
    }),
  };
}

/**
 * Detect and fix order values that look like Date.now() timestamps.
 * If any order > 1_000_000_000 (i.e. looks like a millisecond timestamp),
 * re-normalize ALL orders to clean 0, 1000, 2000... sorted by createdAt (newest first).
 * Returns { data, changed } — `changed` contains items whose order was updated.
 */
export function normalizeTimestampOrders(data: BacklogData): { data: BacklogData; changed: BacklogItem[] } {
  const hasTimestampOrders = data.items.some((i) => Math.abs(i.order) > 1_000_000_000);
  if (!hasTimestampOrders) return { data, changed: [] };

  // Sort newest-first so newest items are at the top (lowest order)
  const sorted = [...data.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const orderMap = new Map<string, number>();
  sorted.forEach((item, idx) => orderMap.set(item.id, idx * 1000));

  const changed: BacklogItem[] = [];
  const items = data.items.map((i) => {
    const newOrder = orderMap.get(i.id) ?? i.order;
    if (newOrder !== i.order) {
      const updated = { ...i, order: newOrder };
      changed.push(updated);
      return updated;
    }
    return i;
  });

  return { data: { ...data, items }, changed };
}
