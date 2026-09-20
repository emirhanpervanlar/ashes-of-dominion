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

export interface StatusGroup {
  type: StatusType;
  /** Sum of every application: the engine adds them (armor, strength, poison...) so this is what the stack really has. */
  amount: number;
  /** How many separate applications were added up. */
  stacks: number;
  /** Turns left on the longest-lasting application. */
  duration: number;
}

/** One entry per status type, in order of first appearance, so several armor buffs read as one chip with the total. */
export function groupStatuses(statuses: readonly { type: StatusType; amount: number; duration: number }[]): StatusGroup[] {
  const groups: StatusGroup[] = [];
  for (const s of statuses) {
    const group = groups.find((g) => g.type === s.type);
    if (group) {
      group.amount += s.amount;
      group.stacks += 1;
      group.duration = Math.max(group.duration, s.duration);
    } else {
      groups.push({ type: s.type, amount: s.amount, stacks: 1, duration: s.duration });
    }
  }
  return groups;
}

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
