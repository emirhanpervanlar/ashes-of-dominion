import type { ArmyStack, StatusType } from '../engine/index.js';

export const STATUS_ICONS: Record<StatusType, string> = {
  strength: '💪',
  weak: '🥀',
  armor: '🛡️',
  bleed: '🩸',
  poison: '☠️',
  burn: '🔥',
  fear: '😨',
  taunt: '📣',
  freeze: '❄️',
};

/** Mirrors the engine's basic-action gate so the UI never offers a stack that would be rejected. */
export function cannotAct(stack: ArmyStack, side: 'player' | 'enemy'): boolean {
  const frozen = stack.statuses.some((s) => s.type === 'freeze' && s.amount > 0);
  return (side === 'player' && stack.actedThisTurn) || frozen || !!stack.flags.cannotAttack;
}
