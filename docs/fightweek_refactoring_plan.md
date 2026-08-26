# Fightweek Refactoring Plan

_Tracks the in-progress refactor toward the CalendarEntry/EventLog target model: what's done, what's active now, and what's explicitly deferred. Complements /docs/target_architecture.md (the stable north star) and /docs/fightweek_decisions.md (durable domain decisions) — this file is the living status/decision log for the refactor itself._

_Last updated: 2026-08-26_

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

**Slice 2: Calendar-originated logging** — completed, tested, deployed to preview:
- calendar-entry discovery and candidate selection completed
- individual self-posted legacy calendar occurrence selected and verified as the first calendar-originated candidate
- calendar-originated create flow implemented and verified
- exact-provenance read-side association implemented and verified
- none/one/conflict classification and visible creation gating implemented and verified
- verified in desktop view
- verified in responsive mobile view using a resized desktop browser
- physical mobile-device verification remains outstanding

See "Completed Slice: Log completed self-posted training", "Phase 3 checkpoint (2026-08-22)" and "Next Planned Slice" below.

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

## Phase 3 checkpoint (2026-08-22): calendar-originated logging, association and integrity classification

Discovery for the second slice is complete. The chosen candidate — an individual self-posted legacy calendar occurrence — was selected, connected to logging, given read-side association, and given read-side integrity classification, across three verified commits:

- `503e207` — calendar-originated creation from an existing self-posted legacy calendar session.
- `24ad192` — exact-provenance read-side association and read-only detail.
- `27f1434` — loading/error/none/one/conflict classification and visible creation gating.

### What the first calendar-originated strangler slice proves

- A legacy session can be adapted without pretending it already is normalized persistence.
- `EventOccurrence` and `CalendarEntry` context can be extracted in pure application/domain logic.
- Explicit fighter action creates a self-contained `TrainingLog`.
- History remains independent of later calendar changes.
- Optional provenance supports exact read-side association.
- Standalone visually similar logs are not associated without provenance.
- Shared application behavior supports desktop, responsive mobile view, and SearchOverlay entry paths.
- Data conflicts can be surfaced without destructive automatic cleanup.

### Product invariant and current enforcement level

- Intended cardinality: zero or one `TrainingLog` per fighter and concrete calendar occurrence.
- Two or more is a data-integrity conflict, not normal behavior.
- The current UI mitigation (loading/error/none/one/conflict) is verified.
- Atomic persistence enforcement is **not** implemented.
- Concurrent duplicate writes remain a known, currently low-risk hardening gap.
- Atomic reservation/rules work is deferred and separately approval-gated ("Slice B").

### Manual verification evidence (2026-08-22)

The `feature/bedre-design` preview at commit `27f1434` was manually verified in desktop view and responsive mobile view in a resized desktop browser; physical mobile-device verification remains outstanding — it is not claimed as done, and mobile is not described as unverified, since shared application logic and automated tests already cover the common desktop/mobile/SearchOverlay path.

Verified in both desktop view and responsive mobile view:

- An eligible self-posted calendar training can be opened.
- The calendar-originated logging flow is available when no associated log exists.
- The logging form receives prefilled calendar context.
- Associated TrainingLogs are shown through exact provenance.
- A one-log state shows the existing log read-only and does not offer another create action.
- A multi-log state shows a clear data-integrity conflict.
- Conflicting logs remain inspectable read-only.
- No log is selected as canonical.
- "Log denne træning" is unavailable in the conflict state.

### Standalone-flow consistency direction (clarification, not yet implemented)
Conceptually, every `TrainingLog` belongs to a training occurrence. The existing standalone "Log træning" flow remains a valid transitional secondary flow for unplanned training. Today it creates self-contained occurrence, calendar-entry, and log context inside the new `TrainingLog` aggregate, but it does not create a visible legacy calendar session.

This must not become the permanent conceptual end state. The target behavior for unplanned training must eventually be one of:

- the action consistently creates the required new-model `EventOccurrence` + `CalendarEntry` + `TrainingLog`, allowing the training to participate in the calendar model; or
- the standalone creation action is removed when the calendar-originated flow can fully replace it.

No new special case is being added to the old week documents to satisfy this direction. This is recorded as a product/model clarification that must be resolved before expanding the standalone flow — it is not decided or implemented here.

### Application-boundary drift + architecture gate (2026-08-23)

A read-only architecture investigation (against committed HEAD `cea8a3e`) confirmed a real application-boundary drift, distinct from — and more precise than — the standalone-flow clarification above:

- `EventOccurrence`, `CalendarEntry`, and `TrainingLog` are valid separate target concepts, and the completed-unplanned-training slice atomically creating all three was useful and **remains valid**.
- However, the current new-model `CalendarEntry` (the `NewModelCalendarAggregate` envelope) is **log-gated in that specific use case**: it cannot exist without the paired `TrainingLog` (coordinator builds both; service writes both; Firestore rules require bilateral pairing).
- The projected calendar entry opens the `TrainingLog` as its **primary detail**, so the "Log træning" entry point partially leaked into application-boundary and presentation ownership.
- This is **important transitional debt, not a blocker**, and MUST NOT become a pattern for future slices.

**Pause / gate (in force):**

- **No new `CalendarEntry` source may be implemented** until the canonical `CalendarEntry` lifecycle is independent of `TrainingLog` (invariants I2/I18 in the canonical contract).
- Existing commits (`503e207`, Checkpoint B → `598e488`, `cea8a3e`) remain valid verified evidence and **must not be reverted** merely because their implementation is transitional.

**Canonical contract:** the normative domain concepts, application operations, invariants, transitional-state register, and slice gate now live in [/docs/self_posted_lifecycle_and_invariants.md](./self_posted_lifecycle_and_invariants.md). This plan tracks status against that contract; it does not restate it.

**Next required architecture checkpoint (updated 2026-08-23 — decision §22):** a first application of the committed architecture gate to a proposed combined correction returned "reject or split the slice." The clarified sequence is:

1. **Pure canonical operation extraction first** — `CreateSelfPostedOccurrence`, `AddOccurrenceToFighterCalendar`, `LogOccurrence`, with the existing completed-unplanned coordinator recomposed from them. Behaviour-preserving; no persistence, rule, or UI change; does **not** make I2 true in persisted behaviour.
2. Shared `CalendarEntry` read/detail contract (presentation convergence) — follows step 1, so it cannot mask the still-fused application boundary.
3. Persisted I2 correction (independently persistable self-posted `EventOccurrence`/`CalendarEntry` support) — separately gated, later.
4. **No new `CalendarEntry` source may proceed** until step 3 is approved and implemented (I18 unchanged).

**Extraction status (updated 2026-08-23 — decision §23):** step 1 above is **partially implemented**. `CreateSelfPostedOccurrence` (narrow occurrence input) and `AddOccurrenceToFighterCalendar` are canonical pure operations; the aggregate is assembled through one authoritative envelope assembler. The TrainingLog is still built by a TRANSITIONAL current-snapshot adapter because the persisted aggregate and TrainingLog snapshots currently **diverge** (occurrence `endDateTime` representation, `occurrence.hasLogs`, embedded `calendarEntry.userId`). Both forms are preserved and pinned by parity tests; **snapshot normalization (final occurrence-oriented `LogOccurrence`) is a separate gate (step 3a)** — see decision §23 and the canonical contract Section E/I. No migration is decided.

**Read-adapter status (updated 2026-08-23 — decision §24):** a read-only recoverability investigation established that a duration-derived legacy TrainingLog end (UTC-Z/offset) cannot be deterministically reconstructed to a local end/duration (no writer timezone/offset/independent duration was ever persisted). The **next implementation slice is 3a-read: a timezone-independent, ambiguity-preserving TrainingLog compatibility read adapter** — deterministic where the persisted end is offset-free local text, honestly classified `'ambiguous'`/`'unavailable'` otherwise; no persisted change, no migration, no writer change. This is a read-side correction, **not** normalization of historical values. The shared `CalendarEntry` read/detail contract (step 2 above) can follow only after subordinate TrainingLog rendering is routed through this adapter — the aggregate's own occurrence/CalendarEntry context is already canonical and needs no adapter. Future canonical write format and any persisted schema/snapshot version remain separately gated (3a-write), **except the future-write occurrence-timing dimension, now decided (decision §25, 2026-08-24)**: new-model unplanned writes feed the paired TrainingLog snapshot the same constructed `EventOccurrence` as the aggregate, converging occurrence `endDateTime` (Section E item A) at the write path. `hasLogs` ownership, embedded-CalendarEntry fields, existing-log backward compatibility, and schema versioning stay gated. No persisted change to existing logs, no rule change, no migration.

**Occurrence-timing read correction (2026-08-23, follow-on to 3a-read):** for a TrainingLog with exactly one exact calendar association (`new_model_calendar_entry` or `self_posted_calendar_session`), a shared pure resolver (`resolveTrainingLogHistoryItem`) now prefers the associated occurrence's own start/end/duration over the log's own (possibly ambiguous) snapshot — the associated occurrence remains authoritative per decision 4/5 above. Falls back to the unchanged 3a-read compatibility reader whenever no exact association exists, the classification is `'conflict'`/`'none'`/`'loading'`/`'error'`, or the associated occurrence's own timing is not itself safe. No persisted change, no migration, no writer change, no rule change. Wired into both App.tsx association views and `TrainingLogPage`'s history list.

**TrainingLogPage legacy-session parity fix (2026-08-23, same day follow-on):** TST verification showed `self_posted_calendar_session`-origin logs still showed the fallback specifically on `TrainingLogPage`, because that page had no way to obtain the legacy session behind a log's `origin` (unlike App.tsx's open `SessionModal`, where the session is already in memory). Closed with a TRANSITIONAL legacy read adapter, split into a Firestore-aware week loader (`legacySessionAssociationService.loadLegacyWeekDocument` — one `getDoc` per fighter+ISO-week, no session-matching knowledge) and a pure selector (`legacySessionAssociation.resolveLegacySessionTimingFromWeekData` — exact `sessionId` match on the day `occurrenceDateISO` implies; never fuzzy). `TrainingLogPage` caches/dedupes by `fighterKey|weekNumber` (not per-session), so several logs in the same fighter/week share one read; a request remembers which fighter it was issued for and is discarded if the fighter switches or the page unmounts before it resolves, so no cross-fighter or post-unmount state leak is possible. `TrainingLogPage` and App.tsx now produce identical duration for the same exact association, closing the parity gap the prior entry above left open. Why the adapter exists, the invariant it cannot yet satisfy, its replacement direction, and its retirement condition are stated in its own doc-comment (I17).

See the canonical contract's "Current next architectural sequence" (Section I) for the full sequence.

### Persisted CalendarEntry independence checkpoint (2026-08-24–25 — decision §26)

Following the timing-convergence slice above, five further slices established independent `CalendarEntry` persistence and Firestore-rules-layer support for logging an existing independent entry. See decision §26 for the full PO clarification and retirement gate; this entry states only what is now complete versus not.

**Complete:** timing convergence (`6d068e3`); `logRecordId` optional at the type/assembler contract (`fedca70`); `calendarEntryService` read tolerance for its absence (`3d7b833`); Firestore rules permitting independent, log-less `CalendarEntry` create (`b156edd`); a dedicated persistence operation, `persistIndependentCalendarEntry` (`cee40b0`); Firestore rules permitting a `TrainingLog` to reference an already-existing independent `CalendarEntry` via unidirectional provenance (`b57fefb`); the application composition that logs against an existing independent `CalendarEntry`, `addTrainingLogForExistingCalendarEntry` (`ee35671`).

**Not complete:** a production caller/UI source for either independent-entry creation or logging one; manual TST verification of the end-to-end flow; recomposition of completed-unplanned onto these operations; `logRecordId` retirement; bilateral-rule retirement; I7/I8 hard (atomic) enforcement.

**Next sequencing (unchanged direction, decision §26):** (1) approved production application/UI wiring from `CalendarEntry` (reusing `addTrainingLogForExistingCalendarEntry`); (2) read-side duplicate-mitigation using association state (mirroring the existing none/one/conflict classification) before any create action is exposed; (3) manual TST verification; (4) separately gated completed-unplanned recomposition and its PO atomicity/UX decision; (5) only then is `logRecordId`/bilateral-pairing retirement considered.

### Shared calendar detail contract checkpoint (2026-08-25 — decision §27)

The shared `CalendarItemDetail`/`CalendarItemCapabilities` read/detail contract named as step 2 of the architecture checkpoint above now exists, with two proof source adapters: legacy self-posted training (`81bf1a5`) and events (`1d98454`).

**Complete:** the pure contract types; the legacy self-posted adapter; the event adapter; **the first non-self-posted production presentation consumer, `EventDetail` (`dfcc985`)** — common detail/capability fields cross the shared boundary while native event signup and other source-specific event behaviour remain on the existing `FightweekEvent` path, unchanged. The event adapter deliberately excludes the event's native signup status (`interested`/`signed-up`/`declined`) from the shared contract — those values target distinct future concepts (`CalendarEntry`, `Favorite`) that remain unimplemented, and `declined` has no approved durable target (decision §27). Current event signup persistence and `useEventMerge` calendar-visibility behaviour are unchanged.

**Not complete:** shared presentation convergence across all calendar sources; legacy `SessionModal`/`SessionDetailSheet` consumption; catalogue-class presentation consumption; invitation presentation consumption; calendar grid/list consumption of the shared contract; canonical event `EventOccurrence`/`CalendarEntry` persistence; `Favorite` implementation; event-status compatibility or migration; general desktop/mobile/SearchOverlay convergence.

**Next architecture-level priority:** a bounded readiness assessment for full-calendar UI evaluation against the already-documented evaluation criteria (see below) — not vendor/library selection or integration, which remain separately gated.

### Next planning focus

- Optionally perform physical mobile-device verification when proportionate.
- Clarify the target new-model behavior of standalone/unplanned completed training (see above).
- Then select the next domain-model strangler step.
- Atomic reservation/persistence-level uniqueness is **not** automatically the next active slice — it remains explicit deferred hardening.
- Catalogue integration, Participation, recurrence, reconciliation, and FullCalendar remain deferred unless deliberately selected.

### Retrospective

- Define cardinality and conflict behavior before implementation.
- Distinguish observe, mitigate, and atomically enforce as separate stages — do not conflate a UI mitigation with atomic enforcement.
- Manually verify a vertical slice before adding migration or persistence hardening.
- Preserve uncommitted isolation and small, reversible commits.
- Verify Copilot reports against actual code, Git state, deployed commit, and UI evidence — not against the report alone.
- Keep prompts checkpoint-specific instead of combining UI, rules, migration, and rollout in one pass.
- Apply risk-proportionate hardening rather than automatically implementing every theoretically possible concurrency safeguard.

---

## Future Spike: Calendar UI / FullCalendar Evaluation

A calendar UI spike remains planned. **FullCalendar** is the first candidate to evaluate. This is a **future spike, not the active next task** — it comes after the discovery work for the next slice and after more `CalendarEntry`/`EventLog` flows have been proven. The required non-self-posted presentation proof now exists (`EventDetail`, `dfcc985` — see the checkpoint above), so a bounded readiness assessment against the questions below may now be considered before any vendor/library comparison or implementation. This does not select a component, approve integration, or mean the current contract is necessarily final — most detail surfaces (legacy self-posted, catalogue, invitations, calendar grid/list) still do not consume it.

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
