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

const LANE_INDEX: Record<Lane, number> = { left: 0, center: 1, right: 2 };

/** AO-D021 — a melee unit reaches its own lane and adjacent lanes only (left never reaches right). */
function laneDistance(a: Lane, b: Lane): number {
  return Math.abs(LANE_INDEX[a] - LANE_INDEX[b]);
}

/**
 * Valid enemy targets for a stack's free basic action (or a card that
 * reuses the same geometry). Ranged units (rangedAllAccess) are unrestricted.
 * Melee units: AO-D013 first — while any enemy front stack lives only front
 * stacks are candidates, otherwise the backline opens up — then AO-D021: of
 * those candidates only own/adjacent lanes are reachable.
 * Softlock guard: if that leaves no target while candidates exist (e.g. the
 * only living enemy is two lanes away), the nearest lane's candidates become
 * legal so a battle can never stall.
 */
export function computeValidTargets(attacker: ArmyStack, enemyArmy: ArmyStack[], attackerDef?: UnitDefinition): ArmyStack[] {
  const def = attackerDef ?? UNIT_DEFINITIONS[attacker.unitId];
  const alive = enemyArmy.filter((s) => s.count > 0 && !s.flags.untargetable);

  if (def.rangedAllAccess) {
    return alive;
  }

  // AO-D013: "living" includes untargetable stacks — they still hold the front.
  const frontHeld = enemyArmy.some((s) => s.count > 0 && isFrontPosition(s.position));
  const candidates = frontHeld ? alive.filter((s) => isFrontPosition(s.position)) : alive;
  if (candidates.length === 0) return [];

  const lane = laneOf(attacker.position);
  const inReach = candidates.filter((s) => laneDistance(lane, laneOf(s.position)) <= 1);
  if (inReach.length > 0) return inReach;

  const nearest = Math.min(...candidates.map((s) => laneDistance(lane, laneOf(s.position))));
  return candidates.filter((s) => laneDistance(lane, laneOf(s.position)) === nearest);
}

/** Any living friendly stack is a valid heal target (Priest's basic action). */
export function computeValidHealTargets(friendlyArmy: ArmyStack[]): ArmyStack[] {
  return friendlyArmy.filter((s) => s.count > 0);
}
