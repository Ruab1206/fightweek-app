// StoryMapPage — Jeff Patton interactive story map (Firebase-backed, theme-aware)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { StoryMapData, Activity, UserTask, ReleaseSlice } from '../types/story-map';
import { composeReleaseName } from '../types/story-map';
import type { BacklogItem, BacklogData, BacklogStatus } from '../types/backlog';
import {
  subscribeStoryMap, persistStoryMapData,
  createActivity, insertActivityAt, updateActivity, deleteActivity,
  createTask, insertTaskAt, updateTask, deleteTask,
  createSlice, insertSliceAt, updateSlice, deleteSlice,
  getActivitiesForMap, getTasksForActivity, getSlicesForMap,
} from '../services/firebaseStoryMapService';
import {
  subscribeBacklog, updateItem, updateItemInDb, batchUpdateRelease,
} from '../services/firebaseBacklogService';
import { useToast } from '../hooks/useToast';
import { useStoryMapDrag } from '../hooks/useStoryMapDrag';
import { CYCLE_COLORS } from './StoryMapColors';
import StoryMapBackbone from './StoryMapBackbone';
import StoryMapSliceRow from './StoryMapSliceRow';
import TaskModal from '../components/backlog/TaskModal';
import { getUniqueTags, getUniqueReleases } from '../services/firebaseBacklogService';
import InlineEdit from '../components/shared/InlineEdit';
import { Plus, ChevronDown, ChevronUp, History } from 'lucide-react';

interface Props { isDark: boolean; }

// ── Error boundary to catch render crashes ──
class StoryMapErrorBoundary extends React.Component<
  { children: React.ReactNode; isDark: boolean },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) { console.error('[StoryMap] Render crash:', err, info); }
  render() {
    if (this.state.error) {
      const bg = this.props.isDark ? 'bg-slate-950' : 'bg-surface-subtle';
      const txt = this.props.isDark ? 'text-slate-200' : 'text-ds-text';
      return (
        <div className={`flex-1 flex items-center justify-center ${bg} p-8`}>
          <div className={`text-center max-w-lg ${txt}`}>
            <p className="text-xl font-bold mb-2">⚠️ Story Map Error</p>
            <p className="text-sm mb-4 opacity-70">Something went wrong rendering the story map.</p>
            <pre className={`text-xs text-left p-3 rounded-lg overflow-auto max-h-40 ${this.props.isDark ? 'bg-slate-900 text-red-300' : 'bg-red-50 text-red-700'}`}>
              {this.state.error.message}
            </pre>
            <button onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function StoryMapPage(props: Props) {
  return (
    <StoryMapErrorBoundary isDark={props.isDark}>
      <StoryMapPageInner {...props} />
    </StoryMapErrorBoundary>
  );
}

function StoryMapPageInner({ isDark }: Props) {
  const [mapData, setMapData] = useState<StoryMapData>({ maps: [], activities: [], tasks: [], slices: [], personas: [] });
  const [backlogData, setBacklogData] = useState<BacklogData>({ items: [], feedback: [] });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // UI toggles
  const [showPains, setShowPains] = useState(true);
  const [collapsedActivities, setCollapsedActivities] = useState<Set<string>>(() => {
    try { const v = localStorage.getItem('fw-sm-collapsed-act'); return v ? new Set(JSON.parse(v)) : new Set(); } catch { return new Set(); }
  });
  const [collapsedSlices, setCollapsedSlices] = useState<Set<string>>(() => {
    try { const v = localStorage.getItem('fw-sm-collapsed-slc'); return v ? new Set(JSON.parse(v)) : new Set(); } catch { return new Set(); }
  });
  const [showHistory, setShowHistory] = useState(() => {
    try { return localStorage.getItem('fw-sm-show-history') === 'true'; } catch { return false; }
  });
  useEffect(() => { localStorage.setItem('fw-sm-collapsed-act', JSON.stringify([...collapsedActivities])); }, [collapsedActivities]);
  useEffect(() => { localStorage.setItem('fw-sm-collapsed-slc', JSON.stringify([...collapsedSlices])); }, [collapsedSlices]);
  useEffect(() => { localStorage.setItem('fw-sm-show-history', String(showHistory)); }, [showHistory]);

  const toggleActivity = (id: string) => setCollapsedActivities(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSlice = (id: string) => setCollapsedSlices(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const [linkingCell, setLinkingCell] = useState<{ taskId: string; sliceId: string } | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [editingStory, setEditingStory] = useState<BacklogItem | null>(null);

  const currentMap = mapData.maps[0] ?? null;
  const mapId = currentMap?.id ?? '';

  // Subscribe to Firestore
  useEffect(() => {
    let gotMap = false, gotBacklog = false;
    const done = () => { if (gotMap && gotBacklog) setLoading(false); };
    const unsubMap = subscribeStoryMap(
      d => { setMapData(d); gotMap = true; done(); },
      err => { console.warn('[StoryMap] map subscription note:', (err as any).code || err.message); gotMap = true; done(); },
    );
    const unsubBacklog = subscribeBacklog(
      d => { setBacklogData(d); gotBacklog = true; done(); },
      err => { console.error('[StoryMap] backlog subscription error:', err); gotBacklog = true; done(); },
    );
    // Safety timeout — show UI even if subscriptions fail silently
    const timer = setTimeout(() => { if (!gotMap || !gotBacklog) { console.warn('[StoryMap] subscription timeout — showing UI'); setLoading(false); } }, 5000);
    return () => { unsubMap(); unsubBacklog(); clearTimeout(timer); };
  }, []);

  const persistMap = useCallback(async (next: StoryMapData) => {
    setMapData(next);
    try {
      await persistStoryMapData(next);
    } catch (err) {
      console.warn('[StoryMap] persist error (data safe in localStorage):', err);
    }
  }, []);

  // Derived
  const activities = useMemo(() => getActivitiesForMap(mapData, mapId), [mapData, mapId]);
  const slices = useMemo(() => getSlicesForMap(mapData, mapId), [mapData, mapId]);
  const tasksByActivity = useMemo(() => {
    const m = new Map();
    for (const act of activities) m.set(act.id, getTasksForActivity(mapData, act.id));
    return m;
  }, [mapData, activities]);
  const allTasks = useMemo(() => activities.flatMap(a => tasksByActivity.get(a.id) || []), [activities, tasksByActivity]);

  const storiesByCell = useMemo(() => {
    const m = new Map<string, BacklogItem[]>();
    for (const item of backlogData.items) {
      if (!item.userTaskId || !item.releaseSliceId) continue;
      const key = `${item.userTaskId}::${item.releaseSliceId}`;
      const arr = m.get(key) || []; arr.push(item); m.set(key, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.mapOrder ?? 0) - (b.mapOrder ?? 0));
    return m;
  }, [backlogData]);

  // One-time sync: for any mapped item whose release is empty/stale, populate from its slice
  useEffect(() => {
    if (loading || slices.length === 0) return;
    const sliceMap = new Map(slices.map(s => [s.id, s]));
    const now = new Date().toISOString();
    const toFix: BacklogItem[] = [];
    for (const item of backlogData.items) {
      if (!item.releaseSliceId) continue;
      const slice = sliceMap.get(item.releaseSliceId);
      if (!slice) continue;
      if (item.release !== slice.release && slice.release) {
        toFix.push({ ...item, release: slice.release, updatedAt: now });
      }
    }
    if (toFix.length === 0) return;
    let d = backlogData;
    toFix.forEach(item => { d = updateItem(d, item); });
    setBacklogData(d);
    // Persist to Firestore — group by release value
    const byRelease = new Map<string, string[]>();
    toFix.forEach(i => { const arr = byRelease.get(i.release) || []; arr.push(i.id); byRelease.set(i.release, arr); });
    for (const [release, ids] of byRelease) {
      batchUpdateRelease(ids, release)
        .catch(err => console.warn('[StoryMap] failed to sync releases:', err));
    }
  }, [loading, slices, backlogData.items.length]);

  // Story handlers
  const handleUpdateStory = useCallback((id: string, patch: Partial<BacklogItem>) => {
    const item = backlogData.items.find(i => i.id === id);
    if (!item) return;
    const updated = { ...item, ...patch, updatedAt: new Date().toISOString() };
    setBacklogData(updateItem(backlogData, updated));
    updateItemInDb(updated);
  }, [backlogData]);

  const handleRemoveStoryFromMap = useCallback((id: string) => {
    if (!globalThis.confirm('Remove from map? (stays in backlog)')) return;
    handleUpdateStory(id, { userTaskId: undefined, releaseSliceId: undefined, mapOrder: undefined });
  }, [handleUpdateStory]);

  const handleAddStory = useCallback((taskId: string, sliceId: string) => {
    const slice = slices.find(s => s.id === sliceId);
    const maxNum = Math.max(0, ...backlogData.items.map(i => i.number));
    const cellStories = storiesByCell.get(`${taskId}::${sliceId}`) || [];
    const maxOrder = Math.max(-1, ...cellStories.map(s => s.mapOrder ?? 0));
    const now = new Date().toISOString();
    const newItem: BacklogItem = {
      id: `item-${Date.now()}`, number: maxNum + 1, title: 'New Story', desc: '', acceptance: '', notes: '',
      status: 'backlog' as BacklogStatus, tag: '', priority: 'Medium', release: slice?.release || '',
      order: backlogData.items.length, createdAt: now, updatedAt: now,
      userTaskId: taskId, releaseSliceId: sliceId, mapOrder: maxOrder + 1,
    };
    const next = { ...backlogData, items: [...backlogData.items, newItem] };
    setBacklogData(next);
    // Save to Firestore
    import('../services/firebaseBacklogService').then(m => m.createItemInDb(newItem));
  }, [backlogData, slices, storiesByCell]);

  const unmappedStories = useMemo(() => backlogData.items.filter(i => !i.userTaskId || !i.releaseSliceId), [backlogData]);

  const handleLinkStory = useCallback((itemId: string) => {
    if (!linkingCell) return;
    const { taskId, sliceId } = linkingCell;
    const cellStories = storiesByCell.get(`${taskId}::${sliceId}`) || [];
    const maxOrder = Math.max(-1, ...cellStories.map(s => s.mapOrder ?? 0));
    const targetSlice = slices.find(s => s.id === sliceId);
    handleUpdateStory(itemId, { userTaskId: taskId, releaseSliceId: sliceId, mapOrder: maxOrder + 1, release: targetSlice?.release || '' });
    setLinkingCell(null); setLinkSearch('');
  }, [linkingCell, storiesByCell, slices, handleUpdateStory]);

  // Drag hook
  const drag = useStoryMapDrag({ mapId, activities, slices, tasksByActivity, storiesByCell, persistMap, handleUpdateStory, mapData });

  // Activity handlers
  const handleAddActivity = () => { const w = createActivity(mapData, mapId, 'New Activity'); const a = w.activities.find(x => !mapData.activities.some(o => o.id === x.id)); persistMap(a ? createTask(w, a.id, 'New Task') : w); };
  const handleInsertActivity = (o: number) => { const w = insertActivityAt(mapData, mapId, 'New Activity', o); const a = w.activities.find(x => !mapData.activities.some(y => y.id === x.id)); persistMap(a ? createTask(w, a.id, 'New Task') : w); };
  const handleUpdateActivity = (id: string, patch: Partial<Activity>) => persistMap(updateActivity(mapData, id, patch));
  const handleDeleteActivity = (id: string) => { if (!globalThis.confirm('Delete activity and all tasks?')) return; persistMap(deleteActivity(mapData, id)); };
  const handleCycleColor = (act: Activity) => { const i = CYCLE_COLORS.indexOf(act.color); persistMap(updateActivity(mapData, act.id, { color: CYCLE_COLORS[(i + 1) % CYCLE_COLORS.length] })); };

  // Task handlers
  const handleAddTask = (actId: string) => persistMap(createTask(mapData, actId, 'New Task'));
  const handleInsertTask = (actId: string, o: number) => persistMap(insertTaskAt(mapData, actId, 'New Task', o));
  const handleUpdateTask = (id: string, patch: Partial<UserTask>) => persistMap(updateTask(mapData, id, patch));
  const handleDeleteTask = (id: string) => { if (!globalThis.confirm('Delete task?')) return; persistMap(deleteTask(mapData, id)); };
  const handleAddPain = (tid: string) => { const t = mapData.tasks.find(x => x.id === tid); if (t) persistMap(updateTask(mapData, tid, { pains: [...t.pains, 'New pain'] })); };
  const handleUpdatePain = (tid: string, i: number, v: string) => { const t = mapData.tasks.find(x => x.id === tid); if (!t) return; const p = [...t.pains]; p[i] = v; persistMap(updateTask(mapData, tid, { pains: p })); };
  const handleDeletePain = (tid: string, i: number) => { const t = mapData.tasks.find(x => x.id === tid); if (t) persistMap(updateTask(mapData, tid, { pains: t.pains.filter((_, j) => j !== i) })); };

  // Slice handlers
  const handleAddSlice = () => persistMap(createSlice(mapData, mapId, 'New Release'));
  const handleInsertSlice = (o: number) => persistMap(insertSliceAt(mapData, mapId, 'New Release', o));
  const handleUpdateSlice = useCallback((id: string, patch: Partial<ReleaseSlice> & { release?: string }) => {
    const currentSlice = mapData.slices.find(s => s.id === id);
    // If name changed, recompose the release string automatically
    if (patch.name !== undefined && patch.release === undefined && currentSlice) {
      patch.release = composeReleaseName(patch.releaseNumber ?? currentSlice.releaseNumber, patch.name);
    }
    persistMap(updateSlice(mapData, id, patch));
    // Cascade release rename to all backlog items in this slice
    if (patch.release !== undefined) {
      const newRelease = patch.release;
      const affectedItems = backlogData.items.filter(i => i.releaseSliceId === id);
      if (affectedItems.length > 0) {
        const now = new Date().toISOString();
        let d = backlogData;
        affectedItems.forEach(item => {
          d = updateItem(d, { ...item, release: newRelease, updatedAt: now });
        });
        setBacklogData(d);
        batchUpdateRelease(affectedItems.map(i => i.id), newRelease)
          .catch(err => console.warn('[StoryMap] failed to cascade release update:', err));
      }
    }
  }, [mapData, backlogData, persistMap]);
  const handleDeleteSlice = (id: string) => { if (!globalThis.confirm('Delete release?')) return; persistMap(deleteSlice(mapData, id)); };
  const handleCycleSliceColor = (s: ReleaseSlice) => { const i = CYCLE_COLORS.indexOf(s.color); persistMap(updateSlice(mapData, s.id, { color: CYCLE_COLORS[(i + 1) % CYCLE_COLORS.length] })); };

  // Edit story modal
  const releases = useMemo(() => getUniqueReleases(backlogData.items), [backlogData.items]);
  const tags = useMemo(() => getUniqueTags(backlogData.items), [backlogData.items]);
  const handleSaveEditingStory = useCallback((saved: BacklogItem) => { handleUpdateStory(saved.id, saved); setEditingStory(null); }, [handleUpdateStory]);
  const handleDeleteEditingStory = useCallback((id: string) => {
    const next = { ...backlogData, items: backlogData.items.filter(i => i.id !== id) };
    setBacklogData(next);
    import('../services/firebaseBacklogService').then(m => m.deleteItemFromDb(id));
    setEditingStory(null);
  }, [backlogData]);

  // Theme classes
  const bgPage = isDark ? 'bg-slate-950' : 'bg-surface-subtle';
  const textMuted = isDark ? 'text-slate-500' : 'text-ds-text-subtlest';
  const borderBase = isDark ? 'border-slate-700' : 'border-surface-border';
  const btnSecondary = isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-surface-border text-ds-text-subtle hover:bg-surface-hover';
  const COL_W = '10rem';
  const GUTTER_W = '11rem';

  // Create a starter map with one activity, one task and one release slice
  const handleCreateMap = useCallback(() => {
    const ts = new Date().toISOString();
    const newMapId = `map-${Date.now()}`;
    let next: StoryMapData = {
      ...mapData,
      maps: [{ id: newMapId, name: 'Story Map', createdAt: ts, updatedAt: ts }],
    };
    // Seed a first activity + task + release so the board isn't blank
    next = createActivity(next, newMapId, 'User Activity 1');
    const firstAct = next.activities.find(a => a.mapId === newMapId);
    if (firstAct) next = createTask(next, firstAct.id, 'User Task 1');
    next = createSlice(next, newMapId, 'Release 1');
    persistMap(next);
  }, [mapData, persistMap]);

  if (loading) return <div className={`flex-1 flex items-center justify-center ${bgPage}`}><span className={`text-lg ${textMuted}`}>Loading story map…</span></div>;

  if (!currentMap) {
    return (
      <div className={`flex-1 flex items-center justify-center ${bgPage}`}>
        <div className="text-center">
          <p className={`text-lg mb-3 ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>No story map yet</p>
          <p className={`text-sm mb-4 ${textMuted}`}>Create one to start building your user journey.</p>
          <button onClick={handleCreateMap} className="px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium shadow-lg">
            🗺️ Create Story Map
          </button>
        </div>
      </div>
    );
  }

  const totalPains = mapData.tasks.reduce((s, t) => s + t.pains.length, 0);

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${bgPage}`} onDragEnd={drag.clearDrag}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${borderBase} shrink-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        <div>
          <InlineEdit value={currentMap.name} tag="h2" className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-ds-text'}`} isDark={isDark}
            onSave={name => persistMap({ ...mapData, maps: mapData.maps.map(m => m.id === mapId ? { ...m, name, updatedAt: new Date().toISOString() } : m) })} />
          <p className={`text-sm ${textMuted} mt-0.5`}>{activities.length} activities · {allTasks.length} tasks · {slices.length} releases</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(h => !h)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${showHistory ? (isDark ? 'bg-blue-900/40 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700') : btnSecondary}`}>
            <History size={12} /> {showHistory ? 'Hide' : 'Show'} history
          </button>
          <button onClick={() => setCollapsedActivities(p => p.size === activities.length ? new Set() : new Set(activities.map(a => a.id)))}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border ${btnSecondary} transition-colors`}>
            {collapsedActivities.size === activities.length ? <ChevronDown size={12} /> : <ChevronUp size={12} />} Activities
          </button>
          <button onClick={() => setCollapsedSlices(p => p.size === slices.length ? new Set() : new Set(slices.map(s => s.id)))}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border ${btnSecondary} transition-colors`}>
            {collapsedSlices.size === slices.length ? <ChevronDown size={12} /> : <ChevronUp size={12} />} Releases
          </button>
          <button onClick={() => setShowPains(p => !p)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${showPains ? (isDark ? 'bg-red-900/40 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700') : btnSecondary}`}>
            {showPains ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Pains {totalPains > 0 && <span className="font-mono">({totalPains})</span>}
          </button>
          {activities.length > 0 && (
            <button onClick={handleAddActivity} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"><Plus size={12} /> Activity</button>
          )}
          {activities.length > 0 && (
            <button onClick={handleAddSlice} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border ${btnSecondary}`}><Plus size={12} /> Release</button>
          )}

        </div>
      </div>

      {/* Map canvas */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-fit">
          <StoryMapBackbone
            activities={activities} tasksByActivity={tasksByActivity}
            collapsedActivities={collapsedActivities} showPains={showPains} isDark={isDark}
            COL_W={COL_W} GUTTER_W={GUTTER_W}
            toggleActivity={toggleActivity}
            handleUpdateActivity={handleUpdateActivity} handleDeleteActivity={handleDeleteActivity}
            handleCycleColor={handleCycleColor} handleInsertActivity={handleInsertActivity}
            handleAddTask={handleAddTask} handleInsertTask={handleInsertTask}
            handleUpdateTask={handleUpdateTask} handleDeleteTask={handleDeleteTask}
            handleAddPain={handleAddPain} handleUpdatePain={handleUpdatePain} handleDeletePain={handleDeletePain}
            drag={drag} />

          {slices.filter(s => showHistory || s.status !== 'done').map((slice, si) => (
            <StoryMapSliceRow key={slice.id}
              slice={slice} si={si} activities={activities} tasksByActivity={tasksByActivity}
              storiesByCell={storiesByCell} collapsedActivities={collapsedActivities}
              collapsedSlices={collapsedSlices} isDark={isDark} COL_W={COL_W} GUTTER_W={GUTTER_W}
              toggleSlice={toggleSlice} handleUpdateSlice={handleUpdateSlice}
              handleDeleteSlice={handleDeleteSlice} handleCycleSliceColor={handleCycleSliceColor}
              handleInsertSlice={handleInsertSlice} handleAddStory={handleAddStory}
              handleAddTask={handleAddTask} handleRemoveStoryFromMap={handleRemoveStoryFromMap}
              unmappedStories={unmappedStories} linkingCell={linkingCell} setLinkingCell={setLinkingCell}
              linkSearch={linkSearch} setLinkSearch={setLinkSearch} handleLinkStory={handleLinkStory}
              setEditingStory={setEditingStory} drag={drag} />
          ))}

          {activities.length === 0 && (
            <div className={`text-center mt-20 p-8`}>
              <p className={`text-lg mb-2 font-semibold ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>Empty map</p>
              <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>Add an activity to start building your story map backbone.</p>
              <button onClick={handleAddActivity} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1.5 font-medium shadow-lg"><Plus size={14} /> Add Activity</button>
            </div>
          )}
        </div>
      </div>

      {editingStory && (
        <TaskModal item={editingStory} onSave={handleSaveEditingStory} onDelete={handleDeleteEditingStory}
          onClose={() => setEditingStory(null)} releases={releases} tags={tags} />
      )}

      {toast.visible && <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 ${isDark ? 'bg-slate-700 text-white' : 'bg-ds-text text-white'}`}>{toast.message}</div>}
    </div>
  );
}
