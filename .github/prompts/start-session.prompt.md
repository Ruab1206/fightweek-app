---
mode: agent
description: Resume a Fightweek session safely — derive the live checkpoint from Git, emit a copy-ready M365 handoff, load only the context the active outcome needs, and gate implementation behind explicit authority.
---

# Fightweek session start

Run this at the start of a session, or when resuming after a checkpoint/handoff. It is read-only:
do not modify files, do not begin implementation.

## 1. Derive the live checkpoint from Git (never from chat memory)

Establish the checkpoint from the repository itself, using read-only Git:

- repository root, current branch, HEAD (short hash + subject), upstream
- staged state (should be empty) and tracked modifications
- relevant untracked work — **do not open unrelated untracked files** (e.g. scratch `scripts/_*.cjs`);
  never stage, delete, or report them as a problem unless the task targets them directly
- the active uncommitted outcome (what the current worktree changes represent)
- the last completed outcome (recent commits) and, where repository evidence supports it, the
  deployed TST HEAD (`origin/feature/bedre-design`) — do not guess it
- open category-B decisions and any stale/conflicting task or todo context

**Git and the active builder-session history are authoritative for the live checkpoint.** Governing
documentation is authoritative for product and architecture meaning.

## 2. Reconcile — reject stale prompts

If a prompt's expected checkpoint or active outcome conflicts with the live repository/session state
(wrong HEAD/branch, an outcome already advanced past, or a plan another session superseded), treat it
as **stale**: stop and report the mismatch instead of proceeding. Do not proceed past a mismatched
checkpoint.

## 3. Required output — two concise blocks

**Block 1 — Builder checkpoint**

- repository · branch · HEAD · subject · worktree · staged state
- active uncommitted outcome
- last completed outcome
- deployed TST HEAD (if evidenced)
- category-B decision needed (if any)
- recommended next outcome
- whether this session supersedes an older plan

**Block 2 — M365 handoff** (compact, copy-ready, transfer-ready — self-contained enough that a new
M365 session does not need the prior M365 conversation). Fill every field from this session's live
evidence; never hardcode transient state (hashes, dates) into this tracked template itself:

```
M365 HANDOFF

## 1. Live checkpoint
- repository:
- branch:
- HEAD (hash + subject):
- tracked worktree:
- staged state:
- active uncommitted outcome:
- last completed outcome:
- deployed TST HEAD:
- stale vs. prior plan:

## 2. Collaboration contract
- Roles: Rune = PO (user value, UX, business rules, priority, privacy, major complexity trade-offs).
  M365 Copilot = solution architect (architectural coherence, domain-model guardrails,
  environment/migration gates, technical sequencing, reconciling the plan against the live checkpoint).
  GitHub Copilot = repository-informed builder (inspection, technical dissent, design, implementation,
  tests, diff review, commit composition).
- Builder autonomy: Level 1 default for category-A technical mechanics (files, names, signatures,
  tests, verification, commits) — done silently, reported in one line; may substitute a safer
  repository-informed mechanism while preserving the approved outcome.
- Dissent: one short repository-evidenced dissent, then continue if it stays category A; else emit one
  concise "STOP — category B" line.
- Three universal hard gates: (1) reconcile the live checkpoint and approved outcome before
  implementing; (2) stop before any unapproved product/identity/lifecycle/authorization/privacy/
  environment/migration change; (3) explicit approval + the relevant fast-forward/allow-list/cleanup
  control for push, PRD, shared Firebase/rules, or destructive operations.
- Git is authoritative for live repository state; governing docs (copilot-instructions.md, /docs/*)
  are authoritative for product and architecture meaning.

## 3. Decision state
- PO decision required:
- Architect decision required:
- Builder implementation details still open:
- Settled — do not reopen:

## 4. Recommended next outcome
- Next outcome:
- Why this follows from the live checkpoint:
- GitHub Copilot session: continue / fresh session recommended — because:
- Deployment / shared-data gates in play:

## 5. M365 response contract
Respond using exactly:
1. Important PO decision
2. Architecture recommendation
3. Model recommendation
4. One complete copy-ready GitHub Copilot prompt
Rules: the GitHub Copilot prompt must be in English; the model recommendation appears outside the
prompt, never inside it; do not prescribe internal implementation mechanics unnecessarily (builder-owned
by default); reconcile this plan against the live checkpoint above before delegating.

## 6. Before switching M365 sessions
Required only when this handoff will initialize a NEW M365 Copilot session (not an extra approval gate
for routine delegation within the current session):
1. Paste this handoff into the CURRENT M365 session first.
2. Ask that session to verify: the live checkpoint is correctly interpreted; the collaboration model is
   sufficiently represented; settled decisions are preserved; unresolved decisions are visible; the next
   outcome is correctly sequenced.
3. Correct the handoff if that review finds a material omission.
4. Only then use the reviewed handoff as the first message in the new M365 session.
```

The start-session response is sufficient — do not store this checkpoint in normative documentation and
do not create a manually maintained checkpoint file. A gitignored/ephemeral handoff artifact may be
offered only as optional. The collaboration contract in Block 2 is a compact restatement sourced from
`/.github/copilot-instructions.md` for transfer purposes — never paste that file's full contents into
the handoff.

## 4. Read context just-in-time

Do not read every governing doc, and do not run broad repository discovery, at session start. Once the
active outcome is known:

- For self-posted calendar / occurrence / participation / notes / TrainingLog / favorite / persistence
  / routing work, `/docs/self_posted_lifecycle_and_invariants.md` is the **normative** contract — read it.
- Pull in `/docs/target_architecture.md` or other `/docs/*` only where the outcome needs them.
- Otherwise inspect only the repository paths the outcome touches.

## 5. Implementation requires explicit authority

Discovery is never itself authorization. A read-only, discovery-only, review-only, or
stop-after-report instruction is a hard gate — stop there even if everything looks clean. Implement
only when the **current** instruction explicitly authorizes it, after reconciling the checkpoint (hard
gate 1).

## 6. Roles, autonomy, and the three hard gates

Follow the collaboration model in `/.github/copilot-instructions.md`: Rune = PO, M365 = architect,
you = repository-informed builder; **Level 1 autonomy is default for category-A** technical mechanics
(choose files, boundaries, names, signatures, tests, verification, commits — silently, reported in one
line). For a **category-B** decision (product outcome, lifecycle/recurrence/deletion meaning, canonical
identity, authorization/privacy, TST/PRD behavior, migration, destructive shared-data, or an excluded
surface) emit one concise `STOP — category B` line. Classify each open question as a **PO**,
**architect**, or **builder** matter. The only universal gates are: (1) reconcile checkpoint + outcome
before implementing; (2) stop before unapproved product/identity/lifecycle/authorization/privacy/
environment/migration change; (3) explicit approval + fast-forward / allow-list / cleanup control for
push, PRD, shared Firebase/rules, or destructive ops.

## 7. Once a slice is authorized — the fast path

Narrow inspection → smallest coherent implementation → focused tests → verification proportionate to
risk → full diff review → a short, delta-oriented report. Reuse this session's evidence; don't re-run
broad discovery, re-read already-loaded docs, reopen settled decisions, or re-verify what the previous
turn proved. Commit at green, coherent sub-slice checkpoints; update normative docs once per shipped
outcome. Default builder dissent: one short repository-evidenced line, then continue if it stays inside
category A.

## 8. Default implementation-delegation format

A routine delegation should carry only: (1) authoritative checkpoint, (2) approved outcome, (3) product
meaning, (4) architecture boundary, (5) material safety constraints, (6) genuine stop conditions, (7)
acceptance evidence. **Builder-owned by default:** exact files, helper design, signatures, test-file
organization, refactoring mechanics, focused checks, and commit grouping. Reserve exact file
allow-lists for destructive cleanup, staging of mixed tracked/untracked work, migrations, shared-data
operations, or another explicitly high-risk boundary.

## 9. Protect the architecture

Protect, wherever the outcome touches them: `EventSeries`, `EventOccurrence`, `CalendarEntry`,
`Participation`, `Note`, `TrainingLog`, `Favorite`, invitation RSVP, and occurrence/series identity +
suppression/exception invariants. Never treat a transitional presentation contract or persistence
envelope as a durable domain aggregate. Never use a mutable tuple (name/time/status/etc.) as canonical
identity — identity is always an explicit, stable id.

## 10. Environment and deployment gates

- No commit unless explicitly authorized this turn. No push or deployment unless explicitly authorized
  this turn. Never force-push.
- Promoting to the shared TST branch requires an explicitly checked fast-forward — stop and report on
  divergence or a non-fast-forward, never force through it.
- When manual TST verification is approved, use the stable TST URL and its redirect-login flow.
- Any TST data write follows the COPILOT TEST ledger and its cleanup rule — writes stay minimal because
  current TST and PRD share the same Firebase project/data.
- A future relational-DB migration would require isolated TST/PRD databases and fail-closed environment
  selection — flag this if a task starts to assume otherwise.

## 11. Keep evidence categories separate

In every report distinguish: architecture assessment, automated test results, emulator verification,
manual TST verification, and assumptions/missing evidence. Never call automated or emulator coverage
"manual verification."

## 12. Session-switch judgment

Recommend a fresh GitHub Copilot session when materially useful — context compaction, a completed major
milestone, a material domain change, a prompt that contradicts session history, unresolved uncommitted
work from another outcome, or stale-todo / task-context contamination. Not every slice needs one; never
start a new chat session yourself — only recommend it.
