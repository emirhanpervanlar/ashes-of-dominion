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

/** Targets legal under every reach rule (ranged, AO-D013 front/back, AO-D021 lane, AO-D033 disciples) — no fallback. */
function strictTargets(attacker: ArmyStack, enemyArmy: ArmyStack[], def: UnitDefinition, ownArmy?: ArmyStack[]): ArmyStack[] {
  if (ownArmy && isBlockedByFrontAlly(attacker, ownArmy, def)) return [];
  if (def.rangedAllAccess) return enemyArmy.filter((s) => s.count > 0 && !s.flags.untargetable);
  const lane = laneOf(attacker.position);
  return meleeCandidates(enemyArmy).filter((s) => laneDistance(lane, laneOf(s.position)) <= 1);
}

/**
 * AO-D038: a true stalemate is when no living unit on EITHER side has a legal target under the
 * strict reach rules (ranged units included). Only then does the nearest-lane fallback open up,
 * so a battle can never stall; otherwise a unit that reaches nothing simply does not attack.
 */
export function isStalemate(playerArmy: ArmyStack[], enemyArmy: ArmyStack[]): boolean {
  const canHit = (army: ArmyStack[], other: ArmyStack[]) =>
    army.some((s) => s.count > 0 && strictTargets(s, other, UNIT_DEFINITIONS[s.unitId], army).length > 0);
  return !canHit(playerArmy, enemyArmy) && !canHit(enemyArmy, playerArmy);
}

/**
 * Valid enemy targets for a stack's free basic action (or a card that reuses the same geometry).
 * Ranged units (rangedAllAccess) are unrestricted. Melee units: AO-D013 first (front row while
 * any enemy front stack lives, otherwise the backline), then AO-D021 (own/adjacent lane only).
 * AO-D033: a back-row melee stack with a living friendly stack directly in front has no targets.
 * A unit with no legal target gets none — unless the whole board is in a stalemate (AO-D038,
 * needs `ownArmy` to judge), in which case the nearest lane's candidates become legal for both sides.
 */
export function computeValidTargets(attacker: ArmyStack, enemyArmy: ArmyStack[], attackerDef?: UnitDefinition, ownArmy?: ArmyStack[]): ArmyStack[] {
  const def = attackerDef ?? UNIT_DEFINITIONS[attacker.unitId];
  const strict = strictTargets(attacker, enemyArmy, def, ownArmy);
  if (strict.length > 0 || !ownArmy) return strict;
  if (isBlockedByFrontAlly(attacker, ownArmy, def) || !isStalemate(ownArmy, enemyArmy)) return [];

  const candidates = meleeCandidates(enemyArmy);
  if (candidates.length === 0) return [];
  const lane = laneOf(attacker.position);
  const nearest = Math.min(...candidates.map((s) => laneDistance(lane, laneOf(s.position))));
  return candidates.filter((s) => laneDistance(lane, laneOf(s.position)) === nearest);
}

/** AO-D033 "disciples": a melee unit in the back row cannot attack while a living friendly stack stands directly in front of it. */
export function isBlockedByFrontAlly(attacker: ArmyStack, ownArmy: ArmyStack[], attackerDef?: UnitDefinition): boolean {
  const def = attackerDef ?? UNIT_DEFINITIONS[attacker.unitId];
  if (def.rangedAllAccess || isFrontPosition(attacker.position)) return false;
  const frontPosition = attacker.position - 3;
  return ownArmy.some((s) => s.count > 0 && s.stackId !== attacker.stackId && s.position === frontPosition);
}

/** Any living friendly stack is a valid heal target (Priest's basic action). */
export function computeValidHealTargets(friendlyArmy: ArmyStack[]): ArmyStack[] {
  return friendlyArmy.filter((s) => s.count > 0);
}
