# AO-047 Objective map nodes: mines, forts, reduced free loot; simpler fort relics; chapter difficulty
Owner-intent: "resources on the road make the game too easy; add mines and villages; make elites into forts (enemy camps); no drawbacks on forced relics; chapter 2 is too hard"
Agent: gameplay-economy
Priority: P0
Depends-on: AO-046 merged (villages, garrison, food loot) and AO-045 merged
Branch: ai/AO-047

## Source of truth
docs/DECISIONS.md AO-D076, D077, D078, D072, D074, D037, D059; QA balance report (boss wall); src/engine/run/worldMap.ts, chapters.ts, encounters.ts, relicSources.ts, loot.ts.

## Must change
1. Node types: `resource` becomes `mine` (capture: passive Gold per day `+N` stacking with Gold Mine building, small one-off, deterministic per seed; a captured mine is counted in run stats and in the daily income hook) - villages already added by AO-046; `elite_battle` becomes `fort` (same encounter strength as the old elite, id/type rename with save migration, texts). Map generation mixes battle / fort / mine / village / merchant / event / boss; reduce the amount of one-off free resource per node (old resource payouts 20-40 Gold / 10-20 Food -> about a third) so that objectives, loot and passive income carry the economy.
2. Fort rewards (AO-D077): relic granted automatically (existing auto-claim from AO-046), chosen from a "simple relic" pool: relics with NO drawbacks (filter `drawbacks` empty) and low rarity weights; plus extra resources (Gold and a little Food, more than a normal battle). Relics with drawbacks remain available only from merchants and events. Boss offers stay 1 of 3 (boss choices exclude drawback relics too, since they are taken by choice from a forced reward: keep it simple - no drawbacks there either).
3. Chapter difficulty (AO-D078): the owner reached the chapter 2 boss with about 70 units, food upkeep unmanageable, too little Gold, boss stacks of 150 units each. Rebalance in the run layer: boss encounter sizes per chapter (scale boss units so the chapter 1 boss is about a third of the current size and `BOSS_CHAPTER_MULTIPLIER` about 1 / 1.4 / 1.9 as the QA report recommended), the depth slope of regular encounters (currently too easy early), Gold income per chapter (battle loot, mine income, village help), food loot, and recruit costs vs income. Write a throwaway simulation in the scratchpad qa folder using the greedy bot that plays the growth policy through chapters 1-2 (visiting forts/mines/villages, recruiting, building Farm/Barracks) and print: army size at each boss, Gold/Food at each boss, upkeep vs production. TARGETS: a decent player enters the chapter 1 boss with roughly 40-55 units, the chapter 2 boss with 70-95, the boss fights are hard but winnable (greedy bot win rate 30-60%), food upkeep manageable with Farm II-III plus loot. Report tables before/after; constants only, no rule changes.
4. Tests: node generation, mine passive income, save migration for old node types (`resource` -> `mine`, `elite_battle` -> `fort`), simple relic pool has no drawbacks, fort reward.
5. docs/SYSTEM_SPEC.md; list UI needs (node names/icons: mine, fort, village; the fort/village choice screens, relic gained banner).

## Allowed files
src/engine/run/** and data/relics.ts (pool flags only), tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules, unit/card stats.

## Acceptance criteria
tsc errors only in UI files using renamed node types (list); vitest green; report includes the simulation tables and constants changed.
