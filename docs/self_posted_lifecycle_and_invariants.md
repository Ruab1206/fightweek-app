# Self-Posted Lifecycle and Invariants — Canonical Contract

_This is the single normative source of truth for the self-posted-training strangler's domain concepts, application operations, and invariants. It is database-neutral and UI-entry-neutral. Other documents and Copilot instructions reference this file rather than restating it._

_Read at planning for any change touching calendar, occurrence, participation, notes, TrainingLog, favorites, persistence, projection, or routing. Update at review, only through an explicit architecture decision recorded in `/docs/fightweek_decisions.md`._

_Status: normative. Last updated: 2026-08-24._

_Relationship to other docs: `/docs/target_architecture.md` remains the north-star vocabulary and points here for self-posted lifecycle normativity; `/docs/fightweek_decisions.md` records the durable decisions (this contract is consistent with decisions §17, §18, §19); `/docs/fightweek_refactoring_plan.md` tracks in-progress status against this contract._

---

## A. Purpose

This contract exists to prevent, during and after the strangler refactor:

- different UI entry points from creating different domain models or business rules;
- persistence envelopes from becoming accidental domain entities;
- new special cases being introduced for a single flow;
- mandatory coupling between concepts that MUST remain independent;
- infrastructure choices (collection shape, persistence origin, atomic-write convenience) from determining product meaning.

The objective of the refactor is not to reproduce existing user flows. It is to establish **canonical domain concepts** and **uniform application operations** so that how a training was created never changes what it is.

---

## B. Canonical concepts

These are domain concepts. They are independent of persistence technology, collection names, and UI entry points.

### EventOccurrence
- One concrete occurrence of an activity in time.
- Owns occurrence identity and timing.
- MAY exist independently of a fighter's calendar, participation, notes, and TrainingLog.

### CalendarEntry
- One fighter-specific calendar relation to an `EventOccurrence`.
- MAY exist without `TrainingLog`, `Participation`, and `Note`.
- MUST NOT be treated as proof of attendance or completion.
- Its meaning MUST be independent of how it was created.

### TrainingLog
- An explicit historical record created by the fighter (the fighter asserts "this happened").
- MUST remain understandable from its own self-contained snapshot.
- MAY be associated with an `EventOccurrence`.
- MUST NOT define `CalendarEntry` identity.
- MUST NOT prove or create `Participation`.
- Calendar-originated uniqueness (at most one per fighter per occurrence) is a business invariant (see I8).
- Standalone historical compatibility remains supported only where explicitly documented (see I9).

### Participation
- Separate from `CalendarEntry` and `TrainingLog`.
- MUST NOT be inferred from calendar presence, notes, or a log; it exists only when an explicit operation creates it.

### Note or Comment
- Separate contextual information attached to a calendar entry or occurrence.
- MUST NOT be treated as proof of participation or completion.

### Favorite
- A separate private user preference/bookmark.
- Not part of this self-posted lifecycle slice.

---

## C. Canonical invariants

- **I1.** `EventOccurrence` MAY exist without `CalendarEntry`.
- **I2.** `CalendarEntry` MAY exist without `TrainingLog`.
- **I3.** `CalendarEntry` MAY exist without `Participation`.
- **I4.** `TrainingLog` MAY exist without `Participation`.
- **I5.** Notes or comments MUST NOT prove `Participation`.
- **I6.** Calendar presence MUST NOT prove attendance or completion.
- **I7.** A fighter MUST NOT have more than one `CalendarEntry` per `EventOccurrence`. Zero or one is valid; more than one is a data-integrity conflict, not normal behaviour.
- **I8.** A fighter MUST NOT have more than one calendar-originated `TrainingLog` per `EventOccurrence`. Zero or one is valid; more than one is a data-integrity conflict, not normal behaviour.
- **I9.** Standalone historical `TrainingLog`s MAY exist without provenance only where backward compatibility explicitly allows it.

**Enforcement note (I7/I8).** These are mandatory business invariants, not optional preferences. Current application or persistence enforcement of I7/I8 MAY be transitional or incomplete — deferred or partial enforcement does not weaken the invariants themselves. Current enforcement status is documented in Section E (transitional-state register) and in `/docs/fightweek_decisions.md` §17 and §19; this contract does not claim current persistence already enforces I7 or I8 atomically.
- **I10.** `TrainingLog` MUST own a self-contained historical snapshot.
- **I11.** Provenance describes origin and association only. It MUST NOT define the object's domain type, primary navigation, or capabilities.
- **I12.** The UI entry point MUST NOT change the resulting domain meaning.
- **I13.** Desktop, mobile, and SearchOverlay MUST use the same application rules.
- **I14.** A persistence envelope is not automatically a domain aggregate.
- **I15.** No new persisted special type MAY be introduced merely for one UI entry point.
- **I16.** Capability differences MUST be explicit application decisions, not inferred inside presentation components from collection names or persistence-origin discriminators.
- **I17.** Transitional records and adapters MUST state: why they exist, which invariant they cannot yet satisfy, their replacement direction, and the condition for retirement.
- **I18.** No new `CalendarEntry` source MAY be implemented while `CalendarEntry` creation remains obligatorily coupled to `TrainingLog`.

Wording above is reconciled with `/docs/fightweek_decisions.md` §17 (one calendar-originated TrainingLog per occurrence), §18 (standalone flow is transitional), and §19 (UI mitigation vs atomic enforcement are distinct). It introduces no contradiction with those decisions.

---

## D. Canonical application operations

Application operations are conceptual contracts. All new or changed domain behaviour MUST be expressed through these canonical operation contracts, and they MUST behave identically across desktop, mobile, and SearchOverlay (I13). An explicitly documented transitional adapter MAY continue to support unchanged legacy behaviour during the strangler — existing production behaviour (e.g. the legacy week/session model) remains operational until its replacement is proven, and no new coupling to that legacy model may be introduced. Section E is the factual register of current transitional behaviour.

### CreateSelfPostedOccurrence
- **Purpose:** create a concrete self-posted `EventOccurrence`.
- **Input:** occurrence details (title, discipline, timing, location).
- **Output:** an `EventOccurrence`.
- **Invariants used:** I1, I12.
- **Independent of:** `CalendarEntry`, `Participation`, `Note`, `TrainingLog`.
- **Scope:** future (not yet independently implemented).

### AddOccurrenceToFighterCalendar
- **Purpose:** create a `CalendarEntry` relating an existing `EventOccurrence` to a fighter's calendar.
- **Input:** an `EventOccurrence` reference + fighter identity.
- **Output:** a `CalendarEntry`.
- **Invariants used:** I2, I3, I7, I12.
- **Independent of:** `TrainingLog`, `Participation`, `Note`.
- **Scope:** future (not yet independently implemented).

### LogOccurrence
- **Purpose:** create a `TrainingLog` for an occurrence the fighter asserts happened.
- **Input:** an occurrence reference (or self-contained snapshot) + log details.
- **Output:** a `TrainingLog` with a self-contained snapshot.
- **Invariants used:** I8, I10, I11.
- **Independent of:** `Participation`; MUST NOT define `CalendarEntry` identity.
- **Scope:** current for legacy calendar-originated logging; future for logging an existing new-model `CalendarEntry`.

### CreateCompletedUnplannedTraining
- **Purpose:** the user-visible "Log træning" action for unplanned training that already happened.
- **Composition:** `CreateSelfPostedOccurrence` + `AddOccurrenceToFighterCalendar` + `LogOccurrence`.
- **Input:** completed-training details.
- **Output:** an occurrence, a calendar entry, and a training log.
- **Invariants used:** I7, I8, I10, I11, I12, I14.
- **Notes:** MAY remain one atomic transaction for user and integrity reasons. Atomic composition MUST NOT imply that `CalendarEntry` conceptually requires `TrainingLog`. This is a composition of the three general operations, not a fourth primitive.
- **Scope:** current (implemented today as one fused transaction — see §E; it MUST be recomposed from the general operations rather than remaining a bespoke primitive).

### CancelCalendarEntry
- **Purpose:** mark a fighter's calendar relation as cancelled without destroying history.
- **Input:** a `CalendarEntry` reference.
- **Output:** the `CalendarEntry` in a cancelled state.
- **Invariants used:** I2, I10 (a cancelled entry MUST NOT delete an associated log).
- **Scope:** deferred.

### RecordParticipation
- **Purpose:** create/update explicit `Participation` for an occurrence or series.
- **Input:** occurrence/series reference + participation status.
- **Output:** a `Participation` record.
- **Invariants used:** I3, I4, I5, I6.
- **Independent of:** `CalendarEntry`, `TrainingLog`, `Note` (participation is never inferred).
- **Scope:** deferred.

### AddNote
- **Purpose:** attach free-form contextual note/comment to a calendar entry or occurrence.
- **Input:** target reference + note text.
- **Output:** a `Note`.
- **Invariants used:** I5, I6.
- **Independent of:** `Participation`, `TrainingLog` (a note is not a log and not proof of attendance).
- **Scope:** current (legacy `meta/notes`), transitional.

---

## E. Transitional-state register

The following is the current known transitional state, stated factually. None of it is the general target model.

- Legacy self-posted calendar sessions remain in `users/{fighterKey}/weeks/week_{n}` documents. **TRANSITIONAL.**
- `NewModelCalendarAggregate` is a **TRANSITIONAL** persistence envelope for completed unplanned training only. It is not the general `CalendarEntry` target aggregate.
- The envelope currently embeds an `EventOccurrence`, a `CalendarEntry`, and a `logRecordId`.
- `logRecordId` is a co-persistence pairing reference for this use case. It is **not** a general one-log-per-occurrence uniqueness mechanism and MUST NOT be generalised as such.
- Current Firestore rules atomically pair the envelope and the `TrainingLog` for this use case (bilateral create). This enforces integrity for the completed-unplanned transaction only.
- This pairing does **not** define the general `CalendarEntry` lifecycle. Under this envelope, `CalendarEntry` cannot yet exist without a `TrainingLog` — the invariant it cannot yet satisfy is **I2/I18**.
- The projected `calendar_entry` card is a **TRANSITIONAL** read-model discriminator, not a durable domain type.
- **Occurrence/CalendarEntry snapshot divergence (TRANSITIONAL).** For one completed-unplanned save, the persisted aggregate and the persisted `TrainingLog` represent occurrence/calendar context *differently*: (A) `occurrence.endDateTime` — **converged for future writes (decision §25):** the TrainingLog snapshot now consumes the same constructed `EventOccurrence` as the aggregate (one local-safe datetime, no independent UTC/ISO recompute). Existing persisted logs are unchanged and may still carry the legacy UTC/ISO duration-derived end. (B) `occurrence.hasLogs` — present (`true`) on the TrainingLog snapshot, absent on the aggregate occurrence. (C) embedded `calendarEntry.userId` — present on the aggregate's CalendarEntry, omitted on the TrainingLog's embedded CalendarEntry. Dimensions (B) and (C) **remain divergent and separately gated**; only the timing dimension (A) is converged. For new writes, one constructed occurrence now feeds both persisted snapshots' timing; `hasLogs` ownership and the embedded-CalendarEntry fields do not yet. This is a documented gap, **not data corruption**.
- **Snapshot normalization is separately gated.** A later architecture gate must decide the canonical datetime representation, `hasLogs` ownership, embedded-CalendarEntry snapshot fields, backward compatibility for existing logs, and whether schema versioning or read adapters are required. The **future-write occurrence-timing dimension is now decided (decision §25)** — new writes share one constructed occurrence's timing. The remaining sub-decisions (`hasLogs` ownership, embedded-CalendarEntry fields, existing-log backward compatibility, schema versioning) stay gated. No migration decision is made here. No new `CalendarEntry` source may proceed as a consequence of documenting this gap.
- **TrainingLog legacy end/duration recoverability (TRANSITIONAL, factual).** A read-only recoverability investigation established: an offset-free local `startDateTime` is a deterministic wall-clock value; an offset-free local explicit `endDateTime` is likewise deterministic (duration between two local values is timezone-independent wall-clock arithmetic). A duration-derived legacy `endDateTime` persisted as a UTC-Z or offset-bearing instant **cannot be mapped back to an original local end time or duration** — no writer timezone, IANA zone, offset, or independent duration was ever persisted, and reconstruction was proven reader-runtime-timezone-dependent (deterministic under only one specific reader timezone, wrong or negative under others). Read-side interpretation MUST preserve this ambiguity rather than resolve it. Runtime/browser/device/server timezone MUST NOT define historical meaning. Provenance (`origin`) MUST NOT select snapshot/datetime interpretation — interpretation is driven by the persisted datetime's own format (and, later, an explicit version field), never by `origin.type`. Current persisted records remain valid, readable, and are **not** classified as corrupted. No migration is approved.
- Legacy and new-model persistence coexist during the strangler. This coexistence is expected.
- No migration or rollback is currently required.
- Existing verified checkpoints (e.g. `503e207`, Checkpoint B → `598e488`, `cea8a3e`) remain valid evidence and MUST NOT be reverted merely because their implementation is transitional.
- **Replacement direction:** deeper `CalendarEntry` lifecycle separation (I2, I18) is required before adding any additional `CalendarEntry` source.
- **Retirement condition:** the envelope and its bespoke pairing MAY be retired once independently usable `CreateSelfPostedOccurrence` + `AddOccurrenceToFighterCalendar` + `LogOccurrence` operations exist and `CreateCompletedUnplannedTraining` is recomposed from them.

---

## F. Slice architecture gate

Every proposed domain or persistence slice MUST answer all of the following explicitly before implementation:

1. Which canonical domain concept changes?
2. Which canonical application operation is used or introduced?
3. Which invariants are affected?
4. Can every concept still exist independently as required?
5. Is the slice cut by domain lifecycle or by UI entry point?
6. Does it introduce a persisted type, envelope, projection, or discriminator?
7. Why is an existing canonical concept insufficient?
8. Is the new construct durable or TRANSITIONAL?
9. How is transitional code identified and retired?
10. Are business rules identical across desktop, mobile, and SearchOverlay?
11. Which layer owns each rule — domain, application, persistence, security, or presentation?
12. Does the slice create a relation that the target model says is optional?
13. Can the proposed implementation support the next source without another special type?
14. What proves that tests cover product invariants rather than only implementation behaviour?

A slice MUST NOT proceed until these answers are explicit.

---

## G. Stop conditions

Copilot or a contributor MUST stop before implementation and report a guardrail concern if a proposal:

- introduces a second representation of an existing target concept without an adapter and a retirement plan;
- makes `CalendarEntry` require `TrainingLog`;
- infers `Participation` from `CalendarEntry`, `TrainingLog`, or `Note`;
- creates different business rules for desktop and mobile;
- routes primary domain behaviour by persistence collection or UI origin;
- introduces a new persistence envelope without classifying it as durable or TRANSITIONAL;
- changes a cardinality invariant without an explicit decision;
- adds a new `CalendarEntry` source before the lifecycle separation is approved (I18);
- uses database choice to define the domain model;
- claims test success as proof of architecture compliance without checking the invariants.

---

## H. Database-neutrality

- The domain model and application contracts are defined **before** choosing Firestore, PostgreSQL, or another persistence technology.
- Persistence technology MUST be evaluated against the approved invariants (Section C), not the reverse.
- A database MAY enforce invariants but MUST NOT define the domain lifecycle.
- No relational-migration decision is made by this document. Firestore remains the active datastore per `/docs/fightweek_decisions.md` §16; this contract does not change that.

---

## I. Current next architectural sequence

Intended sequence, documented but not implemented here. It MAY be changed only through an explicit architecture decision recorded in `/docs/fightweek_decisions.md`.

1. Approve this lifecycle and invariant contract.
2. Evaluate current code against it.
3. Extract independently usable pure canonical operations (`CreateSelfPostedOccurrence`, `AddOccurrenceToFighterCalendar`, `LogOccurrence`) and recompose current completed-unplanned behaviour from them. This step is behaviour-preserving: it establishes domain/application operation boundaries only. It does **not** make I2 true in persisted behaviour — persistence and Firestore-rule correction (step 5) remain separately gated and are not performed here. **Partially implemented:** `CreateSelfPostedOccurrence` (narrow occurrence input) and `AddOccurrenceToFighterCalendar` are canonical pure operations and feed the aggregate through one authoritative envelope assembler; the TrainingLog is still produced by a TRANSITIONAL current-snapshot adapter (`buildTransitionalSelfPostedTrainingLog`), now **fed the same constructed occurrence so its timing converges with the aggregate (decision §25)** while `hasLogs`/embedded-CalendarEntry snapshot fields still diverge (Section E items B/C). The final occurrence-oriented `LogOccurrence` remains deferred behind the snapshot-normalization gate (step 3a).
   - **3a-read (in progress — see decision §24). Ambiguity-preserving compatibility read adapter.** A pure, timezone-independent TrainingLog compatibility read model classifies each persisted snapshot's datetime format and renders start deterministically always; renders end/duration deterministically (`'exact'`) only when both start and end are offset-free local wall-clock strings; classifies a UTC-Z or offset-bearing legacy end as `'ambiguous'` (or `'unavailable'` for missing/invalid) rather than inventing a local end or a runtime-timezone-derived duration. Verified deterministic under multiple runtime timezones. No persisted change; not normalization of historical values.
   - **3a-write (separately gated, unchanged by 3a-read).** Decide the canonical **future-write** datetime representation, `hasLogs` ownership, embedded-CalendarEntry snapshot fields, backward compatibility for existing logs, and whether an explicit persisted schema/snapshot version is required; then make the final occurrence-oriented `LogOccurrence` emit one approved canonical snapshot. **The future-write occurrence-timing dimension is now decided (decision §25):** new-model unplanned writes share one constructed occurrence's timing between the aggregate and the TrainingLog snapshot (Section E item A converged). The remaining sub-decisions (`hasLogs` ownership, embedded-CalendarEntry fields, existing-log backward compatibility, schema versioning) stay gated. No migration decision is made until this gate. Legacy records are not required to satisfy information they never stored.
4. Introduce a shared `CalendarEntry` read/detail contract (presentation convergence). This follows the operation extraction in step 3, so presentation convergence does not conceal an application boundary that is still fused.
5. Introduce independently persistable self-posted `EventOccurrence` and `CalendarEntry` support (the step where persisted I2 is corrected).
6. Recompose completed-unplanned persistence from the canonical operations, retaining atomic user-visible save behaviour.
7. Enable logging an existing new-model `CalendarEntry`.
8. **No new `CalendarEntry` source may proceed until persisted I2 separation (step 5) is approved and implemented** (I18 remains in force throughout steps 3–4).
9. Evaluate target persistence technology after the canonical model is sufficiently defined.
