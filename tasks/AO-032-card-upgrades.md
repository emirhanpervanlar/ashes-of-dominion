# AO-032 Card upgrades ("+" versions)
Owner-intent: "upgrade should be real: reward Upgrade pick, Forgotten Library Study, Wandering Smith Sharpen"
Agent: gameplay-combat
Priority: P1
Depends-on: none (engine worktree, sequential after AO-031 if the same branch space is needed)
Branch: ai/AO-032

## Source of truth
docs/DECISIONS.md AO-D060, D006 (reward pick), D040; src/engine/data/cards.ts, src/engine/run/cardUpgrades.ts (`CARD_UPGRADES` is empty today), reward/event code that reads it, `CardInstance.upgraded`, combat card resolution.

## Must change
1. Design conservatively and DOCUMENT it in docs/SYSTEM_SPEC.md (the owner reviews the list in the final report): for EVERY card that can appear in a deck or reward pool, define an upgraded "+" version by one simple rule set: (a) cost -1 when the card costs 2+ mana and is not already cheap, OR (b) main numbers +25-40% (damage %, block %, heal, duration +1 only where it is a plain buff), OR (c) one small extra effect (draw 1, +1 unit heal) for cards whose numbers are already high; never change what the card fundamentally does, never add debuffs to cards that had none, never make a condition disappear. Data-driven: an `upgrade` block on the definition or a table in cardUpgrades.ts, one place. Card ids ending in `_plus` already exist for some cards: reuse that convention if it is what the code does (check), otherwise a flag.
2. Combat/deck build reads the upgrade so the upgraded instance behaves and displays (name "Charge +", text) correctly; `cardRequirement/cardPlayability` still work.
3. The reward Upgrade option and the two event options work end to end (upgrade a chosen card; the same card cannot be upgraded twice; unavailable when nothing is upgradable). Remove the "No card can be upgraded" gate.
4. Tests: every card has a valid upgrade; upgraded numbers strictly better by the rule; a seeded battle plays an upgraded card; reducer paths (reward, event) apply and reject double upgrades. Provide a table in the report: card, base text, upgraded text.

## Allowed files
src/engine/** (data/cards.ts, cardUpgrades.ts, combat where it reads instances, run reward/event glue), its tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI (list the display needs in the report), unit/relic data, damage formula.

## Acceptance criteria
tsc/vitest clean apart from known UI-side items; the report includes the full upgrade table and any card that could not be upgraded by the rules with a DDR.
