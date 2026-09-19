# AO-021 World time, 30-day boss chapters, no road nodes, city anytime with Threat
Owner-intent: "boss every 30 days (3 bosses to win), no empty roads, no elite in the first 5 steps, city reachable any time but each visit makes the game harder"
Agent: gameplay-economy
Priority: P0
Depends-on: AO-020 merged (engine only, no file overlap with UI)
Branch: ai/AO-021

## Source of truth
docs/DECISIONS.md AO-D045, D046, D047, D049 (D039 amended, D037 relic sources), docs/01_CANONICAL_GDD.md sections 2 and 24-26 (Threat / Town / return cost), src/engine/run/worldMap.ts, encounters.ts, runEngine.ts.

## Must change
1. Map: remove `road` nodes; every step is battle / elite / resource / merchant / event; no fixed city nodes anymore. World steps advance the Day counter by 1 as today. Generate the map in 30-step chapters; the last step (day 30, 60, 90) is the boss node; deterministic per seed. No Elite Battle in the first 5 steps of the run (test over many seeds). Chapters 2 and 3 use stronger encounters and bosses (minimal, data-driven; report whether you added boss definitions or scaled the existing one).
2. Win condition: run_complete after the 3rd boss. After boss 1 and 2 the run continues into the next chapter with the boss reward (epic relic choice of 3, reuse relic sources/rarity and the CLAIM_RELIC flow from AO-017). The single-boss `finalBattle` logic is generalised (chapter index in RunState; old saves migrate through migrateRun to chapter 1).
3. Expose for the UI: `daysUntilBoss(run)`, chapter number, `bossWarning` (true when <= 7 days).
4. City anytime (AO-D047): new run action `TRAVEL_TO_CITY` valid on the map phase (not in battle/reward/event): enters the city; leaving the city returns to the same map node after a return cost of 3 days (Day +3, food consumed as for moving 3 steps, Gold Mine income applies per day), Threat +1 per visit (`run.threat`). Encounter generation scales enemy unit counts by `1 + 0.06 x threat` (constants in one place). ENTER_CITY and city map nodes go away; city state, buildings and recruit rules stay unchanged. If the 3-day return would pass a boss day (30/60/90), the boss fight starts on arrival: define this precisely and add a test.
5. Tests: chapter generation, boss at day 30/60/90, win after 3 bosses, no elite before step 6, no road nodes, TRAVEL_TO_CITY (+3 days, threat, scaling), migrateRun for old saves. Update docs/SYSTEM_SPEC.md.

## Allowed files
src/engine/run/**, its tests, src/engine/data (boss/encounter data only if needed), docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules/damage, card data. If a numeric default proves obviously broken, keep it and report numbers in a DDR for qa-playtest tuning.

## Acceptance criteria
tsc and vitest green (UI compile errors caused by removed exports are listed exactly in the report; keep old exports if trivial), report lists new/removed exports and run actions for the UI task.

## Status
- 2026-09-19 ACCEPTED (engine; 287 tests). UI adaptation pending (ENTER_CITY, road/city/start node types, boss/threat display). Open: only 2 epic relics for boss choices; encounter depth untuned.
