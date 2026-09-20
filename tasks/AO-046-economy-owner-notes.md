# AO-046 Economy notes: rewards, free city visits, garrison, marketplace, villages, food balance
Owner-intent: from the owner's playtest notes; run layer only
Agent: gameplay-economy
Priority: P0
Depends-on: main (may run in parallel with AO-045 only in a separate worktree; merge after AO-045)
Branch: ai/AO-046

## Source of truth
docs/DECISIONS.md AO-D068, D070, D071, D072, D074, D048, D053, D047, D059; src/engine/run/*.

## Must change
1. Reward (AO-D068): remove `SKIP_REWARD` and `REMOVE_CARD` from the reward phase: the only way to close the reward is CLAIM_CARD or CLAIM_UPGRADE (one pick). If the offer could be empty, fall back to always offering at least 2 new cards. Elite victory: the relic is granted automatically (event `RELIC_CLAIMED` with the relic id, stored as `pendingReward.relicGained` for the UI banner); boss victory keeps the 3-choice relic offer (CLAIM_RELIC). Update tests.
2. Free city visits (AO-D070): `TRAVEL_TO_CITY` raises Threat only if it is not the first visit of the run or of the current chapter (track `run.cityVisitsThisChapter`, reset on CHAPTER_STARTED; migrate old saves). Expose whether the next visit is free for the UI warning (`nextCityVisitRaisesThreat(run)`).
3. Recruit bug (AO-D071): the owner cannot recruit at some city visits, suspecting an old "recruit once per 7 days" rule. Investigate the code path (RECRUIT rules, Barracks requirement, slot/army checks, gold/food, phase) with a reproducing test at several days/visits, fix the real cause, report it.
4. Barracks tiers and garrison (AO-D071): Barracks becomes a tiered building (tiers I-IV, one slot, cost curve proposal 60/120/240/480 Gold, constants): each tier unlocks a recruitable unit type (I Swordsman, II Archer, III Priest, IV Knight; currently RECRUIT_COSTS allows all: restrict to the unlocked ones) and raises the weekly garrison. Garrison: every 7 days of the world clock (day % 7 == 0 while the run advances, also after event upkeep does not count) the city garrison receives free units by tier (proposal: tier I 4 Swordsmen; II +3 Archers; III +2 Priests; IV +1 Knight per week; keep numbers small; constants in one table), accumulating up to a cap of 2 weeks; `run.garrison: {unitId: count}`; new run action `COLLECT_GARRISON {unitId?}` (in the city, uses the normal army rules: merge into same type or a free slot; anything that does not fit stays in the garrison). Event `GARRISON_GROWN`, `GARRISON_COLLECTED`. Balance note: free soldiers must not trivialise the game (report the extra units per chapter for a player who visits every week).
5. Marketplace (AO-D071): the city has a Marketplace panel (always available, no building slot): buy Food packs with Gold (e.g. 10 Food per purchase); the price starts around 12 Gold and rises a little with every purchase in the run (price = base x 1.08^purchases rounded), plus a slow decay is NOT wanted; actions `BUY_FOOD {packs}` with the integer validation pattern from `actionValidation.ts`; quote helper `foodMarketQuote(run)` for the UI. Constants in one block.
6. Villages (AO-D072): a new node type `village` replaces about a third of the resource nodes (chapter generation, deterministic per seed). Visiting a village opens a village choice (event-like phase or a pending event): Raid = immediate Gold and Food loot (scaled by chapter), Threat +1; Help = a small immediate reward and a permanent village: passive Food per day (+3, stacking, `run.villages`) and +1 free militia (Swordsman) added to the weekly garrison per helped village (cap). `run.villages` counted in stats (`villagesHelped`, `villagesRaided`). Village upgrades are out of scope. Keep the passive Food in the same daily hook as Farm/Gold Mine.
7. Food balance (AO-D074): raise the food loot chance after battles (today ~20% early; make it about 45% early rising with depth, amounts unchanged in size), keep Farm/Stable/upkeep numbers unless the numbers you measure show starvation before day 15 for a starting army with the new starting armies (see item 8); report the resulting expected Food per battle and the days a starting army survives.
8. Starting armies and start balance (AO-D074): redesign the starting armies (AO-D007 amended): every hero starts with a solid front line; the Mage (fragile) gets 3-5 high-defense front soldiers (e.g. Swordsman x4) plus Archer/Priest support; Warlord Swordsman + Knight; Rogue Swordsman x3-4 front + Archers. Keep total starting units modest (about 8-12). Because the first city visit is now free, a player can recruit before the first fight: take that into account. Then run a measurement script (your own throwaway script in the scratchpad qa folder) simulating the first 5 battles with the greedy bot for the 3 heroes and report win rates and casualties; iterate constants (starting armies, starting Gold/Food) until fresh runs win the first 3 battles about 90% of the time and the first elite around 50-60%. Do NOT change unit damage/card numbers here (the balance task does that); report what you would change.
9. Tests for every item, migrateRun for old saves (new fields default), docs/SYSTEM_SPEC.md.

## Allowed files
src/engine/run/**, src/engine/data/heroes.ts and units.ts ONLY for starting armies (no stat changes), tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules, cards data, unit stats.

## Acceptance criteria
tsc errors only in UI files that use changed actions (list exactly); vitest green; report lists new actions/events/fields/exports for the UI and the measurement tables.
