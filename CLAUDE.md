# Ashes of Dominion — Project Instructions

Turn-based tactical strategy RPG / deckbuilding roguelike (TypeScript, React 18, Vite, Vitest). Browser game, engine and UI in one repo.
Owner speaks Turkish; **all UI text and code are English**. Talk to the owner in Turkish.

## Commands
- `npm run dev` (Vite) — use a port other than **5173** (5173 belongs to an unrelated project; never touch it). Kill your dev server when done.
- `npx tsc --noEmit` — typecheck. `npx vitest run` — tests. Both must be clean before anything is "done".
- Browser checks: puppeteer-core + `C:/Program Files/Google/Chrome/Application/chrome.exe`. Saved run lives in localStorage key `aod_run_state_v1` (inject it + click Continue to jump to any screen/phase).

## Source of truth — precedence (highest first)
1. `docs/DECISIONS.md` (owner decisions, append-only) — always wins.
2. `docs/SCREEN_SPEC.md`, `docs/SYSTEM_SPEC.md` (what is built now), `docs/DESIGN_BIBLE.md`.
3. `docs/01_CANONICAL_GDD.md` (original design) and `docs/00_GAME_VISION.md`.
If a lower doc contradicts a higher one, follow the higher one and note the drift in your report.

## Structure
```
src/engine/**   pure game logic (no React, no DOM). combat.ts damage.ts targeting.ts intents.ts army.ts data/**
src/engine/run/** run layer: map, city, merchant, events, rewards, food, runEngine.ts (single reducer: applyRunAction)
src/ui/**, src/App.tsx, src/index.css   presentation; App.tsx owns battle screen + screen routing
docs/  tasks/  .claude/agents  .claude/skills
```
The UI renders engine state; it never re-implements rules. Engine RNG is deterministic and centralized.

## Team (Director model)
Owner (human) decides. **Claude Director** = the main session: turns owner intent into tasks, dispatches specialists, reviews, asks the owner. Subagents cannot spawn subagents, so the Director dispatches every specialist directly; "teams" are ownership groupings:

| Team | Agent | Owns |
|---|---|---|
| Gameplay | `gameplay-combat` | combat rules, damage/heal math, targeting, AI intents, unit/card/hero data |
| Gameplay | `gameplay-economy` | run layer: map, food, gold, city, recruit, rewards, merchant, events, relics |
| UI | `ui-ux` | interaction design, screen specs, UX review (writes specs, not code) |
| UI | `ui-frontend` | React/CSS implementation of screens |
| QA | `qa-automated` | vitest tests + scripted browser checks |
| QA | `qa-playtest` | plays the game, reports balance/UX/bug findings (read-only) |
| Cross | `reviewer` | reviews any branch against its task + decisions (read-only) |

Dependency order for a feature: design/spec (ux) -> engine (gameplay) -> UI (frontend) -> tests/QA -> review. Do not run agents in parallel on the same files (`App.tsx`, `index.css` are hot spots) — sequential, or separate git worktrees.
Skills in `.claude/skills/`: `game-design`, `combat-review`, `ui-review`, `release-check`.

## Hard rules
1. **Never change game design on your own.** Contradiction, unclear spec, or a mechanic that looks broken *by design* -> stop that item and emit a DDR (below). Fixing a bug that violates the spec is fine; changing the spec is not.
2. Stay inside the task's `Allowed files`. Respect team ownership above.
3. Work on branch `ai/<task-id>`. Never push to `main` from an agent, never force-push. The Director merges.
4. Definition of done: tsc clean, vitest green, engine changes have a test that fails without the change, UI changes verified in a real browser and screenshots looked at.
5. No dead code, no compat shims, no speculative features. Delete CSS/props/functions your change leaves unreferenced. Comments only for non-obvious WHY.
6. Never weaken a test to make it pass. If a decision changed old behavior, update the test and say so.
7. Commits end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Detailed messages: what and why.
8. Do not push or open PRs unless the Director/owner asks.

## Design Decision Request (DDR)
```
DDR
issue: <one sentence>
current_spec: <doc + section>
problem: <why it fails>
options: [A, B (, C)]
recommendation: <one>
```
Continue unrelated items; do not implement the contested part. The Director takes it to the owner; the answer becomes an `AO-D###` entry in `docs/DECISIONS.md`.

## Task files (`tasks/AO-###-slug.md`)
Fields: Owner-intent, Agent, Priority, Depends-on, Branch, Goal, Must preserve, Must change, Allowed files, Forbidden, Acceptance criteria (pass/fail checkable), Verification.
Lifecycle: DRAFT -> DISPATCHED -> IN_REVIEW -> REVISION-n -> ACCEPTED (dated status line appended by the Director). Revisions are new sections in the same file.

## Agent report format
```
TASK <id> — status: DONE | PARTIAL | BLOCKED
changed: <files>
tests: <tsc / vitest result>
verified: <what was checked in a browser, or "not verified: why">
ddr: <none | list>
deviations: <anything not per acceptance criteria>
```
