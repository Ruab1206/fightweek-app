
// ──────────────────────────────────────────────
// Story Map Service — Firestore-only persistence
// Firestore is the single source of truth. No localStorage.
// ──────────────────────────────────────────────
import { doc, onSnapshot, setDoc, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type {
  StoryMapData, Activity, UserTask, ReleaseSlice, Persona,
} from '../types/story-map';

// ────────── Firestore paths ──────────
const STORY_MAP_COLLECTION = 'story-map';
const STORY_MAP_DOC = 'main';

const empty = (): StoryMapData => ({
  maps: [], activities: [], tasks: [], slices: [], personas: [],
});

// ────────── Helpers ──────────
const now = () => new Date().toISOString();
let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

// ────────── Firestore persistence ──────────

function writeToFirestore(data: StoryMapData): Promise<void> {
  return setDoc(doc(db, PUBLIC_DATA_PATH, STORY_MAP_COLLECTION, STORY_MAP_DOC), data)
    .then(() => { console.log('[story-map] Firestore write OK'); })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[story-map] Firestore write failed:', msg);
      throw err;
    });
}

// ────────── Public API ──────────

/**
 * Subscribe to story map data.
 * Firestore is the single source of truth via real-time onSnapshot.
 */
export function subscribeStoryMap(
  callback: (data: StoryMapData) => void,
  onError?: (err: Error) => void,
): () => void {
  const unsubFirestore = onSnapshot(
    doc(db, PUBLIC_DATA_PATH, STORY_MAP_COLLECTION, STORY_MAP_DOC),
    (snap: DocumentSnapshot) => {
      if (snap.exists()) {
        const raw = snap.data() as StoryMapData;
        callback({ ...empty(), ...raw });
        console.log('[story-map] Loaded from Firestore');
      } else {
        callback(empty());
      }
    },
    (err: Error) => {
      console.error('[story-map] Firestore subscription error:', err.message);
      onError?.(err);
    },
  );

  return () => { unsubFirestore(); };
}

/** Save the entire story map to Firestore. */
export async function persistStoryMapData(data: StoryMapData): Promise<void> {
  await writeToFirestore(data);
}

// ────────── Activity CRUD ──────────

export function createActivity(data: StoryMapData, mapId: string, title: string): StoryMapData {
  const maxOrder = Math.max(-1, ...data.activities.filter(a => a.mapId === mapId).map(a => a.order));
  const act: Activity = {
    id: uid('act'), mapId, title, description: '', order: maxOrder + 1, color: 'blue',
  };
  return { ...data, activities: [...data.activities, act] };
}

export function insertActivityAt(data: StoryMapData, mapId: string, title: string, atOrder: number): StoryMapData {
  const act: Activity = {
    id: uid('act'), mapId, title, description: '', order: atOrder, color: 'blue',
  };
  const activities = data.activities.map(a =>
    a.mapId === mapId && a.order >= atOrder ? { ...a, order: a.order + 1 } : a,
  );
  return { ...data, activities: [...activities, act] };
}

export function updateActivity(data: StoryMapData, id: string, patch: Partial<Activity>): StoryMapData {
  return { ...data, activities: data.activities.map(a => a.id === id ? { ...a, ...patch } : a) };
}

export function deleteActivity(data: StoryMapData, id: string): StoryMapData {
  return {
    ...data,
    activities: data.activities.filter(a => a.id !== id),
    tasks: data.tasks.filter(t => t.activityId !== id),
  };
}

export function reorderActivities(data: StoryMapData, mapId: string, orderedIds: string[]): StoryMapData {
  const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
  return {
    ...data,
    activities: data.activities.map(a =>
      a.mapId === mapId && orderMap.has(a.id) ? { ...a, order: orderMap.get(a.id)! } : a,
    ),
  };
}

// ────────── UserTask CRUD ──────────

export function createTask(data: StoryMapData, activityId: string, title: string): StoryMapData {
  const maxOrder = Math.max(-1, ...data.tasks.filter(t => t.activityId === activityId).map(t => t.order));
  const task: UserTask = {
    id: uid('task'), activityId, title, description: '', order: maxOrder + 1, pains: [],
  };
  return { ...data, tasks: [...data.tasks, task] };
}

export function insertTaskAt(data: StoryMapData, activityId: string, title: string, atOrder: number): StoryMapData {
  const task: UserTask = {
    id: uid('task'), activityId, title, description: '', order: atOrder, pains: [],
  };
  const tasks = data.tasks.map(t =>
    t.activityId === activityId && t.order >= atOrder ? { ...t, order: t.order + 1 } : t,
  );
  return { ...data, tasks: [...tasks, task] };
}

export function updateTask(data: StoryMapData, id: string, patch: Partial<UserTask>): StoryMapData {
  return { ...data, tasks: data.tasks.map(t => t.id === id ? { ...t, ...patch } : t) };
}

export function deleteTask(data: StoryMapData, id: string): StoryMapData {
  return { ...data, tasks: data.tasks.filter(t => t.id !== id) };
}

export function reorderTasks(data: StoryMapData, activityId: string, orderedIds: string[]): StoryMapData {
  const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
  return {
    ...data,
    tasks: data.tasks.map(t =>
      t.activityId === activityId && orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)! } : t,
    ),
  };
}

export function moveTask(data: StoryMapData, taskId: string, targetActivityId: string, targetOrder: number): StoryMapData {
  return {
    ...data,
    tasks: data.tasks.map(t =>
      t.id === taskId ? { ...t, activityId: targetActivityId, order: targetOrder } : t,
    ),
  };
}

// ────────── ReleaseSlice CRUD ──────────

export function createSlice(data: StoryMapData, mapId: string, name: string): StoryMapData {
  const maxOrder = Math.max(-1, ...data.slices.filter(s => s.mapId === mapId).map(s => s.order));
  const slice: ReleaseSlice = {
    id: uid('slice'), mapId, name, releaseNumber: '', objective: '', successMetrics: '',
    order: maxOrder + 1, color: 'gray', release: name,
  };
  return { ...data, slices: [...data.slices, slice] };
}

export function insertSliceAt(data: StoryMapData, mapId: string, name: string, atOrder: number): StoryMapData {
  const slice: ReleaseSlice = {
    id: uid('slice'), mapId, name, releaseNumber: '', objective: '', successMetrics: '',
    order: atOrder, color: 'gray', release: name,
  };
  const slices = data.slices.map(s =>
    s.mapId === mapId && s.order >= atOrder ? { ...s, order: s.order + 1 } : s,
  );
  return { ...data, slices: [...slices, slice] };
}

export function updateSlice(data: StoryMapData, id: string, patch: Partial<ReleaseSlice>): StoryMapData {
  return { ...data, slices: data.slices.map(s => s.id === id ? { ...s, ...patch } : s) };
}

export function deleteSlice(data: StoryMapData, id: string): StoryMapData {
  return { ...data, slices: data.slices.filter(s => s.id !== id) };
}

export function reorderSlices(data: StoryMapData, mapId: string, orderedIds: string[]): StoryMapData {
  const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
  return {
    ...data,
    slices: data.slices.map(s =>
      s.mapId === mapId && orderMap.has(s.id) ? { ...s, order: orderMap.get(s.id)! } : s,
    ),
  };
}

// ────────── Query helpers ──────────

export function getActivitiesForMap(data: StoryMapData, mapId: string): Activity[] {
  return data.activities.filter(a => a.mapId === mapId).sort((a, b) => a.order - b.order);
}

export function getTasksForActivity(data: StoryMapData, activityId: string): UserTask[] {
  return data.tasks.filter(t => t.activityId === activityId).sort((a, b) => a.order - b.order);
}

export function getSlicesForMap(data: StoryMapData, mapId: string): ReleaseSlice[] {
  return data.slices.filter(s => s.mapId === mapId).sort((a, b) => a.order - b.order);
}

// ────────── Persona CRUD ──────────

export function createPersona(data: StoryMapData, name: string, role: string): StoryMapData {
  const persona: Persona = {
    id: uid('persona'), name, role, avatar: '👤',
    goals: [], activities: [], painPoints: [], context: '',
    createdAt: now(), updatedAt: now(),
  };
  return { ...data, personas: [...data.personas, persona] };
}

export function updatePersona(data: StoryMapData, id: string, patch: Partial<Persona>): StoryMapData {
  return {
    ...data,
    personas: data.personas.map(p =>
      p.id === id ? { ...p, ...patch, updatedAt: now() } : p,
    ),
  };
}

export function deletePersona(data: StoryMapData, id: string): StoryMapData {
  return {
    ...data,
    personas: data.personas.filter(p => p.id !== id),
  };
}
