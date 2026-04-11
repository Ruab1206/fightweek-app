
// ──────────────────────────────────────────────
// PersonaPage — sketch persona gallery (Jeff Patton style)
// CRUD with index-card style persona cards
// Theme-aware, Firestore persistence via story-map service
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import type { StoryMapData } from '../types/story-map';
import type { Persona } from '../types/story-map';
import {
  subscribeStoryMap, persistStoryMapData,
  createPersona, updatePersona, deletePersona,
} from '../services/firebaseStoryMapService';
import PersonaCard from '../components/persona/PersonaCard';
import { Plus, ChevronsUpDown, RotateCcw } from 'lucide-react';

interface Props {
  isDark: boolean;
}

// ────────── Seed personas (inserted on first load if Firestore is empty) ──────────
const SEED_PERSONAS: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Karl', role: 'Fighter (Udøver)', avatar: '🥊',
    goals: [
      'See today\'s and this week\'s training plan at a glance',
      'Track sessions, rest days, and cancellations effortlessly',
      'Prepare structured fight camps with clear goals',
    ],
    activities: [
      'Opens app every morning to check today\'s schedule',
      'Adds/edits sessions as plans change',
      'Marks rest days and toggles standard week',
      'Reviews team view to see who else is training',
      'Gives daily feedback and adjusts the plan',
    ],
    painPoints: [
      'Too many taps to do simple things',
      'Losing overview when schedule changes mid-week',
      'Doesn\'t want to log in every time',
    ],
    context: 'Den centrale aktør — ansvarlig for eksekvering, feedback og daglig justering af planen. Mobile-first (iPhone). Uses the app 2–4 times a day in short bursts between sessions. Competitive MMA fighter aiming for UFC.',
  },
  {
    name: 'Frodi', role: 'Coach', avatar: '🧠',
    goals: [
      'Monitor all fighters\' training load and compliance',
      'Quickly spot who\'s training, who\'s resting, who cancelled',
      'Data-driven follow-up on goals and Standarden',
      'Curate the training offering and manage goal hierarchy',
    ],
    activities: [
      'Reviews Team View every morning',
      'Gets notified about cancellations and reasons',
      'Adjusts training plans based on fighter feedback',
      'Uses data to validate that fighters follow Standarden',
      'Defines progression paths and curates training sessions',
    ],
    painPoints: [
      'No single view of all fighters\' weekly status',
      'Cancellation reasons get lost in chat messages',
      'Hard to track training load trends over time',
    ],
    context: 'Den strategiske leder — ansvarlig for progression, målhierarki og kuratering af træningsudbuddet. iPad or laptop at the gym. Master\'s in sports science. Oversees 5–10 fighters at a time.',
  },
  {
    name: 'Jens', role: 'Team Coordinator', avatar: '📋',
    goals: [
      'Remove noise around agreements, events, and practical deadlines',
      'Keep the team calendar in sync with events and bookings',
      'Coordinate logistics: travel, hotel, equipment for fight weeks',
    ],
    activities: [
      'Manages fight-week logistics and travel planning',
      'Updates team calendar with event bookings',
      'Sends reminders and coordination messages',
      'Tracks weigh-in schedules and venue details',
      'Clears impediments so fighters and coaches can focus',
    ],
    painPoints: [
      'Information scattered across email, chat, and spreadsheets',
      'Last-minute changes hard to communicate reliably',
      'No central place for fight-week logistics',
    ],
    context: 'Logistik-ankeret (Scrum Master-rollen) — sørger for at fjerne støj omkring aftaler, stævner og praktiske deadlines. Laptop-first, works from office. Not in the gym daily.',
  },
  {
    name: 'Jabar', role: 'Trainer / Instructor', avatar: '🥋',
    goals: [
      'Deliver high-quality technical content in specialised sessions',
      'Ensure fighters progress in the specific discipline',
      'Coordinate session content with the head coach\'s overall plan',
    ],
    activities: [
      'Runs specialised sessions (e.g. wrestling, striking)',
      'Provides technical feedback to individual fighters',
      'Reports session attendance and performance notes to coach',
      'Adjusts session difficulty based on fighter readiness',
    ],
    painPoints: [
      'Doesn\'t always know the fighter\'s weekly load or fatigue level',
      'Session plan changes aren\'t communicated in time',
      'No structured way to share session notes with the coach',
    ],
    context: 'Faglig specialist (f.eks. Jabar Shirani til brydning) — leverer det tekniske indhold i de specifikke pas. In the gym for specific sessions only. Mobile phone between sessions.',
  },
  {
    name: 'Rune', role: 'App Admin', avatar: '⚙️',
    goals: [
      'Keep the app running, backlog prioritised, releases shipped',
      'Ensure data quality and user access control',
      'Evolve the product based on team feedback',
    ],
    activities: [
      'Manages backlog items, story map, and release planning',
      'Deploys updates and monitors for issues',
      'Reviews feedback and translates to backlog items',
      'Maintains design system and documentation',
    ],
    painPoints: [
      'Limited time — builds in spare hours between other work',
      'Balancing feature requests with technical debt',
      'Testing across multiple devices and roles',
    ],
    context: 'Desktop-first (VS Code + browser). PO + developer in one person, AI-assisted. Builds on evenings and weekends.',
  },
  {
    name: 'Mette', role: 'Relative (Interessent)', avatar: '👨‍👩‍👧',
    goals: [
      'Know when fight week is and where to watch',
      'See the fighter\'s schedule so she can plan around it',
      'Feel connected to the fighter\'s journey',
    ],
    activities: [
      'Checks shared calendar for upcoming sessions and events',
      'Watches fight announcements and results',
      'Asks the fighter about the weekly plan',
    ],
    painPoints: [
      'No visibility into the fighter\'s training schedule',
      'Always asking "when are you training?" or "when is the fight?"',
      'Fight details scattered across social media and messages',
    ],
    context: 'Interessent — læse-adgang til relevante dele af planen/stævnekalenderen. Mobile only (iPhone). Not tech-savvy. Wants simple, glanceable info.',
  },
  {
    name: 'Mikkel', role: 'Friend / Fan', avatar: '🎉',
    goals: [
      'Follow the fighter\'s journey and upcoming fights',
      'Know when and where to watch or attend events',
      'Show support and stay in the loop',
    ],
    activities: [
      'Follows fighter\'s social media and fight announcements',
      'Buys tickets or tunes in for live events',
      'Shares fight results with other friends',
    ],
    painPoints: [
      'Hard to find reliable fight schedules and results',
      'Misses events because announcements come too late',
      'No single source of truth for the fighter\'s record and upcoming bouts',
    ],
    context: 'Mobile (Instagram, browser). Casual engagement — checks in around fight announcements, not daily.',
  },
  {
    name: 'Per', role: 'Club Admin', avatar: '🏢',
    goals: [
      'Oversee the club\'s fight team within the broader club context',
      'Coordinate facility usage, insurance, and memberships',
      'Report on fighter activity for club/federation requirements',
    ],
    activities: [
      'Reviews team activity summaries monthly',
      'Manages facility bookings that overlap with fight-team sessions',
      'Handles federation registrations and insurance paperwork',
    ],
    painPoints: [
      'No aggregated view of fight-team activity for reporting',
      'Manual data entry for federation reports',
      'Scheduling conflicts between fight team and club classes',
    ],
    context: 'Laptop, works from the club office. Manages multiple teams/activities — fight team is one of many.',
  },
  {
    name: 'Søren', role: 'Manager (Interessent)', avatar: '💼',
    goals: [
      'Build the fighter\'s career and secure opportunities',
      'Track fight record, rankings, and contract status',
      'Coordinate with promoters and negotiate deals',
    ],
    activities: [
      'Pitches fighters to promoters for upcoming events',
      'Negotiates fight contracts and sponsorship deals',
      'Monitors fighter\'s training and readiness status',
      'Tracks record, rankings, and media exposure',
    ],
    painPoints: [
      'Fighter\'s training status is a black box',
      'No structured fight record or career overview in one place',
      'Communication with promoters is manual and fragmented',
    ],
    context: 'Interessent — læse-adgang til relevante dele af planen/stævnekalenderen. Laptop + phone. Manages multiple fighters across organisations. Needs quick overview, not training details.',
  },
  {
    name: 'Thomas', role: 'Promoter', avatar: '🎤',
    goals: [
      'Fill fight cards with competitive, reliable matchups',
      'Verify fighter availability, record, and weight class',
      'Communicate event details efficiently to all involved parties',
    ],
    activities: [
      'Scouts fighters for upcoming event cards',
      'Confirms availability and weight-class compliance',
      'Distributes event schedules, weigh-in details, and logistics',
    ],
    painPoints: [
      'Hard to verify fighter records and availability quickly',
      'Last-minute pull-outs due to injury or weight issues',
      'No standard way to exchange event/fighter information',
    ],
    context: 'Laptop. Runs 2–6 events per year. Works with multiple gyms and managers simultaneously.',
  },
  {
    name: 'Anna', role: 'Event Owner', avatar: '🏟️',
    goals: [
      'Deliver a professional, well-organised fight event',
      'Ensure all fighters, officials, and staff have the right info',
      'Manage ticket sales, venue logistics, and broadcast',
    ],
    activities: [
      'Coordinates venue setup, security, and medical staff',
      'Manages event timeline: weigh-ins, walkouts, fight order',
      'Handles media credentials and broadcast logistics',
      'Communicates with all stakeholders before and during event',
    ],
    painPoints: [
      'Information changes constantly leading up to the event',
      'Keeping all parties in sync is exhausting and error-prone',
      'No central system for event logistics — relies on spreadsheets and group chats',
    ],
    context: 'Laptop + phone on event day. Manages everything from venue contracts to broadcast. Extremely time-pressured on fight night.',
  },
];

export default function PersonaPage({ isDark }: Props) {
  const [data, setData] = useState<StoryMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);

  // Seed helper — builds a full StoryMapData with all seed personas
  const buildSeeded = useCallback((base: StoryMapData): StoryMapData => {
    let seeded: StoryMapData = { ...base, personas: [] };
    for (const seed of SEED_PERSONAS) {
      seeded = createPersona(seeded, seed.name, seed.role);
      const newest = seeded.personas[seeded.personas.length - 1];
      seeded = updatePersona(seeded, newest.id, {
        avatar: seed.avatar,
        goals: seed.goals,
        activities: seed.activities,
        painPoints: seed.painPoints,
        context: seed.context,
      });
    }
    return seeded;
  }, []);

  useEffect(() => {
    const unsub = subscribeStoryMap((d) => {
      // Seed personas only if Firestore has none
      if (d.personas.length === 0) {
        const seeded = buildSeeded(d);
        persistStoryMapData(seeded);
        setData(seeded);
      } else {
        setData(d);
      }
      setLoading(false);
    });
    return unsub;
  }, [buildSeeded]);

  const persist = useCallback(async (next: StoryMapData) => {
    setData(next);
    await persistStoryMapData(next);
  }, []);

  const handleCreate = () => {
    if (!data) return;
    persist(createPersona(data, 'New Persona', 'Role'));
  };

  const handleUpdate = useCallback((id: string, patch: Partial<Persona>) => {
    if (!data) return;
    persist(updatePersona(data, id, patch));
  }, [data, persist]);

  const handleDelete = useCallback((id: string) => {
    if (!data) return;
    if (!globalThis.confirm('Delete this persona?')) return;
    persist(deletePersona(data, id));
  }, [data, persist]);

  const handleResetToDefaults = () => {
    if (!data) return;
    if (!globalThis.confirm('Reset all personas to defaults? This will replace your current personas.')) return;
    const seeded = buildSeeded(data);
    persist(seeded);
  };

  // Collapse / expand
  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (allCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(data.personas.map(p => p.id)));
    }
    setAllCollapsed(!allCollapsed);
  };

  if (loading || !data) {
    return (
      <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
        Loading personas…
      </div>
    );
  }

  const ghostBtn = isDark
    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100';

  return (
    <div className="flex-1 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sketch Personas
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Lightweight index-card personas (Jeff Patton style) — who are we building for?
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.personas.length > 0 && (
            <>
              <button onClick={toggleAll}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${ghostBtn}`}
                title={allCollapsed ? 'Expand all cards' : 'Collapse all cards'}>
                <ChevronsUpDown className="w-4 h-4" />
                {allCollapsed ? 'Expand All' : 'Collapse All'}
              </button>
              <button onClick={handleResetToDefaults}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${ghostBtn}`}
                title="Reset to default personas">
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </>
          )}
          <button onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> New Persona
          </button>
        </div>
      </div>

      {/* Grid of persona cards */}
      {data.personas.length === 0 ? (
        <div className={`text-center mt-20 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          <p className="text-lg mb-2">No personas yet</p>
          <p className="text-sm">Click "New Persona" to create your first sketch persona.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.personas.map(p => (
            <PersonaCard
              key={p.id}
              persona={p}
              isDark={isDark}
              collapsed={collapsedIds.has(p.id)}
              onToggleCollapse={() => toggleCollapse(p.id)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
