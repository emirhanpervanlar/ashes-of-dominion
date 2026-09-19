# AO-005 Run-army integrity: stackId collision + Royal Banner cap
Owner-intent: "healer can't heal the Swordsman" (root causes found by qa-automated and qa-playtest in AO-004)
Agent: gameplay-economy
Priority: P0
Depends-on: AO-004 merged
Branch: ai/AO-005

## Goal
Make the run army trustworthy so combat updates (heal, damage, flags) always hit the right live stack with correct caps.

## Bug A — stackId collision (qa-automated)
`addUnitsToArmy` (`src/engine/run/city.ts`) ignores count-0 stacks when choosing a free slot; stackId is `player_<unit>_<position>`, so a recruit reuses the id of a wiped stack. `replaceStack` in `combat.ts` writes to the first match (the wiped one), so the live recruit never receives heals or damage. Two `it.fails` tests reproduce it (`src/engine/run/__tests__/decisions.test.ts`, `src/engine/__tests__/decisions.test.ts`).

## Bug B — relic bonus does not raise the heal cap (qa-playtest, reproduced in browser)
Royal Banner's +20 (and Arcane Crystal's -10%) change `count`/HP/`maxHp` but not `preBattleMaxCount`/`startingCount`, so the AO-D004 cap (`preBattleMaxCount x hpPerUnit`) stays at the pre-relic size. A Priest heal on a full-health Swordsman x26 yields `amount = -200` (HP 260 -> 60) and the count still reads 26. Suspect: `applyRelicStatEffectsOnce` / `addFlatToLargestStack` in `src/engine/run/runEngine.ts`. Recruiting already updates both fields correctly (`addUnitsToArmy`), use that as the reference.

## Must preserve
Same-type merge, 6-living-stack cap (AO-D008), Royal Banner/Arcane Crystal numbers (26 / 5 etc. — only the derived fields change), AO-D007 starting armies.

## Must change
1. A run army never contains two stacks with the same stackId after any sequence of battle-with-wipe, recruit, split, merge. Prefer dropping wiped stacks from `run.army` (when the army is written back after battle, or when adding units) over suffix hacks. Smallest correct change; explain it.
2. Relic army-size effects update `count`, `currentHp`, `maxHp`, `startingCount` AND `preBattleMaxCount` consistently.
3. Flip the two `it.fails` tests to `it()`. Add tests: full-health relic-boosted stack healed by a Priest stays unchanged (amount 0, never negative); a wounded relic-boosted stack heals up to the boosted cap.

## Allowed files
src/engine/run/** and tests. If the fix needs `combat.ts` / `army.ts`, stop and report (gameplay-combat owns them; the follow-up AO-006 handles combat-side clamps).

## Forbidden
src/ui/**, src/App.tsx, balance values (do NOT change relic amounts or starting armies).

## Acceptance criteria
1. Both `it.fails` tests are `it()` and pass. 2. New tests above pass. 3. No duplicate stackIds across a battle/recruit/split/merge sequence (test). 4. tsc clean, vitest green.

## Verification
`npx tsc --noEmit && npx vitest run`
