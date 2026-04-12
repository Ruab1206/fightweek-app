// StoryMapBackbone — sticky header with activity + task rows
import InlineEdit from '../components/shared/InlineEdit';
import { getColor } from './StoryMapColors';
import { Plus, Trash2, GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Activity, UserTask } from '../types/story-map';
import type { useStoryMapDrag } from '../hooks/useStoryMapDrag';

interface Props {
  activities: Activity[];
  tasksByActivity: Map<string, UserTask[]>;
  collapsedActivities: Set<string>;
  showPains: boolean;
  isDark: boolean;
  COL_W: string;
  GUTTER_W: string;
  toggleActivity: (id: string) => void;
  handleUpdateActivity: (id: string, patch: Partial<Activity>) => void;
  handleDeleteActivity: (id: string) => void;
  handleCycleColor: (act: Activity) => void;
  handleInsertActivity: (o: number) => void;
  handleAddTask: (actId: string) => void;
  handleInsertTask: (actId: string, o: number) => void;
  handleUpdateTask: (id: string, patch: Partial<UserTask>) => void;
  handleDeleteTask: (id: string) => void;
  handleAddPain: (tid: string) => void;
  handleUpdatePain: (tid: string, i: number, v: string) => void;
  handleDeletePain: (tid: string, i: number) => void;
  drag: ReturnType<typeof useStoryMapDrag>;
}

export default function StoryMapBackbone({
  activities, tasksByActivity, collapsedActivities, showPains, isDark,
  COL_W, GUTTER_W,
  toggleActivity, handleUpdateActivity, handleDeleteActivity, handleCycleColor,
  handleInsertActivity, handleAddTask, handleInsertTask, handleUpdateTask, handleDeleteTask,
  handleAddPain, handleUpdatePain, handleDeletePain,
  drag,
}: Props) {
  const bgBase = isDark ? 'bg-slate-900' : 'bg-white';
  const borderBase = isDark ? 'border-slate-700' : 'border-surface-border';
  const taskCardBg = isDark ? 'bg-slate-800' : 'bg-white';
  const taskCardBorder = isDark ? 'border-slate-600' : 'border-surface-border';
  const textPrimary = isDark ? 'text-slate-200' : 'text-ds-text';
  const textMuted = isDark ? 'text-slate-500' : 'text-ds-text-subtlest';
  const insertBtnCls = isDark
    ? 'bg-slate-700 text-slate-400 hover:bg-blue-600 hover:text-white'
    : 'bg-surface-hover text-ds-text-subtlest hover:bg-brand-500 hover:text-white';

  return (
    <div className={`sticky top-0 z-10 ${bgBase} border-b ${borderBase} shadow-sm`}>
      {/* Row 1 — Activity headers */}
      <div className="flex border-l-4 border-transparent">
        <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} className={`shrink-0 sticky left-0 z-[5] ${bgBase}`} />
        {activities.map((act, ai) => {
          const tasks = tasksByActivity.get(act.id) || [];
          const col = getColor(act.color, isDark);
          const isCollapsed = collapsedActivities.has(act.id);
          const span = isCollapsed ? 1 : Math.max(tasks.length, 1);
          return (
            <div key={act.id} className="relative shrink-0"
              style={{ width: `calc(${span} * ${COL_W})`, minWidth: `calc(${span} * ${COL_W})` }}>
              <div
                className={`${col.header} px-2 py-1.5 h-full flex items-center gap-1.5 border-r border-white/20 ${ai === 0 ? 'rounded-tl-lg' : ''} ${ai === activities.length - 1 ? 'rounded-tr-lg' : ''} ${drag.dragActivity === act.id ? 'opacity-50' : ''} ${drag.dropTarget === `act::${act.id}` ? 'ring-2 ring-blue-400' : ''}`}
                draggable onDragStart={e => drag.onActivityDragStart(e, act.id)}
                onDragOver={e => drag.onActivityDragOver(e, act.id)} onDrop={e => drag.onActivityDrop(e, act.id)}
                onDragLeave={() => drag.setDropTarget(null)}>
                <button onClick={() => toggleActivity(act.id)} className="shrink-0 opacity-60 hover:opacity-100" title={isCollapsed ? 'Expand' : 'Collapse'}>
                  {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
                <GripVertical size={12} className="opacity-40 cursor-grab shrink-0" />
                <InlineEdit value={act.title} tag="h3" className="font-semibold text-xs flex-1 truncate" isDark={isDark}
                  onSave={title => handleUpdateActivity(act.id, { title })} />
                {!isCollapsed && <button onClick={() => handleCycleColor(act)} className="w-3 h-3 rounded-full border border-current opacity-40 hover:opacity-100 shrink-0" title="Change color" />}
                {!isCollapsed && <button onClick={() => handleDeleteActivity(act.id)} className="opacity-40 hover:opacity-100 shrink-0" title="Delete activity"><Trash2 size={12} /></button>}
              </div>
              <button onClick={() => handleInsertActivity(act.order + 1)}
                className={`absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-4 h-4 rounded-full ${insertBtnCls} text-[10px] font-bold flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity`}
                title="Insert activity">+</button>
            </div>
          );
        })}
      </div>

      {/* Row 2 — Task cards */}
      <div className="flex border-l-4 border-transparent">
        <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} className={`shrink-0 flex items-center justify-end pr-2 sticky left-0 z-[5] ${bgBase}`}>
          <span className={`text-[9px] ${textMuted} font-medium uppercase tracking-wider`}>Tasks</span>
        </div>
        {activities.map(act => {
          const tasks = tasksByActivity.get(act.id) || [];
          const col = getColor(act.color, isDark);
          const isCollapsed = collapsedActivities.has(act.id);
          if (isCollapsed) {
            return (
              <div key={act.id} style={{ width: COL_W, minWidth: COL_W }} className={`${col.bg} flex items-center justify-center border-r ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                <span className={`text-[9px] ${textMuted} [writing-mode:vertical-lr] rotate-180`}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
              </div>
            );
          }
          return (
            <div key={act.id} className={`flex ${col.bg}`}>
              {tasks.map((task, ti) => (
                <div key={task.id} className={`relative border-r ${isDark ? 'border-slate-700' : 'border-surface-border'}`} style={{ width: COL_W, minWidth: COL_W }}>
                  {ti > 0 && (
                    <button onClick={() => handleInsertTask(act.id, task.order)}
                      className={`absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-4 h-4 rounded-full ${insertBtnCls} text-[10px] font-bold flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity`}
                      title="Insert task" onDragOver={drag.onTaskZoneDragOver} onDrop={e => drag.onTaskZoneDrop(e, act.id)}>+</button>
                  )}
                  <div className={`m-1 cursor-grab ${drag.dragTask?.id === task.id ? 'opacity-50' : ''} ${drag.dropTarget === `task::${task.id}` ? 'ring-2 ring-blue-400 rounded' : ''}`}
                    draggable onDragStart={e => drag.onTaskDragStart(e, task.id, act.id)}
                    onDragOver={e => drag.onTaskDragOver(e, task.id)}
                    onDrop={e => drag.onTaskDrop(e, task.id, act.id)}
                    onDragLeave={() => drag.setDropTarget(null)}>
                    <div className={`rounded border ${taskCardBorder} ${taskCardBg} p-1.5 shadow-xs hover:shadow-sm transition-shadow`}>
                      <div className="flex items-start gap-1">
                        <GripVertical size={10} className="opacity-30 cursor-grab shrink-0 mt-px" />
                        <InlineEdit value={task.title} tag="span" className={`text-xs font-semibold ${textPrimary} flex-1 leading-snug`} isDark={isDark}
                          onSave={title => handleUpdateTask(task.id, { title })} />
                        <button onClick={() => handleDeleteTask(task.id)} className={`${textMuted} hover:text-red-500 shrink-0`}><Trash2 size={10} /></button>
                      </div>
                      {showPains && task.pains.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {task.pains.map((pain, pi) => (
                            <div key={pi}
                              className={`rounded border ${isDark ? 'border-red-800 bg-red-950' : 'border-red-200 bg-red-50'} px-1.5 py-1 group/pain ${drag.dragPain?.taskId === task.id && drag.dragPain.index === pi ? 'opacity-50' : ''} ${drag.dropTarget === `pain::${task.id}::${pi}` ? 'ring-1 ring-red-300' : ''}`}
                              draggable onDragStart={e => drag.onPainDragStart(e, task.id, pi)}
                              onDragOver={e => drag.onPainDragOver(e, task.id, pi)}
                              onDrop={e => drag.onPainDrop(e, task.id, pi, (tid, from, to) => {
                                const t = tasks.find(x => x.id === tid) || task;
                                const pains = [...t.pains]; const [moved] = pains.splice(from, 1); pains.splice(to, 0, moved);
                                handleUpdateTask(tid, { pains });
                              })}
                              onDragLeave={e => { e.stopPropagation(); drag.setDropTarget(null); }}>
                              <div className="flex items-start gap-0.5">
                                <GripVertical size={7} className="opacity-0 group-hover/pain:opacity-40 cursor-grab shrink-0 mt-0.5" />
                                <InlineEdit value={pain} tag="span" className={`text-[10px] ${isDark ? 'text-red-300' : 'text-red-700'} flex-1 leading-tight`} isDark={isDark}
                                  onSave={val => handleUpdatePain(task.id, pi, val)} />
                                <button onClick={() => handleDeletePain(task.id, pi)} className="opacity-0 group-hover/pain:opacity-100 text-red-400 hover:text-red-600 shrink-0"><X size={8} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {showPains && <button onClick={() => handleAddPain(task.id)} className="mt-1 text-[9px] text-red-400 hover:text-red-600 flex items-center gap-0.5"><Plus size={8} /> pain</button>}
                      {!showPains && task.pains.length > 0 && <div className="mt-1 text-[9px] text-red-400">{task.pains.length} pain{task.pains.length > 1 ? 's' : ''}</div>}
                    </div>
                  </div>
                  {ti === tasks.length - 1 && (
                    <button onClick={() => handleInsertTask(act.id, task.order + 1)}
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-4 h-4 rounded-full ${insertBtnCls} text-[10px] font-bold flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity`}
                      title="Insert task" onDragOver={drag.onTaskZoneDragOver} onDrop={e => drag.onTaskZoneDrop(e, act.id)}>+</button>
                  )}
                </div>
              ))}
              {tasks.length === 0 && (
                <div style={{ width: COL_W, minWidth: COL_W }} className={`flex items-center justify-center border-r ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
                  <button onClick={() => handleAddTask(act.id)} className={`${textMuted} hover:${textPrimary} text-xs flex items-center gap-1 py-2`}
                    onDragOver={drag.onTaskZoneDragOver} onDrop={e => drag.onTaskZoneDrop(e, act.id)}>
                    <Plus size={12} /> Add task
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
