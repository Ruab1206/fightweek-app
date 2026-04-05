// ──────────────────────────────────────────────
// Story Map types — ported from Toolbox
// ──────────────────────────────────────────────

/** Top-level story map container */
export interface StoryMap {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Backbone level 1 — a major user activity (epic-level) */
export interface Activity {
  id: string;
  mapId: string;
  title: string;
  description: string;
  order: number;
  color: string;
}

/** Backbone level 2 — a user task under an activity */
export interface UserTask {
  id: string;
  activityId: string;
  title: string;
  description: string;
  order: number;
  pains: string[];
}

export type ReleaseStatus = 'todo' | 'doing' | 'done';

/** Horizontal swimlane — a release slice */
export interface ReleaseSlice {
  id: string;
  mapId: string;
  name: string;
  releaseNumber: string;
  objective: string;
  successMetrics: string;
  order: number;
  color: string;
  release: string;
  status?: ReleaseStatus;
}

/** Compose a display release name from number + name parts */
export function composeReleaseName(releaseNumber: string | undefined, name: string): string {
  const num = (releaseNumber ?? '').trim();
  const n = (name ?? '').trim();
  if (!n) return num;
  if (!num) return n;
  return `${num} - ${n}`;
}

/** Full data shape for story map */
export interface StoryMapData {
  maps: StoryMap[];
  activities: Activity[];
  tasks: UserTask[];
  slices: ReleaseSlice[];
  personas: Persona[];
}

/** Lightweight sketch persona — index-card style (Jeff Patton) */
export interface Persona {
  id: string;
  name: string;
  role: string;
  avatar: string;         // emoji or initials
  goals: string[];
  activities: string[];   // what do they do day-to-day?
  painPoints: string[];
  context: string;        // environment, constraints, tools
  createdAt: string;
  updatedAt: string;
}
