# Grill Me Before Implementation

Use this prompt before implementing risky or non-trivial Fightweek changes.

## Token discipline

For assessment tasks, broad reading is acceptable if needed.

For implementation tasks:
- Do not read all docs by default.
- Do not scan broad folders unless necessary.
- First identify the minimal docs and files needed.
- Prefer targeted reads over repository-wide exploration.
- If more context is needed, explain why before expanding scope.

## First decide which docs are needed

Do not read all docs by default.

Read /docs/fightweek_decisions.md if the change touches:
- domain model
- recurring events
- logs
- participation
- favorites
- Firestore shape
- user/calendar ownership

Read /docs/fightweek_test_scenarios.md if the change touches:
- recurrence
- logs
- delete/cancel behavior
- participation
- favorites

Read /docs/fightweek_core_flows.md if the change touches:
- user flows
- coach/team events
- fighter-to-fighter invites
- favorites
- scheduling

Read /docs/fightweek_database_model.dbml only if the change touches:
- entities
- relationships
- persistence structure
- migration planning

## Before coding, return

1. My understanding of the task
2. Which docs I actually read and why
3. Affected domain concepts
4. Relevant decisions
5. Smallest safe implementation scope
6. Tests to add/update
7. Risks
8. Questions before implementation

Do not implement until the questions are answered.

End with:
"Please answer the questions above before I implement."