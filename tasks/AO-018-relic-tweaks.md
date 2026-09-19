# AO-018 Relic tweaks (AO-D043)
Owner-intent: "camp relic chance lower; starting relics simple"
Agent: gameplay-economy
Priority: P2
Depends-on: AO-017 merged
Branch: ai/AO-018

## Must change
1. Abandoned Camp "Search" relic chance 60% -> 25% (only that number).
2. Arcane Crystal is removed from the starting relics and becomes a found relic, rarity rare (keep its effects: +2 max Mana, army -10% damage; merchant price by rarity applies).
3. Fifth starting relic: "Traveler's Purse" - grants +50 Gold at run start (pure benefit, common, implement through the existing start-of-run relic application like Royal Banner's army bonus; no combat files). The starting five become: Royal Banner, Whetstone, Padded Vest, Lucky Charm, Traveler's Purse.
4. Update tests that asserted the old five/old chance, say which; docs/SYSTEM_SPEC.md.

## Allowed files
src/engine/run/**, src/engine/data/relics.ts, tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, combat files, other relic numbers.

## Acceptance criteria
tsc clean, vitest green, report lists the new starting five and any UI-visible export changes.
