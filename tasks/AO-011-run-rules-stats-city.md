# AO-011 Run rules: full heal, building effects, run stats, card removal, defeat/new-run
Owner-intent: "wounded heal after battle, buildings need real effects, full stats on the death screen, remove cards from the deck, New Run goes to the main menu"
Agent: gameplay-economy
Priority: P0
Depends-on: none (AO-010 runs in parallel in another worktree; do not touch combat files)
Branch: ai/AO-011

## Source of truth
docs/DECISIONS.md AO-D019, AO-D020, AO-D026, AO-D027 (and D015, D008).

## Must change
1. Full heal (AO-D019): after a won battle every surviving stack is restored to full HP of its surviving unit count (H3); dead units stay dead. Keep preBattleMaxCount consistent with this.
2. Building effects (AO-D020) in `src/engine/run/city.ts` + wherever effects are applied: Stable = movement Food cost -25%; Forge = army attack +5% (route through the RelicEffect pipeline used by doctrines); Mage Tower = hero Wisdom +2 (if the hero has no Wisdom stat or nothing in the engine reads it, do NOT invent one - raise a DDR and leave the building unchanged); Shrine = after every battle 10% of casualties revive (round down, min 0; never above preBattle count); Gold Mine = +10 Gold per day (Day advance in the run layer) instead of one-off +100. Update descriptions strings so they tell the truth.
3. RunStats (AO-D027): add `stats` to RunState (enemiesKilled, unitsLost, damageDealt, damageTaken, battlesWon, turnsPlayed, goldGathered, foodGathered, foodEaten, largestStack, cardsPlayed, daysElapsed, nodesVisited - add any other cheap, meaningful ones). Fed from combat results the run layer already receives (COMBAT_ACTION results / final combat state) - do not edit combat files; if a number is not derivable without combat changes, list it in the report for AO-010/next task. Old saved runs without `stats` must load (default zeros).
4. Card removal (AO-D026): new run action REMOVE_CARD { instanceId } and a rule for where it is allowed: Reward (as the alternative to card/upgrade/skip - one pick only), Merchant (Gold price rising per use), City (once per week, free). Do NOT set prices/limits by yourself beyond that: emit a DDR with proposed numbers and implement the engine hook with constants in one place. Also Reward: CONFIRM_REWARD step is removed - claiming a card/upgrade/removal/skip resolves the reward immediately (AO-D026); keep the reducer consistent and update tests.
5. Defeat/New Run (AO-D027): expose whatever the reducer needs so the UI can send New Run from the defeat/run_complete screen straight to the main menu with the saved run cleared (check how App.tsx currently does it; report the exact file/line of the bug but do not edit UI).
6. Update docs/SYSTEM_SPEC.md (Run layer).

## Allowed files
src/engine/run/**, its tests, docs/SYSTEM_SPEC.md.

## Forbidden
src/ui/**, src/App.tsx, combat/damage/targeting files, unit/card balance. Hero XP/levels (AO-D030) is not part of this task.

## Acceptance criteria
1. Tests for each item (heal, each building effect, stats accumulation incl. old-save default, card removal in all three places, reward resolves without confirm). 2. tsc clean, vitest green. 3. Report lists DDRs (removal prices/limits, Mage Tower Wisdom) and stats that need combat data.

## Status
- 2026-09-19 ACCEPTED after REVISION-1 (Mage Tower tiers AO-D036).
