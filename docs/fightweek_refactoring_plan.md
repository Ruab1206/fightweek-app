# Fightweek Refactoring Plan

_Tracks the in-progress refactor toward the CalendarEntry/EventLog target model: what's done, what's active now, and what's explicitly deferred. Complements /docs/target_architecture.md (the stable north star) and /docs/fightweek_decisions.md (durable domain decisions) — this file is the living status/decision log for the refactor itself._

_Last updated: 2026-08-01_

---

## Status

### Phase 1 — Domain types & adapters (done)
Pure domain types (`EventOccurrence`, `CalendarEntry`, `EventLog`, etc.) and Firestore-free adapters translating current session/event/fravær shapes into the target vocabulary. No persistence change.

### Phase 2 — Log-protection decision layer (done, remains active)
Pure `decideDeletion` gate wired into session, fravær and event delete paths (desktop + mobile). Logged/noted occurrences are soft-cancelled instead of hard-deleted; series deletes report deleted/preserved counts.

**Phase 2 remains valid as the interim protection layer for the current (old) model.** It stays in place and is not being replaced by this plan.

**2026-08-01 decision:** stop spending further time on small Phase 2 polish (e.g. soft-cancel wording) unless it blocks verification or risks data loss. Further hardening of the old model is deprioritized in favor of building the new lifecycle in parallel.

### Phase 3 — CalendarEntry/EventLog strangler (starting now)
See "Active Slice" below.

---

## Direction: strangler/parallel implementation

The old model's structural issues (desktop/mobile delete divergence, sessions/events/fravær/self-posted training all behaving differently, notes only reachable through parent UI, no independent history view, no source→fighter reconciliation, business rules spread across UI) are not being fixed in place.

Instead: build a new `CalendarEntry`/`EventLog` lifecycle **beside** the old implementation, prove it on one flow, then migrate flows across one at a time. The old calendar/session model is left untouched until a new slice is proven.

The new lifecycle must prove:
- A note/log can be read **independently** of active calendar visibility.
- Historical training/session/event context is preserved even if the calendar entry is later removed.
- Calendar visibility and log/history are separate concerns.
- The old calendar remains untouched until the new slice is proven.

---

## Active Slice: Self-posted training

**Why this slice first:** single-owner, single-calendar, no participation, no series/recurrence, no source-calendar reconciliation — the cleanest testbed for the CalendarEntry/EventLog spine without touching any of the harder open problems.

The slice must demonstrate:

1. Create occurrence/context for self-posted training.
2. Create a calendar entry (or equivalent planning/history reference).
3. Create an `EventLog` with preserved training context.
4. Show the log in a chronological history view.
5. Allow calendar-entry removal later without making the log meaningless.

### Product decisions recorded (2026-08-01)

| # | Decision |
|---|----------|
| 1 | **First slice:** self-posted training. |
| 2 | **Entry point:** a new, separate "Log training" / "Self-posted training" entry point. Not merged into the existing add-session flow yet. |
| 3 | **Plan vs log:** support **log-after-the-fact** first — the fighter records training that already happened. Plan-ahead self-posted training is not required for v1. |
| 4 | **History view v1:** shows new logs only. Legacy notes (existing `meta/notes`) are **not** included in v1; a read-bridge to surface them may be added later. |
| 5 | **Minimum log fields v1:** notes, discipline/category, start/end or duration, optional intensity if easy, and preserved training context. |
| 6 | **Discipline/category:** reuse the existing category/discipline conventions where available (no new taxonomy). |
| 7 | **Removal semantics:** do not over-polish wording yet. The invariant that matters is that history remains readable with training context — exact copy/labels are not a priority now. |
| 8 | **Editing:** v1 = create + log + chronological history view. Editing an existing log/entry can come later unless trivial to include. |

---

## Explicitly out of scope for the first slice

- Participation normalization.
- "Interesseret" / "Tilmeldt" / "Ikke interesseret" status handling.
- #1221 source-calendar-no-longer-offered warning.
- Fravær notes.
- Recurrence refactor.
- Series exceptions.
- Source/gym calendar reconciliation.
- Migration of existing `weeks`/`meta/notes` data.
- Postgres/Supabase migration.

---

## Future Spike: Calendar UI / FullCalendar Evaluation

A calendar UI spike remains planned. **FullCalendar** is the first candidate to evaluate. This is a **future spike, not the active next task** — it comes after the first `CalendarEntry`/`EventLog` strangler slice (self-posted training) has proven the basic lifecycle.

The UI library must not drive the domain model. The spike evaluates whether a calendar component can render and interact with the cleaned-up `CalendarEntry`/`EventOccurrence` model, and helps decide whether to replace or reduce the current custom calendar UI.

**Questions the spike should answer:**

- Can it render `CalendarEntries` from the new model?
- Can it support day/week/month style calendar views?
- Can it represent cancelled, removed, logged, source-missing or source-changed entries clearly?
- Can it support mobile behavior better than the current custom UI?
- Can it support future recurrence interactions without forcing bad domain design?
- Does it reduce duplicated desktop/mobile calendar behavior?

**Out of scope for the spike:**

- Do not change the domain model to fit FullCalendar.
- Do not replace the whole calendar UI in one step.
- Do not implement recurrence behavior as part of the spike.
- Do not implement #1221 as part of the spike.
- Do not implement participation normalization as part of the spike.

---

## Relationship to other docs

- **Target vocabulary and entity definitions:** see [/docs/target_architecture.md](../docs/target_architecture.md) — this plan does not redefine `EventOccurrence`/`CalendarEntry`/`EventLog`, it tracks progress toward them.
- **Durable domain rules** (e.g. logged occurrences must never hard-delete): see [/docs/fightweek_decisions.md](../docs/fightweek_decisions.md).
- **This document** is updated as the refactor progresses (slice completed, next slice chosen, scope decisions made) — it is expected to change more often than the other two.
