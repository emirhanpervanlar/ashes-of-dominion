# AO-007 Reposition stacks outside battle (run action)
Owner-intent: "the player can reposition their units whenever they want outside battle; in battle only cards do it" (AO-D015)
Agent: gameplay-economy
Priority: P1
Depends-on: AO-006 merged
Branch: ai/AO-007

## Goal
A run-level action that moves a stack to a position (1-6), swapping with the stack already there, available whenever the run is not in battle.

## Must change
- New `RunAction` `MOVE_STACK { stackId, toPosition }`. Valid in phases `on_map` and `city` only; rejected in battle/reward/event/merchant. Moving to an empty position relocates; moving to an occupied position swaps the two stacks' positions. Same position is a no-op without an error event. Living stacks only (wiped stacks are already dropped).
- Positions and stackIds: `stackId` currently embeds the position (`player_<unit>_<position>`). Moving must NOT create duplicate ids or stale ids; decide the simplest correct approach (e.g. keep stackId stable after creation and make sure nothing derives the position from the id — grep for such assumptions in engine and UI and list them in the report, do not edit UI). Add a test proving ids stay unique across a sequence of recruit / move / swap / split / merge.
- Recruit rule (AO-D015) already holds: same type merges, else first free slot. Add a test that pins it.
- Add a `RunEvent` (e.g. `STACK_MOVED`) only if the History log should show it; if you add one, list it in the report so ui-frontend adds its text in `runEventText.ts`.
- Update `docs/SYSTEM_SPEC.md` (Run layer).

## Allowed files
src/engine/run/** and tests, docs/SYSTEM_SPEC.md.

## Forbidden
src/ui/**, src/App.tsx, combat files. If a stackId assumption lives in combat/army files, stop and report.

## Acceptance criteria
1. MOVE_STACK relocates, swaps, and is rejected during battle and other non-map/city phases. 2. Unique ids across the mixed sequence test. 3. Recruit merge/first-free-slot pinned by test. 4. tsc clean, vitest green.

## Extra (from AO-006 review)
Training Hall description in src/engine/run/city.ts still reads "Hero max AC +1 and max DC +1" — AC/DC no longer exist (AO-D001). Change the text to say it grants +2 max Mana (matches the actual effect). Update any test that asserts the old string.

## Status
- 2026-09-19 ACCEPTED (179/179). No STACK_MOVED run event added (frequent UI action); ids never change on move; split id collision fixed in run layer.
