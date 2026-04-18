// ──────────────────────────────────────────────
// BacklogPage — full-screen backlog management (dark theme)
// Ported from Toolbox, backed by Firestore real-time sync
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { BacklogItem, BacklogData } from '../types/backlog';
import {
  subscribeBacklog,
  createItem, updateItem, deleteItem,
  filterItems, sortByOrder, getUniqueReleases, getTagsByFrequency,
  moveStatus, normalizeOrders, moveItemToColumn,
  addFeedback, updateFeedbackStatus, deleteFeedback,
  createItemInDb, updateItemInDb, deleteItemFromDb, batchUpdateOrders,
  addFeedbackToDb, updateFeedbackStatusInDb, deleteFeedbackFromDb,
} from '../services/firebaseBacklogService';
import TaskModal from '../components/backlog/TaskModal';
import BacklogFeedbackModal from '../components/backlog/BacklogFeedbackModal';
import BoardView from '../components/backlog/BoardView';
import ListView from '../components/backlog/ListView';
import FeedbackView from '../components/backlog/FeedbackView';
import ReleasePicker from '../components/backlog/ReleasePicker';
import SearchableDropdown from '../components/backlog/SearchableDropdown';
import TabBar from '../components/backlog/TabBar';
import ShortcutHelpOverlay from '../components/backlog/ShortcutHelpOverlay';
import { useSearchField } from '../hooks/useSearchField';
import { useBacklogKeyboard, BACKLOG_SHORTCUTS } from '../hooks/useBacklogKeyboard';
import { X as XIcon, Search as SearchIcon, ClipboardList, Palette, ScrollText, ChevronLeft, PanelLeftClose, PanelLeft, Users, Database, BookOpen, Settings, Map, Sun, Moon, Swords, Landmark, Layers, Target, ListChecks, ShieldCheck } from 'lucide-react';
import MarkdownDocPage from '../components/MarkdownDocPage';
import { TEAM_CHARTER, RELEASE_NOTES, ENTITY_MODEL, DOMAIN_MODEL, DESIGN_SYSTEM, MASTER_DATA, FIGHT_TEAM_DESCRIPTION, ARCHITECTURAL_BLUEPRINT, PRODUCT_VISION, CATALOGUE_SPEC, TARGET_ARCHITECTURE } from '../content';
import StoryMapPage from './StoryMapPage';
import PersonaPage from './PersonaPage';
import RolesPage from './RolesPage';
import { useTheme } from '../hooks/useTheme';
import type { StoryMapData } from '../types/story-map';
import { subscribeStoryMap } from '../services/firebaseStoryMapService';


type ViewTab = 'board' | 'list' | 'feedback';
type SidebarPage = 'backlog' | 'roles' | 'story-map' | 'fight-team-description' | 'team-charter' | 'release-notes' | 'personas' | 'architectural-blueprint' | 'target-architecture' | 'design-system' | 'domain-model' | 'entity-model' | 'master-data' | 'product-vision' | 'catalogue-spec';

interface Props {
  isAdmin: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type?: string) => void;
}

export default function BacklogPage({ isAdmin, onClose, onShowToast }: Props) {
  // Core state — hydrated via Firestore real-time subscription
  const [data, setData] = useState<BacklogData>({ items: [], feedback: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [statusFilter, setStatusFilter] = useState<'active' | 'done' | 'all'>('active');
  const [tagFilter, setTagFilter] = useState('All');
  const search = useSearchField('backlog');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Modal state
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showReleasePicker, setShowReleasePicker] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('fw-sidebar-collapsed') === 'true');
  const [activePage, setActivePage] = useState<SidebarPage>('backlog');

  // Persist sidebar state
  useEffect(() => { localStorage.setItem('fw-sidebar-collapsed', String(sidebarCollapsed)); }, [sidebarCollapsed]);

  // Lock body scroll when BacklogPage is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // 'm' shortcut — toggle sidebar collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showTaskModal || showFeedbackModal || showReleasePicker) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'm' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showTaskModal, showFeedbackModal, showReleasePicker]);

  // Toast wrapper
  const showToast = useCallback((msg: string) => onShowToast(msg, 'success'), [onShowToast]);

  // Story map data — used to merge release names from slices
  const [storyMapData, setStoryMapData] = useState<StoryMapData>({ maps: [], activities: [], tasks: [], slices: [], personas: [] });

  // Subscribe to Firestore on mount
  useEffect(() => {
    const unsubBacklog = subscribeBacklog((d) => {
      setData(d);
      setLoading(false);
    });
    const unsubMap = subscribeStoryMap(
      (d) => setStoryMapData(d),
      () => {}, // ignore story map errors here
    );
    return () => { unsubBacklog(); unsubMap(); };
  }, []);

  // Persist helper — optimistic local state + async Firestore write
  const persist = useCallback((d: BacklogData) => setData(d), []);

  // Derived
  const allItems = useMemo(() => sortByOrder(data.items), [data.items]);
  const filtered = useMemo(() => filterItems(allItems, statusFilter, tagFilter, search.term), [allItems, statusFilter, tagFilter, search.term]);
  const tagsByFreq = useMemo(() => getTagsByFrequency(data.items), [data.items]);
  const releases = useMemo(() => {
    const fromItems = getUniqueReleases(data.items);
    // Merge release names from story map slices so they appear in the picker
    const sliceReleases = storyMapData.slices.map(s => s.release).filter(Boolean);
    const all = new Set([...fromItems, ...sliceReleases]);
    return Array.from(all);
  }, [data.items, storyMapData.slices]);
  const newFeedbackCount = useMemo(() => data.feedback.filter((f) => f.status === 'new').length, [data.feedback]);

  // CRUD handlers — optimistic update + Firestore write
  const handleSaveTask = useCallback((item: BacklogItem) => {
    if (item.status === 'done' && !item.release) { showToast('Assign a release first (r)'); return; }
    const isNew = !data.items.find((i) => i.id === item.id);
    const afterId = isNew && selectedIndex >= 0 && selectedIndex < filtered.length ? filtered[selectedIndex].id : undefined;

    if (isNew) {
      const next = createItem(data, item, afterId);
      persist(next);
      // Find the newly created item
      const created = next.items.find((i) => !data.items.some((e) => e.id === i.id));
      if (created) createItemInDb(created);
    } else {
      persist(updateItem(data, item));
      updateItemInDb(item);
    }
    setShowTaskModal(false);
    setEditingItem(null);
    showToast(isNew ? 'Item created' : 'Item updated');
  }, [data, persist, showToast, selectedIndex, filtered]);

  const handleDeleteTask = useCallback((id: string) => {
    persist(deleteItem(data, id));
    deleteItemFromDb(id);
    setShowTaskModal(false);
    setEditingItem(null);
    showToast('Item deleted');
  }, [data, persist, showToast]);

  const handleStatusChange = useCallback((item: BacklogItem, direction: 'forward' | 'backward') => {
    const moved = moveStatus(item, direction);
    if (moved.status === 'done' && !item.release) { showToast('Assign a release first (r)'); return; }
    const updated = { ...moved, updatedAt: new Date().toISOString() };
    persist(updateItem(data, updated));
    updateItemInDb(updated);
  }, [data, persist, showToast]);

  const openEdit = useCallback((item: BacklogItem) => { setEditingItem(item); setShowTaskModal(true); }, []);
  const openCreate = useCallback(() => { setEditingItem(null); setShowTaskModal(true); }, []);

  // Feedback handlers
  const handleFeedbackSubmit = useCallback((text: string, context: string) => {
    const fb = { text, context, user: 'anonymous@fightweek.app', userName: 'Anonymous User', timestamp: new Date().toISOString(), status: 'new' as const };
    persist(addFeedback(data, fb));
    addFeedbackToDb(fb);
    setShowFeedbackModal(false);
    showToast('Thanks for your feedback!');
  }, [data, persist, showToast]);

  const handleConvertFeedback = useCallback((fbId: string) => {
    const fb = data.feedback.find((f) => f.id === fbId);
    if (!fb) return;
    const next = createItem(updateFeedbackStatus(data, fbId, 'converted'), {
      title: fb.text.slice(0, 100),
      desc: `Feedback from ${fb.userName} (${fb.context}):\n\n${fb.text}`,
      status: 'ready', tag: 'Feedback',
    });
    persist(next);
    updateFeedbackStatusInDb(fbId, 'converted');
    const created = next.items.find((i) => !data.items.some((e) => e.id === i.id));
    if (created) createItemInDb(created);
    showToast('Item created from feedback');
  }, [data, persist, showToast]);

  const handleDismissFeedback = useCallback((fbId: string) => {
    persist(updateFeedbackStatus(data, fbId, 'dismissed'));
    updateFeedbackStatusInDb(fbId, 'dismissed');
  }, [data, persist]);

  const handleDeleteFeedback = useCallback((fbId: string) => {
    persist(deleteFeedback(data, fbId));
    deleteFeedbackFromDb(fbId);
    showToast('Feedback deleted');
  }, [data, persist, showToast]);

  // Tab buttons
  const tabs: { key: ViewTab; label: string; badge?: number }[] = [
    { key: 'list', label: 'List' },
    { key: 'board', label: 'Board' },
    { key: 'feedback', label: 'Feedback', badge: newFeedbackCount || undefined },
  ];

  // Keyboard shortcuts
  useBacklogKeyboard({
    showTaskModal, showFeedbackModal, showReleasePicker,
    selectedIndex, setSelectedIndex, selectedIds, setSelectedIds,
    showShortcuts, setShowShortcuts,
    filtered, data, persist, isAdmin, search,
    openEdit, openCreate, showToast,
    setActiveTab, setShowReleasePicker,
    statusFilter, tagFilter, activeTab,
  });

  // Sidebar nav items
  const sidebarItems: { key: SidebarPage; label: string; icon: any; }[] = [
    { key: 'backlog', label: 'Backlog & Feedback', icon: ClipboardList },
    { key: 'roles', label: 'Holdroller', icon: ShieldCheck },
    { key: 'product-vision', label: 'Product Vision', icon: Target },
    { key: 'release-notes', label: 'Release Notes', icon: ScrollText },
    { key: 'personas', label: 'Personas', icon: Users },
    { key: 'story-map', label: 'Story Map', icon: Map },
    { key: 'domain-model', label: 'Domain Model', icon: Layers },
    { key: 'entity-model', label: 'Entity Model', icon: Database },
    { key: 'architectural-blueprint', label: 'Architecture', icon: Landmark },
    { key: 'target-architecture', label: 'Target Architecture', icon: Target },
    { key: 'catalogue-spec', label: 'Catalogue Spec', icon: ListChecks },
    { key: 'design-system', label: 'Design System', icon: Palette },
    { key: 'master-data', label: 'Master Data', icon: Settings },
    { key: 'team-charter', label: 'Team Charter', icon: BookOpen },
    { key: 'fight-team-description', label: 'Fight Team', icon: Swords },
  ];

  const { isDark, toggleTheme } = useTheme();

  // Map sidebar pages to markdown content
  const pageContent: Record<string, string> = {
    'fight-team-description': FIGHT_TEAM_DESCRIPTION,
    'team-charter': TEAM_CHARTER,
    'release-notes': RELEASE_NOTES,
    'architectural-blueprint': ARCHITECTURAL_BLUEPRINT,
    'target-architecture': TARGET_ARCHITECTURE,
    'domain-model': DOMAIN_MODEL,
    'entity-model': ENTITY_MODEL,
    'design-system': DESIGN_SYSTEM,
    'master-data': MASTER_DATA,
    'product-vision': PRODUCT_VISION,
    'catalogue-spec': CATALOGUE_SPEC,
  };

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
      {/* ═══ Top header bar ═══ */}
      <div className={`flex-shrink-0 px-4 md:px-6 py-3 flex items-center justify-between ${isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-white border-b border-surface-border shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className={`p-1.5 rounded-lg md:hidden ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title="Back">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>FightWeek</h1>
          <span className="text-xs text-yellow-500 font-bold uppercase tracking-wide hidden md:inline">Admin</span>
          {/* Mobile page selector */}
          <select
            value={activePage}
            onChange={(e) => setActivePage(e.target.value as SidebarPage)}
            className={`md:hidden appearance-none text-xs font-medium px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-ds-text border-surface-border'}`}
          >
            {sidebarItems.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-yellow-400 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover'}`} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className={`hidden md:flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`} title="Back to schedule (b)">
            ← Back
          </button>
        </div>
      </div>

      {/* ═══ Body: sidebar + main ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className={`hidden md:flex flex-col border-r flex-shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-14' : 'w-56'} ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-surface-raised border-surface-border'}`}>
          <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg font-medium transition-colors ${
                  sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5 text-sm'
                } ${
                  activePage === item.key
                    ? (isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-brand-50 text-brand-500')
                    : (isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-ds-text-subtle hover:bg-surface-hover hover:text-ds-text')
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
          <div className={`py-3 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'} ${sidebarCollapsed ? 'px-2 flex justify-center' : 'px-4'}`}>
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className={`transition-colors ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-ds-text-subtlest hover:text-ds-text-subtle'}`}
              title={sidebarCollapsed ? 'Expand sidebar (m)' : 'Collapse sidebar (m)'}
            >
              {sidebarCollapsed
                ? <PanelLeft className="w-4 h-4" />
                : <span className="text-[10px] flex items-center gap-1.5"><PanelLeftClose className="w-3.5 h-3.5" /> Collapse <kbd className={`px-1 py-0.5 rounded font-mono ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-surface-hover text-ds-text-subtlest'}`}>m</kbd></span>
              }
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {activePage === 'story-map' ? (
            /* ═══ Story Map page ═══ */
            <StoryMapPage isDark={isDark} />
          ) : activePage === 'personas' ? (
            /* ═══ Persona page (interactive cards) ═══ */
            <PersonaPage isDark={isDark} />
          ) : activePage === 'roles' ? (
            /* ═══ Roles management page ═══ */
            <RolesPage isDark={isDark} />
          ) : activePage !== 'backlog' && pageContent[activePage] ? (
            /* ═══ Markdown doc page ═══ */
            <>
              {/* Mobile header for doc pages */}
              <div className={`flex-shrink-0 border-b px-4 md:px-6 py-3 md:hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActivePage('backlog')} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-ds-text'}`}>
                    {sidebarItems.find(i => i.key === activePage)?.label}
                  </h2>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <MarkdownDocPage content={pageContent[activePage]} />
              </div>
            </>
          ) : (
            /* ═══ Backlog content ═══ */
            <>
          {/* Sub-header: tabs + actions */}
          <div className={`flex-shrink-0 border-b px-4 md:px-6 py-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-lg font-semibold md:hidden ${isDark ? 'text-white' : 'text-ds-text'}`}>Backlog & Feedback</h2>
              <div className="hidden md:block" />
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                    + New
                  </button>
                )}
                <button onClick={() => setShowFeedbackModal(true)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium ${isDark ? 'text-blue-400 border border-blue-800/50 hover:bg-blue-900/30' : 'text-brand-500 border border-brand-100 hover:bg-brand-50'}`}>
                  💬 Feedback
                </button>
              </div>
            </div>
            <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

      {/* Filters (board & list) */}
      {activeTab !== 'feedback' && (
        <div className={`flex-shrink-0 border-b px-4 md:px-6 py-2 flex items-center gap-3 flex-wrap ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          {(['active', 'done', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize ${
                statusFilter === s
                  ? (isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-brand-50 text-brand-500')
                  : (isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-ds-text-subtle hover:bg-surface-hover')
              }`}
            >
              {s}
            </button>
          ))}
          <span className={`w-px h-5 ${isDark ? 'bg-slate-700' : 'bg-surface-border'}`} />
          <SearchableDropdown label="Label" options={tagsByFreq} value={tagFilter === 'All' ? '' : tagFilter} onChange={(v) => setTagFilter(v || 'All')} />
          <span className={`w-px h-5 ${isDark ? 'bg-slate-700' : 'bg-surface-border'}`} />
          <div className="relative w-44">
            <SearchIcon size={14} className={`absolute left-2 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />
            <input
              {...search.inputProps}
              className={`w-full pl-7 pr-7 py-1 text-xs rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 ${isDark ? 'bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-surface-subtle border border-surface-border text-ds-text placeholder-ds-text-subtlest'}`}
            />
            {search.term && (
              <button onClick={() => { search.clear(); search.ref.current?.focus(); }} className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-ds-text-subtlest hover:text-ds-text-subtle'}`}>
                <XIcon size={12} />
              </button>
            )}
          </div>
          <span className={`text-xs ml-auto ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{filtered.length} items</span>
        </div>
      )}

      {/* View content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className={`text-center py-20 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Loading backlog…</div>
        ) : (
          <>
            {activeTab === 'board' && (
              <BoardView
                items={filtered}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDrop={(itemId, status, index) => {
                  if (status === 'done') {
                    const item = data.items.find((i) => i.id === itemId);
                    if (item && !item.release) { showToast('Assign a release first (r)'); return; }
                  }
                  const next = moveItemToColumn(data, itemId, status, index);
                  persist(next);
                  const moved = next.items.find((i) => i.id === itemId);
                  if (moved) updateItemInDb(moved);
                }}
              />
            )}
            {activeTab === 'list' && (
              <ListView
                items={filtered}
                isAdmin={isAdmin}
                selectedIndex={selectedIndex}
                selectedIds={selectedIds}
                onSelect={(idx, e) => {
                  if (e?.shiftKey && selectedIndex >= 0) {
                    const from = Math.min(selectedIndex, idx);
                    const to = Math.max(selectedIndex, idx);
                    const rangeIds = new Set(selectedIds);
                    for (let i = from; i <= to; i++) rangeIds.add(filtered[i].id);
                    setSelectedIds(rangeIds);
                    setSelectedIndex(idx);
                  } else if (e?.ctrlKey || e?.metaKey) {
                    const next = new Set(selectedIds);
                    const id = filtered[idx].id;
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedIds(next);
                    setSelectedIndex(idx);
                  } else {
                    setSelectedIndex(idx);
                    setSelectedIds(new Set());
                  }
                }}
                onEdit={openEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTask}
                onReorder={(fromIdx, toIdx) => {
                  if (!isAdmin) return;
                  const sorted = sortByOrder(filtered);
                  const dragIds = selectedIds.size > 0 && selectedIds.has(sorted[fromIdx].id) ? new Set(selectedIds) : new Set([sorted[fromIdx].id]);
                  const selected = sorted.filter((_, i) => dragIds.has(sorted[i].id));
                  const rest = sorted.filter((_, i) => !dragIds.has(sorted[i].id));
                  const insertAt = Math.min(toIdx, rest.length);
                  const reordered = [...rest.slice(0, insertAt), ...selected, ...rest.slice(insertAt)];
                  const next = normalizeOrders(data, reordered);
                  persist(next);
                  // Batch-update changed orders to Firestore
                  const updates = next.items
                    .filter((item) => item.order !== data.items.find((o) => o.id === item.id)?.order)
                    .map((item) => ({ id: item.id, order: item.order }));
                  if (updates.length > 0) batchUpdateOrders(updates);
                  const newIdx = reordered.findIndex((i) => i.id === sorted[fromIdx].id);
                  setSelectedIndex(newIdx);
                }}
              />
            )}
            {activeTab === 'feedback' && (
              <FeedbackView
                feedback={data.feedback}
                isAdmin={isAdmin}
                onConvert={handleConvertFeedback}
                onDismiss={handleDismissFeedback}
                onDelete={handleDeleteFeedback}
              />
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className={`flex-shrink-0 px-4 md:px-6 py-2 border-t text-xs flex items-center justify-between ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-surface-raised border-surface-border text-ds-text-subtlest'}`}>
        <span>{filtered.length} items{selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : selectedIndex >= 0 ? ` · selected #${selectedIndex + 1}` : ''}</span>
        {isAdmin && (
          <span className={isDark ? 'text-slate-600' : 'text-ds-text-subtlest'} title="Press ? for full shortcut reference">
            ⌨ j/k navigate · t/g top/bottom · o open · f/a status · æ search · ? help
          </span>
        )}
      </div>
            </>
          )}
        </div>{/* /main content column */}
      </div>{/* /body flex */}

      {/* ═══ Modals (always top-level) ═══ */}
      {showTaskModal && (
        <TaskModal
          item={editingItem}
          onSave={handleSaveTask}
          onDelete={isAdmin ? handleDeleteTask : undefined}
          onClose={() => { setShowTaskModal(false); setEditingItem(null); }}
          readOnly={!isAdmin}
          releases={releases}
          tags={tagsByFreq}
        />
      )}
      {showFeedbackModal && (
        <BacklogFeedbackModal
          context="Backlog"
          onSubmit={handleFeedbackSubmit}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
      {showReleasePicker && (
        <ReleasePicker
          releases={releases}
          itemCount={selectedIds.size > 0 ? selectedIds.size : 1}
          onSelect={(release) => {
            const targets = selectedIds.size > 0
              ? filtered.filter((i) => selectedIds.has(i.id))
              : selectedIndex >= 0 && selectedIndex < filtered.length
                ? [filtered[selectedIndex]]
                : [];
            let d = data;
            targets.forEach((item) => {
              const updated = { ...item, release, updatedAt: new Date().toISOString() };
              d = updateItem(d, updated);
              updateItemInDb(updated);
            });
            persist(d);
            setShowReleasePicker(false);
            showToast(`Release ${release ? `set to "${release}"` : 'removed'} for ${targets.length} item${targets.length !== 1 ? 's' : ''}`);
          }}
          onClose={() => setShowReleasePicker(false)}
        />
      )}
      {showShortcuts && <ShortcutHelpOverlay onClose={() => setShowShortcuts(false)} shortcuts={BACKLOG_SHORTCUTS} isAdmin={isAdmin} />}
    </div>
  );
}
