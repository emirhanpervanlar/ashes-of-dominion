# AO-017 Relic system (5 starting relics, rarity, drawbacks, sources) + no early elites
Owner-intent: "5 simple starting relics in their own pool; other relics get rarity common/rare/epic; some have drawbacks; relics come from elites, rarely from events, and from merchants priced by rarity; no elite in the first 3 road steps"
Agent: gameplay-economy
Priority: P1
Depends-on: none
Branch: ai/AO-017

## Source of truth
docs/DECISIONS.md AO-D037, AO-D039, AO-D006 (no relics after normal battles), AO-D014. The relic drawback proposal and numbers from AO-012 (already reported to the owner): Blood Banner +30% dmg / +15% dmg taken; Cursed Crown +3 Mana / +20% dmg taken; Hawk's Eye ranged +20% / melee -10%; Crown of Champions small stacks +30% / +10% dmg taken; Banner of the Horde stacks>50 +3 Strength / ranged -10%; Bulwark Standard -15% dmg taken / dmg dealt -10%; Shadow Ring dodge +8% / max Mana -1. New relic ideas: Field Chaplain's Charm (heal +30%), Iron Bracers (-10% dmg taken), Glass Cannon Idol (+40% dmg / +25% taken), Miser's Ledger (+2 Mana / heal -30%), Hunter's Quiver (ranged +30% / melee -20%). Numbers are prototypes; drawbacks must be implementable with existing RelicEffect kinds (negative HERO_MAX_MANA must be clamped and tested). Owner said: not every relic needs a drawback.

## Must change
1. Starting relics: a separate pool of exactly 5 SIMPLE starting relics (pure benefit or trivial, e.g. Royal Banner, Arcane Crystal are existing starting relics - keep only those that are simple and fill up to 5 with new simple ones; no drawbacks that confuse a new player). Single table with a `startingEligible` flag or a distinct exported list (choose the cleanest); all 5 are offered at start (no seed offer needed). Keep the current two-step run start working (CHOOSE_STARTING_RELIC) - the atomic START_RUN comes with the UI task. Expose the relic list in a UI friendly way (name, description that states drawbacks, rarity, effects).
2. Rarity: add `rarity: 'common' | 'rare' | 'epic'` to every relic definition; assign by power. Add the new relics above (at least 4 new ones, some pure, some with drawbacks) and drawbacks on the existing ones as listed (not necessarily all; keep pure ones where the power is small).
3. Sources: elite battle victory offers a relic choice (1 relic, weighted to rare/epic-more-often than merchants); events can grant a relic rarely (add to at most 1-2 existing events as a low-probability or option outcome, without altering their other outcomes); merchant sells relics with price by rarity (common < rare < epic, e.g. 60/100/160 Gold - constants in one place) and stock chosen from the non-starting pool, never duplicates owned relics. Normal battles still give no relic (AO-D006).
4. AO-D039: world map generation never places an Elite Battle in the first 3 steps/layers from the start node; keep determinism per seed; test over many seeds.
5. FIRST_CARD_DISCOUNT effect is declared in types but not implemented: only implement it if you add a relic that uses it, otherwise leave it and say so. Do NOT touch combat files; if a relic needs combat support that does not exist, use a different relic and report.
6. Tests for each item; docs/SYSTEM_SPEC.md updated.

## Allowed files
src/engine/run/**, src/engine/data/relics.ts, tests, docs/SYSTEM_SPEC.md.

## Forbidden
combat/damage/targeting files, UI, unit/card data, hero XP.

## Acceptance criteria
tsc clean (UI may need follow-up for changed relic APIs: if the UI stops compiling, list exactly which exports changed and keep old export names working by design, not with shims), vitest green, report lists the final starting five, all relics with rarity/drawback, prices, and event changes.
