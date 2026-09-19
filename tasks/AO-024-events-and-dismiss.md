# AO-024 Events pool (random, no repeats), new effects, ambush gambles, unit dismissal
Owner-intent: "richer random events, unit gains with a forced choice when the army is full, gambles that can end in an ambush"
Agent: gameplay-economy
Priority: P1
Depends-on: AO-021 and AO-022 merged
Branch: ai/AO-024

## Source of truth
docs/DECISIONS.md AO-D050, D054, D055, D056 (plus D035/D052 removal rules, D047/D051 Threat, D048 food, D037 relic rarity); the events proposal delivered for AO-023 (14 new events; use its table: names, options, weights, prerequisites, chapter gates, selection design, new effect kinds). Existing events are retuned as the proposal says.

## Must change
1. Selection: weighted random pool without repeats within a run (`run.seenEventIds`, resets when exhausted keeping the last 3 excluded), chapter gates, "at least one option playable" filter, run RNG only; migrateRun default for old saves.
2. New EventEffect kinds and appliers: THREAT_DELTA (min 0), DAY_COST, MAX_MANA_DELTA, UNIT_GAIN, UNIT_LOSS (random / largest stack), REVIVE_LAST_CASUALTIES, UPGRADE_CARD / REMOVE_CARD / GIVE_CARD (with a pending player-choice sub-state like reward picks), chance + relic rarity weights, per-option `requires` (unit type present, gold, deck size, chapter) enforced in the reducer and exposed for the UI (option available + reason text). All amounts in one config table, scaled by chapter (x1 / x1.5 / x2).
3. Ambush gambles (AO-D056): an option can have `{ successChance, success, failure: 'ambush' }`; on failure the run starts a normal battle of the current chapter (reuse the existing battle start; after the battle the normal reward flow applies, then back to the map). Implement Ambushed Merchants that way (rescue = low chance for the big reward: +60 Gold and a card; failure = ambush) and convert 1-2 other proposal gamble options (report which) in the same spirit: the better the reward, the lower the chance.
4. Unit gain with no room (AO-D054): new run action `DISMISS_STACK { stackId, count? }` (outside battle only; count omitted = whole stack; at least one unit type must remain in the army - reject dismissing the last unit), and a pending state `pendingUnitChoice` when an event's UNIT_GAIN cannot fit: the newcomer is held in the state as a temporary 7th entry the UI can render; the player must resolve it by DISMISS_STACK on any stack (newcomer included) or DECLINE_UNIT_GAIN; the event only completes after that. Tests for all paths.
5. Retune Bandit Toll (Food loss scales with daily upkeep) and Abandoned Camp Rest (mana / revival instead of HP) as in the proposal.
6. Expose for the UI: the list of options with `available` and `reason`, the pending choice states, event outcome texts (English). Update docs/SYSTEM_SPEC.md; tests for selection (no repeats until exhausted, chapter gating, save/resume), each effect, prerequisite rejection, gamble both branches (deterministic seeds), dismissal.

## Allowed files
src/engine/run/**, its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat rules, card data. If placeholder numbers look broken, keep them and report for qa-playtest.

## Acceptance criteria
tsc and vitest green (UI compile breaks from changed event exports listed exactly), report lists all event ids with weights, the run actions/pending states and UI needs.
