# ASHES OF DOMINION
## Game Design Document + Claude Implementation Brief

**Status:** Pre-production / Vertical Slice specification  
**Purpose:** Canonical handoff from the design conversation to an AI coding agent (Claude).

> **Important:** Values marked `PROTOTYPE` are intentionally not final balance. They must be configurable and easy to rebalance. Core design decisions marked as locked should not be silently changed.

---

# 1. EXECUTIVE SUMMARY

## One-sentence pitch

A web-based, turn-based strategy RPG / roguelike where the player controls one Hero who commands an army of up to six persistent unit stacks through card-based combat, captures and develops cities, explores a dangerous world map, manages resources, discovers synergistic builds, and eventually defeats a region boss.

## Inspirations

The game combines structural strengths of:

- **Heroes of Might and Magic III:** world exploration, cities, recruitment, resources, army stacks, strategic movement and persistent casualties.
- **Slay the Spire:** roguelike runs, map decisions, card rewards, deckbuilding, relics, build discovery and visible enemy intent.
- **Darkest Dungeon:** attrition, persistent losses, morale/stress-like pressure, retreat and risk.
- **Baldur's Gate:** Hero identity, abilities, traits, choices and later companions/narrative.
- **Hearthstone:** readable cards, tags, synergies and satisfying combos.

## Central design idea

Cards do **not** replace the army.

Cards are **commands issued to the army**.

Desired player feeling:

> "My 187 soldiers just charged."

not:

> "I played a card that dealt 23 damage."

The army is persistent and valuable. If a stack starts with 100 soldiers and ends a battle with 73, the next battle begins with 73.

The Hero normally does **not** occupy a battlefield square and is not a normal attackable combat unit. The Hero commands the army using Hero skills/spells, mana and strategic effects.

---

# 2. DESIGN PRINCIPLES

1. **Build discovery over class locking.** The player discovers a build during a run.
2. **Every system feeds another system:** Hero ↔ cards ↔ army ↔ cities ↔ economy ↔ world map.
3. **The key strategic question is often "Should I fight now?"**
4. **Power has a cost:** large armies need food/recruitment; elite armies are expensive to replace; spell builds depend on mana.
5. **Build identity changes playstyle**, not merely percentage damage.
6. **Persistent losses matter but one bad battle must not automatically invalidate a run.**
7. **Readable complexity:** many interactions are possible, but MVP uses a small vocabulary of statuses and mechanics.
8. **Near-zero graphics are sufficient for MVP:** HTML/CSS, cards, icons/emojis, bars, text and simple animations.

---

# 3. CORE GAME LOOP

```text
WORLD MAP
  ↓
Move / Explore / Event / Resource / Battle / City
  ↓
COMBAT
  ↓
Rewards
  ↓
Hero / Deck / Relic / Army / City progression
  ↓
WORLD MAP
  ↓
Eventually BOSS
Initial target run length: 20–40 minutes.
Long-term target: 30–60 minutes.

4. RUN VS META PROGRESSION
Run-based / temporary
Army units and counts
Casualties
City ownership
City buildings
Gold
Food
Run resources
Cards
Relics
Equipment
World-map control
Temporary traits/conditions
Permanent / meta
Hero unlocks
Hero skill-tree progression
New cards becoming available
New unit types
New Heroes
Starting relic options
New factions/content
New scenarios
Principle

Meta progression should primarily unlock choices and build possibilities, not massive raw-number inflation.

5. HERO SYSTEM
MVP Hero: Commander

Core resources:

HP
Mana
AC (Attack Command)
DC (Defense Command)
PROTOTYPE values
AC: 3/3, restored to full each player turn. Spent on offensive army-command cards.
DC: 3/3, restored to full each player turn. Spent on defensive/support army-command cards.
Mana: 5/8 initially, restored by +2 each turn. Spent on Hero-only utility/spell cards (cards that do not command an army stack) and Hero skills.
Active skill slots: 4.

LOCKED (2026-09-16) — Dual Command Point system replaces the single "Energy" resource.

AC + DC = 6, matching the 6-stack army limit: at most one order per stack per turn, and that order is either an attack or a defense/support action, never both. A stack that receives no order this turn takes no action (no auto-attack, no auto-block) and takes full incoming damage — this is a deliberate resource-allocation decision, not an oversight. It also enables a dedicated "tank" playstyle: a stack given Taunt/Guard via a DC card each turn becomes a protector, at the cost of DC that can't be spent elsewhere.

The Hero:

does not occupy a grid square;
does not automatically basic-attack;
issues commands;
casts spells;
buffs/debuffs;
manipulates Mana and Command Points (AC/DC);
affects morale and positioning;
can directly damage enemies through skills.

LOCKED (2026-09-16): If Hero HP reaches 0, the current battle is immediately lost. The army retreats with casualties per the Retreat rules (§50); the Hero is not permanently killed and the run continues. Hero defeat never ends the run by itself.

Commander skill-tree branches
Military
Army Size
Armor
Charge
Leadership
Morale
Recruit
Rally
Logistics
Movement
Food
Scouting

Future Heroes:

Commander
Necromancer
Ranger
Archmage
more faction-specific Heroes
6. COMBAT SYSTEM

Combat is turn-based and card-driven.

Player controls:

Hero
up to 6 friendly stacks
cards
Hero skills
positioning

Enemy controls:

up to 6 stacks
AI
visible intents
MVP turn order
Player Turn
→ draw / play cards / use skills
→ End Turn
→ Enemy Turn
→ execute intents
→ Next Player Turn

No complex initiative system is required for MVP.

7. BATTLEFIELD

2 × 3 grid:

FRONT: [1] [2] [3]
BACK:  [4] [5] [6]

Empty slots are allowed.

Example:

FRONT: Knight / Swordsman / Knight
BACK:  Archer / Mage / Priest

Positioning must matter without becoming Fire Emblem-level complexity.

Prototype targeting preferences:

Orc → frontline
Wolf → backline
Shaman → support/buff weakest ally
Assassin → furthest back

Later: Taunt / Challenge.

8. ENEMY INTENTS

Enemy intent is visible before enemy action, Slay the Spire-style.

Example:

ORC
Intent: Attack Swordsman
Damage: 28

The intent system is part of the tactical puzzle.

9. ARMY STACKS

Each stack contains:

unitType
count
currentHp
maxHp
morale
buffs
debuffs
veterancy
position

Potential later fields:

speed
initiative
equipment
special traits
Persistent casualties
Battle 1:
Swordsmen = 100

After battle:
Swordsmen = 73

Battle 2:
Swordsmen = 73

This is a core mechanic.

Example

Knight:

HP per unit = 10
Count = 18
Max HP = 180

The casualty calculation must be deterministic and centralized.

Wounded concept — PROTOTYPE

When a stack falls below approximately 50% HP:

Damage -10%
Morale -1

Do not lock this until tested.

10. UNIT PROTOTYPES
Friendly
Swordsman
HP 10
Attack 3
Defense 2
Passive: Formation
Adjacent Swordsman stack: +10% Defense
Archer
HP 6
Attack 4
Defense 0
Passive: Ranged
Backline: +25% Attack
Knight
HP 12
Attack 7
Defense 4
Passive: Guard
Prototype: absorbs/redirects 25% of adjacent stack direct damage
Priest
HP 8
Attack 1
Defense 1
Support role
Prefer healing through cards/skills instead of complicated automatic AI
Enemy
Goblin
HP 5
Attack 2
Poison 1
Orc
HP 12
Attack 5
Strong basic attacker
Shaman
HP 8
Attack 2
Buffs weakest ally by +2 Strength
Wolf
HP 7
Attack 4
+50% damage against backline

These numbers are PROTOTYPE.

11. DAMAGE MODEL

Conceptual formula:

Raw Damage
= Unit Attack × Effective Count

Final Damage
= Raw Damage
  × buffs
  × formation modifiers
  × morale modifiers
  × target modifiers
  - defense

Do not scale raw count linearly forever.

PROTOTYPE Effective Count
1–50       ×1.00
51–100     ×0.90
101–200    ×0.75
201–400    ×0.60
400+       ×0.45

These coefficients are PROTOTYPE.

Goal:

500 soldiers are much stronger than 100.
500 soldiers are not simply 5× stronger.
Horde and Elite builds remain viable.
12. FORMATIONS
Defensive Formation
Front +25% Defense
Back +10% ranged/spell effectiveness
Wedge Formation
Charge damage +40%
Turtle Formation
Backline takes -30% damage

All values are PROTOTYPE.

13. STATUS EFFECTS

Initial vocabulary:

Strength: +Attack
Weak: -Attack
Armor: +Defense/Block
Bleed: end-turn damage
Poison: stack-based damage
Burn: magic damage
Fear: -Morale
Taunt: target priority
Haste: extra action/initiative later

Avoid 20+ statuses in MVP.

14. CARD SYSTEM

Cards are commands to the army or Hero utility actions.

Resources
AC (Attack Command) pays for offensive army-command cards.
DC (Defense Command) pays for defensive/support army-command cards.
Mana pays for Hero skills and Hero-only utility cards (cards that don't command an army stack).
Cards and skills can interact.

Examples:

Card generates Mana.
Skill generates AC or DC.
Card improves next Hero skill.
Skill changes card cost.
Deck rules — PROTOTYPE
Starting deck: 12 cards
Maximum deck: ~30
Draw: 5 per turn
Max hand: 10
Discard pile
Reshuffle when deck empty
Retain may exist
Exhaust may exist
Small synergistic decks should be rewarded
Card reward can be skipped
Rarity
Common
Rare
Epic
Legendary
Upgrades

Upgrades may change mechanics, not only numbers.

15. INITIAL CARD POOL

Costs use AC (Attack Command), DC (Defense Command) or Mana — see §5 and §14. Numbers are PROTOTYPE.

Basic
Command: Strike

1 AC
Selected friendly stack attacks.

Defend

1 DC
Selected stack gains +15 Block.

Reposition

1 DC
Move one friendly stack.

Rally

1 DC
Target gains +2 Morale.

Army
Charge

1 AC
Friendly cavalry attacks with +50% Attack.

Volley

2 AC
All friendly Archer stacks attack.

Formation

1 DC
All friendly stacks gain +10% Defense this turn.

Reinforce

2 DC
Add 10% of selected stack's original starting count.

Defense
Shield Wall

1 DC
Frontline gains 25 Block.

Mass Guard

2 DC
One Knight protects adjacent stacks for 2 turns.

Hold the Line

2 DC
Frontline cannot be displaced this turn and gains +30% Defense.

Hero / Utility
These don't command an army stack, so they cost Mana instead of AC/DC — except the two conversion cards below, which deliberately trade a Command Point for Mana (skip an army order this turn to fuel Hero spells instead).

Arcane Focus

1 DC
Gain 2 Mana.

Battle Meditation

1 DC
Gain 1 Mana and draw 1.

Commander's Presence

2 DC
All army gains +1 Morale.

Tactical Insight

0 Mana
Draw 2. Exhaust.

Offensive
Execute

2 AC
+50% damage against enemies below 30% HP.

Focus Fire

1 AC
Selected enemy takes +25% damage this turn.

Break Formation

2 AC
Enemy loses Formation bonuses.

Veteran's Resolve

2 AC
Veteran stack gains +30% Attack this turn.

These are prototype concepts.

16. RELICS

Relics are major run modifiers.

They may be:

positive
negative
hybrid

Negative relics should preferably be build-defining tradeoffs.

Examples:

King's Crown

Army size >100 → +2 Strength.

Blood Banner

Army damage +30%, recruitment cost +50%.

Cursed Crown

Hero Mana +3, skill cooldown +1.

Merchant's Ring

Shop prices -30%, battle rewards -20%.

Hawk's Eye

Ranged units +20% Attack.

Arcane Core

Hero skill/spell damage +25%.

Banner of the Horde

Count-based Army effects +25%.

Crown of Champions

Stacks with Count <25 gain +30% Attack.

17. STARTING RELICS

Before a run, choose one from a small selection.

Royal Banner

Army size +20
Recruitment cost +10%

Arcane Crystal

Start +2 Mana
Army size -10%

Blood Coin

Gold rewards +25%
Food rewards -25%

More starting options unlock permanently.

18. HERO TRAITS

Traits can be positive, negative or hybrid.

Veteran

Army morale +1.

Haunted

Undead encounters +20%.

Greedy

Gold rewards +10%.
Food cost +10%.

Bloodthirsty

Healing -30%.
Kills grant temporary Strength.

Traits should alter decisions/build identity.

19. WORLD MAP

Hybrid of Heroes III exploration and Slay the Spire decision structure:

spatial zones
roads
shortcuts
fog of war
resource sites
neutral armies
enemy territory
cities
events
elite zones
boss zones

Player should have meaningful movement freedom rather than a purely linear path.

Node states
Unknown
Revealed
Visited
Node types
Road
Battle
Elite Battle
Resource
Mine
Farm
Ruins
Village
Merchant
Event
City
Boss
secret/special later

Risk and reward should vary.

20. FOOD AND MOVEMENT

Food is used for:

movement
army upkeep

Large armies should mainly cost more food rather than simply making movement feel slower.

PROTOTYPE additional travel/upkeep cost
<50 units       +0
51–100          +1
101–200         +2
201–400         +3
400+            +5

Exact values are prototype.

21. STARVATION

Food at zero should not immediately end the run.

Apply Starving:

Morale -1
Army HP -5% per relevant interval
potential casualties

Player is strongly incentivized to reach a city.

22. WORLD DAYS

World movement advances a Day counter:

Day 1
Day 2
Day 3
...

Cities can use days for production.

No real-time timers are needed.

23. CITIES

A run should have approximately 2–4 meaningful cities.

Cities are:

recruitment centers
healing/safety hubs
economic centers
build-development centers
territory anchors

Cities must be captured.

24. CITY TYPES
Kingdom / Ironhold
Swordsman
Archer
Knight
Priest
Arcane / Silverkeep
Apprentice
Mage
Elemental
Arcane Guardian
Necropolis / Gravehaven
Skeleton
Ghoul
Wraith
Bone Knight
Horde
Goblin
Orc
Wolf Rider
Ogre

Not all are required for MVP.

25. CITY LEVELS

Three levels:

Level 1 — Outpost

Basic recruitment, healing, basic buildings.

Level 2 — Stronghold

Advanced units, more production, more buildings.

Level 3 — Capital

Elite units, special building, powerful doctrine.

Avoid excessive city-management complexity.

26. CITY BUILDINGS

City has limited building slots.

PROTOTYPE
6 active slots
~10 possible buildings

Examples:

Economy

Market
Warehouse
Gold Mine
Sawmill

Army

Barracks
Stable
Archery
Mage Tower

Hero

Tavern
Training Hall
Forge

Special

Shrine
Library
Castle

Player cannot build everything.

27. CITY DOCTRINES
Military Doctrine

Army card effects cost less / are stronger.

Arcane Doctrine

Spell damage +20%.

Necromantic Doctrine

Deaths can become Skeletons.

Economic Doctrine

Resource nodes yield more.

Exact bonuses are prototype.

28. RECRUITMENT

Recruitment costs resources.

Conceptual example:

Swordsman x10
100 Gold
10 Food

Cities can have production over World Days.

Example:

Swordsman x20
ETA: Day 6

No real-time waiting.

29. SIX-STACK LIMIT

Active army maximum: 6 stacks.

This creates meaningful decisions:

merge
replace
garrison
dismiss later
keep elite vs cheap stack
30. STACK MERGING

Same-unit stacks can merge.

Veterancy should not be blindly overwritten.

Example:

Veteran Swordsman x80
Recruit Swordsman x20
→ Swordsman x100
→ approximately 80% veteran quality

Exact formula is prototype and must be deterministic.

31. GARRISON

Units can remain in a city.

Example:

IRONHOLD GARRISON
Swordsman x50
Archer x20
Knight x5

Garrison protects cities and creates a strategic distinction between field army and city defense.

32. SIEGE

Future system.

MVP may treat city capture as normal combat plus a city-defense modifier.

Future:

Wall HP
Gate HP
Towers
Siege cards
Breach
33. CITY CAPTURE CHOICES

After capture:

Occupy

Keep the city.

Pillage

Gain significant Gold, damage/destroy buildings and suffer future faction/reputation consequences.

Release

Give up direct ownership in exchange for other future consequences/benefits.

This is a future/RPG layer; MVP can begin with Occupy only.

34. RESOURCES
MVP
Gold
Food
Later
Wood
Ore
Crystal

Gold:

recruitment
buildings
healing
upgrades
shops
mercenaries
events

Food:

movement
army upkeep
35. RESOURCE NODES

Possible nodes:

Gold Mine
Sawmill
Ore Mine
Crystal Mine
Food Farm

Example:

Gold Mine: +100 Gold / Day
Food Farm: +10 Food / Day

Values are prototype.

36. FACTIONS

Initial conceptual factions:

Kingdom / Human
Wild / Orc / Beast
Undead / Necromancer
Arcane / Mage

Each can eventually have:

units
cities
cards
relics
events
bosses
37. REPUTATION

Future lightweight system:

-100 to +100

Reputation can change city prices, patrols, events and faction interactions.

Do not overbuild for MVP.

38. WORLD EVENTS

Examples:

Bandit Raid

A Gold Mine stops producing until resolved.

Orc Invasion

Enemy army moves toward a city.

Merchant Caravan

Temporary shop.

Plague

Army HP -10%.

Ancient Portal

Opens a special area.

Events should create decisions, not only random punishment.

39. EVENT EXAMPLE
Abandoned Camp
Search

Chance for Rare Relic; risk of trap.

Rest

Hero HP +20%.

Burn

Future ambush frequency decreases.

Events can have future consequences.

40. MERCHANTS / MERCENARIES

Merchant can sell:

cards
relics
food
army
equipment later

Mercenary camps provide immediate recruitment at premium prices.

Example:

20 Knights — 300 Gold
50 Archers — 200 Gold
1 Ogre — 500 Gold
41. THREAT / ANTI-SNOWBALL

A player must not farm forever until the game becomes trivial.

Use a world Threat Level.

As the run progresses:

enemy patrols improve
raids appear
elite camps appear
enemy armies evolve
bosses gain mechanics

Do not use only giant HP multipliers.

42. BOSS SYSTEM

Bosses must test the build through unique mechanics.

Lich King

Resurrects dead units every 3 turns.

Dragon

Massive AoE.

Warlord

Gains strength based on player's army size.

43. BUILD SYSTEM

A build is the intersection of:

Hero
+
Hero Skills
+
Army
+
Cards
+
Relics
+
City
+
City Doctrine
+
Traits
+
Equipment (later)

No single element should completely define it.

44. TAG SYSTEM

Cards, units, relics and skills should have semantic tags.

Example:

Charge
Tags:
Cavalry
Attack
Command
Aggressive
Rally
Tags:
Morale
Support
Command
Raise Dead
Tags:
Undead
Death
Summon
Sacrifice
Tags:
Death
Army
Risk

Tags should enable synergy without requiring massive hard-coded special cases.

45. BUILD DISCOVERY

The player starts without a fixed build.

Example:

Hero: Commander

Army:
Swordsman
Archer
Knight
Priest

Deck:
12 cards

Starting Relic:
Choose 1 of 3

Later the run may naturally become:

Commander
+
Knight
+
Guard cards
+
Armor relic
+
Fortress city

The player discovers an "Immortal Knights" identity.

Another run might become:

Commander
+
Archers
+
Morale
+
Volley
+
Hawk's Eye

Different run, different build.

46. INITIAL BUILD ARCHETYPES
1. Undying Legion

Core:

Skeleton
Death
Sacrifice
Summon

Support:

Morale
Exhaust
Necromancy

Signature:

Death becomes a resource.

2. Immortal Knights

Core:

Knight
Guard
Armor
Heal
Veteran

Signature:

Small elite army that refuses to die.

3. Storm Archers

Core:

Archer
Backline
Ranged
Focus Fire
Volley

Weakness:

Assassin / Wolf / backline pressure

Signature:

Kill threats before they reach the line.

4. Arcane Overlord

Core:

Mage
Mana
Hero spells
Spell relics

Signature:

The Hero is the primary weapon.

5. Horde

Core:

Count
Recruitment
Morale
Mass Attack

Strength:

huge army

Weakness:

AoE
food/recruitment cost

Signature:

Numbers are the weapon.

6. Merchant Warlord

Core:

Gold
Mercenaries
Shops
Bribes
Economy

Signature:

Money becomes military power.

7. Cavalry Blitz

Core:

Cavalry
Charge
Positioning
Formation

Signature:

Win the positioning puzzle and destroy the enemy in a burst.

8. Blood Army

Core:

Sacrifice
Low HP
Blood effects
Risk/reward

Signature:

Your own casualties are a resource.

9. Tactical Commander

Core:

Reposition
Formation
Focus Fire
Counterattack
Command manipulation

Signature:

Tactical skill is the source of power.

10. Fear Legion

Core:

Fear
Morale
Wraith / Dark units
Execution

Signature:

Break the enemy before killing them.

11. Fortress

Core:

Defense
Guard
Armor
City specialization
Counterattack

Signature:

The enemy cannot break your formation.

12. Combo Engine

Core:

Command Point (AC/DC) manipulation
Mana generation
Draw
Exhaust
card/skill interactions

Signature:

Construct explosive chains of actions.

47. HYBRID BUILDS

Hybrid builds are explicitly encouraged.

Examples:

Necromancer + Horde

Hundreds of Skeletons with death-based replacement.

Commander + Necromancer

Leadership/recruitment interacts with death mechanics.

Merchant + Elite

Economy sustains a tiny elite army.

Mage + Horde

Hero AoE/control compensates for Horde weaknesses.

The engine should not artificially prevent unusual combinations.

48. FIRST THREE SERIOUS BUILD TESTS

The first deep build tests should be:

Undying Legion
Immortal Knights
Horde

For each eventually create:

Hero interactions
15–25 relevant cards
5–6 relevant relics
relevant units
city buildings
city doctrine
traits
weaknesses/counters
early/mid/late run progression

These three are more important than creating dozens of shallow archetypes.

49. COMBAT SCENARIO

Commander:

FRONT:
Knight x18
Swordsman x80
Knight x8

BACK:
Archer x30
Mage x10
Priest x15

Enemy:

FRONT:
Orc x42
Orc x30
Wolf x20

BACK:
Shaman x12
Goblin x45
Goblin x45

Hero:

HP: 100
Mana: 5/8
AC: 3/3
DC: 3/3

Sample hand:

Charge
Rally
Shield Wall
Volley
Reposition

The enemy intent is visible.

Example tactical decision:

Wolf targets Archer.

Player may reposition the Archer, spend resources to protect it, or accept the loss while pursuing a stronger attack.

The intended question is:

"Who do I save?"

not simply:

"What deals the most damage?"

50. RETREAT

Retreat is allowed.

Possible costs:

Food
Morale
Casualties
World Day/time
enemy positional advantage

Retreat should be an emergency strategic tool, not a free combat reset.

51. CASUALTY RECOVERY

Future distinction:

Dead units = permanently lost.
Wounded units = potentially recoverable.
Cities/hospitals restore wounded.

For MVP, use a simpler recovery/recruitment model if needed.

52. ASCENSION / DIFFICULTY

After core gameplay works, add meaningful modifiers.

Examples:

A1

Enemy army +10%.

A2

Food consumption +10%.

A3

Elite enemies gain extra ability.

A4

City recruitment limited.

A5

Bosses gain special mechanics.

Prefer mechanical modifiers over simple HP inflation.

53. NARRATIVE

Working title:

ASHES OF DOMINION

Premise:

The kingdom shattered after the Emperor died.

The Crown of Dominion broke into pieces.

Different factions control pieces.

The Hero travels through the fractured realm, conquering cities, forming alliances, fighting factions and eventually deciding who should rule.

Future outcomes may depend on:

factions killed/saved
cities captured
companions
traits
relics
major choices

Heavy narrative is deferred until gameplay is proven.

54. COMPANIONS — FUTURE

Potentially 3 companion slots.

Each companion may have:

passive
level
equipment
quest
build interactions

Examples:

Aria

Ranger; Archers +20%.

Brom

Warrior; Swordsman gains Armor.

Malach

Necromancer; enemy deaths may become Skeletons.

Companions are not MVP.

55. MVP / VERTICAL SLICE
Hero

1: Commander

Friendly units
Swordsman
Archer
Knight
Priest
Enemy units
Goblin
Orc
Shaman
Wolf
Cards

~20

Relics

~10

City

1

Buildings

~6 meaningful MVP buildings

World map

~30 nodes

Boss

1

Run

20–40 minutes

Graphics

Minimal.

The first milestone is:

One complete run that is genuinely fun.

56. TECHNICAL ARCHITECTURE

LOCKED (MVP phase, 2026-09-16): No backend for the vertical slice. Solo dev — priority is validating that combat is fun before investing in server infrastructure.

MVP (Phase 1 through at least Phase 4)
Frontend
React + TypeScript.
Domain/game engine is a pure TypeScript module with zero DOM/browser dependencies — the same discipline as "server authority" below, just running in-browser for now.
Persistence
Run state serialized to localStorage after meaningful actions (see §65 Save/Resume). No server round-trip, no network calls, no database.

Later (once world map persistence, cross-device play, or anti-cheat matters)
Backend
Pure PHP API is appropriate.
Domain/game engine must remain independent of HTTP.
Database
PostgreSQL.
Cache/messaging
Redis where useful.
Server authority

Move the same domain engine behind an API. Because the engine is written as pure, framework-free TypeScript with no client-trust shortcuts from day one, this should be a relocation, not a rewrite. Once moved, the server/domain engine becomes authoritative for:

damage
casualties
rewards
RNG
resource changes
card legality
combat outcomes

Frontend must never be trusted for authoritative game state once a server exists.

57. GAME ENGINE SEPARATION

Core abstraction:

GameState
  +
PlayerAction
  ->
GameEngine
  ->
NewGameState
  +
Events

Example:

{
  "action": "PLAY_CARD",
  "cardId": "charge_01",
  "targetStackId": "army_02"
}

The engine validates and resolves the action.

58. DETERMINISTIC RUNS

Every run has a seed.

runSeed + playerActions = reproducible state

Use centralized RNG.

This enables:

debugging
tests
replay
bug reproduction
balance simulation

Do not scatter random calls across UI code.

59. SUGGESTED DOMAIN MODEL
Run
Hero
HeroSkill
HeroTrait
Army
ArmyStack
UnitType
Deck
Card
Relic
City
Building
CityDoctrine
WorldMap
WorldNode
Faction
ResourcePool
Battle
EnemyArmy
EnemyStack
Event
Reward

Future:

Companion
Equipment
Quest
Siege
TradeRoute
60. GAME STATE EXAMPLE
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
    "ac": 3,
    "maxAc": 3,
    "dc": 3,
    "maxDc": 3
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

Schema is expected to evolve.

61. EVENT-DRIVEN COMBAT OUTPUT

Prefer events in addition to final state:

[
  {
    "type": "CARD_PLAYED",
    "cardId": "charge_01"
  },
  {
    "type": "STACK_ATTACKED",
    "attacker": "knight_1",
    "target": "orc_1",
    "damage": 72
  },
  {
    "type": "UNITS_KILLED",
    "stackId": "orc_1",
    "count": 11
  }
]

Events allow:

frontend animations
testing
replay
debugging
combat log
62. CARD IMPLEMENTATION

Do not put card behavior directly into UI components.

Conceptual definition:

CardDefinition
  id
  name
  cost
  rarity
  tags
  targeting
  effects
  upgrade

Composable effects where practical:

GainMana(2)
DrawCards(1)
ApplyStrength(target, 2)
Attack(stack)
MoveStack(stack, position)
ApplyArmor(stack, 25)
63. DATA-DRIVEN CONTENT

Units, cards, relics and buildings should preferably be data/config driven.

Example:

cards/
  charge
  rally
  volley

units/
  swordsman
  archer
  knight
  priest

Balance values should be editable without rewriting engine logic.

64. ACTION VALIDATION

Every action must be validated by the domain engine.

Examples:

Card belongs to player?
Card is in hand?
Enough AC/DC/Mana?
Valid target?
Stack alive?
Destination position empty?
Skill off cooldown?
Enough resources?
City owned?
Recruitment capacity available?

Never trust frontend state.

65. SAVE / RESUME

Runs must be resumable.

Save:

current run state
after meaningful world actions
before/after combat

A browser refresh must not destroy a 30-minute run.

66. TESTING STRATEGY

Automated tests are essential.

Combat tests
damage calculation
diminishing count
casualties
death
buffs
debuffs
positioning
targeting
energy
mana
card effects
enemy intents
World tests
movement
food
day
resource production
city capture
recruitment
garrison
threat
Determinism

Same:

seed + actions

must produce the same result.

67. BALANCE SIMULATION

Eventually create a simulation harness for thousands of battles/runs.

Compare:

Horde
Elite
Spell
Economy
hybrid builds

Measure:

win rate
casualties
run length
resource income
card pick frequency
relic pick frequency
boss survival
army composition

Do not rely solely on intuition for balance.

68. UI PRINCIPLES
Combat
Enemy
[Stack][Stack][Stack]
[Stack][Stack][Stack]

Enemy intents

----------------

Hero HP / Mana
AC / DC

Hand:
[Card] [Card] [Card] [Card] [Card]

Player Army
[Stack][Stack][Stack]
[Stack][Stack][Stack]

End Turn

Cards clearly show:

name
cost
effect
tags when useful
upgrade indicator
World map

Show:

discovered nodes
unknown nodes
player location
cities
army summary
Gold
Food
Day
Threat
relevant faction/reputation
movement choices
City
IRONHOLD

Gold: 820
Food: 70

Buildings
[✓] Barracks
[ ] Stable
[✓] Market
[ ] Blacksmith
[ ] Training Ground
[ ] Shrine

Recruitment
Swordsman x20
Knight x5

Garrison
Swordsman x40
69. MAJOR DESIGN RISKS
Too many systems

Build the vertical slice first.

Snowball

Use Threat, upkeep, enemy evolution and meaningful risk.

Army loss feels unfair

Use recovery, retreat, cities, recruitment and eventually wounded mechanics.

Combat becomes card-only

Cards must command persistent army stacks; composition and position remain meaningful.

City becomes Civilization-like

Keep limited buildings, three levels and specialization.

Builds become shallow

Use tags, cross-system synergies, meaningful weaknesses and hybrid builds.

70. LOCKED VS PROTOTYPE
Treat as core / locked
One Hero.
Hero is not a normal battlefield unit.
Up to 6 army stacks.
Card-based combat.
Persistent casualties.
2×3 battlefield.
Positioning matters.
Visible enemy intent.
AC + DC + Mana (dual Command Points replace single Energy).
Hero defeat ends only the current battle, never the run directly.
Cities are captured/developed.
Multiple but limited cities.
World exploration.
Resources.
Food/upkeep.
Relics.
Build discovery.
Roguelike run structure.
Permanent/meta unlocks.
Near-zero-graphics MVP.
Deterministic engine, written framework/DOM-free so it can become server-authoritative later without a rewrite (no backend during MVP — see §56).
Prototype / balance subject to testing
AC/DC/Mana numbers
Damage coefficients
Diminishing-count coefficients
Unit stats
Card costs/effects
Formation percentages
Food costs
City production intervals
Threat scaling
Resource production
Run length
Node count
City count
Wounded rules
Reputation numbers
Siege rules

All prototype values must be configurable.

71. IMPLEMENTATION ORDER
Phase 1 — Pure combat engine

Implement:

Game state
Hero
6 stack positions
Unit definitions
Enemy definitions
Cards
AC / DC
Mana
Enemy intents
Damage
Casualties
Buff/debuff
Turn loop
Deterministic RNG
Automated tests

Goal:

A complete battle runs without a UI.

Phase 2 — Combat UI
battlefield
stacks
intents
cards
Hero resources
combat log
simple animations
end turn

Goal:

Combat is playable in browser.

Phase 3 — Rewards + build loop
card rewards
relics
upgrades
deck management
Hero skills

Goal:

Battle naturally creates build decisions.

IMPLEMENTED (2026-09-16): engine/run/ — a RunState layer above the Phase 1/2
combat engine. Scope notes/assumptions, since Phase 4 (World map) does not
exist yet:
- One battle per run for now. Victory -> a combined reward screen (pick at
  most one relic AND at most one new card/upgrade, both skippable) ->
  "run_complete", a terminal screen. Phase 4 replaces this terminal state
  with real map navigation triggering further battles via the same
  RunState (persisted army/casualties/deck/relics/hero).
- Relics: a representative subset of §16/§17's examples — only ones with
  a real mechanical hook right now (no recruitment/shops/Hero-damage
  spells yet, so relics referencing those are deferred, not stubbed).
  "Stat-boost" relic effects (max Mana/AC/DC, starting army size) apply
  once, permanently, when granted. "Combat-modifier" effects (damage
  multipliers) are read fresh from the held relics on every player-side
  attack — see damage.ts's relicDamageMultiplier/relicFlatAttackBonus.
- Card upgrades: a fixed base-card -> "+" card id map (run/cardUpgrades.ts),
  4 of the 10 MVP cards upgradable so far. Reward screen offers upgrading
  an owned card as an alternative to a brand new card, mutually exclusive.
- Hero skills: modeled as always-available actions gated by Mana + a
  per-battle cooldown (not drawn/discarded like cards) — reuses the same
  CardEffect executor as cards. 2 of the 4 skill slots are filled
  (Second Wind, Inspire); the doc's Hero skill-TREE (meta-progression,
  §4) is a separate, later concern.

Phase 4 — World map
nodes
movement
food
days
battles
events
resources
merchant
fog of war

Goal:

Player can complete a small run.

IMPLEMENTED (2026-09-16): engine/run/worldMap.ts + food.ts + encounters.ts +
events.ts + merchant.ts, wired into runEngine.ts's MOVE_TO action. Scope
notes/assumptions:
- Topology: 7 layers (1 start Road, 5 middle layers of 3 nodes each, 1 end
  node), fully bipartite-connected between adjacent layers so every node
  is always reachable — no orphan nodes — while the player still picks
  which node type to walk into next. ~17 nodes today; node count is
  explicitly PROTOTYPE (§70) and grows once City/Boss nodes (Phase 5/6)
  replace the current single 'end' placeholder.
- Fog of war: a node is 'unknown' until one of its incoming edges has been
  visited, then 'revealed' (type visible, not yet enterable except via its
  connection), then 'visited'. Matches Heroes3-lite/StS hybrid per §19.
- Food/Day: every move costs Food (base + army-size bracket, §20) and
  advances Day by 1. Food hitting 0 triggers Starving (§21: Army HP -5%,
  Morale -1) rather than ending the run.
- Resource nodes: a one-time Gold+Food pickup on arrival, not Heroes3-style
  ongoing daily production (no "day tick" system exists yet — would need
  its own design pass, deferred rather than half-built).
- Battle encounters scale with map layer depth and Elite-vs-normal (a
  PROTOTYPE anti-snowball stand-in for full Threat scaling, §41).
- Events/Merchant: a representative subset (2 events, a 3-card + 1-relic
  shop), not the full §38/§40 catalog — same reasoning as Phase 3's relic
  subset.
- City and Boss node types do not exist yet; the 'end' node is Phase 4's
  own terminal milestone ("map cleared"), replaced by real content in
  Phase 5/6.

Phase 5 — City
one city
recruitment
healing
6 buildings
specialization
garrison

Goal:

Heroes III strategic layer becomes real.

IMPLEMENTED (2026-09-16): engine/run/city.ts, wired into runEngine.ts (ENTER_CITY/
RECRUIT/BUILD_BUILDING/UPGRADE_CITY/TRANSFER_GARRISON_TO_ARMY). Scope
notes/assumptions:
- Exactly one City node, forced onto the map's midpoint layer (§55: City
  count = 1) rather than left to the random node-type pool.
- "Cities must be captured" (§23) is simplified for MVP: the city is
  already friendly on arrival, no capture battle — there's no rival
  faction/hostile-city-ownership model yet to make capture meaningful.
- 7 buildings (not the full ~10-building catalog), 3/5/6 slots at
  Level 1/2/3 — picking 6 of 7 is still a real specialization choice.
  Two buildings gate recruitment entirely (Mage Tower -> Mage, Stable ->
  Cavalier) rather than just discounting it, giving "6 buildings" real
  mechanical teeth instead of only percentages.
- Recruitment merges into a matching field-army stack (veterancy blended
  by weighted average) or creates a new stack in a free slot; if the
  army is full (6 stacks) with no match, recruits must go to the
  Garrison instead of being silently rejected.
- Healing is tied to the Shrine building (+20% army HP on every city
  visit) rather than a separate always-available paid action — keeps
  the "healing" requirement real without adding a second heal mechanic.
- The map's forward-only DAG (§19) has no back-edges, so a dedicated
  ENTER_CITY action lets the player re-enter the city they're standing
  on without "moving" — otherwise a Heroes3-style town you return to
  would be unreachable after the first visit.
- No day-tick recruitment queue yet (§28's "Swordsman x20, ETA: Day 6")
  — recruits are instant. Production-over-days needs the same day-tick
  system Phase 4's resource nodes deferred; still future work.

Phase 6 — Boss + complete run
boss
final reward
victory/defeat
run summary
save/resume

Goal:

Complete 20–40 minute vertical slice.

IMPLEMENTED (2026-09-16): the map's Boss node (formerly a no-op 'end'
placeholder, renamed) now starts a real boss battle instead of instantly
completing the run. Scope notes/assumptions:
- One boss (§55: Boss count = 1): Warlord, from §42's example list.
  "Gains strength based on player's army size" is implemented as a flat
  Attack bonus (+1 per 15 total player units) computed fresh on every
  attack from UnitDefinition.scalesWithPlayerArmy — never stored as a
  status, so it can't accidentally stack across turns. Applied
  consistently in both actual damage resolution (combat.ts) and the
  visible enemy-intent damage preview (intents.ts), so the number shown
  before the enemy turn matches what actually lands.
  Dragon (AoE) and Lich King (resurrection) from §42's list are deferred
  — each needs its own new mechanic (a multi-target enemy attack, a
  dead-unit-tracking/revival system) that doesn't exist yet; one real
  boss beats three half-built ones.
- Defeating the boss routes through the normal victory reward screen
  (relic + card/upgrade, both skippable) — reusing existing reward
  infrastructure — then confirming it ends the run at 'run_complete'
  instead of returning to the map (tracked via RunState.finalBattle).
  Losing to the boss is an ordinary defeat, consistent with the locked
  "Hero defeat ends only the battle" rule; there's just nowhere left to
  retreat to with no further map nodes.
- Run summary (RunEndScreen) now shows Day, City level, Gold, Relics,
  Deck size and final army composition, not just battles/relics/deck.
- Save/resume was already in place since Phase 2 (full RunState in
  localStorage after every action) — verified end-to-end here across a
  full run including a mid-battle page reload.
- Verified live in-browser: a full seed-to-Warlord-to-Victory run via a
  headless-Chrome driver script (with intermediate battles resolved by
  editing the saved state's enemy army, the same technique a save-editor
  or a future "simulate battle" test hook would use, then reloading and
  clicking End Turn through the normal UI) — no console errors, correct
  Run Summary screen.

Phase 7 — Build expansion

First:

Undying Legion
Immortal Knights
Horde

Then expand to other archetypes.

72. CLAUDE'S ROLE

Claude should act as both:

senior game programmer
game designer

Rules:

Preserve design intent.
Flag contradictions before implementation.
Keep prototype values configurable.
Do not add systems not required by the current milestone.
Write tests alongside complex engine behavior.
Keep domain engine independent from frontend.
Never silently change a core rule.
Make prototype values easy to rebalance.
Prefer deterministic behavior.
Build the smallest complete vertical slice first.

When uncertain:

distinguish LOCKED from PROTOTYPE;
do not invent a major mechanic;
choose the simplest implementation consistent with the design;
document assumptions.
73. FIRST CODING TASK FOR CLAUDE

Do not begin by implementing the whole game.

Begin with:

Combat Engine Vertical Slice

Implement a pure, deterministic combat engine containing:

Hero
Commander
HP 100
Mana 5/8
AC 3/3
DC 3/3
Player army
FRONT
Knight x18
Swordsman x80
Knight x8

BACK
Archer x30
Mage x10
Priest x15

If Mage is not yet a formal MVP unit, replace it with an already-defined unit or implement Mage only as the smallest spell-oriented prototype. Do not expand the roster unnecessarily.

Enemy army
FRONT
Orc x42
Orc x30
Wolf x20

BACK
Shaman x12
Goblin x45
Goblin x45
Cards at minimum
Charge
Rally
Shield Wall
Volley
Reposition
Defend
Command: Strike
Arcane Focus
Battle Meditation
Tactical Insight
Requirements
2×3 positioning
Player turn
Card draw
AC / DC (dual Command Points)
Hero mana
Enemy intents
Enemy turn
Damage
Casualties
Buffs/debuffs
Deterministic RNG
Combat event log
Persistent stacks
Unit count decreases after casualties
Battle victory/defeat

Only after this engine is tested should Claude build the browser UI.

74. NORTH STAR

A successful run should produce a story such as:

"I started with a normal Commander army. Then I found a relic that rewarded small elite stacks, captured a Fortress city, upgraded Guard cards, recruited a few Knights, and by the end I had five nearly immortal Knights protecting a Priest while my Hero generated Mana."

Or:

"I accidentally started getting Death cards, found a Grave Crown, captured a Necropolis and began sacrificing units to create Skeletons. By the end of the run my losses were actually making my army stronger."

Or:

"I built a Horde, reached hundreds of units, but Food became a serious problem. I had to capture a Farm before attempting the boss, and the boss's AoE nearly destroyed my whole army."

The game is not primarily about collecting cards.

It is not primarily about building cities.

It is not primarily about controlling armies.

It is the interaction between:

Hero progression
Army composition
card commands
deckbuilding
relics
cities
resources
exploration
positioning
attrition
risk/reward
build discovery

The player's story of each run should emerge from the systems.