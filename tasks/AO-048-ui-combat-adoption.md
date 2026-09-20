# AO-048 UI adopts the new combat engine (hero spells, battle-end window, buffs by field click, skeleton)
Owner-intent: play the game with the fixed combat rules: hero spells hit the chosen enemy directly, army buffs by clicking the field, finish the battle after the last kill, Necromancy works
Agent: ui-frontend
Priority: P0
Depends-on: main (AO-045 + AO-043 merged)
Branch: ai/AO-048 (ui worktree, from main)

## Source of truth
docs/DECISIONS.md AO-D064, D065, D066, D067, D069, D073, D075; docs/SYSTEM_SPEC.md combat section (hero-cast cards `cast: 'hero'` + `scalesWith`, `heroSpellDamage`/`heroSpellScaling`/`HERO_ATTACKER_ID`, `CombatState.enemiesCleared`, `CombatState.nextFriendlyAttackBonusPercent`, targeting types 'enemy-stack' / 'none' / 'ally-stack', `cannotAct`, `isBlockedByFrontAlly`, skeleton unit, `UNITS_RAISED`).

## Must change
1. Card play flow: cards with `targeting: 'enemy-stack'` (Fireball, Frost, Chain Lightning, Command: Strike, Volley, Mark Target) need NO acting stack: click the card, then click an enemy (valid targets highlight), or drag the card onto the enemy; never ask to pick one of your own units first (the reported bug: choose enemy -> asked for own unit -> both took damage). Cards with `targeting: 'none'` (Arcane Storm, Arrow Rain, Focus Fire, Formation, Rally, Battle Hardened, Hold the Line, Mass Charge, Venomous Army...) play by clicking the card and then clicking any empty part of the battlefield (or dragging it onto the field / the drop zone); show the field as a valid drop area while such a card is pending. Unit-bound and `ally-stack` cards keep the acting-unit selection. Cancel by Esc/empty click for enemy-stack cards only where it does not conflict (an empty click plays a 'none' card).
2. Hero-cast effects: hits with `attackerStackId === 'hero'` must not look up a stack: draw the attack effect from the hero portrait/plaque (or the played card position) to the target (projectile/spell effect by scalesWith: fire orb for Intelligence, arrows for Dexterity, slash for Strength), floaters "-N units" on the target, log text "<Hero> casts <Card>"; fix `battleCues`, `fxDom`, `eventText`, tests.
3. Battle-end window (AO-D067): when `combat.enemiesCleared` the End Turn button reads "Finish Battle" (pixel label) and pending healing cards/heals still work; victory arrives after END_TURN; show a subtle banner "All enemies fallen - heal up, then finish the battle" near the hero plaque; no enemy playback in that case.
4. Frozen / cannot-act: `src/ui/stackStatus.ts` uses the engine's `cannotAct`; frozen stacks show the ice overlay and cannot be selected as acting units; enemy frozen stacks are shown as skipping their turn in the playback (no attack step exists for them).
5. Back-row rule (AO-D069): `isBlockedByFrontAlly` now means any living front-row ally blocks a back-row MELEE stack; support/healer and ranged are never marked blocked; the blocked marker tooltip says "Front row is occupied: this melee unit cannot attack".
6. Focus Fire etc.: the Turn effects strip reads `combat.nextFriendlyAttackBonusPercent` (chip "Next friendly attack +50%"), army-wide defense/damage buffs; fix the two failing tests (`turnEffects.test.ts`, `tipContent.test.ts` hero stat mana example) against the new engine model, do not weaken them.
7. Hero stat tooltips: rewrite `HERO_STAT_INFO` texts to the real rules now: Intelligence scales magic hero spells (Fireball, Frost, Chain Lightning, Arcane Storm), Dexterity scales volleys (Arrow Rain, Volley), Strength scales Command: Strike; Wisdom gives +1 max Mana per 4 points above 10 (read the constants from `heroSpells.ts` / `heroStats.ts`); Vitality "not used yet" unless the engine reads it. Cards that scale show a small "Scales with <stat>" badge on card views and in the card info popup (`card.scalesWith`).
8. Skeleton: a proper 32x32 pixel sprite (undead, bone-white with dark sockets, same quality as the other sprites, both idle frames), a role icon, unit text, Barracks does not list it, army bar/popups handle it; toast/history "N fallen soldiers rose as Skeletons" for `UNITS_RAISED`. Necromantic doctrine text in the Temple panel matches the engine.
9. Card texts: `src/ui/cardText.ts`/`unitText.ts` are hard copies: check every card's text against the engine data (`CARD_UPGRADES` descriptions, effects) and fix drift; the "needs an enemy in reach" wording must not appear anywhere; Fireball text states its splash.
10. Deck viewers, hand cards and reward cards show the mana cost of hero-cast cards correctly; the pile viewers list Command: Strike and Volley.
11. Docs: docs/SCREEN_SPEC.md battle section updated. Delete orphaned code.

## Allowed files
src/ui/**, src/App.tsx, src/index.css, docs/SCREEN_SPEC.md, docs/DESIGN_LANGUAGE.md (only the sprite/icon lists and the helper classes deleted in AO-043).

## Forbidden
src/engine/** (report gaps).

## Acceptance criteria
tsc clean, vitest green (all 683 tests incl. the two currently failing ones fixed properly). Browser (puppeteer-core, dev server port 5211, never 5173/4173, inject state BEFORE load, real clicks): a Mage battle: Fireball on an enemy (no own-unit prompt, no damage to own units, splash on neighbours, hero-cast effect visible), Arcane Storm and Focus Fire played by clicking the empty field, Frost on an enemy then that enemy skipping its turn, killing all enemies then healing with Heal and pressing Finish Battle, a Priest behind a Swordsman healing, a blocked back-row enemy melee, Skeleton stack after a Necromantic-doctrine victory; screenshots looked at; no console errors.
