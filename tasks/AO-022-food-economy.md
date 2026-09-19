# AO-022 Food economy: per-unit upkeep, loot, Farm
Owner-intent: "food is not understandable; show daily consumption; each unit eats differently and more with count; loot after battles; a farm in the city so I can balance food with upgrades"
Agent: gameplay-economy
Priority: P0
Depends-on: AO-021 merged
Branch: ai/AO-022

## Source of truth
docs/DECISIONS.md AO-D048 (and D020 buildings), src/engine/run/food.ts, city.ts, GDD section 25.

## Must change
1. Upkeep: `foodPerUnit` per unit type in unit data (heavy Knight highest, Priest/Archer middle, Swordsman/Goblin low; choose numbers so the starting armies cost about 3-6 Food per day and a 60-unit army about 25-40; ONE table). Daily upkeep = sum(count x foodPerUnit). Replace the old army-size tier formula in `moveFoodCost` (Stable -25% stays, rounded down, min 1). Expose `dailyUpkeep(run)`, a per-stack breakdown `stackUpkeep(stack)`, `dailyProduction(run)` and the net for the UI.
2. Loot (AO-D053): after a won battle resource loot is RANDOM (deterministic through the run RNG): Gold is common; Food is NOT guaranteed and drops with a low probability. Amounts and the Food chance improve with the chapter / day and enemy strength (elite more); constants in one table; events carry the amounts (`stats.foodGathered/goldGathered` updated). Report the resulting expected Gold/Food per battle for early, mid and late chapter.
2b. City card removal (AO-D052): free the first time, then the price grows exponentially per use in the run (50, 100, 200, 400 ... Gold; constants in `run/cardRemoval.ts`); drop the once-per-7-days limit for the City only; Merchant and Reward removal unchanged; `cardRemovalQuote` reflects it; update tests.
3. Farm building: produces Food per day, 3 tiers (upgradeable like the Mage Tower: one slot, cumulative +2 / +5 / +9 Food per day, costs 60 / 140 / 320 Gold; proposal, constants in one block). Production applies through the same per-day hook as Gold Mine. Truthful descriptions.
4. Starvation rules stay (no instant unit deletion without warning): verify and expose a `foodWarning` (Food will run out within 3 days at the current net) for the UI.
5. Tests, docs/SYSTEM_SPEC.md, migrateRun for old saves.

## Allowed files
src/engine/run/**, src/engine/data/units.ts (foodPerUnit field only), tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules/damage, card data, other unit stats.

## Acceptance criteria
tsc and vitest green; report lists new exports and a table of daily upkeep for the three starting armies and a 60-unit army, and net food over 30 days with no production vs Farm tier I.

## Status
- 2026-09-19 ACCEPTED (engine; 313/314 tests, the remaining failure is the missing Farm icon for the UI task). Numbers retuned to targets after a balance flag: foodPerUnit 0.1/0.2/0.5, Farm +3/+6/+9.
