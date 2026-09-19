# AO-006 Combat crash, heal clamp, melee reach rule, Royal Banner value
Owner-intent: battles must not crash or heal negatively; no melee softlock; Royal Banner must not undo the small-army decision
Agent: gameplay-combat
Priority: P0
Depends-on: AO-005 merged (done). Shared working tree: run sequentially, commit only your own files (never `git add -A`).
Branch: ai/AO-006

## Bug A — crash when a card kills its target
Shield Bash, Frost and Lance Breaker throw "Cannot read properties of undefined (reading 'side')" when the ATTACK effect kills the target and the following `APPLY_STATUS` effect runs on the dead stack (`APPLY_STATUS` case in `src/engine/combat.ts`). qa-playtest scanned all 46 cards and found only these three, but the cause is general: any effect after a lethal effect must handle a dead target.

## Bug B — heal can be negative
`applyHealToStack` (`src/engine/damage.ts`) can return a negative `healedAmount` when current HP already exceeds the cap, lowering HP. Healing must never reduce HP or count: `newHp = max(currentHp, min(cap, currentHp + amount))`. (AO-005 fixed the data that caused it; this is the defensive engine rule.)

## Rule change — AO-D013 (amends AO-D002)
Melee (non-`rangedAllAccess`) units may target the backline only when the target side's front row (positions 1-3) has NO living stack. While any front stack lives they reach front stacks only, exactly as today. Same rule for enemy AI (`intents.ts`, enemy retarget in `resolveEnemyTurn`, validation messages). Ranged is unchanged. The existing tests that assert "dead front lane never exposes the backline" must be rewritten to match: a single dead front lane still exposes nothing; only a fully empty front row exposes the back. Update `docs/SYSTEM_SPEC.md` (Targeting) and note it in the report.

## Value change — AO-D014
Royal Banner grants +6 (was +20) in `src/engine/data/relics.ts` (`ARMY_SIZE_FLAT_LARGEST`). Update every test that hard-codes the old result (Warlord Swordsman 26 -> 12, Rogue Archer 26 -> 12, Mage Archer 24 -> 10, and derived numbers). Also fix the Training Hall description that still says "AC/DC" if it lives in engine data (it grants +2 max Mana).

## Must preserve
AO-D004 heal semantics, AO-D005 flag lifecycles, deterministic RNG.

## Must change (summary)
1. Effects after a lethal effect skip cleanly; general fix in the effect executor, not per card.
2. Heal never reduces HP; state your convention for zero heals.
3. AO-D013 rule + tests (incl. softlock scenario: melee army vs a lone backline goblin can now finish the battle; all-backline Mage army is now attackable by enemy melee once the enemy front... i.e. once the player front row is empty).
4. AO-D014 value + test updates.
5. Parametrized test over `CARD_DEFINITIONS`: lethal setup, no throw.

## Allowed files
src/engine/combat.ts, damage.ts, targeting.ts, intents.ts, data/relics.ts, data/*.ts descriptions, scenario.ts, their tests, docs/SYSTEM_SPEC.md. Run-layer tests that hard-code Royal Banner numbers may be edited for the value only.

## Forbidden
src/ui/**, src/App.tsx, src/engine/run/*.ts (non-test), other balance values.

## Acceptance criteria
1. All-cards lethal test passes and fails without the fix. 2. Heal clamp test. 3. AO-D013 tests incl. the stalemate scenario resolving. 4. Banner value updated everywhere. 5. tsc clean, vitest green.

## Verification
`npx tsc --noEmit && npx vitest run`

## Status
- 2026-09-19 ACCEPTED (172/172). Deviation accepted: when the front is empty melee may target the whole living backline (not lane-limited); untargetable front stacks still count as holding the front. Training Hall text moved to AO-007.
