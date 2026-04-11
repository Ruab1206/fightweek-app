// ──────────────────────────────────────────────
// Backlog types — ported from Toolbox, dark-theme palette
// ──────────────────────────────────────────────

export type BacklogStatus = 'backlog' | 'ready' | 'doing' | 'done';
export type BacklogPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface BacklogItem {
  id: string;
  number: number;
  title: string;
  desc: string;
  acceptance: string;
  notes: string;
  status: BacklogStatus;
  tag: string;
  priority: BacklogPriority;
  release: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  // Story map placement (optional)
  userTaskId?: string;
  releaseSliceId?: string;
  mapOrder?: number;
}

export interface FeedbackItem {
  id: string;
  text: string;
  user: string;
  userName: string;
  timestamp: string;
  context: string;
  status: 'new' | 'converted' | 'dismissed';
}

export interface BacklogData {
  items: BacklogItem[];
  feedback: FeedbackItem[];
}

/** Status display config — light palette (works for pill badges) */
export const STATUS_CONFIG: Record<BacklogStatus, { label: string; bg: string; colour: string }> = {
  backlog: { label: 'Backlog', bg: 'bg-gray-100', colour: 'text-gray-700' },
  ready:   { label: 'Ready',   bg: 'bg-blue-100', colour: 'text-blue-700' },
  doing:   { label: 'Doing',   bg: 'bg-amber-100', colour: 'text-amber-700' },
  done:    { label: 'Done',    bg: 'bg-emerald-100', colour: 'text-emerald-700' },
};

export const PRIORITY_CONFIG: Record<BacklogPriority, { label: string; colour: string }> = {
  Low:      { label: 'Low', colour: 'text-slate-400' },
  Medium:   { label: 'Medium', colour: 'text-blue-400' },
  High:     { label: 'High', colour: 'text-amber-400' },
  Critical: { label: 'Critical', colour: 'text-red-400' },
};

export const STATUS_ORDER: BacklogStatus[] = ['backlog', 'ready', 'doing', 'done'];
