// useStoryMapDrag — drag & drop state and handlers for story map
import { useState, useCallback } from 'react';
import type { StoryMapData, Activity, UserTask, ReleaseSlice } from '../types/story-map';
import type { BacklogItem } from '../types/backlog';
import {
  reorderActivities, reorderTasks, moveTask, reorderSlices,
} from '../services/firebaseStoryMapService';

interface UseDragOptions {
  mapId: string;
  activities: Activity[];
  slices: ReleaseSlice[];
  tasksByActivity: Map<string, UserTask[]>;
  storiesByCell: Map<string, BacklogItem[]>;
  persistMap: (d: StoryMapData) => void;
  handleUpdateStory: (id: string, patch: Partial<BacklogItem>) => void;
  mapData: StoryMapData;
}

export function useStoryMapDrag(opts: UseDragOptions) {
  const { mapId, activities, slices, tasksByActivity, storiesByCell, persistMap, handleUpdateStory, mapData } = opts;

  const [dragType, setDragType] = useState<'activity' | 'task' | 'story' | 'slice' | 'pain' | null>(null);
  const [dragActivity, setDragActivity] = useState<string | null>(null);
  const [dragTask, setDragTask] = useState<{ id: string; activityId: string } | null>(null);
  const [dragStory, setDragStory] = useState<{ id: string; taskId: string; sliceId: string } | null>(null);
  const [dragSlice, setDragSlice] = useState<string | null>(null);
  const [dragPain, setDragPain] = useState<{ taskId: string; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const clearDrag = useCallback(() => {
    setDragType(null); setDragActivity(null); setDragTask(null);
    setDragStory(null); setDragSlice(null); setDragPain(null); setDropTarget(null);
  }, []);

  // Activities
  const onActivityDragStart = (e: React.DragEvent, actId: string) => { setDragType('activity'); setDragActivity(actId); e.dataTransfer.effectAllowed = 'move'; };
  const onActivityDragOver = (e: React.DragEvent, targetId: string) => { if (dragType !== 'activity') return; e.preventDefault(); setDropTarget(`act::${targetId}`); };
  const onActivityDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragType !== 'activity' || !dragActivity || dragActivity === targetId) { clearDrag(); return; }
    const ids = activities.map(a => a.id);
    const fromIdx = ids.indexOf(dragActivity); const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { clearDrag(); return; }
    ids.splice(fromIdx, 1); ids.splice(toIdx, 0, dragActivity);
    persistMap(reorderActivities(mapData, mapId, ids)); clearDrag();
  };

  // Tasks
  const onTaskDragStart = (e: React.DragEvent, taskId: string, activityId: string) => { e.stopPropagation(); setDragType('task'); setDragTask({ id: taskId, activityId }); e.dataTransfer.effectAllowed = 'move'; };
  const onTaskDragOver = (e: React.DragEvent, targetTaskId: string) => { if (dragType !== 'task') return; e.preventDefault(); e.stopPropagation(); setDropTarget(`task::${targetTaskId}`); };
  const onTaskDrop = (e: React.DragEvent, targetTaskId: string, targetActivityId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (dragType !== 'task' || !dragTask || dragTask.id === targetTaskId) { clearDrag(); return; }
    if (dragTask.activityId === targetActivityId) {
      const tasks = tasksByActivity.get(targetActivityId) || [];
      const ids = tasks.map(t => t.id);
      const fromIdx = ids.indexOf(dragTask.id); const toIdx = ids.indexOf(targetTaskId);
      if (fromIdx === -1 || toIdx === -1) { clearDrag(); return; }
      ids.splice(fromIdx, 1); ids.splice(toIdx, 0, dragTask.id);
      persistMap(reorderTasks(mapData, targetActivityId, ids));
    } else {
      const targetTasks = tasksByActivity.get(targetActivityId) || [];
      const toIdx = targetTasks.findIndex(t => t.id === targetTaskId);
      const order = toIdx >= 0 ? toIdx : targetTasks.length;
      let next = moveTask(mapData, dragTask.id, targetActivityId, order);
      const srcTasks = next.tasks.filter(t => t.activityId === dragTask.activityId).sort((a, b) => a.order - b.order);
      const dstTasks = next.tasks.filter(t => t.activityId === targetActivityId).sort((a, b) => a.order - b.order);
      next = reorderTasks(next, dragTask.activityId, srcTasks.map(t => t.id));
      next = reorderTasks(next, targetActivityId, dstTasks.map(t => t.id));
      persistMap(next);
    }
    clearDrag();
  };
  const onTaskZoneDragOver = (e: React.DragEvent) => { if (dragType !== 'task') return; e.preventDefault(); e.stopPropagation(); };
  const onTaskZoneDrop = (e: React.DragEvent, targetActivityId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (dragType !== 'task' || !dragTask) { clearDrag(); return; }
    const targetTasks = tasksByActivity.get(targetActivityId) || [];
    let next = moveTask(mapData, dragTask.id, targetActivityId, targetTasks.length);
    const srcTasks = next.tasks.filter(t => t.activityId === dragTask.activityId).sort((a, b) => a.order - b.order);
    const dstTasks = next.tasks.filter(t => t.activityId === targetActivityId).sort((a, b) => a.order - b.order);
    next = reorderTasks(next, dragTask.activityId, srcTasks.map(t => t.id));
    next = reorderTasks(next, targetActivityId, dstTasks.map(t => t.id));
    persistMap(next); clearDrag();
  };

  // Slices
  const onSliceDragStart = (e: React.DragEvent, sliceId: string) => { setDragType('slice'); setDragSlice(sliceId); e.dataTransfer.effectAllowed = 'move'; };
  const onSliceDragOver = (e: React.DragEvent, targetId: string) => { if (dragType !== 'slice') return; e.preventDefault(); setDropTarget(`slice::${targetId}`); };
  const onSliceDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragType !== 'slice' || !dragSlice || dragSlice === targetId) { clearDrag(); return; }
    const ids = slices.map(s => s.id);
    const fromIdx = ids.indexOf(dragSlice); const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { clearDrag(); return; }
    ids.splice(fromIdx, 1); ids.splice(toIdx, 0, dragSlice);
    persistMap(reorderSlices(mapData, mapId, ids)); clearDrag();
  };

  // Stories
  const onStoryDragStart = (e: React.DragEvent, itemId: string, taskId: string, sliceId: string) => { e.stopPropagation(); setDragType('story'); setDragStory({ id: itemId, taskId, sliceId }); e.dataTransfer.effectAllowed = 'move'; };
  const onCellDragOver = (e: React.DragEvent, cellKey: string) => { if (dragType !== 'story') return; e.preventDefault(); setDropTarget(`cell::${cellKey}`); };
  const onCellDrop = (e: React.DragEvent, targetTaskId: string, targetSliceId: string) => {
    e.preventDefault();
    if (dragType !== 'story' || !dragStory) { clearDrag(); return; }
    const cellStories = storiesByCell.get(`${targetTaskId}::${targetSliceId}`) || [];
    const maxOrder = Math.max(-1, ...cellStories.map(s => s.mapOrder ?? 0));
    const targetSlice = slices.find(s => s.id === targetSliceId);
    handleUpdateStory(dragStory.id, { userTaskId: targetTaskId, releaseSliceId: targetSliceId, mapOrder: maxOrder + 1, release: targetSlice?.release || '' });
    clearDrag();
  };

  // Pains
  const onPainDragStart = (e: React.DragEvent, taskId: string, index: number) => { e.stopPropagation(); setDragType('pain'); setDragPain({ taskId, index }); e.dataTransfer.effectAllowed = 'move'; };
  const onPainDragOver = (e: React.DragEvent, taskId: string, index: number) => { if (dragType !== 'pain' || dragPain?.taskId !== taskId) return; e.preventDefault(); e.stopPropagation(); setDropTarget(`pain::${taskId}::${index}`); };
  const onPainDrop = (e: React.DragEvent, taskId: string, targetIndex: number, handleReorderPain: (taskId: string, fromIdx: number, toIdx: number) => void) => {
    e.preventDefault(); e.stopPropagation();
    if (dragType !== 'pain' || !dragPain || dragPain.taskId !== taskId) { clearDrag(); return; }
    handleReorderPain(taskId, dragPain.index, targetIndex); clearDrag();
  };

  return {
    dragType, dragActivity, dragTask, dragStory, dragSlice, dragPain, dropTarget,
    clearDrag, setDropTarget,
    onActivityDragStart, onActivityDragOver, onActivityDrop,
    onTaskDragStart, onTaskDragOver, onTaskDrop, onTaskZoneDragOver, onTaskZoneDrop,
    onSliceDragStart, onSliceDragOver, onSliceDrop,
    onStoryDragStart, onCellDragOver, onCellDrop,
    onPainDragStart, onPainDragOver, onPainDrop,
  };
}
