// StoryMapSliceRow — one release slice row in the story map
import InlineEdit from '../components/shared/InlineEdit';
import { getColor, SLICE_COLORS } from './StoryMapColors';
import { Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { composeReleaseName } from '../types/story-map';
import type { Activity, UserTask, ReleaseSlice } from '../types/story-map';
import type { BacklogItem } from '../types/backlog';
import type { useStoryMapDrag } from '../hooks/useStoryMapDrag';

interface Props {
  slice: ReleaseSlice;
  si: number;
  activities: Activity[];
  tasksByActivity: Map<string, UserTask[]>;
  storiesByCell: Map<string, BacklogItem[]>;
  collapsedActivities: Set<string>;
  collapsedSlices: Set<string>;
  isDark: boolean;
  COL_W: string;
  GUTTER_W: string;
  toggleSlice: (id: string) => void;
  handleUpdateSlice: (id: string, patch: Partial<ReleaseSlice>) => void;
  handleDeleteSlice: (id: string) => void;
  handleCycleSliceColor: (s: ReleaseSlice) => void;
  handleInsertSlice: (o: number) => void;
  handleAddStory: (taskId: string, sliceId: string) => void;
  handleAddTask: (actId: string) => void;
  handleRemoveStoryFromMap: (id: string) => void;
  unmappedStories: BacklogItem[];
  linkingCell: { taskId: string; sliceId: string } | null;
  setLinkingCell: (cell: { taskId: string; sliceId: string } | null) => void;
  linkSearch: string;
  setLinkSearch: (v: string) => void;
  handleLinkStory: (itemId: string) => void;
  setEditingStory: (story: BacklogItem | null) => void;
  drag: ReturnType<typeof useStoryMapDrag>;
}

export default function StoryMapSliceRow({
  slice, si: _si, activities, tasksByActivity, storiesByCell, collapsedActivities, collapsedSlices, isDark,
  COL_W, GUTTER_W,
  toggleSlice, handleUpdateSlice, handleDeleteSlice, handleCycleSliceColor,
  handleInsertSlice, handleAddStory, handleAddTask, handleRemoveStoryFromMap,
  unmappedStories, linkingCell, setLinkingCell, linkSearch, setLinkSearch, handleLinkStory,
  setEditingStory, drag,
}: Props) {
  const bgBase = isDark ? 'bg-slate-900' : 'bg-white';
  const borderBase = isDark ? 'border-slate-700' : 'border-surface-border';
  const borderLight = isDark ? 'border-slate-700' : 'border-surface-border';
  const textPrimary = isDark ? 'text-slate-200' : 'text-ds-text';
  const textMuted = isDark ? 'text-slate-500' : 'text-ds-text-subtlest';
  const cardBg = isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-surface-border';
  const insertBtnCls = isDark
    ? 'bg-slate-700 text-slate-400 hover:bg-blue-600 hover:text-white'
    : 'bg-surface-hover text-ds-text-subtlest hover:bg-brand-500 hover:text-white';
  const isSliceCollapsed = collapsedSlices.has(slice.id);

  return (
    <div className="relative">
      <div
        className={`flex border-l-4 border-t-2 ${isDark ? 'border-t-slate-700' : 'border-t-surface-border'} ${SLICE_COLORS[slice.color] || 'border-l-gray-300'} ${drag.dragSlice === slice.id ? 'opacity-50' : ''} ${drag.dropTarget === `slice::${slice.id}` ? 'ring-2 ring-blue-400' : ''}`}
        draggable onDragStart={e => drag.onSliceDragStart(e, slice.id)}
        onDragOver={e => drag.onSliceDragOver(e, slice.id)} onDrop={e => drag.onSliceDrop(e, slice.id)}
        onDragLeave={() => drag.setDropTarget(null)}>

        {/* Slice label */}
        <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} className={`shrink-0 p-2 border-r border-b ${borderBase} ${bgBase} sticky left-0 z-[5]`}>
          <div className="flex items-start gap-1">
            <button onClick={(e) => { e.stopPropagation(); toggleSlice(slice.id); }}
              className={`shrink-0 mt-0.5 rounded hover:bg-opacity-20 ${isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-gray-500 hover:bg-gray-200'}`}
              title={isSliceCollapsed ? 'Expand' : 'Collapse'}>
              {isSliceCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <div className="flex-1 min-w-0">
              <InlineEdit value={slice.name} tag="span" className={`text-xs font-semibold ${textPrimary} block`} isDark={isDark}
                onSave={name => handleUpdateSlice(slice.id, { name })} />
              {!isSliceCollapsed && (
                <InlineEdit value={slice.objective} tag="p" className={`text-[10px] ${textMuted} mt-0.5 block leading-tight`} placeholder="Objective…" isDark={isDark}
                  onSave={objective => handleUpdateSlice(slice.id, { objective })} />
              )}
            </div>
          </div>
          {!isSliceCollapsed && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[9px] ${textMuted}`}>No:</span>
              <InlineEdit value={slice.releaseNumber ?? ''} tag="span" className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'} min-w-[1.5rem]`} placeholder="—" isDark={isDark}
                onSave={releaseNumber => {
                  const release = composeReleaseName(releaseNumber, slice.name);
                  handleUpdateSlice(slice.id, { releaseNumber, release });
                }} />
              <select
                value={slice.status || 'todo'}
                onChange={e => handleUpdateSlice(slice.id, { status: e.target.value as 'todo' | 'doing' | 'done' })}
                className={`text-[9px] px-1 py-0 rounded border cursor-pointer ${isDark ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-white border-surface-border text-ds-text-subtle'}`}
              >
                <option value="todo">Todo</option>
                <option value="doing">Doing</option>
                <option value="done">Done</option>
              </select>
              <button onClick={() => handleCycleSliceColor(slice)} className={`ml-auto w-2.5 h-2.5 rounded-full border ${isDark ? 'border-slate-500' : 'border-surface-border'} opacity-40 hover:opacity-100`} title="Change color" />
              <button onClick={() => handleDeleteSlice(slice.id)} className={`${textMuted} hover:text-red-500`}><Trash2 size={10} /></button>
            </div>
          )}
        </div>

        {/* Story cells */}
        {activities.map(act => {
          const tasks = tasksByActivity.get(act.id) || [];
          const col = getColor(act.color, isDark);
          if (collapsedActivities.has(act.id)) {
            return <div key={act.id} style={{ width: COL_W, minWidth: COL_W, backgroundColor: col.tint }} className={`shrink-0 border-r border-b ${borderLight}`} />;
          }
          if (tasks.length === 0) {
            return (
              <div key={act.id} style={{ width: COL_W, minWidth: COL_W, backgroundColor: col.tint }} className={`shrink-0 border-r border-b ${borderLight} flex items-center justify-center min-h-[3.5rem]`}>
                <button onClick={() => handleAddTask(act.id)} className={`text-[9px] ${textMuted} hover:${textPrimary} flex items-center gap-0.5`}><Plus size={8} /> task</button>
              </div>
            );
          }
          return tasks.map(task => {
            const cellKey = `${task.id}::${slice.id}`;
            const stories = storiesByCell.get(cellKey) || [];
            const isLinking = linkingCell?.taskId === task.id && linkingCell?.sliceId === slice.id;
            return (
              <div key={cellKey}
                style={{ width: COL_W, minWidth: COL_W, backgroundColor: col.tint }}
                className={`shrink-0 border-r border-b ${borderLight} ${isSliceCollapsed ? 'py-0.5 px-1' : 'p-1 min-h-[3.5rem]'} ${drag.dropTarget === `cell::${cellKey}` ? 'ring-2 ring-blue-300 ring-inset' : ''}`}
                onDragOver={e => drag.onCellDragOver(e, cellKey)} onDrop={e => drag.onCellDrop(e, task.id, slice.id)}
                onDragLeave={() => drag.setDropTarget(null)}>
                {isSliceCollapsed ? (
                  stories.length > 0 && <span className={`text-[9px] ${textMuted}`}>{stories.length}</span>
                ) : (
                  <>
                    {stories.map(story => (
                      <div key={story.id}
                        className={`mb-1 ${cardBg} border rounded px-1.5 py-1 shadow-xs hover:shadow-sm cursor-grab group text-[11px]`}
                        draggable onDragStart={e => drag.onStoryDragStart(e, story.id, task.id, slice.id)}
                        onClick={e => { e.stopPropagation(); setEditingStory(story); }}>
                        <div className="flex items-stretch gap-1">
                          <span className={`flex-1 ${textPrimary} font-medium leading-tight line-clamp-2`}>{story.title}</span>
                          <div className="flex flex-col items-end justify-between shrink-0">
                            <button onClick={e => { e.stopPropagation(); handleRemoveStoryFromMap(story.id); }}
                              className={`opacity-0 group-hover:opacity-100 ${textMuted} hover:text-red-500`}><X size={9} /></button>
                            <span className={`${textMuted} font-mono text-[9px] leading-none`}>#{story.number}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLinking ? (
                      <div className={`${isDark ? 'bg-slate-800 border-blue-700' : 'bg-white border-blue-200'} border rounded p-1 shadow-sm`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-semibold text-blue-400">Link story</span>
                          <button onClick={() => { setLinkingCell(null); setLinkSearch(''); }} className={`${textMuted} hover:${textPrimary}`}><X size={8} /></button>
                        </div>
                        <input type="text" value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                          placeholder="Search…" autoFocus
                          className={`w-full text-[10px] border rounded px-1 py-0.5 mb-1 outline-none ${isDark ? 'bg-slate-900 border-slate-600 text-slate-200 focus:border-blue-500' : 'bg-white border-surface-border text-ds-text focus:border-brand-500'}`} />
                        {unmappedStories.length === 0 ? (
                          <p className={`text-[9px] ${textMuted}`}>No unmapped stories</p>
                        ) : (
                          <div className="max-h-24 overflow-y-auto space-y-0.5">
                            {unmappedStories.filter(item => !linkSearch || item.title.toLowerCase().includes(linkSearch.toLowerCase()) || String(item.number).includes(linkSearch)).slice(0, 20).map(item => (
                              <button key={item.id} onClick={() => handleLinkStory(item.id)}
                                className={`w-full text-left px-1 py-0.5 text-[10px] ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-ds-text hover:bg-brand-50'} rounded truncate`}>
                                <span className={`${textMuted} font-mono`}>#{item.number}</span> {item.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-0.5">
                        <button onClick={() => handleAddStory(task.id, slice.id)}
                          className={`flex-1 text-center py-0.5 ${isDark ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/60' : 'text-ds-text-subtlest hover:text-ds-text-subtle hover:bg-white/60'} rounded text-[10px]`}
                          title="New story"><Plus size={10} className="mx-auto" /></button>
                        {unmappedStories.length > 0 && (
                          <button onClick={() => setLinkingCell({ taskId: task.id, sliceId: slice.id })}
                            className={`px-1 py-0.5 ${isDark ? 'text-slate-600 hover:text-blue-400 hover:bg-slate-800/60' : 'text-ds-text-subtlest hover:text-brand-500 hover:bg-white/60'} rounded text-[9px]`}
                            title="Link existing story">↗</button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          });
        })}
      </div>
      <button onClick={() => handleInsertSlice(slice.order + 1)}
        className={`absolute -bottom-2 left-[5rem] z-20 w-4 h-4 rounded-full ${insertBtnCls} text-[10px] font-bold flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity`}
        title="Insert release">+</button>
    </div>
  );
}
