---
mode: agent
description: Read-only architecture gate for a proposed Fightweek strangler slice — check it against the canonical self-posted lifecycle and invariants, then give one verdict.
---

# Fightweek architecture check (pre-planning gate)

Use this **on demand**, before planning or implementing a domain/persistence slice that touches
calendar, occurrence, participation, notes, TrainingLog/EventLog, favorites, persistence,
projection, or routing. This is an approval gate, **not** an always-on instruction and **not** an
implementation step.

## Rules for this prompt

- **Read-only by default.** Do not edit, create, stage, commit, push, or deploy. Do not access
  live Firestore.
- The **normative** reference is `/docs/self_posted_lifecycle_and_invariants.md`. Also consult the
  linked `/docs/target_architecture.md` and `/docs/fightweek_decisions.md` where relevant.
- Judge the slice against the **invariants**, not against whether tests pass.

## Steps

1. **Restate the proposed slice** in one or two sentences (user outcome + what it changes).
2. **Reconstruct the affected domain operations** from the canonical contract's Section D
   (CreateSelfPostedOccurrence, AddOccurrenceToFighterCalendar, LogOccurrence,
   CreateCompletedUnplannedTraining, CancelCalendarEntry, RecordParticipation, AddNote).
3. **List every affected invariant** (I1–I18) and, for each, state aligned / at-risk / violated.
4. **Identify every persisted construct** the slice adds or changes (type, envelope, projection,
   discriminator) and **classify each as durable or TRANSITIONAL**; for transitional ones, give the
   retirement condition (I17).
5. **Check desktop / mobile / SearchOverlay parity** — is the rule implemented once and shared? (I13)
6. **Check whether UI origin or persistence collection drives domain ownership** — primary
   navigation, capabilities, or type must not be inferred from origin (I11, I16).
7. **Check whether an optional relation has become mandatory** — especially CalendarEntry↔TrainingLog
   (I2), and Participation inference (I5). Confirm I18 is respected (no new CalendarEntry source while
   the coupling exists).
8. **Check the slice gate** (canonical contract Section F) and **stop conditions** (Section G).

## Output

Answer the Section F gate questions explicitly, then give **exactly one** verdict:

- **approve for planning** — no invariant violated; transitional constructs are classified with a
  retirement condition; desktop/mobile/search parity holds.
- **revise before planning** — the intent is sound but one or more items must change first; list the
  precise, minimal corrections.
- **reject or split the slice** — the slice violates a stop condition or fuses concerns that must stay
  separate; state why and how to split it.

Do not implement anything. Do not proceed past the verdict.
