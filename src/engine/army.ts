import { UNIT_DEFINITIONS } from './data/units.js';
import type { ArmyStack, Position, Side, UnitId } from './types.js';

export function createStack(unitId: UnitId, side: Side, position: Position, count: number): ArmyStack {
  const def = UNIT_DEFINITIONS[unitId];
  const maxHp = count * def.hpPerUnit;
  return {
    stackId: `${side}_${unitId}_${position}`,
    unitId,
    side,
    position,
    count,
    currentHp: maxHp,
    maxHp,
    startingCount: count,
    morale: 0,
    veterancy: 0,
    block: 0,
    statuses: [],
  };
}

/** The vertical-slice player army from AGENT.md §73 — kept as a rich test fixture. */
export function buildVerticalSlicePlayerArmy(): ArmyStack[] {
  return [
    createStack('knight', 'player', 1, 18),
    createStack('swordsman', 'player', 2, 80),
    createStack('knight', 'player', 3, 8),
    createStack('archer', 'player', 4, 30),
    createStack('mage', 'player', 5, 10),
    createStack('priest', 'player', 6, 15),
  ];
}

/**
 * A small starting garrison rather than a full 6-stack army — the player is meant to
 * grow their force through recruiting and battle rewards, not start at full strength.
 */
export function buildStartingPlayerArmy(): ArmyStack[] {
  return [createStack('swordsman', 'player', 2, 6), createStack('archer', 'player', 4, 4)];
}

function findFreeArmyPosition(army: ArmyStack[]): Position | null {
  const taken = new Set(army.filter((s) => s.count > 0).map((s) => s.position));
  for (let p = 1 as Position; p <= 6; p++) {
    if (!taken.has(p)) return p;
  }
  return null;
}

/**
 * Splits `splitCount` units off of `stackId` into a new stack in a free army slot,
 * preserving the source stack's wound ratio proportionally across both halves.
 * Returns null if the stack doesn't exist, the split count is out of range, or the
 * army is already at its 6-stack cap.
 */
export function splitArmyStack(army: ArmyStack[], stackId: string, splitCount: number): ArmyStack[] | null {
  const idx = army.findIndex((s) => s.stackId === stackId);
  if (idx < 0) return null;
  const source = army[idx]!;
  if (splitCount <= 0 || splitCount >= source.count) return null;
  const freePosition = findFreeArmyPosition(army);
  if (freePosition === null) return null;

  const hpPerUnit = UNIT_DEFINITIONS[source.unitId].hpPerUnit;
  const woundRatio = source.maxHp > 0 ? source.currentHp / source.maxHp : 1;
  const remainCount = source.count - splitCount;

  const updatedSource: ArmyStack = {
    ...source,
    count: remainCount,
    maxHp: remainCount * hpPerUnit,
    currentHp: Math.max(0, Math.round(remainCount * hpPerUnit * woundRatio)),
    startingCount: remainCount,
  };
  const newStack: ArmyStack = {
    ...source,
    stackId: `${source.side}_${source.unitId}_${freePosition}`,
    position: freePosition,
    count: splitCount,
    maxHp: splitCount * hpPerUnit,
    currentHp: Math.max(0, Math.round(splitCount * hpPerUnit * woundRatio)),
    startingCount: splitCount,
  };
  return [...army.map((s, i) => (i === idx ? updatedSource : s)), newStack];
}

/**
 * Merges two same-unit stacks into one (at the first stack's position), summing
 * counts/HP and blending veterancy by a weighted average. Returns null if the
 * stacks don't match, don't exist, or are the same stack.
 */
export function mergeArmyStacks(army: ArmyStack[], stackIdA: string, stackIdB: string): ArmyStack[] | null {
  if (stackIdA === stackIdB) return null;
  const a = army.find((s) => s.stackId === stackIdA);
  const b = army.find((s) => s.stackId === stackIdB);
  if (!a || !b || a.unitId !== b.unitId) return null;

  const newCount = a.count + b.count;
  const merged: ArmyStack = {
    ...a,
    count: newCount,
    maxHp: a.maxHp + b.maxHp,
    currentHp: a.currentHp + b.currentHp,
    startingCount: a.startingCount + b.startingCount,
    veterancy: newCount > 0 ? Math.round((a.count * a.veterancy + b.count * b.veterancy) / newCount) : 0,
  };
  return [...army.filter((s) => s.stackId !== a.stackId && s.stackId !== b.stackId), merged];
}

/** The vertical-slice enemy encounter from AGENT.md §73. */
export function buildVerticalSliceEnemyArmy(): ArmyStack[] {
  return [
    createStack('orc', 'enemy', 1, 42),
    createStack('orc', 'enemy', 2, 30),
    createStack('wolf', 'enemy', 3, 20),
    createStack('shaman', 'enemy', 4, 12),
    createStack('goblin', 'enemy', 5, 45),
    createStack('goblin', 'enemy', 6, 45),
  ];
}
