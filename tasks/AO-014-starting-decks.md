# AO-014 Simple starting decks (Slay the Spire style)
Owner-intent: "10 cards at run start, only 4 different cards, all simple; do not change any card's behaviour; Slay the Spire logic"
Agent: gameplay-combat
Priority: P1
Depends-on: none
Branch: ai/AO-014

## Goal
Each hero (Warlord, Rogue, Mage) starts with a 10-card deck made of exactly 4 DISTINCT existing cards (duplicates fill the rest, e.g. 4+3+2+1 or 3+3+2+2), like Strike/Defend in Slay the Spire.

## Must change
- `startingDeck` of every hero in src/engine/data/heroes.ts: 10 cards, 4 distinct card ids, ordered by hero identity (Warlord = melee attack + block, Rogue = ranged attack + evasion/utility-free, Mage = fireball/attack + shield + heal).
- Pick ONLY simple cards that already exist: plain attack, block/defense, single-target heal, at most ONE simple self/army buff type; NO debuff/status (Weak, Freeze, Poison, Mark), no redirect, no self-casualty, no draw/move utility cards. Do not edit any card definition (numbers, text, effects) - if no simple card of a needed kind exists for a hero, raise a DDR instead of editing or inventing a card.
- Cards removed from the starting decks must remain obtainable (reward / merchant pools) exactly as today; verify and list.
- Update tests that assert deck size/contents; add a test that every hero deck has 10 cards with exactly 4 distinct ids and none of them applies a debuff.
- docs/SYSTEM_SPEC.md: starting decks.

## Allowed files
src/engine/data/heroes.ts, src/engine/**/__tests__, docs/SYSTEM_SPEC.md.

## Forbidden
Card definitions, UI, run layer logic, relics.

## Acceptance criteria
tsc clean, vitest green, report lists the three decks (card names x count) and where each removed card can still be obtained.

## Verification
vitest + a short script/test that draws opening hands for all three heroes without error.

## Status
- 2026-09-19 ACCEPTED (merged with AO-016). Note: Warlord deck attack depends on Charge (Knight only).
