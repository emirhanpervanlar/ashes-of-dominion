# Ashes of Dominion — Claude Implementation Handoff

> **Document purpose:** This is the canonical design and implementation handoff for the current version of the game. Claude should treat this document as the source of truth unless the user explicitly changes a rule in conversation.
>
> **Important:** Do not silently reintroduce mechanics that were explicitly removed. Prototype/balance values may change during playtesting, but the core architecture and gameplay philosophy below should remain stable.

---

## 1. Game Vision

**Working title:** Ashes of Dominion

A web-based turn-based strategy RPG / roguelike combining:

- **Disciples: Sacred Lands** — readable 6-stack battle presentation, positional targeting, manual unit attacks, unit abilities.
- **Heroes of Might and Magic III** — persistent army stacks, casualties, recruitment, world exploration, strategic resources, a home city, army attrition.
- **Slay the Spire** — deckbuilding, card rewards, relics, build discovery, run structure.
- **Baldur's Gate** — Hero identity, RPG progression, Hero abilities, traits and future narrative/companions.
- **Darkest Dungeon** — attrition, risk, persistent losses, retreat decisions and pressure over a run.

The game must **not** feel like Slay the Spire with a Heroes skin. Each inspiration belongs to a different gameplay layer.

### North-star fantasy

The player should feel:

> “I built this army, positioned my troops, personally ordered attacks, and at the critical moment used my units' special abilities and my Hero's powers to turn the battle.”

Not:

> “I played a damage card that happened to represent an army.”

---

# 2. Core Design Principles

1. **Army units fight.** The player should not need cards just to make soldiers perform their ordinary attacks.
2. **Cards enhance/control combat.** Cards represent unit abilities and Commander/Army commands.
3. **Position determines target availability.** The player should understand who can attack whom from the battlefield itself.
4. **Manual targeting is intentional.** Selecting a unit reveals valid enemy targets; the player chooses the target.
5. **Persistent stacks matter.** 100 Swordsmen becoming 73 is meaningful and persists into later battles.
6. **Army composition shapes the deck.** The units the player owns determine which unit-ability cards can appear and how strong they are.
7. **Hero abilities create the RPG layer.** Hero progression should not replace army management.
8. **The city must matter to the main loop.** It is the player's home base, recruitment center and development hub.
9. **World movement should feel spatial.** Do not use the current Slay the Spire-style “choose one of three nodes” structure.
10. **Do not overcomplicate.** If a mechanic makes combat harder to read without creating a meaningful decision, remove it.
11. **Near-zero graphics are acceptable for MVP.** Clarity, interaction feedback and information hierarchy matter more than art.
12. **Server/domain engine is authoritative and deterministic.** UI must not own game rules.

---

# 3. Current Core Loop

```text
HOME CITY
   ↓
Recruit / Heal / Upgrade / Prepare Deck
   ↓
WORLD MAP
   ↓
Move / Explore / Resource / Event / Enemy
   ↓
BATTLE
   ↓
Casualties + Rewards + Cards + Relics + Progression
   ↓
WORLD MAP
   ↓
Return to City when useful OR continue taking risks
   ↓
Develop Army / Hero / Deck
   ↓
Boss / End of Run
```

The key strategic question is often:

> **“Should I fight now, or should I return to the city / seek resources / wait for recruitment / take another route?”**

---

# 4. COMBAT SYSTEM — CURRENT CANONICAL DESIGN

## 4.1 Battlefield

Use a **Disciples-inspired 6-vs-6 battlefield**.

Each side has six stack slots arranged as 3 columns × 2 rows:

```text
                 ENEMY

        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │ FRONT 1 │ │ FRONT 2 │ │ FRONT 3 │
        ├─────────┤ ├─────────┤ ├─────────┤
        │ BACK  4 │ │ BACK  5 │ │ BACK  6 │
        └─────────┘ └─────────┘ └─────────┘

                 PLAYER

        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │ FRONT 1 │ │ FRONT 2 │ │ FRONT 3 │
        ├─────────┤ ├─────────┤ ├─────────┤
        │ BACK  4 │ │ BACK  5 │ │ BACK  6 │
        └─────────┘ └─────────┘ └─────────┘
```

A slot may be empty.

A slot contains a **stack**, not one individual soldier.

Example:

```text
🛡 KNIGHT
× 27
HP ████████
Veteran II
```

---

## 4.2 Player interaction: unit-by-unit manual attack

There is **NO automatic player attack resolution**.

The player selects their stacks one by one.

Example:

```text
Player selects Knight
        ↓
Game highlights all enemies the Knight can attack
        ↓
Player clicks one highlighted enemy
        ↓
Knight attacks that enemy
```

This is deliberately inspired by the readability and interaction model of Disciples.

### Critical UI rule

When a unit is selected, valid targets must receive a clear visual frame/highlight.

The player should never have to memorize targeting rules to understand what can be attacked.

---

# 5. Targeting Geometry

The core idea is:

> **Position defines the natural set of targets.**

For front-row units:

```text
PLAYER LEFT   → ENEMY LEFT + CENTER
PLAYER CENTER → ENEMY LEFT + CENTER + RIGHT
PLAYER RIGHT  → ENEMY CENTER + RIGHT
```

Visual model:

```text
Enemy:

[ A ] [ B ] [ C ]

Player:

[ X ] [ Y ] [ Z ]

X → A, B
Y → A, B, C
Z → B, C
```

This is the fundamental Disciples-like targeting rule.

### Back-row units

Backline units are generally ranged/support/magic units and may have broader target access.

For MVP, ranged backline units such as Archers can target all relevant enemy positions according to their unit definition.

Do not introduce a large set of special targeting exceptions initially. Define target masks in unit data/configuration.

---

# 6. Front / Back Rules

Frontline is the normal melee engagement layer.

A melee unit primarily interacts with the enemy frontline.

If an enemy frontline position is empty or the front unit is eliminated, the enemy backline may become reachable according to the unit's targeting rules.

Backline is intended for:

- Archers
- Priests
- Mages
- future ranged/support units

Backline units should generally be more vulnerable when the frontline collapses.

Do not turn this into Fire Emblem-level positioning complexity.

---

# 7. Unit Action Model

This is a major correction from the previous prototype.

### Every stack has a normal action.

Normal attacks do **not** consume Energy.

There is no Attack Point / Defence Point system.

There is no AP/DP economy.

The normal action is part of the unit itself.

Examples:

| Unit | Normal Action |
|---|---|
| Swordsman | Attack an accessible enemy |
| Knight | Attack an accessible enemy |
| Archer | Ranged attack an accessible enemy |
| Priest | Heal a valid friendly stack or perform a weak basic attack if specified |
| Goblin | Attack |
| Orc | Heavy attack |
| Wolf | Attack with a preference for vulnerable/backline targets |
| Shaman | Support/buff or attack depending on definition |

The exact basic action is data-driven.

---

# 8. Cards Are Unit Abilities and Commander Commands

Cards no longer exist primarily to make soldiers attack.

Cards represent:

1. **Unit special abilities**
2. **Commander/army commands**
3. Later: Hero/spell interactions where appropriate

A normal attack is free.

A special ability costs Energy according to the card.

Example:

```text
Knight
  ├─ Basic Attack (free)
  ├─ Passive: Guard
  ├─ Charge (card)
  └─ Shield Wall (card)
```

---

# 9. Example Unit Ability Cards

## Archer

### Focus Shot

- Type: Unit Ability
- Unit: Archer
- Effect: Strong single-target ranged attack.
- Target: valid Archer target.

### Arrow Rain

- Type: Unit Ability
- Unit: Archer
- Effect: Attack multiple enemies in the selected target area/lane.
- Cost: prototype 2 Energy.

### Piercing Arrow

- Type: Unit Ability
- Unit: Archer
- Effect: Hit the primary target and an eligible unit behind it.

---

## Knight

### Charge

- Type: Unit Ability
- Unit: Knight
- Effect: Powerful attack against a valid target.
- Prototype bonus: +50% damage.
- Cost: prototype 1 Energy.

### Shield Wall

- Type: Unit Ability
- Unit: Knight
- Effect: Defensive stance / protection effect.
- Prototype: significant defense for the relevant round.

### Guard

- Type: Unit Ability
- Unit: Knight
- Effect: Protect an adjacent friendly stack.

---

## Swordsman

### Shield Bash

- Attack with a control component such as Stun/Freeze-like temporary disruption.

### Hold Formation

- Increase defensive effectiveness for the relevant formation/round.

### Counterattack

- If attacked during the relevant period, retaliate.

---

## Priest

### Greater Heal

- Strong healing of a friendly stack.

### Bless

- Increase Strength / Armor / relevant positive state.

### Purify

- Remove Poison, Bleed, Fear or other removable negative states.

---

# 10. Commander / Hero Cards

Commander cards are not tied to a specific unit.

Examples:

### Rally

Increase morale of a selected stack or relevant group.

### Reposition

Move a stack to another valid battlefield slot.

This is strategically important because position determines the target graph.

### Focus Fire

Allow a unit to attack a selected valid target rather than relying on its default targeting preference.

### Tactical Insight

Draw cards / improve tactical resources.

### Formation

Modify the army's formation temporarily.

Avoid making Formation a complicated mini-game in MVP.

---

# 11. Hero System

The Hero is the RPG layer.

The Hero is **not a normal battlefield unit** and does not occupy one of the six army slots.

Hero resources:

- HP
- Mana
- Energy is used for cards, not necessarily Hero resource identity
- Hero ability cooldowns where needed

Prototype:

```text
Hero: Commander
HP: 100 / 100
Mana: 5 / 8
Energy: 3 / 3
```

Prototype Mana regeneration: +2 per player turn.

Prototype Energy: +3 per player turn / max 3.

These are **prototype values**, not immutable balance values.

---

# 12. Hero Ability Examples

Commander:

- Tactical Command
- Rally
- Heroic Intervention
- Mass Command
- Reposition / command manipulation

Future Heroes:

- Commander
- Necromancer
- Ranger
- Archmage

Do not implement all future Heroes before the core combat loop is proven.

---

# 13. Combat Turn Flow

```text
PLAYER PHASE
    ↓
Select stack
    ↓
Select valid target
    ↓
Normal attack OR play ability card
    ↓
Repeat for available actions
    ↓
Use Hero abilities/cards as appropriate
    ↓
END TURN
    ↓
ENEMY PHASE
    ↓
Enemy AI chooses actions/targets
    ↓
Resolve enemy actions
    ↓
NEXT PLAYER TURN
```

### Important

The player should be allowed to act with their six stacks in any useful order.

Do not force a rigid initiative system in MVP unless required later.

---

# 14. Enemy Intent

Enemy intent remains visible, Slay the Spire-inspired.

However, because target selection is much more constrained and visible, intent should be extremely readable.

Example:

```text
ORC
⚔ 18
↓
KNIGHT
```

Shaman:

```text
SHAMAN
↑ +2 Strength
→ ORC
```

The UI should avoid a forest of arrows.

When the player selects an enemy or unit, relevant target relationships can be highlighted.

---

# 15. Combat UI Requirements

The web UI must prioritize readability over visual effects.

Recommended layout:

```text
                     ENEMY

     [ Orc ]       [ Shaman ]       [ Goblin ]
      ×42            ×12              ×35
      HP ████        HP ███           HP ████
      ⚔18            ↑BUFF            ⚔12


              ===== BATTLE =====

     [ Knight ]    [ Swordsman ]     [ Archer ]
       ×27             ×80             ×30
       HP ████         HP ███          HP ████

     [ Archer ]     [ Priest ]        [ Knight ]
       ×20             ×15              ×8


        [Card] [Card] [Card] [Card] [Card]

      Hero HP   Mana   Energy        END TURN
```

When a player unit is selected:

- show valid targets with a strong border
- optionally dim invalid targets
- show attack preview where useful
- show card availability

Avoid permanent arrows for every possible relationship.

---

# 16. Attack Point / Defence Point — REMOVED

The previous prototype introduced Attack Point and Defence Point to prevent units from feeling idle.

This system is now explicitly **removed**.

Reason:

- Adds another resource layer.
- Makes the player think about AP/DP instead of the army.
- Complicates card design.
- Does not solve the actual problem.

The correct solution is:

> **Every stack has a free normal action. Cards provide special actions.**

---

# 17. Army Stacks

A stack represents multiple soldiers of the same unit type.

Example:

```json
{
  "stackId": "s1",
  "unitType": "knight",
  "count": 27,
  "currentHp": 250,
  "maxHp": 324,
  "morale": 2,
  "veterancy": 1,
  "position": 1,
  "buffs": [],
  "debuffs": []
}
```

The player may have at most **6 stacks** in battle.

Casualties persist between battles.

Example:

```text
100 Swordsmen
↓
Battle
↓
73 Swordsmen
↓
Next battle starts with 73
```

This is one of the main Heroes III-inspired mechanics.

---

# 18. Army Attrition

Losing units should matter beyond a temporary HP bar.

Potential future model:

- Dead = permanently lost.
- Wounded = recoverable in city.

For MVP, a simpler persistent-count model is acceptable.

A badly damaged stack can suffer reduced combat effectiveness and morale.

Prototype idea:

- Below ~50% effective HP → -10% damage.
- Below ~50% → -1 Morale.

Balance values are provisional.

---

# 19. Unit Stats

Initial prototype friendly units:

### Swordsman

- HP/unit: 10
- Attack: 3
- Defense: 2
- Passive: adjacent Swordsman +10% Defense

### Archer

- HP/unit: 6
- Attack: 4
- Defense: 0
- Passive: backline +25% Attack

### Knight

- HP/unit: 12
- Attack: 7
- Defense: 4
- Passive: Guard / absorb or redirect 25% of adjacent stack direct damage as prototype

### Priest

- HP/unit: 8
- Attack: 1
- Defense: 1
- Role: healing/support

Initial enemy units:

### Goblin

- HP: 5
- Attack: 2
- Poison: 1

### Orc

- HP: 12
- Attack: 5

### Shaman

- HP: 8
- Attack: 2
- Support: buffs weakest ally by +2 Strength as prototype

### Wolf

- HP: 7
- Attack: 4
- Bonus: +50% damage against backline as prototype

All numbers are configurable and must be balance-tested.

---

# 20. Damage Model

Avoid naive linear scaling forever.

Conceptual:

```text
Raw Damage = Unit Attack × Effective Count
Final Damage = Raw Damage × modifiers − defense/modifiers
```

Prototype diminishing count curve:

```text
1–50      ×1.00
51–100    ×0.90
101–200   ×0.75
201–400   ×0.60
400+      ×0.45
```

This is a prototype, not a locked formula.

Goal:

```text
500 soldiers > 100 soldiers
```

but not:

```text
500 soldiers = exactly 5× 100 soldiers
```

This supports Horde vs Elite builds.

---

# 21. Status Vocabulary

Keep MVP vocabulary small:

- Strength
- Weak
- Armor
- Bleed
- Poison
- Burn
- Fear
- Taunt / target priority
- Haste later
- Freeze / Stun-like control

Do not create dozens of statuses before the combat loop is fun.

---

# 22. Deck System

The deck is a combat build assembled around the current army and Hero.

Prototype:

- Starting deck: ~12 cards
- Max deck: ~30 cards
- Draw: 5 per turn
- Hand max: 10
- Discard pile
- Reshuffle when draw pile is empty
- Retain/Exhaust available
- Card reward can be skipped
- Rarity: Common / Rare / Epic / Legendary

### Critical new rule

The card pool is influenced by the player's current army.

If the player has:

```text
Knight ×30
Archer ×40
Priest ×15
```

the deck/reward pool can contain:

- Knight abilities
- Archer abilities
- Priest abilities
- Commander cards
- Hero-related cards where appropriate

If the player does not own a unit, that unit's normal ability cards should not randomly flood the deck.

---

# 23. Army → Deck Relationship

This is a core identity mechanic.

```text
ARMY COMPOSITION
      ↓
AVAILABLE UNIT ABILITIES
      ↓
CARD POOL
      ↓
DECK
      ↓
COMBAT
```

Example:

```text
Archer ×40
   ↓
Arrow Rain becomes available
   ↓
Player chooses Archer-heavy cards
   ↓
Ranged build develops
```

If the Archer stack is devastated:

```text
Archer ×40
↓
Archer ×8
```

its Archer abilities remain available but naturally become weaker if their effect scales with Archer count.

This means:

> **Army attrition also creates deck attrition/power loss.**

That is intentional.

---

# 24. Card Scaling

Unit ability cards should generally scale from the relevant unit stack.

Example:

```text
Arrow Rain
Power ∝ Archer stack count / relevant Archer strength
```

Avoid every card being an arbitrary fixed spell.

The player should feel that the card is being performed by their army.

---

# 25. Relics

Relics are strong run-level modifiers inspired by Slay the Spire.

Examples:

### King's Crown

Army size >100 → +2 Strength.

### Blood Banner

Army damage +30%, recruitment cost +50%.

### Cursed Crown

Hero Mana +3, skill cooldown +1.

### Merchant's Ring

Shop prices -30%, battle rewards -20%.

### Hawk's Eye

Ranged units +20% Attack.

### Arcane Core

Hero spell damage +25%.

### Banner of the Horde

Count-based Army effects +25%.

### Crown of Champions

Stacks with count <25 gain +30% Attack.

Negative/positive relics should preferably create **interesting tradeoffs**, not pure punishment.

---

# 26. Traits

Traits create run identity.

Examples:

- Veteran: Army morale +1.
- Haunted: Undead encounters +20%.
- Greedy: Gold rewards +10%, food cost +10%.
- Bloodthirsty: Healing -30%, kills grant temporary Strength.

Traits should change decisions rather than simply add raw stats.

---

# 27. Build Archetypes

Builds emerge from the combination of:

```text
Hero
+ Hero Skills
+ Army
+ Cards
+ Relics
+ City Upgrades
+ Traits
+ Equipment later
```

Main archetypes:

1. **Horde** — many cheap units, high food/recruitment cost, count synergies, vulnerable to AoE.
2. **Elite** — few powerful units, expensive casualties, strong defensive and quality-based abilities.
3. **Hero/Spell** — smaller army, Hero mana and ability engine.
4. **Economy/Merchant** — gold/resource/city focus.

Future sub-archetypes:

- Cavalry
- Ranged
- Defense
- Morale
- Necromancy
- Fear
- Sacrifice
- Combo

Strong examples:

- Undying Legion
- Immortal Knights
- Storm Archers
- Arcane Overlord
- Horde
- Merchant Warlord
- Cavalry Blitz
- Blood Army
- Tactical Commander
- Fear Legion
- Fortress
- Combo Engine

Do not implement all of these in MVP.

First deep build tests should be:

1. Undying Legion
2. Immortal Knights
3. Horde

---

# 28. WORLD MAP — REPLACES SLAY THE SPIRE NODE MAP

The current design should **not** use a standard Slay the Spire-style map where each turn offers three abstract nodes.

The game needs a spatial world because:

- army movement matters
- food/upkeep matters
- city location matters
- resources matter
- returning to base matters
- route planning matters
- danger should be visible in geographic context

Use a compact Heroes-style spatial map.

Example:

```text
                 [Northern Mountains]
                       🏔
                        │
                [Ruins] ─── [Orc Camp]
                   │
                   │
[Gold Mine] ─── [HOME CITY] ─── [Forest]
                   │               │
                   │               [Wolf Den]
                [Village]
                   │
              [Ancient Road]
                   │
                 [BOSS]
```

The player chooses where to travel.

---

# 29. SINGLE HOME CITY — CURRENT DESIGN

Use **one meaningful city** in the core game instead of multiple cities.

The city is:

- Home base
- Recruitment center
- Healing/safety center
- Deck development center
- Hero development center
- Army preparation center
- Long-term anchor for the run

Multiple cities created too much management and weakened the relationship between city and core loop.

A second city can become a future late-game or special scenario feature, but it is **not required for MVP**.

---

# 30. City Production Cycle

The city has a recruitment/production cycle.

A core prototype rule:

> **Recruitment production completes every 7 World Days.**

Example:

```text
Day 1
Production started: Knight ×20

Day 4
Progress: 4 / 7

Day 7
Knight ×20 available
```

This should create strategic tension on the world map.

Example:

```text
Day 5
Army badly damaged

City production completes in 2 days

Boss is 3 days away

Player must decide:
- continue toward Boss
- return to City
- find food/resource
- take another fight
```

The city therefore becomes part of the strategic clock.

---

# 31. City Must Not Be an Idle Wait Exploit

The player should not be able to sit in the city forever and gain infinite power without consequence.

Use a **World Threat** progression.

Threat should increase over time and change the world through:

- stronger/more dangerous enemy armies
- patrols
- raids
- elite encounters
- city pressure
- changing resource availability
- boss mechanics

Avoid relying only on “enemy HP +50%”.

---

# 32. City Levels

Prototype three stages:

### Level 1 — Camp

- basic recruitment
- basic healing
- one production function
- basic development

### Level 2 — Stronghold

- stronger recruitment
- advanced units
- more buildings
- deck development
- Hero training

### Level 3 — Capital

- elite unit access
- special building
- powerful doctrine
- advanced ability/card pool

The exact requirements are prototype values.

---

# 33. City Buildings

Do not build a Civilization-style management system.

Use a limited number of meaningful slots.

Prototype building pool:

### Economy

- Market
- Warehouse
- Gold Mine
- Sawmill

### Army

- Barracks
- Stable
- Archery
- Mage Tower

### Hero

- Tavern
- Training Hall
- Forge

### Special

- Shrine
- Library
- Castle

The city may have around 6 active building slots while more than 6 possible buildings exist.

This creates specialization.

---

# 34. City Build Should Influence the Deck

This is critical.

The city should not merely give:

```text
+100 Gold
```

It should unlock or improve the player's build.

Examples:

### Barracks

Unlock/improve melee units and abilities.

### Archery

Unlock/improve ranged units and abilities.

### Training Hall

Upgrade unit ability cards / improve army training.

### Library

Improve Hero abilities / spells.

### Mage Tower

Unlock magic-related unit/ability content.

Thus:

```text
CITY
 ↓
UNIT ACCESS
 ↓
ABILITY CARD POOL
 ↓
DECK BUILD
```

---

# 35. City Specialization

Possible doctrines:

### Military Doctrine

Army card effects stronger / cheaper.

### Arcane Doctrine

Spell damage +20%.

### Necromantic Doctrine

Deaths can become Skeletons.

### Economic Doctrine

Resource nodes yield more.

Exact numbers are prototype values.

---

# 36. Recruitment

The player has a maximum of 6 active army stacks.

This forces meaningful choices:

- recruit
- merge stacks
- replace weak units
- maintain elite units
- eventually dismiss/garrison units

Same-type stacks can merge.

Veterancy should not be blindly erased when merging.

Example:

```text
80 veteran + 20 recruit
```

should create a combined stack with veteran quality approximately proportional to the composition, using a deterministic formula.

---

# 37. Garrison

Future/optional after core MVP:

The city can store unused army stacks.

This provides a strategic alternative to deleting valuable veteran units.

Do not implement complex city defense until the main combat loop works.

---

# 38. World Resources

MVP resources:

- Gold
- Food

Later:

- Wood
- Ore
- Crystal

### Gold

Used for:

- recruitment
- buildings
- healing
- upgrades
- shops
- mercenaries
- events

### Food

Used for:

- movement
- army upkeep

This makes a large army powerful but expensive.

---

# 39. Food / Army Upkeep

A large army should consume more Food.

Prototype additional cost concept:

```text
<50       +0
51–100    +1
101–200   +2
201–400   +3
400+      +5
```

These values are prototypes.

Food reaching zero should not instantly end the run.

Potential starving state:

- Morale penalty
- Army HP loss
- eventual casualties

The purpose is pressure, not arbitrary punishment.

---

# 40. World Day

World Day advances as the player travels, waits, performs relevant actions or otherwise consumes time.

City production uses World Days.

Threat progression uses World Days.

Resource production can use World Days.

The player should always see:

```text
Day 12
Gold 840
Food 93
Threat 2
```

---

# 41. World Map Content

Possible node/location types:

- Road
- Battle
- Elite Battle
- Resource
- Gold Mine
- Food Farm
- Ruins
- Village
- Merchant
- Event
- Home City
- Boss
- Secret/special locations later

Unlike a node map, these are physical locations on the world.

The player can choose routes based on distance, danger and objective.

---

# 42. Events

Events must create decisions rather than merely random punishments.

Example:

## Abandoned Camp

Options:

- Search → chance of rare relic, risk of trap.
- Rest → Hero HP +20%.
- Burn → future ambush frequency decreases.

Other event concepts:

### Bandit Raid

A Gold Mine stops producing until resolved.

### Orc Invasion

An enemy army moves toward the player's area/city.

### Merchant Caravan

Temporary shop.

### Plague

Army HP -10%.

### Ancient Portal

Access to a special area.

---

# 43. Merchant / Shops

Merchants can sell:

- Cards
- Relics
- Food
- Army/recruitment opportunities
- Equipment later

Mercenary camps can provide immediate recruitment at premium prices.

---

# 44. Retreat

Retreat is allowed.

It must have a cost.

Possible costs:

- Food
- Morale
- casualties
- World Day/time
- enemy positional advantage

Retreat must not become a free “undo battle” button.

---

# 45. Bosses

Bosses should test builds through mechanics, not only inflated stats.

Examples:

### Lich King

Resurrects dead units every 3 turns.

### Dragon

Massive AoE pressure.

### Warlord

Gains strength based on player's army size.

The final boss should create a build check:

> “Did I actually build something coherent?”

---

# 46. Roguelike Run Structure

Target MVP run:

**20–40 minutes**.

Long-term:

**30–60 minutes**.

Run-based state:

- Army counts
- Casualties
- City development
- Gold
- Food
- Cards
- Relics
- Equipment later
- Temporary traits/conditions
- World control

Meta progression:

- Hero unlocks
- Hero skill-tree progression
- new cards
- new units
- new Heroes
- starting relic options
- new factions
- new scenarios

Meta progression should mostly unlock **new choices/build possibilities**, not huge raw stat inflation.

---

# 47. Starting Relics

Possible starting choice:

### Royal Banner

Army size +20; recruitment cost +10%.

### Arcane Crystal

Start +2 Mana; army size -10%.

### Blood Coin

Gold rewards +25%; Food rewards -25%.

These are examples; balance is provisional.

---

# 48. Factions

Future factions:

- Kingdom / Human
- Wild / Orc / Beast
- Undead / Necromancer
- Arcane / Mage

Each can eventually provide:

- Units
- Cities/content
- Cards
- Relics
- Events
- Bosses

Reputation is a future lightweight system, potentially -100 to +100.

Do not implement complex diplomacy in MVP.

---

# 49. Narrative

Working story:

The Kingdom shattered after the Emperor's death. The Crown of Dominion broke into pieces, and factions now control fragments of the old realm.

The Hero travels through the shattered world, builds an army, captures/controls key locations, interacts with factions and ultimately determines who controls the remnants of Dominion.

Future outcomes can depend on:

- factions killed/saved
- cities/territories controlled
- companions
- traits
- relics
- choices

Heavy narrative is deferred until gameplay is proven.

---

# 50. Future Companions

Future system:

- 3 companion slots
- passive effects
- level
- equipment
- quests
- build interactions

Examples:

### Aria — Ranger

Archers +20%.

### Brom — Warrior

Swordsman gains Armor.

### Malach — Necromancer

Enemy deaths may become Skeletons.

Not MVP.

---

# 51. Future Necromancy / Build Examples

### Undying Legion

Skeleton / Death / Sacrifice / Summon.

Deaths become a resource.

### Immortal Knights

Knight / Guard / Armor / Heal / Veteran.

Small elite army.

### Storm Archers

Archer / Ranged / Backline / Focus Fire / Volley.

### Arcane Overlord

Hero / Mana / Mage / Spell.

### Horde

Count / Recruitment / Morale / Mass Attack.

### Merchant Warlord

Gold / Mercenaries / Shops / Economy.

### Cavalry Blitz

Cavalry / Charge / Positioning / Formation.

### Blood Army

Sacrifice / Low HP / Blood / Risk.

### Tactical Commander

Reposition / Formation / Focus Fire / Counterattack.

### Fear Legion

Fear / Morale / Wraith / Execution.

### Fortress

Defense / Guard / Armor / City specialization / Counterattack.

---

# 52. Technical Architecture

Preferred stack:

- Frontend: React + TypeScript
- Backend: pure PHP API is appropriate
- PostgreSQL
- Redis optional

The game engine must be independent from HTTP and UI.

Recommended abstraction:

```text
GameState + PlayerAction
        ↓
    GameEngine
        ↓
NewGameState + Events
```

Example:

```json
{
  "action": "PLAY_CARD",
  "cardId": "charge_01",
  "targetStackId": "army_02",
  "targetEnemyStackId": "enemy_01"
}
```

The server/domain engine validates and resolves this.

Frontend must never be trusted for:

- damage
- casualties
- rewards
- RNG
- resource changes
- card legality
- battle outcome

---

# 53. Deterministic Runs

Every run has a seed.

```text
runSeed + playerActions = reproducible state
```

Use one centralized RNG service.

Do not scatter random calls throughout UI/components.

Benefits:

- debugging
- replay
- tests
- balance simulation
- bug reproduction

---

# 54. Game State Example

```json
{
  "run": {
    "seed": 123456,
    "day": 12,
    "gold": 840,
    "food": 93,
    "threatLevel": 2
  },
  "hero": {
    "id": "commander",
    "hp": 82,
    "maxHp": 100,
    "mana": 5,
    "maxMana": 8,
    "energy": 3,
    "maxEnergy": 3
  },
  "army": [
    {
      "stackId": "s1",
      "unitType": "knight",
      "count": 18,
      "currentHp": 171,
      "maxHp": 180,
      "morale": 2,
      "veterancy": 1,
      "position": 1,
      "buffs": [],
      "debuffs": []
    }
  ],
  "combat": null
}
```

The schema is expected to evolve.

---

# 55. Combat Event Log

Combat resolution should emit structured events.

Example:

```json
[
  { "type": "UNIT_SELECTED", "stackId": "army_02" },
  { "type": "TARGET_SELECTED", "targetId": "enemy_01" },
  { "type": "STACK_ATTACKED", "attacker": "army_02", "target": "enemy_01", "damage": 72 },
  { "type": "UNITS_KILLED", "stackId": "enemy_01", "count": 11 },
  { "type": "CARD_PLAYED", "cardId": "charge_01" }
]
```

Events are useful for:

- frontend animations
- combat log
- tests
- replay
- debugging

---

# 56. Card Architecture

Use data/config-driven definitions.

Conceptual:

```text
CardDefinition
- id
- name
- cost
- rarity
- tags
- sourceUnit / commander / hero
- targeting
- effects
- upgrade
```

Avoid putting card behavior directly inside React components.

Prefer composable effects where practical:

```text
GainMana(2)
DrawCards(1)
ApplyStrength(target, 2)
Attack(stack)
MoveStack(stack, position)
ApplyArmor(stack, 25)
Freeze(target)
```

---

# 57. Tags

Use tags to enable build synergy without hundreds of hard-coded interactions.

Examples:

```text
Charge:
Cavalry, Attack, Command, Aggressive

Rally:
Morale, Support, Command

Raise Dead:
Undead, Death, Summon

Sacrifice:
Death, Army, Risk
```

Tags can interact with relics, Hero skills, city doctrines and rewards.

---

# 58. Action Validation

Every action must be validated server-side.

Examples:

- Does the card belong to the player?
- Is it in hand?
- Is there enough Energy?
- Is the target valid?
- Is the stack alive?
- Is the destination valid?
- Is the skill off cooldown?
- Is the player in the correct battle phase?
- Does the city belong to the player?
- Are enough resources available?
- Is recruitment capacity available?

Never trust frontend validation.

---

# 59. Save / Resume

Save the run after meaningful world actions and before/after combat where appropriate.

Refreshing the browser must not destroy a run.

Combat state should be recoverable.

---

# 60. Testing Strategy

## Combat tests

Test:

- target availability
- left/center/right target geometry
- front/back interaction
- empty slots
- manual attack
- basic unit actions
- card targeting
- damage
- diminishing count
- casualties
- unit death
- buffs/debuffs
- positioning
- energy
- mana
- enemy intent
- victory/defeat

## World tests

Test:

- movement
- World Day
- Food
- upkeep
- resource production
- city production cycle
- recruitment
- city upgrades
- threat progression
- battle transitions

## Determinism

Same seed + same actions must produce the same result.

---

# 61. MVP Scope

The MVP must prove **one complete fun run**, not contain every planned feature.

### Combat MVP

- Disciples-inspired 6v6 layout
- 6 player stacks
- 6 enemy stacks
- 3-column × 2-row positioning
- manual unit selection
- valid target highlighting
- manual attack
- free basic actions
- unit ability cards
- Commander cards
- Energy
- Mana
- enemy intent
- casualties
- persistent stack counts
- basic buffs/debuffs
- deterministic RNG
- combat event log

### Friendly units

- Swordsman
- Archer
- Knight
- Priest

### Enemy units

- Goblin
- Orc
- Shaman
- Wolf

### Important note

The previous prototype combat scenario included a Mage stack, but Mage is not part of the formal MVP roster above.

**Do not silently add Mage to MVP.** Either replace it with an existing MVP unit or explicitly request/define a Mage as an additional prototype before implementing it.

### Cards

Start around 20 cards, including:

- Charge
- Rally
- Shield Wall
- Volley / Arrow Rain equivalent depending on final Archer naming
- Reposition
- Defend
- Focus Fire
- Battle Meditation
- Tactical Insight
- unit-specific abilities

### Relics

~10.

### World

- one Home City
- compact spatial world map
- roads
- resource locations
- battles
- events
- merchant
- one boss
- World Day
- Food
- Gold
- threat progression

### City

- one city
- recruitment
- healing
- production cycle
- 3 levels
- limited building slots
- build specialization
- card/ability development

### Run

20–40 minutes.

---

# 62. Implementation Order

## Phase 1 — Combat engine only

1. Game state
2. Hero
3. Six player positions
4. Six enemy positions
5. Unit definitions
6. Target geometry
7. Manual unit selection
8. Target validation
9. Basic attack
10. Casualties
11. Buff/debuff
12. Cards
13. Energy
14. Mana
15. Enemy intent
16. Enemy AI
17. Turn loop
18. Deterministic RNG
19. Event log
20. Tests

### Goal

A complete battle can be played without a world map or city.

---

## Phase 2 — Combat UI

Build the web battle screen.

Priority:

1. clear 6-vs-6 layout
2. readable stack cards
3. click unit
4. highlight valid targets
5. click target
6. attack animation/feedback
7. card hand
8. Hero resources
9. enemy intent
10. combat log

Do not add decorative graphics until the information architecture is correct.

---

## Phase 3 — Deck / Build Loop

Implement:

- card rewards
- card upgrades
- deck management
- relics
- Hero skills
- unit-to-card availability

Goal: after battle, the player makes meaningful build decisions.

---

## Phase 4 — World Map

Implement:

- spatial map
- roads
- movement
- World Day
- Food
- upkeep
- resource locations
- battles
- events
- merchant
- fog/exploration if needed
- threat

Do not use the Slay the Spire 3-choice node map.

---

## Phase 5 — Home City

Implement:

- one Home City
- recruitment
- healing
- 7-day production cycle
- buildings
- city level
- specialization
- card/ability unlocks
- Hero development

---

## Phase 6 — Complete Run

Implement:

- boss
- victory
- defeat
- run summary
- save/resume
- basic meta unlock

---

## Phase 7 — Build Expansion

Deepen only a few builds first:

1. Undying Legion
2. Immortal Knights
3. Horde

Then add additional factions/builds.

---

# 63. Example Combat Scenario

Use this scenario as a readability test.

Player:

```text
FRONT
Knight ×18 | Swordsman ×80 | Knight ×8

BACK
Archer ×30 | Priest ×15 | Archer ×20
```

Enemy:

```text
FRONT
Orc ×42 | Wolf ×20 | Orc ×30

BACK
Shaman ×12 | Goblin ×45 | Goblin ×45
```

When the player selects the left Knight, the UI should clearly show its valid targets.

When the player selects the center Swordsman, it should clearly show its valid targets.

When the player selects an Archer, its ranged target options should be visually clear.

The player must be able to understand the entire battlefield without reading a manual.

---

# 64. Example of Intended Player Decision

Suppose:

```text
Enemy:
[ Orc ] [ Shaman ] [ Goblin ]

Player:
[ Knight ] [ Swordsman ] [ Archer ]
```

The player sees that the center Swordsman can reach all three relevant targets while the left/right frontline units have narrower target ranges.

The player can then decide:

> “I want my Knight to occupy this position because it gives me access to the Shaman.”

This is the kind of tactical reasoning the combat system should generate.

The player should not be thinking:

> “Which AP/DP resource should I spend to make this stack attack?”

---

# 65. Why Combat and Deckbuilding Are Connected

The combat system should create this progression:

```text
Army composition
      ↓
Unit identity
      ↓
Unit abilities
      ↓
Card pool
      ↓
Deck construction
      ↓
Combat decisions
      ↓
Casualties
      ↓
Army composition changes
      ↓
Deck changes
```

This creates an organic relationship between Heroes-style armies and Slay the Spire-style decks.

---

# 66. Why the City Is Connected to the Loop

The city should create:

```text
City
 ↓
Recruitment
 ↓
New unit types
 ↓
New ability cards
 ↓
New builds
 ↓
Combat power
 ↓
World exploration
 ↓
Resources
 ↓
City upgrades
```

The city is therefore not merely an economy screen.

It is the **home base where the player's army/build evolves**.

---

# 67. Major Design Risks

## Risk: Combat becomes visually confusing

Solution:

- simple battlefield
- clear target highlights
- minimal permanent arrows
- strong unit selection state
- clear enemy intent

## Risk: Too much micromanagement

Solution:

- 6 stacks maximum
- no AP/DP
- no complex initiative
- simple targeting graph

## Risk: Army becomes irrelevant because cards do everything

Solution:

- basic actions are unit-owned
- ability strength scales with army
- casualties persist
- unit composition determines card pool

## Risk: City becomes irrelevant

Solution:

- recruitment cycle
- build development
- ability/card unlocks
- Hero development
- meaningful return-to-base decisions

## Risk: City becomes a Civilization clone

Solution:

- one city
- limited buildings
- three levels
- specialization
- no complex population/diplomacy/trade network

## Risk: Horde snowballs

Solution:

- food upkeep
- diminishing count scaling
- AoE vulnerability
- expensive recruitment
- threat progression

## Risk: Elite build loses one stack and becomes unrecoverable

Solution:

- recruitment cycle
- healing
- future wounded system
- retreat
- city recovery

---

# 68. Locked vs Prototype

## LOCKED CORE

These define the current identity:

- One Hero
- Hero is not a normal battlefield unit
- Maximum 6 army stacks
- Disciples-inspired 6-vs-6 combat presentation
- 3 columns × 2 rows
- Manual unit selection
- Target highlighting
- Manual target selection
- Free normal unit actions
- Unit ability cards
- Commander/Hero abilities
- Energy for cards
- Mana for Hero abilities
- Persistent casualties
- Army stacks
- Positioning matters
- Visible enemy intent
- Deckbuilding
- Relics
- World exploration
- Spatial road-based map
- One Home City
- City development
- 7-day production cycle as the current core prototype rule
- Gold and Food
- Army upkeep
- Roguelike runs
- Meta unlocks
- Server-authoritative engine
- Deterministic runs
- Near-zero graphics MVP

## PROTOTYPE / BALANCE

These may change through testing:

- exact unit stats
- damage coefficients
- diminishing count formula
- card costs
- Energy values
- Mana values
- city production quantities
- exact 7-day production implementation
- Food costs
- World Day costs
- threat scaling
- building bonuses
- city level requirements
- relic numbers
- morale effects
- wounded/dead model
- boss values
- run length

---

# 69. What Claude Must NOT Do

1. Do not silently change the core combat rules.
2. Do not reintroduce Attack Points or Defence Points.
3. Do not make normal attacks require cards.
4. Do not turn combat into an automatic simulation where the player merely watches.
5. Do not use the Slay the Spire 3-path node map for the world map.
6. Do not create multiple cities for MVP.
7. Do not build a Civilization-like city-management system.
8. Do not add dozens of units/cards before the core loop is fun.
9. Do not put game rules into React components.
10. Do not trust frontend actions.
11. Do not scatter random calls across the application.
12. Do not silently add Mage or other non-MVP units.
13. Do not solve complexity by adding more UI indicators instead of simplifying the underlying rules.
14. Do not add a new major subsystem without explicitly identifying it as a proposed change.

---

# 70. How Claude Should Handle Uncertainty

When uncertain:

1. Identify whether the issue is **LOCKED** or **PROTOTYPE**.
2. If locked, preserve the rule.
3. If prototype, choose the simplest implementation consistent with the design.
4. Do not invent a major mechanic silently.
5. State assumptions in a short implementation note.
6. Keep values configurable.
7. Add tests around non-trivial engine behavior.

Claude's role is both:

- senior game programmer
- senior game designer

Claude should flag contradictions before implementation rather than implementing contradictory systems.

---

# 71. Immediate Task — Combat V2 Refactor

**Do this before adding new city/world complexity.**

The current prototype felt “raw” because the combat model was difficult to read and the Attack Point / Defence Point system did not solve the underlying problem.

Refactor the battle system to:

### Remove

- Attack Point
- Defence Point
- automatic player attacks
- arbitrary free target selection
- unnecessary target priority complexity
- cross-lane attacks that are not justified by unit abilities

### Add/retain

- 6 player stacks
- 6 enemy stacks
- 3 columns × 2 rows
- Disciples-like manual targeting
- target highlighting
- manual normal attacks
- unit basic actions
- unit ability cards
- Commander cards
- Energy
- Mana
- enemy intent
- casualties
- persistent stack count
- simple statuses
- deterministic combat
- event log

### Acceptance test

A player should be able to look at the combat screen and immediately understand:

1. Where each of my six stacks is.
2. Where each enemy stack is.
3. Which enemies a selected unit can attack.
4. What each enemy intends to do.
5. Which stack is damaged.
6. Which ability cards can be used.
7. Why moving a unit changes its target options.

If these are not immediately readable, do not add more mechanics. Fix the presentation or simplify the rules.

---

# 72. Immediate Task After Combat — World Map V2

Once Combat V2 is fun and readable, implement:

- spatial world map
- roads
- Home City
- World Day
- Food
- Gold
- army upkeep
- resource locations
- enemy locations
- events
- merchant
- city return path
- 7-day production cycle
- city upgrades
- threat progression

Do not return to the three-choice Slay the Spire node structure.

---

# 73. Example Full Strategic Loop

```text
DAY 1
Home City
Recruit initial army
Choose city production
Prepare deck

DAY 2
Leave city
Travel toward Food Farm

DAY 3
Collect Food

DAY 4
Encounter enemy army

BATTLE
- position stacks
- manually attack
- use Archer ability
- use Knight Charge
- use Priest Heal
- use Commander ability

RESULT
- lose 12 Swordsmen
- gain card reward
- gain relic

DAY 5
Continue toward Ruins

DAY 6
Event
Choose Search
Gain relic but lose some HP

DAY 7
City production completes
Player decides whether to return

DAY 8+
Continue exploring or return to recruit

...

LATE RUN
Army is strong but Food is low
Threat is high
Boss is approaching
Player decides whether to risk the final route or return to City

FINAL BATTLE
Build is tested

RUN END
Rewards / meta unlocks
```

The exact event placement is procedural/config-driven; this is an example of the intended strategic rhythm.

---

# 74. North-Star Emergent Stories

The game should eventually generate stories like:

### Immortal Knights

“I started with a normal Commander build, found an elite-army relic, specialized my city in military training, recruited Knights, built Guard and Armor cards, and ended with a tiny veteran army that was incredibly difficult to kill.”

### Undying Legion

“I found death-related cards, developed a Necromantic city doctrine, started sacrificing units to create Skeletons, and my losses became part of the engine.”

### Horde

“I kept recruiting cheap troops until I had hundreds. Food became my biggest problem, so I had to route toward Farms. The Dragon's AoE nearly destroyed the entire army.”

These stories should emerge from interacting systems, not scripted sequences.

---

# 75. Final Design Summary

The current identity of Ashes of Dominion is:

```text
                 ASHES OF DOMINION

                    HERO
                     │
              RPG abilities / Mana
                     │
                     ▼
WORLD MAP ──────── ARMY ──────── CITY
   │                 │             │
   │                 │             │
 Food / routes       │       Recruitment /
 Resources            │       Upgrades /
 Events               │       Card unlocks
   │                 │             │
   └─────────────────┼─────────────┘
                     ▼
                  DECK
                     │
                     ▼
                6v6 COMBAT
                     │
             Disciples targeting
                     │
          Manual unit attacks
                     │
            Unit ability cards
                     │
                Hero abilities
                     │
                     ▼
                CASUALTIES
                     │
                     ▼
                  WORLD
```

### The three most important ideas are:

**1. Disciples combat readability**

> Select a stack → see valid targets → choose target → attack.

**2. Heroes army persistence**

> The stack survives between battles and its casualties matter.

**3. Slay the Spire deckbuilding**

> The army and Hero determine the card pool, and cards allow the player to manipulate and strengthen the army during critical moments.

The city and world map then provide the strategic layer that connects battles together.

---

# 76. Claude's First Implementation Instruction

Start by implementing **Combat V2 only**.

Do not expand the game into a larger feature set until this is playable and readable.

The first milestone is:

> **A deterministic browser battle where the player can see six army stacks, select any available stack, see exactly which enemy stacks it can attack, manually choose a target, execute a free normal attack, use a small number of unit ability cards, use a Hero ability, end the turn, observe readable enemy intents/actions, and continue until victory or defeat.**

Only after this feels good should the world map and city loop be reconnected.

The game should be judged first by one question:

> **“Is this 6v6 battle understandable and fun to control?”**

If the answer is no, simplify the combat system before adding content.
