# AO-025 Starvation with unit deaths and morale, more Farm tiers
Owner-intent: "when food runs out units must die (random, share scaled by the shortage, rising each day), the army enters battle with negative morale after several starving days, players must not gamble on food; more Farm tiers"
Agent: gameplay-economy
Priority: P0
Depends-on: AO-024 merged
Branch: ai/AO-025

## Source of truth
docs/DECISIONS.md AO-D057, AO-D058, AO-D048, AO-D053. Current code: src/engine/run/food.ts (`applyStarvation`, upkeep, `foodWarning`), city.ts (`FARM_TIERS`), runEngine.ts day tick (search for applyStarvation), morale in ArmyStack (`morale` field) and how combat reads morale (read only; do NOT edit combat files).

## Must change
1. New starvation model replacing `applyStarvation`: each day the stockpile cannot cover the upkeep, Food becomes 0 (not "reduce the army until upkeep fits"), and units die: total deaths = `ceil(lossRate x totalUnits)` (min 1 while any deficit exists), chosen at random one unit at a time across stacks with the run RNG. `lossRate = min(cap, (base + perShortage x shortageRatio) x escalation^(consecutiveDays - 1))` where `shortageRatio = deficit / dailyNeed` in (0,1]. Defaults to start with (constants in ONE block, expected to be tuned): base 0.04, perShortage 0.08 (so a fully starved first day about 12%, a 10% shortage about 5%), escalation growth +0.5 per further consecutive starving day (linear), cap 0.6. Reset the consecutive-days counter (`run.starvationDays`) on the first fully fed day. Expose `starvationForecast(run)` for the UI: expected loss share if the next day starves. Emit `STARVED { deaths: [{ unitId, count }], day, consecutiveDays }` so the UI can print "N Swordsmen starved".
2. Morale: after `STARVATION_MORALE_AFTER_DAYS` (default 3) consecutive starving days the player's stacks enter the next battles with a negative morale malus that grows with every further starving day (default -5 at day 3, then -3 more per day, floor by a cap; constants). First check how combat consumes `ArmyStack.morale` (effects on damage/AP/anything). If morale has no combat effect today, do NOT edit combat: report exactly what exists and raise a DDR with the minimal combat change needed (owner decides). Apply the malus through the existing run -> combat army setup path in the run layer (start of battle), remove it when fed again.
3. Farm: 5 tiers (upgradeable, one slot), cumulative Food per day and cost tuned so that Farm V can balance about a 60-unit army together with Stable (report the table), while Farm I-III keep the targets from the previous task (starting army balanced by tier I, mid army by tier III). Constants in FARM_TIERS.
4. Keep `foodWarning` meaningful: it should also warn before a shortage starts; add `starvationDaysLeft`-style info if needed.
4b. Event day costs (Director call, same spirit as AO-D051: no clock changes for now): the DAY_COST effect of events (Wait out fog, Join the hunt, Bandit Toll refuse...) must NOT advance the real Day counter (it could pass the boss day and make "Boss in N days" negative). Convert it to "N days of upkeep": the Food the army eats in N days is paid at once (and if the stockpile cannot cover it, the normal starvation model applies to the shortage). Update event texts to say "costs N days of food". Guard `daysUntilBoss` so it can never be negative.
5. Tests: deficit share scaling (80% shortage kills more than 10%), escalation across consecutive days, reset when fed, deaths random but deterministic per seed and spread across stacks, no "cut to the upkeep" behaviour (army with 20 Food vs need 100 is not cut down to need 20), morale malus timing, save migration (`starvationDays` default 0), Farm tiers. Update docs/SYSTEM_SPEC.md. Report a table: for armies of 8, 38 and 60 units with 0 Food and 5 consecutive starving days: cumulative survivors and morale malus.

## Allowed files
src/engine/run/**, its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules/damage/morale rules (report instead), card data.

## Acceptance criteria
tsc and vitest green except the known UI-side failures (Farm icon test, the 4 UI compile errors from AO-021), report lists new events/exports for the UI and the balance table.

## Status
- 2026-09-19 ACCEPTED (engine). Morale malus -10 at day 3 then -8/day (floor around day 14; a step of 15 would reach it at day 9). Numbers tunable in STARVATION.
