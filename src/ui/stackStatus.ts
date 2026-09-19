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

/** Mirrors the engine's basic-action gate so the UI never offers a stack that would be rejected. `ownArmy` enables the AO-D033 back-row block. */
export function cannotAct(stack: ArmyStack, side: 'player' | 'enemy', ownArmy?: ArmyStack[]): boolean {
  const frozen = stack.statuses.some((s) => s.type === 'freeze' && s.amount > 0);
  return (side === 'player' && stack.actedThisTurn) || frozen || !!stack.flags.cannotAttack || (!!ownArmy && isBlockedByFrontAlly(stack, ownArmy));
}
