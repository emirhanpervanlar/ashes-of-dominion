# AO-006 Combat crash on lethal card + heal clamp
Owner-intent: battles must not crash or heal negatively (found by qa-playtest in AO-004)
Agent: gameplay-combat
Priority: P0
Depends-on: AO-005 merged (shared working tree; run sequentially)
Branch: ai/AO-006

## Bug A — crash when a card kills its target
Shield Bash, Frost and Lance Breaker throw "Cannot read properties of undefined (reading 'side')" when the ATTACK effect kills the target and the following `APPLY_STATUS` effect then runs on the dead stack (`APPLY_STATUS` case in `src/engine/combat.ts`). In the browser the click does nothing and an uncaught error is raised. qa-playtest scanned all 46 cards and found only these three, but the cause is general: any effect list that acts on a target after a lethal effect must handle a dead target.

## Bug B — heal can be negative
`applyHealToStack` (`src/engine/damage.ts`) can return a negative `healedAmount` when the current HP already exceeds the cap (`preBattleMaxCount x hpPerUnit`), lowering HP. Healing must never reduce HP or count: clamp so `newHp = max(currentHp, min(cap, currentHp + amount))`. (AO-005 fixes the data that caused it; this is the defensive engine rule.)

## Must preserve
AO-D004 heal semantics, AO-D005 flag lifecycles, deterministic RNG, existing tests.

## Must change
1. Effects after a lethal effect skip cleanly (statuses on a dead target are dropped, no exception, no STATUS_APPLIED event for a dead stack). Fix generally in the effect executor, not per card.
2. Heal never reduces HP; `STACK_HEALED.amount` is never negative and no event is emitted for a zero heal if that matches current behavior conventions (keep whichever the tests already assume, state it in the report).
3. Add a test that plays every card in a lethal setup (target at 1 HP, high damage) and asserts no throw — parametrize over `CARD_DEFINITIONS`.

## Allowed files
src/engine/combat.ts, damage.ts, related tests.

## Forbidden
src/ui/**, src/App.tsx, src/engine/run/**, card/unit numbers.

## Acceptance criteria
1. The all-cards lethal test passes and fails without the fix. 2. Heal clamp test passes. 3. tsc clean, vitest green.

## Verification
`npx tsc --noEmit && npx vitest run`
