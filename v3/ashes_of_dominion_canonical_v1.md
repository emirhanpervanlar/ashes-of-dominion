# Ashes of Dominion — Canonical Game Design Document v1

## Status
Canonical MVP specification and implementation handoff for Claude.

## 1. Vision

Ashes of Dominion is a turn-based tactical strategy RPG / deckbuilding roguelike combining:
- Disciples: Sacred Lands: readable 6v6 tactical combat and positional targeting.
- Heroes of Might and Magic III: persistent army stacks, recruitment and casualties.
- Slay the Spire: cards, rewards, relics and build discovery.
- Baldur’s Gate / D&D: Hero stats, leveling and archetypes.
- Diablo: Town/Hub and dungeon loop.
- Dark Souls: returning to safety has a cost.
- Darkest Dungeon: attrition and retreat pressure.

Core fantasy:
> “I built this army, positioned my troops, personally ordered their attacks, and at the critical moment used my units’ special abilities and my Hero’s powers to turn the battle.”

The game must NOT feel like a pure card game where cards merely represent attacks.

---

## 2. Core Loop

```text
HERO
  ↓
TOWN / SAFE HUB
  ↓
DUNGEON
  ↓
Battle / Elite / Event / Treasure / Merchant / Road
  ↓
Combat
  ↓
Gold + Food + Hero XP + Card Reward
  ↓
Continue deeper
  OR
Teleport to Town
  ↓
Town visit increases Threat
  ↓
3 Road Turns to re-enter dungeon
  ↓
Continue
  ↓
Boss
  ↓
Major Reward
  ↓
Run Victory
```

Central strategic question:
> “Should I continue deeper with my damaged army, or teleport back to Town, accept the increased threat and 3-road return, heal/recruit/develop, then go back in?”

---

## 3. MVP Scope

### Included
- One Town.
- One dungeon layer/run.
- 3 Heroes.
- 4 friendly unit types.
- 4 enemy unit types.
- 6v6 tactical combat.
- Manual player basic attacks.
- Unit Skill cards.
- Hero cards.
- Neutral cards.
- Mana.
- Hero stats, XP, levels and traits.
- Persistent casualties.
- Veterancy and morale.
- 15 MVP relics.
- Food, Gold and World Day.
- Threat.
- Town healing.
- 7-day recruitment.
- Dungeon persistence.
- Dynamic encounters influenced by Threat.
- Enemy intent.
- Deterministic RNG.
- Server-authoritative simulation.
- Save/resume.
- One main boss.
- Victory/defeat and run summary.

### Explicitly excluded from MVP
- AP/DP.
- Energy.
- Commander.
- Commander spells.
- Automatic player attacks.
- Initiative/speed.
- Complex reactions/interrupts.
- 20+ status effects.
- Multiple towns.
- Giant city builder.
- Dozens of resources.
- 10+ base Heroes.
- Mage battlefield unit.
- Infinite procedural dungeon.
- Permanent meta progression.
- Multiplayer/PvP.

---

# 4. Combat

## Battlefield

Each side has 6 slots in a 3×2 formation.

```text
ENEMY
[ FRONT 1 ] [ FRONT 2 ] [ FRONT 3 ]
[ BACK  4 ] [ BACK  5 ] [ BACK  6 ]

PLAYER
[ FRONT 1 ] [ FRONT 2 ] [ FRONT 3 ]
[ BACK  4 ] [ BACK  5 ] [ BACK  6 ]
```

Empty slots are allowed. Hero does not occupy a slot.

## Player interaction

```text
Select friendly stack
↓
Highlight valid enemy targets
↓
Click valid target
↓
Unit performs basic attack
```

Normal basic attacks:
- cost no Mana;
- are never cards;
- are manually selected by the player.

UI must strongly highlight legal targets and dim illegal targets.

## Turn system

```text
PLAYER PHASE
  ↓
Basic attacks
Cards
Legal tactical actions
  ↓
END TURN
  ↓
ENEMY PHASE
  ↓
Enemy AI actions
  ↓
NEXT PLAYER TURN
```

No initiative/speed in MVP.

## Target geometry

Front-row melee:

```text
Enemy:
[ A ] [ B ] [ C ]

Player:
[ X ] [ Y ] [ Z ]

X → A, B
Y → A, B, C
Z → B, C
```

Backline, ranged and support targeting use configurable target masks.

---

# 5. Hero

Hero has:
- HP;
- five core stats;
- Mana;
- XP;
- level;
- traits;
- Hero card pool.

Hero death = run defeat.

## Stats

- Strength
- Dexterity
- Intelligence
- Vitality
- Wisdom

10 is neutral. Below 10 gives no negative scaling.

```text
Effectiveness = 1 + max(0, stat - 10) * 0.02
```

Examples:

| Stat | Multiplier |
|---:|---:|
| 10 | ×1.00 |
| 11 | ×1.02 |
| 12 | ×1.04 |
| 15 | ×1.10 |
| 18 | ×1.16 |
| 20 | ×1.20 |
| 25 | ×1.30 |
| 30 | ×1.40 |

Hero-derived effectiveness cap: ×1.40.

### Strength
Melee/physical damage, physical unit skills and physical Hero cards.

### Dexterity
Ranged effectiveness, accuracy/precision and Dodge.

```text
Dex ≤10 → 0%
Dex 12 → 2%
Dex 15 → 5%
Dex 18 → 8%
Dex 20 → 10%
```

Hero-derived Dodge cap: 20%.

### Intelligence
Magic damage, magical/elemental effects and related statuses.

### Vitality
Army survivability, defensive effects and Hero survivability.

### Wisdom
Max Mana and healing/support.

Every 2 Wisdom above 10 = +1 Max Mana.

Max Mana cap: 12.

---

# 6. Heroes

## Warlord

```text
STR 16
DEX 10
INT  8
VIT 14
WIS  8
Base Mana 3
```

Starting army:

```text
Swordsman ×60
Knight ×20
Archer ×10
```

Fantasy: physical army, frontline, elite strength, defensive/burst commands.

Example traits:
- Iron Commander: frontline +10% Defense.
- Blood Commander: melee +15% damage below 50% original count.
- Horde Master: count-based effects +20%.
- Knight Lord: Knight skills +20%.
- Defender: protective effects +1 turn where legal.
- Berserker: melee +20% when Hero HP <50%.

## Rogue

```text
STR  9
DEX 17
INT 10
VIT  9
WIS 13
Base Mana 5
```

Starting army:

```text
Archer ×40
Swordsman ×30
Knight ×10
```

Fantasy: ranged damage, Dodge, Poison, Mark, Execute, mobility.

Example traits:
- Shadow Hunter: Marked targets receive +15% ranged damage.
- Venom Master: Poison +50%.
- Evasion Expert: Dodge granted by abilities +25% relative.
- Assassin: damage vs enemies below 30% count +25%.
- Hunter: ranged basic attacks +10%.
- Shadow Adept: Shadowstep costs 0 once/combat.

## Mage

```text
STR  7
DEX  9
INT 18
VIT  8
WIS 16
Base Mana 7
```

Starting army:

```text
Archer ×20
Priest ×20
Swordsman ×30
```

Fantasy: magic, control, Mana, healing/support.

Mage is a Hero archetype, NOT a battlefield Mage unit.

Example traits:
- Arcane Scholar: Max Mana +2.
- Elementalist: elemental damage +20%.
- Necromancer: death-trigger effects gain additional value / Necromancer relic interactions.
- Battle Mage: magic cards can empower next basic attack.
- Support Mage: healing/support +20%.
- Mana Weaver: first Mana-generation effect each combat +1 extra temporary Mana.

---

# 7. Leveling

Normal cap: level 12.

Suggested progression:

```text
L2–4   Stat choices
L5     Hero Trait
L6–7   Stat choices
L8     Advanced Trait
L9–10  Stat choices
L11    Advanced Trait
L12    Final specialization
```

Each stat choice:
```text
+2 to any one core stat
```

---

# 8. Units

Every UnitDefinition:

```text
unitType
basicAttack
passive
skillCards[]
```

Runtime stack:

```text
stackId
unitType
count
currentHp
maxHp
morale
veterancy
position
buffs
debuffs
```

Primary UI identity is soldier count:

```text
KNIGHT
×27
```

No unit levels in MVP. Power comes from:

```text
COUNT + VETERANCY + HERO + CARDS + RELICS
```

## Friendly units

### Swordsman

```text
HP 10
Attack 3
Defense 2
```

Passive: Formation Discipline
- adjacent friendly frontline stack → +10% Defense.

Role: frontline anchor, defense, formation.

### Archer

```text
HP 6
Attack 4
Defense 0
```

Passive: High Ground
- backline → +25% Attack.

Role: ranged DPS.

### Knight

```text
HP 12
Attack 7
Defense 4
```

Passive: Guard
- absorbs/redirects approximately 25% direct damage from adjacent allies;
- affected by Knight Defense.

Role: elite melee, mobility, protection.

### Priest

```text
HP 8
Attack 1
Defense 1
```

Passive: Devotion
- healing/support +10%.

Role: support.

## Veterancy

```text
0 = +0% damage
1 = +3% damage
2 = +5% damage
3 = +8% damage
```

Veterancy resets if the stack dies.

When merging stacks outside combat, retain the lower veterancy.

---

# 9. Casualties and Morale

Army count is persistent.

Internal HP may exist for combat resolution, but damage ultimately translates into soldier casualties.

Casualties persist after combat.

Morale:
- range 0–100;
- starts at 100;
- affected by starvation, Fear, large casualties, cards and relics.

MVP low morale modifies Damage/Defense.

Morale does NOT make units flee automatically in MVP.

---

# 10. Card System

MVP pool: **46 cards**

```text
16 Unit Skill cards
24 Hero cards
6 Neutral cards
```

Card rules:
- Mana per card.
- Mana restored each Player Turn.
- Unit card active if source unit count >0.
- Lower count weakens applicable unit skills.
- Count 0 = inactive, not removed.
- Inactive cards may be free-discarded.
- Duplicates allowed.
- Max deck 30.
- Starting deck 12.
- Initial draw 5.
- Draw 3/turn.
- Hand limit 10.
- Discard reshuffles.
- Exhaust unavailable for rest of combat.
- Common/Uncommon max 3 copies.
- Rare max 2.
- Legendary/Unique max 1.

## Count scaling

Prototype:

```text
1–20       ×1.00
21–50      ×0.90
51–100     ×0.75
101–200    ×0.60
201–400    ×0.45
400+       ×0.35
```

Keep these values in configuration.

---

# 11. Unit Skill Cards

## Swordsman

**Shield Bash** — Common, M1  
Normal attack + Weak. Weak reduces next attack damage by 20%. Damage includes Defense component.

**Hold Formation** — Common, M1  
Self Defense +30%, control resistance +15%; adjacent allies Defense +10%; 1 turn.

**Counterattack** — Uncommon, M2  
First melee attack received this turn triggers 70% normal damage counter; max 1.

**Brace** — Uncommon, M2  
Defense +50%, incoming damage -40%, cannot basic attack; 1 turn.

## Archer

**Focus Shot** — Common, M1  
Next basic attack +60% damage, +20% accuracy.

**Piercing Arrow** — Uncommon, M2  
Primary 125% damage; target behind receives 50%.

**Arrow Rain** — Rare, M3  
Up to 3 enemy stacks, 55% damage each.

**Covering Fire** — Uncommon, M2  
Selected Archer reacts to melee attack on adjacent ally, 60% basic damage, max 2 triggers.

## Knight

**Charge** — Common, M1  
Move + attack, +50% damage; additional +15% if not attacked earlier.

**Shield Wall** — Uncommon, M2  
Defense +60%; adjacent allies incoming damage -20%; cannot move; 1 turn.

**Protect** — Common, M1  
Adjacent ally’s first direct damage 40% redirected to Knight.

**Lance Breaker** — Rare, M3  
Attack +100%; target Armor -30% + Weak; Knight Defense -20%; 1 turn.

## Priest

**Greater Heal** — Common, M2  
Restore lost soldiers; scales with Priest count and Wisdom; cannot exceed pre-battle maximum.

**Bless** — Common, M1  
Friendly stack Damage +25%, Defense +15%; 1 turn.

**Purify** — Uncommon, M1  
Remove Poison/Bleed/Burn/Weak; +20% status resistance; 1 turn.

**Divine Protection** — Rare, M3  
First lethal damage prevented; stack remains at 1; Defense +20% until turn end.

---

# 12. Hero Cards

## Warlord

**Blood Rage** — Common, M1  
Melee +40%. After next attack, stack loses 5% current count; cannot kill final soldier.

**Mass Charge** — Uncommon, M2  
All Knight stacks +30% damage this turn.

**Hold the Line** — Common, M1  
All frontline stacks +25% Defense.

**Brutal Command** — Rare, M2  
Selected melee next attack +100%; cannot be redirected.

**Rally** — Common, M1  
Restore morale; draw 1.

**Last Stand** — Rare, M2  
Target below 40% original count gets +50% damage/+30% defense.

**Formation** — Uncommon, M1  
Three adjacent friendly stacks +15% Defense.

**Execution Order** — Rare, M2  
Enemy below 30% effective HP/count: next attack +100%, ignores Armor.

## Rogue

**Poison Arrow** — Common, M1  
Next Archer attack applies Poison.

**Double Shot** — Rare, M2  
Archer attacks twice; second 60%.

**Evasion** — Common, M1  
Selected stack Dodge +25% relative; 1 turn.

**Ambush** — Uncommon, M2  
Target not yet acted gets +75% damage; otherwise +25%.

**Mark Target** — Common, M1  
Mark for 2 turns; ranged damage +25%.

**Shadowstep** — Uncommon, M1  
Move legal stack; draw 1.

**Venomous Army** — Rare, M3  
Ranged attacks apply Poison this turn.

**Execute** — Rare, M2  
Enemy below 20% receives +150% next attack; if killed, draw 2.

## Mage

**Fireball** — Common, M2  
High single-target magic damage + small splash; Intelligence scaling.

**Frost** — Common, M2  
Magic damage + Freeze/Slow 1 turn; damage -20%; cannot Charge/Move.

**Arcane Storm** — Rare, M4  
All enemy stacks moderate magic damage; primary +50%.

**Arcane Shield** — Common, M2  
Friendly stack incoming damage -35%; 1 turn.

**Heal** — Common, M2  
Restore soldiers; scales with Priest count and Wisdom.

**Mana Surge** — Rare, M0, Exhaust  
Gain +2 temporary Mana this turn.

**Chain Lightning** — Rare, M3  
Primary 100%; up to two secondary targets 50%.

**Arcane Overload** — Legendary, M3, Unique  
Hero magic cards +50% effectiveness this turn; cannot play another Overload same turn.

---

# 13. Neutral Cards

**Focus Fire** — Common, M1  
Next friendly attack +50%.

**Reposition** — Common, M1  
Move friendly stack; next attack +15%.

**Tactical Insight** — Uncommon, M1  
Draw 2.

**Emergency Retreat** — Uncommon, M2  
Friendly stack cannot be targeted 1 turn; cannot attack.

**Second Wind** — Rare, M2, Exhaust  
Restore 10% lost soldiers.

**Battle Hardened** — Rare, M2  
Damage +20%, Defense +20%; if stack took ≥30% casualties, Damage +35% and Defense +30%.

---

# 14. Starting Decks

## Warlord
```text
Shield Bash
Hold Formation
Brace
Charge
Protect
Blood Rage
Hold the Line
Rally
Brutal Command
Focus Fire
Reposition
Tactical Insight
```

## Rogue
```text
Focus Shot
Piercing Arrow
Covering Fire
Charge
Protect
Poison Arrow
Mark Target
Evasion
Shadowstep
Focus Fire
Reposition
Tactical Insight
```

## Mage
```text
Focus Shot
Greater Heal
Bless
Fireball
Frost
Arcane Shield
Heal
Mana Surge
Tactical Insight
Reposition
Focus Fire
Purify
```

---

# 15. Card Rewards and Upgrades

Normal reward weighting:

```text
Hero   40%
Unit   45%
Neutral 15%
```

Elite:

```text
Hero     35%
Unit     40%
Neutral  10%
Rare+ bias 15%
```

Army composition may lightly bias rewards toward owned units, never hard-locking rewards.

Present exactly 3 distinct card IDs. Player chooses 1 or skips.

Upgrades modify the same card state, not a new card ID.

Examples:
- Shield Bash Weak -20 → -30.
- Arrow Rain 55 → 70.
- Greater Heal +30% healing.
- Fireball +40% damage.
- Rally draw 1 → 2.

Upgrade sources:
- Elite;
- Shrine;
- special Events;
- optional paid Town service.

No unlimited free Town upgrading.

Cards use tags, e.g.:

```text
Charge = KNIGHT, MELEE, MOBILITY, DAMAGE
Fireball = MAGE, MAGIC, ELEMENTAL, DAMAGE
Hold Formation = SWORDSMAN, DEFENSE, FORMATION
```

Use tags for relic/trait interactions. Avoid hard-coded card-ID checks.

---

# 16. Relics

MVP: 15 relics. Run-specific. Initial slots: 3.

1. **Crown of Dominion** — total army >100 → Army effectiveness +15%.
2. **Shadow Ring** — Dodge +8%; successful dodge draws 1, max 1/turn.
3. **Arcane Orb** — Max Mana +2.
4. **Blood Banner** — Damage +20%; Healing -30%.
5. **Hawk Eye** — Ranged damage +20%.
6. **Iron Standard** — Frontline Defense +15%.
7. **Knight's Oath** — if Knight count >0, Charge damage +30%.
8. **Venom Sac** — Poison damage +50%.
9. **Phoenix Feather** — once/combat, Hero lethal damage leaves Hero at 1 HP; Unique.
10. **War Drum** — friendly stack kills enemy stack → draw 1, max 1/turn.
11. **Grimoire of Bones** — friendly stack destroyed → 20% chance temporary Skeleton stack.
12. **Blood Chalice** — Healing -50%; friendly stack loses soldiers → Hero Mana +1, max 2/turn.
13. **Tactician's Compass** — first card each turn costs 1 less, minimum 0.
14. **Fortress Core** — if player ends turn without attacking, all friendly Defense +10% next turn.
15. **Executioner's Sigil** — enemies below 25% count take +25% damage.

Main relic sources:
- Elite;
- Boss;
- rare Treasure;
- special Events.

Boss is the main reliable source of major relics.

---

# 17. Status Effects

MVP:
- Strength
- Weak
- Armor
- Bleed
- Poison
- Burn
- Fear
- Taunt
- Freeze/Control

Do not add a large status library.

No Haste/reaction complexity in MVP.

---

# 18. Enemies

## Goblin
```text
HP 5
Attack 2
Defense 0
```
Passive: Mob Tactics — adjacent Goblin → +10% damage.
AI: swarm isolated/weak targets.

## Orc
```text
HP 12
Attack 5
Defense 2
```
Passive: Brutal — target below 50% count → +20% damage.
AI: nearest accessible, prioritize weakened.

## Shaman
```text
HP 8
Attack 2
Defense 1
```
Passive: at enemy phase start, buff weakest allied enemy stack.
AI: support first, attack if no useful buff.

## Wolf
```text
HP 7
Attack 4
Defense 1
```
Passive: Pounce — backline +50% damage.
AI: prioritize Archer/Priest.

---

# 19. Enemy Formations

## Horde
```text
Goblin Goblin Goblin
Goblin Goblin Orc
```

## Guarded Shaman
```text
Orc     Orc     Orc
Goblin  Shaman  Goblin
```

## Wolf Pack
```text
Wolf    Wolf
Wolf    Goblin
```

## Elite Guard
```text
Orc     Orc     Orc
Wolf    Shaman  Wolf
```

---

# 20. Enemy AI / Intent

Enemy intent is displayed before the enemy phase and recalculated when relevant battlefield state changes.

Priority scoring example:

```text
Can kill target       +100
Can kill Archer        +80
Useful support action  +60
Random Swordsman       +30
```

The exact values are prototype configuration.

AI goal:
> Predictable enough to plan against, imperfect enough not to feel scripted.

---

# 21. Elite

Elite encounters use:
- stronger compositions;
- one additional modifier;
- stronger stats;
- special formation.

Do NOT simply multiply HP by 3.

Possible modifiers:
- Reinforced
- Aggressive
- Poisoned
- Armored
- Coordinated
- Frenzied

MVP: one modifier per elite encounter.

---

# 22. Boss — The Ashen Warlord

## Phase 1
- frontline heavy;
- buffs/summons Orcs;
- melee pressure.

## Phase 2 — Ashen Command
Triggered around 60% HP:
- buffs enemy army;
- alters one battlefield tile/position;
- targets weakest stack periodically.

## Phase 3 — Last Dominion
Triggered around 25% HP:
- +25% damage;
- Fear resistance;
- aggressive targeting.

Boss difficulty comes from behavior and phases, not huge HP inflation.

Boss reward:
- large Gold;
- Food;
- XP;
- major relic choice;
- powerful card choice;
- run victory.

---

# 23. Dungeon

Spatial map, not abstract node chain.

Node types:
- Road
- Battle
- Elite
- Event
- Treasure
- Merchant
- Shrine
- Boss

Example:

```text
Treasure
   |
Battle — Road — Elite
          |
        Event
          |
       Merchant
          |
         Boss
```

Backtracking is allowed but costs Food + World Day.

## Persistence

Static:

```text
UNVISITED → CLEARED
```

Cleared static encounters never respawn.

Dynamic content can change with Threat:
- patrols;
- ambushes;
- elite variants;
- new dynamic encounters;
- events.

## Node rules

### Road
- Food -2 prototype.
- World Day +1.
- Small chance of dynamic encounter.

### Battle
- combat;
- Gold + Food + XP;
- card reward.

### Elite
- harder combat;
- high Gold/Food/XP;
- card reward;
- relic.

### Event
Can modify HP, Food, Gold, cards, relics or army.

### Treasure
Can provide Gold, relics, card upgrade or Food.

### Merchant
Can sell cards, relics, healing and recruitment supplies. Limited stock.

### Shrine
Can upgrade a card, heal, trade Gold for power or provide temporary blessing. Consumed once.

---

# 24. World Day

Global clock.

Examples:

```text
Road = +1 day
Backtracking = +1 day
Town → dungeon = 3 days
```

Town waiting also advances World Day.

Recruitment and dynamic world state use World Day.

Time is never free.

---

# 25. Food

Prototype:
- base travel cost = 2 Food per Road Turn.

Army upkeep:

```text
<50       +0
51–100    +1
101–200   +2
201–400   +3
400+      +5
```

At Food 0:
- morale drops;
- travel becomes dangerous;
- starvation event can trigger.

Do not instantly delete units without warning.

---

# 26. Town

One home Town.

Town is a safe hub, not a reset button.

Services:
- Heal Hero;
- Heal Army;
- Recruitment;
- Deck management;
- Hero progression;
- Buildings;
- Merchant/service access.

## Teleport

Teleport available from dungeon.

Town visit:
```text
Threat +1
```

Dungeon persists.

Return to dungeon:
```text
3 Road Turns
```

## Healing

Prototype costs:

```text
Swordsman = 2 Gold/soldier
Archer    = 2 Gold/soldier
Knight    = 5 Gold/soldier
Priest    = 4 Gold/soldier
```

Hero healing is separate.

Healing cannot create infinite soldiers.

## Recruitment

Seven World Day production cycle.

```text
Barracks → Swordsman
Range    → Archer
Stable   → Knight
Chapel   → Priest
```

Prototype batch sizes:

```text
Swordsman ×30
Archer    ×25
Knight    ×10
Priest    ×15
```

Production continues while in dungeon.

One batch per building may be in production.

## Buildings

MVP:
- Barracks
- Range
- Stable
- Chapel
- Inn
- Library

Do not build a giant city-builder.

## Waiting

Waiting in Town advances:
- World Day;
- recruitment;
- Food/upkeep;
- dynamic dungeon state.

---

# 27. Threat

Starts at 0.

Every Town visit:
```text
Threat +1
```

Threat affects:
- encounter composition;
- elite frequency;
- enemy types;
- enemy passives;
- dynamic patrols;
- boss modifiers;
- events.

Threat is NOT simply enemy HP scaling.

Prototype bands:

```text
0–1 Normal
2–3 Alert
4–5 Dangerous
6+  Hostile
```

Exact probabilities are tunable.

---

# 28. Run Pacing

Target: 60–90 minutes.

Suggested:
```text
0–10   Initial army identity
10–25  First deck direction
25–45  Meaningful casualties + Town decision
45–65  Specialization
65–90  Boss approach
```

Boss normally around Hero level 9–11.

Level 12 possible through exploration.

---

# 29. Economy

Normal battle:
```text
Gold +80–140
Food +8–18
XP   +60–100
```

Elite:
```text
Gold +180–300
Food +15–30
XP   +120–200
```

Boss:
```text
Gold +400–600
Food +40–60
XP   +400–600
```

Rewards should compensate for risk without erasing attrition.

All numbers are prototype configuration.

---

# 30. Victory / Defeat

Defeat:
- Hero HP ≤0;
- OR all friendly combat stacks die.

Army reaching 0 outside combat does not independently kill Hero.

Victory:
- Ashen Warlord defeated.

Run summary:
- Hero;
- Level;
- Stats;
- Army;
- Cards;
- Relics;
- Gold;
- Threat;
- World Day;
- Battles;
- Casualties.

No permanent meta progression in MVP.

---

# 31. Save / Resume

Save after:
- node entry/exit;
- every combat action;
- combat resolution;
- reward choice;
- Town service;
- recruitment;
- teleport;
- World Day changes;
- level/stat/trait choices.

Stored:

```text
runId
seed
gameState
eventLog
version
updatedAt
rngState
```

Server authoritative.

---

# 32. Technical Architecture

Preferred:

```text
React + TypeScript
      |
    HTTP
      |
Pure PHP API
      |
 Game Engine
      |
PostgreSQL
      |
Redis optional
```

The game engine must not depend on HTTP.

## PHP

```text
src/
  Domain/
    Combat/
    Hero/
    Army/
    Cards/
    Relics/
    Dungeon/
    Town/
    Economy/
    Progression/
    Random/
    Events/

  Application/
    Commands/
    Queries/
    Handlers/

  Infrastructure/
    Persistence/
    Redis/
    RNG/

  Http/
    Controllers/
    Requests/
    Responses/
```

## React

```text
src/
  features/
    combat/
    dungeon/
    town/
    hero/
    deck/
    relics/
  components/
  state/
  api/
```

---

# 33. Engine Model

```text
GameState + PlayerAction
        ↓
GameEngine
        ↓
NewGameState + Events
```

No HTTP dependency inside domain/game engine.

---

# 34. Deterministic RNG

Use one centralized RNG.

Run seed:
```text
runSeed
```

Persist:
```text
rngState
```

Invariant:

```text
same seed
+
same actions
+
same game version
=
same result
```

Never use uncontrolled random calls in UI/domain code.

---

# 35. Server Authority

Server validates/determines:
- card legality;
- Mana;
- targets;
- damage;
- casualties;
- RNG;
- rewards;
- XP;
- Gold;
- Food;
- recruitment;
- Threat;
- Hero death;
- dungeon state.

Client never decides final damage/rewards.

---

# 36. Player Actions

```text
SELECT_STACK
BASIC_ATTACK
PLAY_CARD
END_TURN
MOVE_STACK
TELEPORT_TOWN
CHOOSE_REWARD
CHOOSE_STAT
CHOOSE_TRAIT
BUY_SERVICE
RECRUIT
```

Example:

```json
{
  "action": "PLAY_CARD",
  "cardId": "charge",
  "sourceStackId": "army_02",
  "targetStackId": "enemy_01"
}
```

Action validation belongs to the game engine.

---

# 37. Events

```text
STACK_SELECTED
ATTACK_DECLARED
ATTACK_RESOLVED
DAMAGE_DEALT
UNITS_KILLED
STATUS_APPLIED
CARD_PLAYED
MANA_CHANGED
TURN_ENDED
ENEMY_INTENT_UPDATED
COMBAT_WON
COMBAT_LOST
REWARD_GRANTED
CARD_REWARDED
RELIC_GAINED
TOWN_ENTERED
THREAT_CHANGED
WORLD_DAY_CHANGED
RECRUITMENT_COMPLETED
```

Event log drives animation/UI feedback.

---

# 38. Data Models

## CardDefinition

```ts
interface CardDefinition {
    id: string;
    name: string;

    source:
        | { type: "unit"; unitId: string }
        | { type: "hero"; heroId: string }
        | { type: "neutral" };

    rarity: Rarity;
    manaCost: number;
    tags: string[];

    targeting: TargetingDefinition;
    requirements?: RequirementDefinition[];

    effects: EffectDefinition[];

    unique?: boolean;
    exhaust?: boolean;
    retain?: boolean;

    upgrade?: CardUpgradeDefinition;
}
```

## GameState

```ts
interface GameState {
    run: RunState;
    hero: HeroState;
    army: ArmyState;
    deck: DeckState;
    relics: RelicState[];
    dungeon: DungeonState;
    town: TownState;
    economy: EconomyState;
    combat?: CombatState;
    rng: RNGState;
    eventLog: GameEvent[];
}
```

## RunState

```ts
interface RunState {
    runId: string;
    seed: string;
    worldDay: number;
    threat: number;
    status: "active" | "victory" | "defeat";
}
```

## CombatState

```ts
interface CombatState {
    phase: "player" | "enemy" | "victory" | "defeat";
    turn: number;

    playerStacks: CombatStack[];
    enemyStacks: CombatStack[];

    hand: CardInstance[];
    drawPile: CardInstance[];
    discardPile: CardInstance[];
    exhaustPile: CardInstance[];

    mana: number;
    maxMana: number;

    enemyIntents: EnemyIntent[];
}
```

---

# 39. Effect System

Composable effects:
- Attack;
- Heal;
- ModifyStat;
- ApplyStatus;
- DrawCards;
- GainMana;
- MoveStack;
- Protect;
- RedirectDamage;
- Summon;
- RestoreMorale.

Prefer data-driven effects.

Avoid one giant switch statement keyed by every card ID.

---

# 40. UI

## Town
Show:
- Hero;
- HP;
- Level;
- Stats;
- Army;
- Gold;
- Food;
- Threat;
- World Day;
- recruitment queues;
- deck;
- relics.

Actions:
- Enter Dungeon;
- Heal;
- Recruit;
- Deck management;
- progression;
- services.

## Dungeon
Show:
- spatial map;
- current location;
- cleared locations;
- Hero/army summary;
- Food;
- Gold;
- Threat;
- World Day.

## Combat
Show:
- 6v6;
- stack count;
- unit icon;
- selection;
- target highlights;
- attack feedback;
- cards;
- Mana;
- Hero HP;
- enemy intent;
- combat log;
- End Turn.

Visual priority:

```text
1. Unit count
2. Position
3. Target legality
4. Enemy intent
5. Buff/debuff
6. HP details
7. Card text
```

---

# 41. Combat UX Invariants

Combat must feel like commanding troops.

Therefore:
- basic attacks are first-class;
- cards augment unit actions;
- unit count is highly visible;
- unit identity remains visible;
- target legality is obvious;
- enemy intent is readable before commitment;
- card effects identify affected stack;
- casualties are numerically and visually clear.

The player should always be able to answer:
1. Which unit can act?
2. What can it attack?
3. What will happen?
4. Which ability can change the outcome?
5. What will I lose?

---

# 42. Testing

## Unit tests
Cover:
- target geometry;
- damage;
- casualty calculation;
- Hero scaling;
- count scaling;
- Mana;
- card legality;
- card effects;
- inactive cards;
- healing;
- protection;
- statuses;
- AI;
- RNG determinism;
- rewards;
- Threat;
- Town visit;
- recruitment;
- World Day;
- Food;
- save/load.

## Integration test

```text
Create run
→ Town
→ Recruit
→ Dungeon
→ Route choice
→ Battle
→ Basic attack
→ Card
→ Enemy turn
→ Win
→ Reward
→ Continue
→ Teleport
→ Threat +1
→ Recruitment advances
→ 3-road return
→ Cleared node persists
→ Elite
→ Relic
→ Boss
→ Victory
→ Run Summary
```

---

# 43. Implementation Phases

## Phase 1 — Combat Engine
GameState, Hero, six player slots, six enemy slots, unit definitions, target geometry, selection, basic attack, casualties, statuses, cards, Mana, Hero stats, enemy intent, AI, turn loop, deterministic RNG, events and tests.

Do NOT add initiative.

## Phase 2 — Combat UI
Battlefield, stack cards, selection, target highlighting, attack feedback, cards, Mana, Hero HP, intent, combat log.

## Phase 3 — Deck / Build
Hero cards, Unit cards, Neutral cards, rewards, duplicates, inactive cards, upgrades, relics, Hero levels and traits.

## Phase 4 — Dungeon
Map, roads, encounters, elites, events, treasure, merchants, shrines, World Day, Food, Gold, dynamic encounters, persistence and boss.

## Phase 5 — Town
Teleport, healing, recruitment, 7-day production, deck management, progression, buildings, Threat and 3-road return.

## Phase 6 — Complete Run
Boss, victory, defeat, run summary, save/resume and tuning.

## Phase 7 — Advanced
Initiative/speed, reactions/interrupts, more Heroes, units, enemies, traits, Necromancer/Elementalist branches, more dungeon layers and multiplayer.

---

# 44. Locked vs Prototype

## Locked
- core loop;
- 3 Heroes;
- 4 friendly units;
- 4 enemy units;
- 6v6;
- target geometry;
- free basic attacks;
- Mana;
- Hero stats;
- Hero progression;
- 46-card MVP pool;
- deck rules;
- inactive cards;
- army→deck feedback;
- relic system;
- Town;
- 7-day recruitment;
- Food;
- Gold;
- World Day;
- Threat;
- teleport;
- 3-road return;
- dungeon persistence;
- enemy intent;
- deterministic RNG;
- server authority;
- save/resume;
- boss;
- victory/defeat;
- no meta progression.

## Prototype / tune through playtesting
- damage values;
- count scaling numbers;
- XP curve;
- Gold rewards;
- Food costs;
- recruitment sizes/prices;
- healing costs;
- Threat probabilities;
- elite scaling;
- dungeon size;
- boss HP;
- encounter probabilities.

Claude must keep prototype values in config/data and never hard-code them into UI/domain logic.

---

# 45. Design Invariants

1. **Army matters.** It is not cosmetic.
2. **Basic attacks matter.** Cards supplement direct tactical control.
3. **Casualties matter.** Lost soldiers remain lost until restored.
4. **Recovery costs resources/time.** Town is safe but not free.
5. **Threat is systemic.** Town visits alter the dungeon/world.
6. **Build identity emerges.** Army + cards + Hero + relics interact.
7. **Information is readable.** Targeting and intent are clear.
8. **Randomness is reproducible.** Seed + actions determine the result.
9. **Server owns truth.**
10. **Balance values remain tunable.**

---

# 46. Definition of Done

A player can:

```text
Create Hero
↓
Town
↓
Recruit
↓
Dungeon
↓
Choose route
↓
Fight manually
↓
Basic attacks
↓
Unit cards
↓
Hero cards
↓
Lose soldiers
↓
Gain cards/relics/XP
↓
Level Hero
↓
Choose stats/traits
↓
Decide whether to Town
↓
Threat +1
↓
3 Road Turns
↓
Persistent dungeon
↓
New/different encounters
↓
Boss
↓
Victory
↓
Run Summary
```

The defining tension:
> Power grows, but every battle can permanently weaken the army that creates that power.

The defining strategic decision:
> Push deeper while damaged, or spend time and increase Threat to recover.

The defining combat decision:
> Which unit acts, which target does it attack, and which special ability is worth spending Mana on right now?

The defining build decision:
> Which army, Hero cards, unit cards and relics are becoming my run’s identity?

---

# 47. Claude Implementation Contract

Treat this document as the canonical MVP contract.

When implementing:
1. Preserve locked design decisions.
2. Put prototype balance values in data/configuration.
3. Keep domain engine independent of HTTP and React.
4. Keep RNG centralized and deterministic.
5. Make the server authoritative.
6. Prefer composable effects and tags over card-ID-specific logic.
7. Write tests alongside each domain system.
8. Emit domain events for meaningful state changes.
9. Keep UI state derived from server state/events where possible.
10. Do not introduce deferred systems into MVP.
11. If unspecified, choose the smallest architecture preserving the locked invariants.
12. Do not redesign the core loop during implementation.

Priority when trade-offs occur:

```text
1. Core gameplay fantasy
2. Combat correctness
3. State consistency / persistence
4. Server authority
5. Deterministic simulation
6. Readable UX
7. Content completeness
8. Balance tuning
9. Visual polish
```

## Final identity

```text
ARMY
  ↕
CARDS
  ↕
HERO
  ↕
RELICS
  ↕
ATTRITION
  ↕
TOWN / THREAT
  ↕
DUNGEON
```

The army creates the tactical possibilities.
Cards amplify them.
The Hero defines direction.
Relics create run-specific combinations.
Casualties create pressure.
Town provides recovery at a cost.
Threat makes retreat a strategic decision instead of a reset.

The intended player feeling:

> **“This is my army, these are my surviving veterans, this is the build I created, and every decision I make determines whether this army reaches the Ashen Warlord.”**
