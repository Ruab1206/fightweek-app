---
mode: agent
description: Resume a Fightweek session safely — verify repo state, load only the context the current item needs, and gate implementation behind explicit authority.
---

# Fightweek session start

Run this at the start of a session, or when resuming after a checkpoint/handoff.

## 1. Checkpoint first

Check, before anything else:

- current branch
- current HEAD (hash + subject)
- tracked worktree is clean (or list what's dirty)
- staged state is empty (or list what's staged)
- if deployment/TST is in scope this turn, the relevant upstream ref too

Preserve pre-existing untracked files (e.g. scratch `scripts/_*.cjs`) — never stage, delete, or
report them as a problem unless the user's task targets them directly.

If the user gave an expected checkpoint (branch/HEAD/commit subject), confirm it matches. **Stop
and report** if it differs — do not proceed past a mismatched checkpoint.

## 2. Read context just-in-time, not upfront

Do not read every governing doc at session start. Once you know the current item:

- For self-posted calendar/occurrence/participation/notes/TrainingLog/favorite/persistence/routing
  work, `/docs/self_posted_lifecycle_and_invariants.md` is the **normative** contract — read it.
- Pull in `/docs/target_architecture.md` or the other `/docs/*` files only where the item actually
  needs them (recurrence math, test scenarios, core flows, decisions log).
- Otherwise, inspect only the repository paths the item touches.

## 3. Role split

- **Rune** — Product Owner (product/user-journey decisions).
- **M365 Copilot** — solution architect (lifecycle/invariant assessment).
- **GitHub Copilot (you)** — repository-informed builder.

When you surface an open question, classify it explicitly as a **PO decision**, an **architect
decision**, or a **builder implementation detail**. Don't decide product meaning yourself.

## 4. Implementation requires explicit authority

Completing repository discovery is never itself authorization to code. Before writing any code,
report:

- repository evidence found
- concrete disagreement or risk (if any)
- affected canonical concepts (see §6)
- affected invariants
- proposed smallest coherent slice
- stop conditions
- whether a PO decision is still open

Only implement when the **current** user instruction explicitly authorizes it. A read-only,
discovery-only, review-only, or stop-after-report instruction is a hard gate — stop there even if
everything looks clean.

## 5. Fast path once a slice is approved

For a normal, already-authorized slice: narrow inspection → smallest coherent implementation →
focused tests → verification proportionate to risk → full diff review → a concise, decision-oriented
report.

Avoid: re-running broad repository discovery you already did this session, re-reading governing
docs you already loaded, reopening a settled PO/architect decision, unrelated refactoring,
unnecessary documentation commits, and treating green tests as proof of untested lifecycle
semantics they don't actually cover.

## 6. Protect the architecture

Identify and protect, wherever the current item touches them: `EventSeries`, `EventOccurrence`,
`CalendarEntry`, `Participation`, `Note`, `TrainingLog`, `Favorite`, invitation RSVP, and
occurrence/series identity + suppression/exception invariants.

Never treat a transitional presentation contract or persistence envelope as a durable domain
aggregate. Never use a mutable tuple (name/time/status/etc.) as canonical identity — identity is
always an explicit, stable id.

## 7. Environment and deployment gates

- No commit unless explicitly authorized this turn.
- No push or deployment unless explicitly authorized this turn. Never force-push.
- Promoting to the shared TST branch requires an explicitly checked fast-forward — stop and report
  on divergence or a non-fast-forward, never force through it.
- When manual TST verification is approved, use the stable TST URL and its redirect-login flow.
- Any TST data write follows the COPILOT TEST ledger and its cleanup rule — writes stay minimal
  because current TST and PRD share the same Firebase project/data.
- A future relational-DB migration would require isolated TST/PRD databases and fail-closed
  environment selection — flag this if a task starts to assume otherwise.

## 8. Keep evidence categories separate

In every report, distinguish: architecture assessment, automated test results, emulator
verification, manual TST verification, and assumptions/missing evidence. Never call automated or
emulator coverage "manual verification."

## 9. Final report shape

Keep it concise: checkpoint result, evidence/disagreement, implementation summary, verification
results, exact changed files, remaining open decisions, commit/deployment status, recommended next
action.

## 10. Session-switch judgment

At a natural commit or slice checkpoint, state whether continuing in this session is safe or
whether a fresh session is recommended before the next slice (e.g. before a materially different
risk class like activating a production trigger). Never start a new chat session yourself — only
recommend it.
