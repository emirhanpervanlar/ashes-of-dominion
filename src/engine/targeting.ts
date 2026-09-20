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

/** AO-D013 pool: while any enemy front stack lives (untargetable ones still hold the front) only front stacks are candidates. */
function meleeCandidates(enemyArmy: ArmyStack[]): ArmyStack[] {
  const alive = enemyArmy.filter((s) => s.count > 0 && !s.flags.untargetable);
  const frontHeld = enemyArmy.some((s) => s.count > 0 && isFrontPosition(s.position));
  return frontHeld ? alive.filter((s) => isFrontPosition(s.position)) : alive;
}

/**
 * Valid enemy targets for a stack's free basic action (or a card that reuses the same geometry).
 * Ranged units (rangedAllAccess) are unrestricted. Melee units (AO-D044): the candidate pool is
 * AO-D013 (front row while any enemy front stack lives, otherwise the backline); among it the
 * attacker uses those in its own/adjacent lane (AO-D021), and if none is within lane reach the
 * nearest lane's candidates become legal, so a stranded unit is always hittable and can always fight.
 * AO-D069: with `ownArmy`, a back-row melee stack with any living friendly stack in the front row has no targets.
 */
export function computeValidTargets(attacker: ArmyStack, enemyArmy: ArmyStack[], attackerDef?: UnitDefinition, ownArmy?: ArmyStack[]): ArmyStack[] {
  const def = attackerDef ?? UNIT_DEFINITIONS[attacker.unitId];
  if (ownArmy && isBlockedByFrontAlly(attacker, ownArmy, def)) return [];
  if (def.rangedAllAccess) return enemyArmy.filter((s) => s.count > 0 && !s.flags.untargetable);

  const candidates = meleeCandidates(enemyArmy);
  const lane = laneOf(attacker.position);
  const reach = Math.max(1, Math.min(...candidates.map((s) => laneDistance(lane, laneOf(s.position)))));
  return candidates.filter((s) => laneDistance(lane, laneOf(s.position)) <= reach);
}

/**
 * AO-D069 (amends AO-D033): a back-row MELEE stack cannot attack while ANY living friendly stack stands in the front row,
 * whatever the lane. Ranged units and support/healer units are never blocked (a Priest heals from the back row, itself included).
 */
export function isBlockedByFrontAlly(attacker: ArmyStack, ownArmy: ArmyStack[], attackerDef?: UnitDefinition): boolean {
  const def = attackerDef ?? UNIT_DEFINITIONS[attacker.unitId];
  if (def.rangedAllAccess || def.basicAction === 'heal' || def.tags.includes('support') || isFrontPosition(attacker.position)) return false;
  return ownArmy.some((s) => s.count > 0 && s.stackId !== attacker.stackId && isFrontPosition(s.position));
}

/** Any living friendly stack is a valid heal target (Priest's basic action). */
export function computeValidHealTargets(friendlyArmy: ArmyStack[]): ArmyStack[] {
  return friendlyArmy.filter((s) => s.count > 0);
}
