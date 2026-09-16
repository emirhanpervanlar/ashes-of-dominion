import type { RngState } from './rng.js';

export type Side = 'player' | 'enemy';

/** 1-3 = front row, 4-6 = back row (AGENT.md §7). */
export type Position = 1 | 2 | 3 | 4 | 5 | 6;

export type UnitId =
  | 'swordsman'
  | 'archer'
  | 'knight'
  | 'priest'
  | 'goblin'
  | 'orc'
  | 'shaman'
  | 'wolf';

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
  | 'haste';

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
  | { kind: 'ATTACK'; multiplier: number }
  | { kind: 'ATTACK_ALL_WITH_TAG'; tag: string; multiplier: number }
  | { kind: 'GAIN_BLOCK'; amount: number }
  | { kind: 'GAIN_BLOCK_ALL_FRONT'; amount: number }
  | { kind: 'MOVE_STACK' }
  | { kind: 'GAIN_MORALE'; amount: number }
  | { kind: 'GAIN_MORALE_ALL'; amount: number }
  | { kind: 'GAIN_MANA'; amount: number }
  | { kind: 'GAIN_MANA_AND_DRAW'; mana: number; draw: number }
  | { kind: 'DRAW'; amount: number };

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
  | { type: 'BATTLE_ENDED'; result: 'victory' | 'defeat' };

export type PlayerAction =
  | {
      type: 'PLAY_CARD';
      instanceId: string;
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
  log: CombatEvent[];
}

export interface ApplyResult {
  state: CombatState;
  events: CombatEvent[];
}
