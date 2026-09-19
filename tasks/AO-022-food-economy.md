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
2. Loot: winning a battle gives Gold and Food loot scaled by enemy strength (elite more); constants in one place; events carry the amounts (`stats.foodGathered/goldGathered` updated).
3. Farm building: produces Food per day, 3 tiers (upgradeable like the Mage Tower: one slot, cumulative +2 / +5 / +9 Food per day, costs 60 / 140 / 320 Gold; proposal, constants in one block). Production applies through the same per-day hook as Gold Mine. Truthful descriptions.
4. Starvation rules stay (no instant unit deletion without warning): verify and expose a `foodWarning` (Food will run out within 3 days at the current net) for the UI.
5. Tests, docs/SYSTEM_SPEC.md, migrateRun for old saves.

## Allowed files
src/engine/run/**, src/engine/data/units.ts (foodPerUnit field only), tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules/damage, card data, other unit stats.

## Acceptance criteria
tsc and vitest green; report lists new exports and a table of daily upkeep for the three starting armies and a 60-unit army, and net food over 30 days with no production vs Farm tier I.
