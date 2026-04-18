// Target Architecture — the north star for incremental decisions
// Read at release planning. Updated at release review.
// Version history at the bottom.
export const TARGET_ARCHITECTURE = `# Target Architecture

> The architectural direction for FightWeek. This document is the bridge between the conceptual domain model ("what we want") and the current entity model ("what's built"). It guides every incremental decision so that today's work doesn't create tomorrow's structural debt.
>
> **Read at planning. Update at review.**

---

## Purpose

FightWeek is built incrementally — one release at a time. That's the right approach, but it carries a risk: locally sensible decisions that create global structural problems. This document prevents that by making the target visible, so every new feature is a step *toward* the north star, not sideways.

---

## Design Principles (Architectural)

These principles govern how we translate domain concepts into code and data:

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **Activity is the universal calendar atom** | Everything in the calendar — planned class, ad hoc run, tournament day, fravær — is an Activity. The training log is metadata *on* the activity, not a separate thing. |
| 2 | **Person = Firebase Auth user** | No separate identity store. A Person is the concept that wraps the Firebase Auth UID. If we need to reference people without accounts (opponents, contacts), that's a different entity. |
| 3 | **Team is independent of Gym** | Fighters train across multiple clubs. The team is the cross-cutting unit. Gyms are sources of training offerings, not organisational parents. |
| 4 | **Roles are contextual** | A person's role depends on context — Coach for Team A, Fighter in another. Roles belong on membership relationships, not on the person. |
| 5 | **Firestore-native design** | We design for Firestore's strengths (documents, subcollections, real-time listeners) not against them. No join tables — embed, denormalise, or use document references. |
| 6 | **Fravær ≠ Health Condition** | Fravær blocks calendar time (travel, exams, personal). Health Conditions track medical/physical state (injury, illness, asthma). They can overlap (sick = both) but are separate concepts. |
| 7 | **Log is annotation, not entity** | Training logging (readiness, intensity, notes, results) is metadata on an Activity, not a standalone record. Ad hoc activities are created first, then annotated. |
| 8 | **Make ad hoc frictionless** | Fighters must be able to log unplanned training (solo run, drop-in class) in one tap. Creating an Activity should be as easy as logging it. |
| 9 | **Competition results live on Activity** | Wins/losses/draws are optional fields on Activity (only relevant when type=tournament). No separate competition table. |

---

## Target Domain Model

### Entities and Relationships

\`\`\`
┌──────────────────────────────────────────────────────────────────┐
│                        ORGANISATION                              │
│                                                                  │
│  ┌────────┐    ┌────────────┐    ┌────────┐    ┌─────────────┐  │
│  │ Person │◄──▶│ TeamMember │──▶│  Team  │    │     Gym     │  │
│  │(= Auth)│    │  (role)    │    │        │    │  (source)   │  │
│  └───┬────┘    └────────────┘    └────────┘    └──────┬──────┘  │
│      │                                                │         │
│      │    ┌─────────────┐                             │         │
│      └───▶│  GymMember  │─────────────────────────────┘         │
│           │   (role)    │                                       │
│           └─────────────┘                                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     CALENDAR & ACTIVITY                           │
│                                                                  │
│  ┌─────────────────┐    ┌───────────────────────────────┐       │
│  │ CatalogueClass  │    │           Activity            │       │
│  │ (recurring offer)│───▶│ (the universal calendar atom) │       │
│  │ schedules[]     │    │ type: class | event | adhoc | │       │
│  └────────┬────────┘    │       fravær | rest           │       │
│           │             │ seriesId? → CatalogueClass    │       │
│           │             └──────────────┬────────────────┘       │
│  ┌────────▼────────┐                   │                        │
│  │ FavouriteSeries │          ┌────────▼─────────┐              │
│  │ (person × class)│          │  ActivityLog      │              │
│  └─────────────────┘          │ (readiness,       │              │
│                               │  intensity,       │              │
│                               │  notes, W/L/D)    │              │
│                               └────────┬─────────┘              │
│                                        │                        │
│                               ┌────────▼─────────┐              │
│                               │ ConditionImpact   │              │
│                               │ (condition × log) │              │
│                               └──────────────────┘              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         TRACKING                                 │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ HealthCondition  │                                           │
│  │ (injury, illness,│                                           │
│  │  chronic, etc.)  │                                           │
│  │ status: active/  │                                           │
│  │  healing/resolved│                                           │
│  └──────────────────┘                                           │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

### Entity Definitions

#### Person (= Firebase Auth User)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Firebase Auth UID |
| email | string | Login identity |
| displayName | string | How they appear in the app |
| avatarUrl | string? | Profile picture |

> **Current state:** \`USER_MAPPING\` in constants.ts. Target: Firestore document, seeded from Auth on first login.

#### Team

| Field | Type | Notes |
|-------|------|-------|
| id | string | Document ID |
| name | string | "Rumble" |
| description | string? | Team purpose |

> **Current state:** Implicit (one hardcoded team). Target: Firestore document at \`public/data/teams/{id}\`.

#### TeamMember

| Field | Type | Notes |
|-------|------|-------|
| personId | string | Firebase Auth UID |
| teamId | string | Team reference |
| role | string | 'head-coach' \\| 'coach' \\| 'coordinator' \\| 'fighter' |

> Stored as a subcollection or embedded array on the Team document. Replaces the global role in \`USER_MAPPING\`.

#### Gym (Source)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Document ID |
| name | string | "SIAM", "Rumble Sports" |
| address | string | Street address |
| phone | string? | Contact phone |
| email | string? | Contact email |
| scheduleUrl | string? | Link to their schedule page |
| lat/lng | number? | For distance features |

> **Current state:** ✅ Live — \`public/data/gyms/{id}\`. Already correct.

#### GymMember

| Field | Type | Notes |
|-------|------|-------|
| personId | string | Firebase Auth UID |
| gymId | string | Gym reference |
| role | string | 'member' \\| 'instructor' \\| 'admin' |

> Not needed now. Build when gym-level access control becomes a real requirement.

#### CatalogueClass (≈ ActivitySeries)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Document ID |
| title | string | "BJJ No-Gi – Fundamentals" |
| discipline | string | "BJJ", "MMA", etc. |
| subDiscipline | string? | "No-Gi", "Sparring" |
| level | string | "Beginner", "Advanced", "Kamphold", etc. |
| ageGroup | string? | "7-9 år" |
| gym | string | Gym name (denormalised) |
| location | string | Room/venue |
| address | string? | Street address |
| schedules | ClassSchedule[] | Recurring weekly timeslots |
| instructor | string? | Who teaches |
| description | string? | Free text |
| showRatings | boolean | Whether to show aggregated ratings |

> **Current state:** ✅ Live — \`public/data/catalogue/{id}\`. This IS the series concept. No rename needed.

#### Activity (the universal calendar atom)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Unique ID |
| personId | string | Whose calendar |
| type | string | 'class' \\| 'event' \\| 'adhoc' \\| 'fravær' \\| 'rest' |
| title | string | Session name |
| discipline | string? | Primary discipline |
| date | string | ISO date |
| startTime | string | HH:mm |
| endTime | string | HH:mm |
| location | string? | Where |
| status | string | 'planned' \\| 'completed' \\| 'cancelled' |
| seriesId | string? | Link to CatalogueClass (for recurring classes) |
| eventId | string? | Link to FightweekEvent (for events) |
| cancellationReason | string? | Why cancelled |

> **Current state:** This is today's \`Session\` object, embedded in weekly schedule documents. The evolution path: Session → Activity, with \`type\` field added and \`status: 'completed'\` enabled.

#### ActivityLog (annotation on Activity)

| Field | Type | Notes |
|-------|------|-------|
| activityId | string | Which Activity this logs |
| readiness | number? | 1–10 pre-training state |
| intensity | number? | 1–5 post-session load |
| relevance | number? | How relevant to current goals |
| notes | string? | Free text |
| wins | number? | Competition results (only for events) |
| losses | number? | Competition results |
| draws | number? | Competition results |

> **Current state:** Not built. Design: embedded as fields on the Activity document (not a separate collection). Firestore-native — avoids joins.

#### HealthCondition

| Field | Type | Notes |
|-------|------|-------|
| id | string | Document ID |
| personId | string | Whose condition |
| type | string | 'injury' \\| 'illness' \\| 'chronic' \\| 'other' |
| description | string | What happened |
| status | string | 'active' \\| 'healing' \\| 'resolved' |
| dateIncurred | string | ISO date |
| dateResolved | string? | Null if still active |
| blockedDisciplines | string[]? | Which disciplines are off-limits |
| maxIntensity | number? | Cap on training load |
| relatedActivityId | string? | Where it happened |

> **Current state:** Not built. Only \`cancellationReason\` on sessions exists. Target: \`users/{uid}/conditions/{id}\`.

#### ConditionImpact

| Field | Type | Notes |
|-------|------|-------|
| conditionId | string | Which HealthCondition |
| impactScale | number | 1–10 how much it affected session |

> Stored as an array on the ActivityLog (embedded, not a separate collection).

#### FavouriteSeries

| Field | Type | Notes |
|-------|------|-------|
| personId | string | Who favourited |
| seriesId | string | CatalogueClass ID |

> Stored as a \`favourites: string[]\` array on the Person document. No join table needed.

---

## Firestore Path Map (Target)

| Entity | Path | Status |
|--------|------|--------|
| Person (profile) | \`users/{uid}/profile\` | 📐 Replaces USER_MAPPING |
| Team | \`public/data/teams/{id}\` | 📐 New |
| TeamMember | \`public/data/teams/{id}/members/{uid}\` | 📐 New |
| Gym | \`public/data/gyms/{id}\` | ✅ Live |
| CatalogueClass | \`public/data/catalogue/{id}\` | ✅ Live |
| FightweekEvent | \`public/data/events/{id}\` | ✅ Live |
| Weekly Schedule | \`users/{uid}/weeks/week_{n}\` | ✅ Live (contains Activity/Session objects) |
| Standard Template | \`users/{uid}/templates/standard\` | ✅ Live |
| HealthCondition | \`users/{uid}/conditions/{id}\` | 📐 New |
| Backlog | \`public/data/backlog/items/{id}\` | ✅ Live |
| Feedback | \`public/data/backlog/feedback/{id}\` | ✅ Live |
| Story Map | \`public/data/story-map/main\` | ✅ Live |

> **Note:** ActivityLog fields are embedded on Activity/Session documents, not stored separately.

---

## Migration Sequence

Ordered by value and dependency. Each phase can be a release or part of a release.

| Phase | What | Depends on | Risk |
|-------|------|------------|------|
| **0. Robustness** | ESLint, Vitest, save wrapper, file extractions (Release 1.8) | Nothing | Low |
| **1. Activity evolution** | Add \`type\` and \`status: completed\` to Session. Enable post-session logging (intensity). | Nothing | Low — additive fields |
| **2. HealthCondition** | New entity, standalone tracker. Wire into session planning (warnings). | Nothing | Low — new feature, no migration |
| **3. Person + Roles** | Firestore-backed Person profile + Team + TeamMember. Replace USER_MAPPING. | Nothing | Medium — auth refactor |
| **4. Training Log** | Readiness + relevance + notes on Activity. ConditionImpact as embedded array. | Phase 1 + 2 | Low — additive |
| **5. FavouriteSeries** | Replace Standard Template with favourites-based schedule builder. | Phase 3 (needs Person doc) | Medium — UI change |
| **6. Competition tracking** | W/L/D fields on event Activities. Fight Camp concept. | Phase 1 | Low — additive |

---

## What NOT to Build Yet

These are explicitly parked. Don't engineer toward them, but don't block them either.

| Concept | Why parked | Unblock trigger |
|---------|-----------|----------------|
| **Multi-team** | One team exists (Rumble). Don't build team-selector UI. | Second team joins the platform |
| **GymMember entity** | No gym-level access control needed. Gyms are reference data. | A gym wants to manage their own schedule in the app |
| **Curated Catalogue** | Coach doesn't need a formal approval layer yet. | Team grows beyond ~12 fighters |
| **Goal Hierarchy** | Long/quarterly/weekly goals are envisioned but not blocking any release. | Coach requests it |
| **Fight Camp** | Preparation periods are interesting but complex. | A fighter has a confirmed fight date |
| **Weekly Plan Workflow** | Submit/review/approve cycle is designed but premature. | Coach actively reviews plans weekly |

---

## How This Document Is Used

| Ceremony | What we do with it |
|----------|--------------------|
| **Release Planning** | Consult the target architecture before selecting items. Ask: *"Does this slice align with the direction? Will we need to rework this later?"* |
| **Release Review** | Review against the target. Ask: *"Did we move toward or away from the north star? Did we learn something that changes the target?"* Update the document if understanding evolved. |
| **Implementation** | When a design decision comes up mid-item, check the design principles here before choosing. |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-18 | Initial version. Synthesised from PO's conceptual DBML proposal + AI Agent's critical analysis. Key decisions: Activity as universal calendar atom, Person = Auth user, Team independent of Gym, Firestore-native physical model. |
`;
