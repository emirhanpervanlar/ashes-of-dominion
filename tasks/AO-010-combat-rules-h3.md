# AO-010 Combat rules: H3 damage, lane rule, kill counts, enemy step list
Owner-intent: "stick to Heroes 3 for damage; melee must not hit across lanes; show damage as units killed; play the enemy turn step by step with real numbers"
Agent: gameplay-combat
Priority: P0
Depends-on: none
Branch: ai/AO-010

## Source of truth
docs/DECISIONS.md AO-D018, AO-D021, AO-D022, AO-D023 (and D002/D004/D013 which stay in force).

## Must change
1. Damage (AO-D018): replace `max(0, attack*mods - defense)` with the H3 percentage model. Per-unit base = attack (after hero/relic/doctrine mods); if attack > defense multiply by `1 + min(3, 0.05*(attack-defense))`, else by `1 - min(0.7, 0.025*(defense-attack))`. Damage never reaches 0 from a hit that lands. Remove the count-tier multiplier (effectiveCount 0.9/0.75/...) so damage is linear in count. Block / card multipliers keep working as today. List the constants in one place.
2. Lane rule (AO-D021) in `src/engine/targeting.ts`: melee targets only own or adjacent lane (lane = position column, positions 1/4 left, 2/5 center, 3/6 right). AO-D013 stays on top. Ranged units unrestricted. Same for enemy AI. Softlock guard: if the lane rule leaves a side with NO legal melee target while it still has living stacks, fall back to the nearest lane so the battle can never softlock, and document it in the report.
3. Kill counts (AO-D022): every damage result exposes `unitsKilled` alongside HP damage; `combat.log` entries carry both HP damage and units killed so the UI can show "-N units" / "Wounded".
4. Enemy step list (AO-D023): END_TURN keeps atomic final state but also returns an ordered `enemySteps` list (per enemy action: actor stackId, kind attack/heal/buff/..., target stackId, hp damage, units killed, status/block applied, resulting counts). The UI will replay it; it must equal what the engine actually did (test: replaying the steps' deltas reproduces the final state).
5. Update docs/SYSTEM_SPEC.md combat section.

## Must preserve
AO-D002/D004/D005/D013 behaviour, deterministic RNG, existing card effects.

## Allowed files
src/engine/** except src/engine/run/**; src/engine/**/__tests__; docs/SYSTEM_SPEC.md.

## Forbidden
src/ui/**, src/App.tsx, run layer. Balance: do not retune unit/card numbers; if the new formula makes fights obviously trivial or impossible, report numbers in a DDR instead of tuning.

## Acceptance criteria
1. Tests: a hit with attack < defense deals > 0; linear scaling (60 units in one stack = 2x30 damage); lane rule table (left never reaches right for melee, ranged does); softlock guard; enemySteps replay equals final state. 2. tsc clean, vitest green (update tests that encoded the old formula and say so). 3. Report a small table of old vs new damage for the 4-5 typical matchups.
