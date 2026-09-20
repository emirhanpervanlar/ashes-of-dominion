# AO-045 Combat fixes and hero spells from the owner's playtest notes
Owner-intent: fix the bugs I hit while playing; make hero spells cast directly and scale with hero stats; simple, unit-independent starting decks
Agent: gameplay-combat
Priority: P0
Depends-on: main
Branch: ai/AO-045 (engine worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D064..D069, D073, D074, D075 (+ D033/D013/D044 for reach). Work in this order, one commit per item.

## Must change
1. Mana (AO-D065): the run must never start a battle at 0 Mana (the hero's current mana leaks from the previous battle); at battle start and every player turn Mana = hero max Mana. Test: win a battle, start another, Mana = max. Starting max Mana: define the formula so that fresh heroes are Warlord 3, Rogue 3, Mage 4 (today Rogue 6, Mage 10 via Wisdom); keep Mage Tower tiers, Training Hall and relics adding on top; report where the number comes from (hero data / Wisdom formula) and update tests/docs.
2. Freeze / cannot act (AO-D066): a Frozen stack (and any stack with cannotAttack / cannotMove-when-attacking) does NOT act on its side's turn: enemy intents are not generated for it, and the player cannot use it; also verify freeze expiry timing (a stack frozen on the player's turn skips its NEXT enemy turn). Repro from the owner: a frozen enemy still attacked. Test both sides.
3. Battle end window (AO-D067): killing all enemies no longer ends the battle instantly; the player may still act (cards, heals) until END_TURN, after which the battle resolves as won (no enemy turn is played). Expose a `enemiesCleared` flag in the combat state for the UI. If the player is wiped the battle still ends at once. Tests incl. a healer heal after the last kill.
4. Reach rules (AO-D069): back-row melee is blocked by ANY living friendly stack in the front row (not only the same lane); support/healer basic actions and heal cards are never blocked (a Priest can heal from the back row and can heal itself); `isBlockedByFrontAlly` and its UI users keep working (report the changed semantics). Update tests that encoded the same-lane reading. Repro from the owner: enemy front row had a right-lane unit, back row centre+right; the back-centre melee attacked: must now be blocked.
5. Hero spells (AO-D064): introduce the notion of a hero-cast card in card data (e.g. `cast: 'hero'` + `scalesWith: 'intelligence' | 'dexterity' | 'strength'`): Fireball, Frost, Chain Lightning, Arcane Storm and Arrow Rain (+ a new basic hero attack card, see 7) are cast on the chosen ENEMY only: no source unit selection, no requirement of a living unit type, and no damage to the player's own stacks (repro: the owner's Fireball damaged his own selected unit). Damage = card multiplier x base spell power x hero stat scaling (choose a simple formula, e.g. 1 + (stat - 10) x 0.05 floored at 0.5, constants in one place; a Mage with Intelligence 18 hits clearly harder than a Warlord with 8) with the H3 defense modifier still applied to the target; list every card you made hero-cast in the report. Fireball splash: the description must state it ("Damages the target and 40% to adjacent stacks").
6. Army buff cards need no unit target (AO-D064): Focus Fire (next friendly attack +50%), Hold the Line, Formation, Rally, Battle Hardened, Bless (army/global versions) etc.: change their target type to `none` where the effect is army-wide so the UI can play them by clicking empty field; keep ally-stack targets only for genuinely single-target cards. Ensure `cardPlayability` and validation agree; tests.
7. Starting decks (AO-D075): no card in a starting deck may need a specific unit type (remove Charge/Shield Bash/Hold Formation/Covering Fire etc. that need Swordsman/Knight/Archer sources). Build each deck (10 cards, 4 distinct) from unit-independent cards and the hero-cast basics: a new simple hero attack per hero identity (Warlord "Command: Strike" scaling Strength; Rogue "Volley" scaling Dexterity; Mage "Fireball" scaling Intelligence), plus a couple of army-wide defensive/buff cards. Cards removed from starting decks stay in the reward/merchant pool. Report the three decks.
8. Fireball balance (AO-D074): reduce Fireball's damage (it currently one-shots too much); pick a value so that with Intelligence 18 a fresh Mage's Fireball kills roughly 2-4 early units, not a whole stack; report before/after damage.
9. Card requirement text (AO-D075): remove the "Needs an enemy in reach" wording (and equivalents) from `cardRequirement`; keep only real unit-type requirements.
10. Armor statuses: the owner reports armor does not stack on units. Investigate what the engine does when the same status is applied twice (stack amounts vs separate entries vs refresh), report the current behaviour, and make it consistent with the card text: armor/defense buffs from different cards should add up (cap at a sane value), same-card repeats refresh duration. Document.
11. Necromancy (AO-D073): add a `skeleton` unit (weak undead: give it low HP/damage, food 0, `tags: ['undead']`, no recruit cost, not recruitable), and implement the Necromantic Doctrine: after a won battle 25% (rounded down) of the player's casualties come back as Skeletons in a Skeleton stack (existing stack, else a free slot; if no room nothing is raised). Implement in the run layer through the existing doctrine effect path (`NECROMANCY`), emit a run event `UNITS_RAISED {count}`, add tests; the sprite/icon/text is a UI task (list what the UI needs).

## Allowed files
src/engine/** (combat, damage, cards data, heroes data, units data, cardRequirements, run layer where needed for mana/necromancy), tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI; balance beyond items 1, 8 and the starting decks; economy features (garrison, villages, loot, rewards) which are another task.

## Acceptance criteria
tsc errors only in UI files that use changed exports (list them exactly, keep old exports working where trivial); vitest green; each bug repro becomes a test that fails on the old code; report lists changed exports/actions for the UI and the hero-cast card list.

## Status
- 2026-09-20 ACCEPTED locally (655 tests); merged to local main, not pushed until the UI adopts hero-spell targeting, enemiesCleared and Skeleton. Open design choices reported: Formation now army-wide, Bless stays single-target, Arrow Rain is a Rogue card, other hero-cast multipliers not rebalanced.
