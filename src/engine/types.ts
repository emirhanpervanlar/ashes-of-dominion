import type { RngState } from './rng.js';

export type Side = 'player' | 'enemy';

/** 1-3 = front row, 4-6 = back row (v3 canonical doc §4). */
export type Position = 1 | 2 | 3 | 4 | 5 | 6;

export type UnitId = 'swordsman' | 'archer' | 'knight' | 'priest' | 'goblin' | 'orc' | 'shaman' | 'wolf';

export type HeroId = 'warlord' | 'rogue' | 'mage';

export type EnemyTargetPreference = 'frontline' | 'backline' | 'buff-weakest-ally' | 'weakest' | 'ranged-priority';

/** v3 §5/§7 — every stack's free, card-less normal action. */
export type BasicActionKind = 'attack' | 'ranged_attack' | 'heal';

/** v3 §8 unit passives — resolved by id in damage.ts, not hard-coded per unit elsewhere. */
export type UnitPassiveId =
  | 'formation_discipline' // Swordsman: adjacent friendly frontline +10% Defense
  | 'high_ground' // Archer: backline +25% Attack
  | 'guard' // Knight: absorbs ~25% direct damage aimed at adjacent allies
  | 'devotion' // Priest: healing/support +10%
  | 'mob_tactics' // Goblin: adjacent Goblin +10% damage
  | 'brutal' // Orc: +20% damage vs targets below 50% count
  | 'shaman_support' // Shaman: buffs weakest allied enemy stack at intent time
  | 'pounce'; // Wolf: +50% damage vs backline targets

export interface UnitDefinition {
  id: UnitId;
  name: string;
  side: Side;
  hpPerUnit: number;
  /** AO-D048: Food this unit eats per day (fractions allowed; a stack's daily upkeep is count x foodPerUnit). */
  foodPerUnit: number;
  /** AO-D031: base damage per unit; attack and defense only scale it through the H3 percentage modifier. */
  damage: number;
  attack: number;
  defense: number;
  tags: string[];
  basicAction: BasicActionKind;
  /** v3 §5 — ranged/support units may bypass lane geometry entirely. */
  rangedAllAccess?: boolean;
  /** Heal strength per effective unit of count, for `basicAction: 'heal'` stacks. */
  healPower?: number;
  passiveId?: UnitPassiveId;
  /** Only used for enemy units to drive intent generation. */
  targetPreference?: EnemyTargetPreference;
}

/** v3 §17 — the MVP visible status vocabulary. Deliberately small. */
export type StatusType = 'strength' | 'weak' | 'armor' | 'bleed' | 'poison' | 'burn' | 'fear' | 'taunt' | 'freeze';

export interface StatusEffect {
  type: StatusType;
  amount: number;
  /** Turns remaining, ticked down (and DoT/control resolved) at the start of the owning side's turn. */
  duration: number;
}

/**
 * One-off mechanical flags used by specific cards (Brace, Protect, Counterattack,
 * Divine Protection, Mark Target, Emergency Retreat, "next attack" buffs, etc.) —
 * deliberately kept OUT of the visible StatusType list per v3 §17 ("do not add a
 * large status library"); these are internal combat-resolution hooks, not badges.
 * All fields are transient and cleared at the start of the owning stack's next turn
 * unless documented otherwise.
 */
export interface StackFlags {
  cannotAttack?: boolean;
  cannotMove?: boolean;
  /** Percent reduction applied to incoming damage this turn (Brace, Shield Wall, Arcane Shield). */
  incomingDamageReductionPercent?: number;
  /** Counterattack card — retaliates for `counterattackPercent`% on the first melee hit received. */
  counterattackPercent?: number;
  counterattackUsesLeft?: number;
  /** Protect card — redirects `redirectPercent`% of the first direct damage this stack takes to `redirectToStackId`. */
  redirectPercent?: number;
  redirectToStackId?: string;
  /** Divine Protection — the next lethal hit instead leaves the stack at 1 soldier. */
  divineShield?: boolean;
  /** Mark Target — ranged damage taken +percent for `duration` turns (ticked like a status but not player-facing as one). */
  markedRangedBonusPercent?: number;
  markedDuration?: number;
  /** Emergency Retreat — cannot be targeted and cannot attack this turn. */
  untargetable?: boolean;
  /** Generic "next basic attack" buffs (Focus Shot, Blood Rage, Brutal Command, Execution Order, Ambush, Last Stand). */
  nextAttackDamageBonusPercent?: number;
  nextAttackAccuracyBonusPercent?: number;
  nextAttackIgnoresArmor?: boolean;
  nextAttackCannotBeRedirected?: boolean;
  /** Poison Arrow-style "next attack applies X" cards. */
  nextAttackAppliesStatus?: { status: StatusType; amount: number; duration: number };
  /** Evasion — relative multiplier on this stack's Hero-derived Dodge chance while it lasts. */
  dodgeMultiplier?: number;
  /** Blood Rage-style self-cost paid immediately after the buffed attack lands. */
  selfCasualtyPercentAfterAttack?: number;
}

export interface ArmyStack {
  stackId: string;
  unitId: UnitId;
  side: Side;
  position: Position;
  count: number;
  currentHp: number;
  maxHp: number;
  startingCount: number;
  /** The stack's largest count reached this battle — Greater Heal/Heal cannot restore past this. */
  preBattleMaxCount: number;
  /** v3 §9 — 0-100, starts at 100. */
  morale: number;
  /** v3 §8 — flat tier 0-3, not an unbounded stat. Resets to 0 if the stack is wiped. */
  veterancy: 0 | 1 | 2 | 3;
  /** Defensive buffer some effects grant; absorbs damage before HP, same role as v2's Block. */
  block: number;
  statuses: StatusEffect[];
  flags: StackFlags;
  actedThisTurn: boolean;
}

export interface HeroStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  wisdom: number;
}

export interface Hero {
  id: string;
  heroType: HeroId;
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  baseMana: number;
  level: number;
  xp: number;
  stats: HeroStats;
  traits: string[];
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type CardSource = { type: 'unit'; unitId: UnitId } | { type: 'hero'; heroId: HeroId } | { type: 'neutral' };

export type CardTargeting =
  | 'none'
  | 'ally-stack'
  | 'enemy-stack'
  | 'ally-stack+enemy-stack'
  | 'ally-stack+position'
  /** Protect/Greater Heal/Heal — an acting ally stack plus a second ally it affects. */
  | 'ally-stack+ally-stack';

/**
 * Composable card effects (v3 §39). Cards compose these rather than each being a
 * bespoke switch-case; a handful of very specific mechanics (Protect's redirect,
 * Counterattack's retaliation window, Divine Protection's death-prevention, Mark
 * Target's ranged-damage-taken bonus, Emergency Retreat's untargetability) are
 * modeled as SET_FLAGS entries consumed by combat.ts/damage.ts rather than as new
 * top-level effect kinds, keeping this union from exploding per-card.
 */
export type CardEffect =
  | { kind: 'ATTACK'; multiplier: number; conditionalBonus?: { targetHpBelowPercent: number; multiplier: number } }
  | { kind: 'ATTACK_ALL_WITH_TAG'; tag: string; multiplier: number }
  | { kind: 'ATTACK_SPLASH'; primaryMultiplier: number; secondaryMultiplier: number; maxSecondaryTargets: number }
  /** Piercing Arrow — primary target plus whatever is directly behind it (same lane, opposite row). */
  | { kind: 'ATTACK_PRIMARY_AND_BEHIND'; primaryMultiplier: number; behindMultiplier: number }
  | { kind: 'ATTACK_TWICE'; firstMultiplier: number; secondMultiplier: number }
  /** Scales off the ACTING stack's own healPower (falls back to 3 if the unit has none) x Wisdom effectiveness. */
  | { kind: 'HEAL'; multiplier: number }
  | { kind: 'RESTORE_SOLDIERS_PERCENT'; percent: number }
  | { kind: 'MODIFY_STAT'; stat: 'attack' | 'defense'; amount: number; duration: number; scope: 'self' | 'adjacent-allies' }
  | { kind: 'APPLY_STATUS'; status: StatusType; amount: number; duration: number }
  | { kind: 'REMOVE_STATUSES'; statuses: StatusType[] }
  | { kind: 'GAIN_MORALE'; amount: number }
  | { kind: 'GAIN_MORALE_ALL'; amount: number }
  | { kind: 'GAIN_MANA'; amount: number }
  | { kind: 'DRAW'; amount: number }
  | { kind: 'MOVE_STACK' }
  | { kind: 'GAIN_TAUNT'; duration: number }
  | { kind: 'GAIN_BLOCK'; amount: number }
  | { kind: 'GAIN_BLOCK_ALL_FRONT'; amount: number }
  | { kind: 'DEFENSE_BUFF_ALL_FRONTLINE'; amount: number; duration: number }
  | { kind: 'DEFENSE_BUFF_ADJACENT_THREE'; amount: number; duration: number }
  | { kind: 'DAMAGE_BUFF_ALL_WITH_TAG'; tag: string; amount: number; duration: number }
  | { kind: 'DAMAGE_AND_DEFENSE_BUFF'; damageAmount: number; defenseAmount: number; duration: number }
  | { kind: 'SET_FLAGS'; target: 'self' | 'other'; flags: Partial<StackFlags> }
  /** Venomous Army — applies the flags to every living friendly stack carrying `tag` (e.g. all ranged stacks). */
  | { kind: 'SET_FLAGS_ALL_WITH_TAG'; tag: string; flags: Partial<StackFlags> }
  | { kind: 'DAMAGE_ALL_ENEMIES'; multiplier: number; primaryBonusMultiplier: number }
  | { kind: 'DAMAGE_UP_TO_N_ENEMIES'; multiplier: number; maxTargets: number }
  | { kind: 'CHAIN_DAMAGE'; primaryMultiplier: number; secondaryMultiplier: number; maxSecondaryTargets: number };

export interface CardRequirement {
  minCount?: number;
}

/** The "+" version of a card (AO-D060): shown text plus whatever it replaces (cost and/or effects). */
export interface CardUpgradeDefinition {
  description: string;
  manaCost?: number;
  effects?: CardEffect[];
}

export interface CardDefinition {
  id: string;
  name: string;
  source: CardSource;
  rarity: Rarity;
  manaCost: number;
  tags: string[];
  targeting: CardTargeting;
  effects: CardEffect[];
  unique?: boolean;
  exhaust?: boolean;
  retain?: boolean;
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
  upgraded?: boolean;
}

export type RelicEffect =
  | { kind: 'HERO_MAX_MANA'; amount: number }
  | { kind: 'ARMY_SIZE_MULT'; multiplier: number }
  | { kind: 'ARMY_SIZE_FLAT_LARGEST'; amount: number }
  | { kind: 'GOLD_FLAT'; amount: number }
  | { kind: 'PLAYER_DAMAGE_MULT'; multiplier: number }
  | { kind: 'TAG_DAMAGE_MULT'; tag: string; multiplier: number }
  | { kind: 'LARGE_STACK_STRENGTH'; threshold: number; amount: number }
  | { kind: 'SMALL_STACK_DAMAGE_MULT'; threshold: number; multiplier: number }
  | { kind: 'PLAYER_DAMAGE_TAKEN_MULT'; multiplier: number }
  | { kind: 'NECROMANCY'; ratio: number }
  | { kind: 'DODGE_BONUS_PERCENT'; amount: number }
  | { kind: 'HEALING_MULT'; multiplier: number }
  | { kind: 'FIRST_CARD_DISCOUNT'; amount: number };

export type RelicRarity = 'common' | 'rare' | 'epic';

export interface RelicDefinition {
  id: string;
  name: string;
  /** States the drawback (if any) in plain words - shown as-is by the UI. */
  description: string;
  rarity: RelicRarity;
  effects: RelicEffect[];
  unique?: boolean;
}

export interface EnemyIntent {
  stackId: string;
  kind: 'attack' | 'buff';
  targetStackId: string | null;
  estimatedDamage?: number;
  buffStatus?: StatusType;
  buffAmount?: number;
}

export type CombatEvent =
  | { type: 'BATTLE_STARTED' }
  | { type: 'TURN_STARTED'; side: Side; turnNumber: number }
  | { type: 'CARD_DRAWN'; instanceId: string; cardId: string }
  | { type: 'DECK_RESHUFFLED' }
  | { type: 'CARD_PLAYED'; instanceId: string; cardId: string }
  | { type: 'CARD_DISCARDED'; instanceId: string; cardId: string }
  | { type: 'CARD_EXHAUSTED'; instanceId: string; cardId: string }
  | {
      type: 'STACK_ATTACKED';
      attackerStackId: string;
      targetStackId: string;
      rawDamage: number;
      /** HP damage that got through Block (AO-D022 pairs it with unitsKilled). */
      finalDamage: number;
      blocked: number;
      unitsKilled: number;
      /** Target stack size right after this hit. */
      countAfter: number;
    }
  | { type: 'UNITS_KILLED'; stackId: string; count: number }
  | { type: 'STACK_DESTROYED'; stackId: string }
  | { type: 'STACK_HEALED'; stackId: string; amount: number }
  | { type: 'BLOCK_GAINED'; stackId: string; amount: number }
  | { type: 'MORALE_CHANGED'; stackId: string; amount: number }
  | { type: 'STATUS_APPLIED'; stackId: string; status: StatusType; amount: number; duration: number }
  | { type: 'STATUSES_REMOVED'; stackId: string; statuses: StatusType[] }
  | { type: 'STACK_MOVED'; stackId: string; fromPosition: Position; toPosition: Position }
  | { type: 'MANA_GAINED'; amount: number }
  | { type: 'INTENTS_GENERATED'; intents: EnemyIntent[] }
  | { type: 'ENEMY_TURN_RESOLVED' }
  | { type: 'ACTION_REJECTED'; reason: string }
  | { type: 'COUNTERATTACK_TRIGGERED'; stackId: string; targetStackId: string }
  | { type: 'DIVINE_SHIELD_CONSUMED'; stackId: string }
  | { type: 'BATTLE_ENDED'; result: 'victory' | 'defeat' };

export type PlayerAction =
  | {
      type: 'PLAY_CARD';
      instanceId: string;
      actingStackId?: string;
      targetStackId?: string;
      toPosition?: Position;
    }
  | { type: 'BASIC_ACTION'; stackId: string; targetStackId?: string }
  | { type: 'END_TURN' };

export interface CombatState {
  seed: number;
  rng: RngState;
  turnNumber: number;
  phase: 'player' | 'enemy' | 'ended';
  result: 'ongoing' | 'victory' | 'defeat';
  hero: Hero;
  playerArmy: ArmyStack[];
  enemyArmy: ArmyStack[];
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhausted: CardInstance[];
  enemyIntents: EnemyIntent[];
  activeRelicEffects: RelicEffect[];
  log: CombatEvent[];
}

/** One damaging hit inside an enemy step: the primary attack or a counterattack it triggered. */
export interface EnemyStepHit {
  attackerStackId: string;
  targetStackId: string;
  hpDamage: number;
  blocked: number;
  unitsKilled: number;
  dodged: boolean;
  countAfter: number;
}

/** Stack values right after an enemy step; replaying these in order reproduces the final state. */
export interface StackSnapshot {
  stackId: string;
  side: Side;
  count: number;
  currentHp: number;
  block: number;
}

/** AO-D023 — one enemy action, in execution order. */
export interface EnemyStep {
  actorStackId: string;
  kind: EnemyIntent['kind'];
  targetStackId: string | null;
  hits: EnemyStepHit[];
  statuses: { stackId: string; status: StatusType; amount: number; duration: number }[];
  resulting: StackSnapshot[];
}

export interface ApplyResult {
  state: CombatState;
  events: CombatEvent[];
  /** Present on END_TURN: the enemy phase as an ordered step list (state is still the atomic final state). */
  enemySteps?: EnemyStep[];
}
