# AI Rules — Ashes of Dominion

Read this and `docs/DECISIONS.md` before touching anything. Canonical design: `v3/ashes_of_dominion_canonical_v1.md`
(where `DECISIONS.md` conflicts with it, DECISIONS.md wins — it is newer).

## Roles
- **Owner** (human): final product decisions.
- **Director** (Claude lead session): turns owner intent into tasks, dispatches agents, reviews results, asks the owner when a design decision is needed.
- **Agents** (`.claude/agents/`): gameplay, ui, qa, reviewer. They implement/verify; they do not decide design.

## Hard rules
1. **Never change game design on your own.** If a spec is contradictory, unclear, or a mechanic looks broken by design, STOP that item and emit a Design Decision Request (below). Fixing a bug that violates the spec is fine; changing the spec is not.
2. Stay inside the task's `Allowed files`. Do not touch `Forbidden` areas.
3. Engine (`src/engine/**`) stays independent of React/HTTP. UI never re-implements combat math.
4. Definition of done: `npx tsc --noEmit` clean, `npx vitest run` green, new behavior has a test when it is engine logic, UI changes were checked in a real browser (puppeteer) when feasible.
5. Never force-push, never push to `main` from an agent. Work on a branch `ai/<task-id>`; the Director merges.
6. No dead code, no compat shims, no speculative features, comments only for non-obvious WHY.
7. Tests must not be weakened to go green. If a test encodes old behavior that a decision changed, update it and say so in the report.

## Design Decision Request (DDR)
When blocked by a design question, append to your report:
```
DDR
issue: <one sentence>
current_spec: <where / what it says>
problem: <why it fails>
options: [A, B (, C)]
recommendation: <one>
```
Continue with unrelated items; do not implement the contested part.

## Report format (end of every task)
```
TASK <id> — status: DONE | PARTIAL | BLOCKED
changed: <files>
tests: <tsc / vitest result>
verified: <what was checked in browser, or "not verified: why">
ddr: <none | list>
deviations: <anything not per acceptance criteria>
```
