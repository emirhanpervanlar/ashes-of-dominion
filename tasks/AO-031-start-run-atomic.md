# AO-031 Atomic START_RUN (hero + starting relic) and run-summary data
Owner-intent: "hero and starting relic chosen on one screen; a full statistics screen when the run ends"
Agent: gameplay-economy
Priority: P1
Depends-on: none
Branch: ai/AO-031 (engine worktree)

## Source of truth
docs/DECISIONS.md AO-D029, D037, D027, D043; src/engine/run/runEngine.ts (`createRun`, `CHOOSE_STARTING_RELIC`, phase `choosing_starting_relic`), relics.ts (starting five), stats.ts (`run.stats`).

## Must change
1. New run action `START_RUN { heroId, relicId, name? }` (or extend `createRun` with a relicId) that creates the run and applies the starting relic in one step, landing on `on_map`; remove the `choosing_starting_relic` phase and the separate `CHOOSE_STARTING_RELIC` action; migrateRun turns an old save that is still in that phase into a run with the default relic (or lets it choose: pick the simplest safe behaviour, report it). Keep the deterministic seed behaviour.
2. Pure preview helper for the UI: `previewStart(heroId, relicId)` returning the resulting army (stacks/counts), max Mana, starting Gold and the relic's effect summary, without the UI re-implementing ARMY_SIZE_* / HERO_MAX_MANA / GOLD_FLAT maths. Also `startingRelicList()` in a UI-friendly order with name, description (drawbacks included), rarity, effect summary.
3. Run summary for the end screens: `runSummary(run)` returning ordered labelled stats for the Defeat/Victory screens: enemies killed, units lost, damage dealt/taken, battles won, turns played, gold/food gathered, food eaten, units starved (add to stats if missing), units revived, largest stack, cards played, days elapsed, chapter reached, bosses defeated, elites defeated, events resolved, relics collected (names), Threat, cause of death (army wiped / hero fell / starvation). Add any counter that is missing and cheap to collect in the run layer (starvation deaths, bosses, elites, events).
4. Tests, docs/SYSTEM_SPEC.md; list removed exports and the migration behaviour.

## Allowed files
src/engine/run/**, its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI (the UI task will consume this; list exact export names in the report), combat files.

## Acceptance criteria
tsc errors only in UI files that used the removed action/phase (listed exactly); vitest green apart from tests that belong to removed UI flows (list). Report exports.
