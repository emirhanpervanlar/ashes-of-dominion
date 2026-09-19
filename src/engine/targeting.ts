import { UNIT_DEFINITIONS } from './data/units.js';
import type { ArmyStack, Position, UnitDefinition } from './types.js';

/**
 * v2_list.md §5 "Targeting Geometry" — position determines the natural set
 * of targets. Positions 1-3 are the front row (left/center/right columns),
 * 4-6 are the back row sharing the same three lanes (1&4 = left, 2&5 =
 * center, 3&6 = right).
 */
export type Lane = 'left' | 'center' | 'right';

export function laneOf(position: Position): Lane {
  const col = (position - 1) % 3;
  return col === 0 ? 'left' : col === 1 ? 'center' : 'right';
}

export function isFrontPosition(position: Position): boolean {
  return position <= 3;
}

function frontPositionForLane(lane: Lane): Position {
  return lane === 'left' ? 1 : lane === 'center' ? 2 : 3;
}

function backPositionForLane(lane: Lane): Position {
  return lane === 'left' ? 4 : lane === 'center' ? 5 : 6;
}

/** v2_list.md §5 — X→A,B / Y→A,B,C / Z→B,C for a melee unit's own lane. */
const MELEE_LANE_TARGETS: Record<Lane, Lane[]> = {
  left: ['left', 'center'],
  center: ['left', 'center', 'right'],
  right: ['center', 'right'],
};

/**
 * Valid enemy targets for a stack's free basic action (or a card that
 * reuses the same geometry). Ranged units (rangedAllAccess) ignore lane
 * restriction entirely and can reach the backline. Melee units are limited
 * to their lane's front-row targets only. AO-D013: only when the enemy front
 * row (positions 1-3) has no living stack at all may melee hit the backline;
 * a single dead front lane exposes nothing.
 */
export function computeValidTargets(attacker: ArmyStack, enemyArmy: ArmyStack[], attackerDef?: UnitDefinition): ArmyStack[] {
  const def = attackerDef ?? UNIT_DEFINITIONS[attacker.unitId];
  const alive = enemyArmy.filter((s) => s.count > 0 && !s.flags.untargetable);
  const byPosition = new Map(alive.map((s) => [s.position, s]));

  if (def.rangedAllAccess) {
    return alive;
  }

  // AO-D013: "living" includes untargetable stacks — they still hold the front.
  const frontHeld = enemyArmy.some((s) => s.count > 0 && isFrontPosition(s.position));
  if (!frontHeld) return alive;

  const lane = laneOf(attacker.position);
  const targets: ArmyStack[] = [];
  for (const l of MELEE_LANE_TARGETS[lane]) {
    const front = byPosition.get(frontPositionForLane(l));
    if (front) targets.push(front);
  }
  return targets;
}

/** Any living friendly stack is a valid heal target (Priest's basic action). */
export function computeValidHealTargets(friendlyArmy: ArmyStack[]): ArmyStack[] {
  return friendlyArmy.filter((s) => s.count > 0);
}
