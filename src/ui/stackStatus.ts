import { isBlockedByFrontAlly } from '../engine/index.js';
import type { ArmyStack, StatusType } from '../engine/index.js';
import type { IconName } from './pixel/icons.js';

export const STATUS_ICONS: Record<StatusType, IconName> = {
  strength: 'st_strength',
  weak: 'st_weak',
  armor: 'st_armor',
  bleed: 'st_bleed',
  poison: 'st_poison',
  burn: 'st_burn',
  fear: 'st_fear',
  taunt: 'st_taunt',
  freeze: 'st_freeze',
};

export interface StackStates {
  /** Player stack that already used its basic action this turn. */
  acted: boolean;
  frozen: boolean;
  /** An effect (cannotAttack or cannotMove) restrains it; only cannotAttack stops its basic action. */
  chained: boolean;
  cannotAttack: boolean;
  /** AO-D033: back-row melee with a living friendly directly in front. */
  blocked: boolean;
}

/** Mirrors the engine's basic-action gate so the UI never offers a stack that would be rejected. `ownArmy` enables the AO-D033 back-row block. */
export function stackStates(stack: ArmyStack, side: 'player' | 'enemy', ownArmy?: ArmyStack[]): StackStates {
  return {
    acted: side === 'player' && stack.actedThisTurn,
    frozen: stack.statuses.some((s) => s.type === 'freeze' && s.amount > 0),
    chained: !!stack.flags.cannotAttack || !!stack.flags.cannotMove,
    cannotAttack: !!stack.flags.cannotAttack,
    blocked: !!ownArmy && isBlockedByFrontAlly(stack, ownArmy),
  };
}

export function cannotAct(stack: ArmyStack, side: 'player' | 'enemy', ownArmy?: ArmyStack[]): boolean {
  const s = stackStates(stack, side, ownArmy);
  return s.acted || s.frozen || s.cannotAttack || s.blocked;
}
