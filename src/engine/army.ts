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
    preBattleMaxCount: count,
    morale: 100,
    veterancy: 0,
    block: 0,
    statuses: [],
    flags: {},
    actedThisTurn: false,
  };
}

/** v3 §19 enemy formations. */
export function buildHordeFormation(): ArmyStack[] {
  return [
    createStack('goblin', 'enemy', 1, 12),
    createStack('goblin', 'enemy', 2, 12),
    createStack('goblin', 'enemy', 3, 12),
    createStack('goblin', 'enemy', 4, 10),
    createStack('goblin', 'enemy', 5, 10),
    createStack('orc', 'enemy', 6, 8),
  ];
}

export function buildGuardedShamanFormation(): ArmyStack[] {
  return [
    createStack('orc', 'enemy', 1, 10),
    createStack('orc', 'enemy', 2, 10),
    createStack('orc', 'enemy', 3, 10),
    createStack('goblin', 'enemy', 4, 10),
    createStack('shaman', 'enemy', 5, 8),
    createStack('goblin', 'enemy', 6, 10),
  ];
}

export function buildWolfPackFormation(): ArmyStack[] {
  return [createStack('wolf', 'enemy', 1, 8), createStack('wolf', 'enemy', 2, 8), createStack('wolf', 'enemy', 4, 8), createStack('goblin', 'enemy', 5, 10)];
}

export function buildEliteGuardFormation(): ArmyStack[] {
  return [
    createStack('orc', 'enemy', 1, 14),
    createStack('orc', 'enemy', 2, 14),
    createStack('orc', 'enemy', 3, 14),
    createStack('wolf', 'enemy', 4, 10),
    createStack('shaman', 'enemy', 5, 10),
    createStack('wolf', 'enemy', 6, 10),
  ];
}

export const ENEMY_FORMATIONS = {
  horde: buildHordeFormation,
  guarded_shaman: buildGuardedShamanFormation,
  wolf_pack: buildWolfPackFormation,
  elite_guard: buildEliteGuardFormation,
} as const;

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
 * army is already at its 6-stack cap. v3 §8 — merging retains the LOWER veterancy,
 * so a split simply copies the source's veterancy tier to both halves.
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
    preBattleMaxCount: remainCount,
  };
  const newStack: ArmyStack = {
    ...source,
    stackId: `${source.side}_${source.unitId}_${freePosition}`,
    position: freePosition,
    count: splitCount,
    maxHp: splitCount * hpPerUnit,
    currentHp: Math.max(0, Math.round(splitCount * hpPerUnit * woundRatio)),
    startingCount: splitCount,
    preBattleMaxCount: splitCount,
  };
  return [...army.map((s, i) => (i === idx ? updatedSource : s)), newStack];
}

/**
 * Merges two same-unit stacks into one (at the first stack's position), summing
 * counts/HP and retaining the LOWER veterancy tier (v3 §8 "retain the lower
 * veterancy" when merging outside combat).
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
    preBattleMaxCount: a.preBattleMaxCount + b.preBattleMaxCount,
    veterancy: Math.min(a.veterancy, b.veterancy) as 0 | 1 | 2 | 3,
  };
  return [...army.filter((s) => s.stackId !== a.stackId && s.stackId !== b.stackId), merged];
}
