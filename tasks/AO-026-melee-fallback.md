# AO-026 Melee lane fallback per scenarios (AO-D044)
Owner-intent: "a lone corner unit must be hittable by any enemy melee unit; a stranded unit must always be able to fight"
Agent: gameplay-combat
Priority: P0
Depends-on: none
Branch: ai/AO-026

## Source of truth
docs/DECISIONS.md AO-D044 (replaces AO-D038), D013, D021, D032, D033. Code: src/engine/targeting.ts (`strictTargets`, `isStalemate`, `computeValidTargets`), combat.ts (intent selection, enemy retarget), cardRequirements.ts (`cardPlayability` uses reach).

## Must change
1. Melee reach per AO-D044: candidates = AO-D013 pool (front row while any front stack lives, otherwise the back row; untargetable stacks still hold the front). Among candidates the attacker uses those within its own or adjacent lane; if NONE is within lane reach it may hit any candidate (the nearest lane). This is per attacker, no global stalemate condition: remove `isStalemate` and everything that only served it (including the `ownArmy` requirement for the fallback; `ownArmy` stays only for AO-D033 blocking). Same for enemy AI and card geometry, Taunt (AO-D032) still only narrows among reachable targets, ranged unchanged.
2. Scenario tests (both sides): (a) my only front unit in a corner, enemy front row empty of other player targets -> every enemy melee unit can hit it whatever its lane; (b) front row empty, a lone back-row unit in a corner -> all enemy melee can hit it; (c) with a same/adjacent-lane target present, melee still prefers in-lane targets and cannot cross to the far lane; (d) a lone left-lane unit vs enemy right-lane melee: both can hit each other; (e) Taunt and disciples block behaviour unchanged; (f) battles cannot softlock. Update tests that encoded the AO-D038 stalemate-only rule and say which.
3. docs/SYSTEM_SPEC.md combat section.

## Allowed files
src/engine/** except src/engine/run/**, its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, run layer, card/unit numbers.

## Acceptance criteria
tsc (only the known UI-side errors) and vitest (only the known Farm-icon failure) as before; new scenario tests fail on the old code; report the final rule in two sentences and the list of changed tests.
