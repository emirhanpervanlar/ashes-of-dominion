# AO-016 Lane stalemate-only guard + card playability reasons
Owner-intent: "my last left unit can be hit by the enemy's far-right unit - bug; Charge only works with Knights and says nothing"
Agent: gameplay-combat
Priority: P0
Depends-on: AO-014 (same branch ai/AO-014, separate commit)
Branch: ai/AO-014

## Source of truth
docs/DECISIONS.md AO-D038, AO-D040 (and D021, D032, D033).

## Must change
1. Softlock guard (AO-D038): replace the per-attacker nearest-lane fallback in src/engine/targeting.ts with a global stalemate rule: the fallback applies only when NO unit on either side has any legal target (lane, front/back, disciples rules, ranged included). Otherwise a unit with no legal target simply does not attack. Player stalemate: legal targets fall back to nearest lane for both sides. Tests: enemy right-lane melee never hits the player's last left-lane unit while the enemy has other units acting/alive; true stalemate scenario resolves (no infinite battle); existing lane tests still pass (update those that encoded per-attacker fallback and say so).
2. Card conditions (AO-D040): find every card whose play requires a condition (unit type such as Charge -> Knight, ranged only, needs a friendly/ally, needs a target of some kind, needs a damaged stack, etc.). Expose from the engine a pure helper (e.g. `cardRequirement(cardId)` returning a short player-facing text or null, and `cardPlayability(card, combat)` returning `{ playable, reason }`) built from the card data (not a hand-written duplicate table where the data already encodes it). List all conditional cards in the report. Add short requirement text to cards where the data supports it without changing any card behaviour.
3. docs/SYSTEM_SPEC.md updated.

## Allowed files
src/engine/** except src/engine/run/**, its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, run layer, card numbers/effects (do not change what a card does).

## Acceptance criteria
tsc clean, vitest green, new tests fail without the change, report lists conditional cards and the helper API for the UI.
