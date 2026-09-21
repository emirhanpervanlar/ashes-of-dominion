# AO-050 Balance round (heroes, units, spells, relics, events) + simple relic pool
Owner-intent: "do the balance round: Swordsman too weak, Fireball strong, first battles too easy, Rogue/Mage mana, heroes fair, forts need simple relics"
Agent: gameplay-combat (numbers/data) with the simulation tooling from the AO-033/AO-047 scratchpad scripts
Priority: P0
Depends-on: main (AO-045/046/047 merged)
Branch: ai/AO-050 (economy worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D074, D077, D078, D065, D064; reports: AO-033 QA balance report (Swordsman dominated, Archer dominant, Royal Banner dominant, Shaman never attacks, events with free value), AO-047 simulation (boss 1: Warlord 0% / Rogue 15% / Mage 78% on the same economy; 15 of 40 Warlord runs die in regular chapter-1 fights), AO-045 (hero spells constants in `heroSpells.ts`, Fireball constants). Scripts: scratchpad qa folder `C:\Users\EMIRHA~1\AppData\Local\Temp\claude\d--ai-project-wow\a7e4b8f3-3b8f-4fac-9616-a4b71b17e2f8\scratchpad\qa` (lib.ts, runbot.ts, eco/growth.ts, go.sh, agg.cjs); run TypeScript with `npx vite-node --root <worktree> <script>`.

## Targets (measure with the greedy bot and the growth-player policy, 40+ seeds per hero)
1. First 3 battles: about 90% win for every hero with the default starting army; first Fort about 50-60% win (with a city visit + recruits), casualties small early.
2. Boss 1 win rate 30-55% for EACH hero (Warlord, Rogue, Mage), not only pooled; boss 2 and 3 similar with the corresponding armies; no hero above 65% or below 25% at any boss.
3. Every unit type has a role: Swordsman is viable (cheap frontline anchor), Archer is strong but not dominant (safe back row), Knight worth its cost, Priest healing matters. Damage per Gold of the four recruitable units within about 30% of each other (report the table).
4. Hero spells: Fireball fair (already reduced), Frost/Chain Lightning/Arcane Storm/Arrow Rain/Command: Strike/Volley multipliers tuned so each hero's signature card is equally valuable (Warlord Strike, Rogue Volley, Mage Fireball); Warlord must not be the weak hero: raise Strength scaling or Strike power or Knight/Swordsman strength as needed.
5. Relics: Royal Banner not dominant (+6 -> +3 or raise the others: Whetstone +20% dmg, Padded Vest -15% taken, Lucky Charm +10% dodge, Traveler's Purse fine); starting relic win-rate spread within 10 points across the five.
6. Shaman: give the enemy Shaman an actual role (attack or a stronger buff) without making it a wall.
7. Events: free-value options (sell_remedies, sell_tomes, study, burn, dispatch, watch, join_hunt) get a small cost or risk so they no longer dominate paid options in the same event (numbers only).
8. Simple relic pool for forts and boss choices (AO-D077, DDR from AO-047): add about 6 NEW relics with NO drawbacks, common/rare, for the found pool (`data/relics.ts`), using existing RelicEffect kinds only (e.g. +Max Mana 1 rare, +8% damage, -6% damage taken, +15% healing, +1 card draw only if an effect exists, small dodge, +Food/Gold flat at grant if a GOLD_FLAT/FOOD_FLAT style exists), each with a sprite/icon id needed listed for the UI task (`rel_<id>` icon, description text). Fort/boss pools then last through a full run (report how many simple relics exist and how many forts a run can take).

## Rules
Only numbers/data: unit base damage/HP/costs, card multipliers, hero spell constants, relic effect values, enemy formation numbers, event amounts, boss sizes. No new mechanics, no rule changes (if a target needs one, raise a DDR). Keep all constants where they are; update tests that pin old numbers and say so; do not weaken assertions of rules. Iterate: measure -> change -> re-measure; keep a table of every changed constant (old -> new) and the before/after win-rate table per hero and boss.

## Allowed files
src/engine/** (data/units.ts, cards.ts, heroes.ts, heroSpells.ts, relics.ts, run constants, events amounts), tests, docs/SYSTEM_SPEC.md.

## Forbidden
UI, rule changes, the save format.

## Acceptance criteria
tsc errors only in the known UI files; vitest green apart from known UI-side failures; report includes: constants changed, before/after tables (first 3 battles, first fort, bosses 1-3 per hero, unit damage per gold, starting relic spread), the new relic list, and remaining imbalances with recommendations.
