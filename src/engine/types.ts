import type { RngState } from './rng.js';

export type Side = 'player' | 'enemy';

/** 1-3 = front row, 4-6 = back row (AGENT.md §7). */
export type Position = 1 | 2 | 3 | 4 | 5 | 6;

export type UnitId =
  | 'swordsman'
  | 'archer'
  | 'knight'
  | 'priest'
  | 'mage'
  | 'cavalier'
  | 'goblin'
  | 'orc'
  | 'shaman'
  | 'wolf'
  | 'warlord'
  | 'skeleton';

export type EnemyTargetPreference = 'frontline' | 'backline' | 'buff-weakest-ally';

export interface UnitDefinition {
  id: UnitId;
  name: string;
  side: Side;
  hpPerUnit: number;
  attack: number;
  defense: number;
  tags: string[];
  /** Only used for enemy units to drive intent generation (AGENT.md §8/§9). */
  targetPreference?: EnemyTargetPreference;
  /**
   * AGENT.md §42 "Warlord: gains strength based on player's army size" —
   * +1 flat Attack per `divisor` total player units, computed fresh each
   * attack (see damage.ts's bossScalingAttackBonus), never stored as a
   * status so it can't accidentally stack.
   */
  scalesWithPlayerArmy?: { divisor: number };
}

export type StatusType =
  | 'strength'
  | 'weak'
  | 'armor'
  | 'bleed'
  | 'poison'
  | 'burn'
  | 'fear'
  | 'taunt'
  | 'haste'
  /** +`amount`% damage taken this status's duration (Focus Fire, AGENT.md §15). */
  | 'vulnerable';

export interface StatusEffect {
  type: StatusType;
  amount: number;
  /** Turns remaining, ticked down at the end of the owning side's turn. */
  duration: number;
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
  morale: number;
  veterancy: number;
  block: number;
  statuses: StatusEffect[];
}

export interface Hero {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  ac: number;
  maxAc: number;
  dc: number;
  maxDc: number;
}

export type CardCostType = 'AC' | 'DC' | 'MANA';

export interface CardCost {
  type: CardCostType;
  amount: number;
}

export type CardTargeting =
  | 'none'
  | 'ally-stack'
  | 'enemy-stack'
  | 'ally-stack+enemy-stack'
  | 'ally-stack+position';

export type CardEffect =
  | {
      kind: 'ATTACK';
      multiplier: number;
      /** Execute, AGENT.md §15: extra multiplier when the target is below a HP% threshold. */
      conditionalBonus?: { targetHpBelowPercent: number; multiplier: number };
    }
  | { kind: 'ATTACK_ALL_WITH_TAG'; tag: string; multiplier: number }
  | { kind: 'GAIN_BLOCK'; amount: number }
  | { kind: 'GAIN_BLOCK_ALL_FRONT'; amount: number }
  | { kind: 'MOVE_STACK' }
  | { kind: 'GAIN_MORALE'; amount: number }
  | { kind: 'GAIN_MORALE_ALL'; amount: number }
  | { kind: 'GAIN_MANA'; amount: number }
  | { kind: 'GAIN_MANA_AND_DRAW'; mana: number; draw: number }
  | { kind: 'DRAW'; amount: number }
  /** Guard Stance (Immortal Knights, AGENT.md §48) — see intents.ts's taunt-aware targeting. */
  | { kind: 'GAIN_TAUNT'; duration: number }
  /** Focus Fire, AGENT.md §15. */
  | { kind: 'APPLY_VULNERABLE'; amount: number; duration: number }
  /** Raise Dead (Undying Legion, AGENT.md §48) — sacrifice part of a stack to summon Skeletons. */
  | { kind: 'SACRIFICE_FOR_SKELETONS'; sacrificePercent: number; skeletonsPerSacrificed: number };

export interface CardDefinition {
  id: string;
  name: string;
  cost: CardCost;
  targeting: CardTargeting;
  effects: CardEffect[];
  exhaust: boolean;
  tags: string[];
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
}

/**
 * Passive relic modifiers (AGENT.md §16/§17). "Stat-boost" kinds are applied
 * once, permanently, at the moment a relic is granted (see run/relics.ts).
 * "Combat-modifier" kinds are read fresh from the currently-held relics on
 * every player-side attack — see combat.ts's resolveAttack.
 */
export type RelicEffect =
  | { kind: 'HERO_MAX_MANA'; amount: number }
  | { kind: 'HERO_MAX_AC'; amount: number }
  | { kind: 'HERO_MAX_DC'; amount: number }
  | { kind: 'ARMY_SIZE_MULT'; multiplier: number }
  | { kind: 'ARMY_SIZE_FLAT_LARGEST'; amount: number }
  | { kind: 'PLAYER_DAMAGE_MULT'; multiplier: number }
  | { kind: 'TAG_DAMAGE_MULT'; tag: string; multiplier: number }
  | { kind: 'LARGE_STACK_STRENGTH'; threshold: number; amount: number }
  | { kind: 'SMALL_STACK_DAMAGE_MULT'; threshold: number; multiplier: number }
  /** Reduces incoming damage to player stacks — Immortal Knights (AGENT.md §48). */
  | { kind: 'PLAYER_DAMAGE_TAKEN_MULT'; multiplier: number }
  /**
   * Necromantic Doctrine / Grave Crown (AGENT.md §27/§48): when a player
   * stack takes casualties, a fraction of the units lost are raised as
   * Skeletons. Combat-modifier kind, read fresh in combat.ts — see the
   * "Necromancy" section of resolveAttack.
   */
  | { kind: 'NECROMANCY'; ratio: number };

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  effects: RelicEffect[];
}

/**
 * Hero skills (AGENT.md §5 "Active skill slots: 4") — always available
 * during combat (not drawn/discarded like cards), gated by Mana cost and a
 * per-battle cooldown instead of a hand/deck. Reuses CardEffect so the same
 * executor in combat.ts handles both.
 */
export interface HeroSkillDefinition {
  id: string;
  name: string;
  description: string;
  cost: CardCost;
  targeting: CardTargeting;
  effects: CardEffect[];
  cooldownTurns: number;
}

export interface HeroSkillState {
  skillId: string;
  cooldownRemaining: number;
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
      finalDamage: number;
      blocked: number;
    }
  | { type: 'UNITS_KILLED'; stackId: string; count: number }
  | { type: 'STACK_DESTROYED'; stackId: string }
  | { type: 'BLOCK_GAINED'; stackId: string; amount: number }
  | { type: 'MORALE_CHANGED'; stackId: string; amount: number }
  | { type: 'STATUS_APPLIED'; stackId: string; status: StatusType; amount: number; duration: number }
  | { type: 'STACK_MOVED'; stackId: string; fromPosition: Position; toPosition: Position }
  | { type: 'MANA_GAINED'; amount: number }
  | { type: 'INTENTS_GENERATED'; intents: EnemyIntent[] }
  | { type: 'ENEMY_TURN_RESOLVED' }
  | { type: 'ACTION_REJECTED'; reason: string }
  | { type: 'SKILL_USED'; skillId: string }
  | { type: 'SKELETONS_RAISED'; count: number }
  | { type: 'BATTLE_ENDED'; result: 'victory' | 'defeat' };

export type PlayerAction =
  | {
      type: 'PLAY_CARD';
      instanceId: string;
      actingStackId?: string;
      targetStackId?: string;
      toPosition?: Position;
    }
  | {
      type: 'USE_SKILL';
      skillId: string;
      actingStackId?: string;
      targetStackId?: string;
      toPosition?: Position;
    }
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
  /** Passive relic effects active for this battle — see RunState.relics. */
  activeRelicEffects: RelicEffect[];
  heroSkills: HeroSkillState[];
  log: CombatEvent[];
}

export interface ApplyResult {
  state: CombatState;
  events: CombatEvent[];
}
