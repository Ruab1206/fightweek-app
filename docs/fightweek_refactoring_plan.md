# Fightweek Refactoring Plan

_Tracks the in-progress refactor toward the CalendarEntry/EventLog target model: what's done, what's active now, and what's explicitly deferred. Complements /docs/target_architecture.md (the stable north star) and /docs/fightweek_decisions.md (durable domain decisions) — this file is the living status/decision log for the refactor itself._

_Last updated: 2026-08-20_

---

## Status

### Phase 1 — Domain types & adapters (done)
Pure domain types (`EventOccurrence`, `CalendarEntry`, `EventLog`, etc.) and Firestore-free adapters translating current session/event/fravær shapes into the target vocabulary. No persistence change.

### Phase 2 — Log-protection decision layer (done, remains active)
Pure `decideDeletion` gate wired into session, fravær and event delete paths (desktop + mobile). Logged/noted occurrences are soft-cancelled instead of hard-deleted; series deletes report deleted/preserved counts.

**Phase 2 remains valid as the interim protection layer for the current (old) model.** It stays in place and is not being replaced by this plan.

**2026-08-01 decision:** stop spending further time on small Phase 2 polish (e.g. soft-cancel wording) unless it blocks verification or risks data loss. Further hardening of the old model is deprioritized in favor of building the new lifecycle in parallel.

### Phase 3 — CalendarEntry/EventLog strangler (in progress)
**Slice 1: Log completed self-posted training** — completed, tested, deployed to preview, manually verified successfully (2026-08-20).

See "Completed Slice: Log completed self-posted training" and "Next Planned Slice" below.

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

## Domain clarification: notes/comments vs logs

A **note or comment** attached to a calendar entry does **not**, by itself, mean that training or an event took place. A note may be any of:

- a planning note
- a reminder
- a comment before an event
- a reflection after an event
- an actual training observation

A **TrainingLog/EventLog is different**:

- it is an **explicit historical record**
- it represents something the user **intentionally registered as completed/happened**
- it must preserve enough context to be understandable **independently of active calendar visibility**

In short: a note is free-form annotation on a calendar entry; a log is an intentional, first-class assertion that "this happened." The presence of a note must never be treated as proof that training occurred.

This distinction must apply consistently across:

- self-posted training
- catalogue class calendar entries
- events
- fravær
- future participation flows

> **Relation to Phase 2:** Phase 2's log-protection layer currently treats any note as a signal to soft-cancel rather than hard-delete. That remains the correct **fail-safe for the old model** (better to preserve too much than lose real history). It is a protection heuristic, not a redefinition of "log" — the new lifecycle draws the note-vs-log line explicitly. This clarification does not change Phase 2 behavior.

---

## Completed Slice: Log completed self-posted training (verified 2026-08-20)

The first slice is specifically **"log completed self-posted training"** — a fighter records, after the fact, a self-posted training session they intentionally register as having happened. It is **log-after-the-fact** and produces an explicit `EventLog`, not merely a note on a calendar entry. This slice must **not** imply that all notes on all calendar entries are logs, or that a note is proof that training took place (see "Domain clarification: notes/comments vs logs" above).

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

### Verification checkpoint (2026-08-20)

Deployed commit: `968c9cf Omit undefined fields from completed training logs`

**Verified successfully on preview environment:**

1. ✅ Create completed training without location, notes, or intensity → saves successfully, no Firestore undefined-field error.
2. ✅ Create completed training with all optional details supplied → saves successfully, values render exactly as entered.
3. ✅ Firestore persistence and ordering after browser refresh → both entries visible, ordered by actual training start time.
4. ✅ Owner create access → fighter can log their own training.
5. ✅ Administrator read-only access → admin viewing another fighter's profile sees history but no create button.
6. ✅ Omitted optional values do not produce empty placeholders → clean history UI.
7. ✅ Kalender, Teamet, and Events views continue to work → no regression in existing flows.

**What this slice proves:**

- The new `CalendarEntry`/`EventLog` lifecycle can preserve training context independently of weekly calendar visibility.
- Explicit training logging (log-after-the-fact) is distinct from notes on calendar entries.
- Optional fields can be safely omitted without Firestore serialization errors.
- A chronological history view is independent of the old weekly calendar model.
- Access control (owner/read, admin/read-only) works correctly.

### Important: Secondary flow, not primary target

**This completed slice is an infrastructure proof and a valid secondary flow.** It demonstrates the new lifecycle for unplanned training that was not already present in the fighter's calendar.

**The primary target flow remains:**

1. Fighter has a training occurrence already in their fighter calendar.
2. Fighter opens the existing `CalendarEntry`.
3. Fighter explicitly selects "Log this training".
4. Training context is **prefilled** from the `CalendarEntry` and `EventOccurrence`.
5. Fighter adds actual participation/log details (notes, intensity, etc.).
6. Durable `EventLog` is created with preserved context.
7. Log remains understandable independently of later calendar changes.

The standalone "log completed training" entry point (demonstrated in this slice) is useful for unplanned/unscheduled training that the fighter wants to record. However, the primary flow will connect training logging to existing calendar entries.

**Guardrail:** A note or comment on a calendar entry must still not be treated as proof that the fighter participated. This distinction applies across all flows.

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

## Next Planned Slice: Discovery & Planning (not yet started)

Before implementing a second slice to connect training logging to existing calendar entries, the following discovery work is required:

**Inventory and assess existing entry types:**

1. Identify all types of calendar entries that already exist in fighter calendars (e.g., catalogue-class occurrences, self-posted training, events, fravær, etc.).
2. For each type, examine identity stability:
   - Does the entry persist with a stable id?
   - How is the entry stored and queried?
   - Are there transformation or reconciliation steps that could break the identity?
3. Determine which entry type is safest to connect first:
   - Prioritize simple, stable, single-owner types.
   - Defer complex flows (participation, series, source reconciliation) to later slices.
4. Define user-flow tests before implementation:
   - Verify the chosen entry type's UI and behavior remain unchanged when logging is added.
   - Define expectations for prefilled context.
   - Clarify how edit/cancel/remove operations interact with logs.

**Likely candidates for inspection** (not selected yet):

- Self-posted training already present in a fighter's calendar (simple, single-owner, no participation).
- An individual catalogue-class occurrence with a stable occurrence id.

**Deliverables:**

- A decision document comparing entry types by stability and complexity.
- User-flow tests for the chosen type.
- Updated backlog with the chosen slice, acceptance criteria, and known risks.

**Guardrails to maintain during discovery:**

- Do not implement logging integration during discovery — only inspect and assess.
- Do not broaden the domain model to support special cases.
- Preserve the note-vs-log distinction explicitly.
- Do not begin FullCalendar work yet (that remains a future spike).

---

## Future Spike: Calendar UI / FullCalendar Evaluation

A calendar UI spike remains planned. **FullCalendar** is the first candidate to evaluate. This is a **future spike, not the active next task** — it comes after the discovery work for the next slice and after more `CalendarEntry`/`EventLog` flows have been proven.

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
