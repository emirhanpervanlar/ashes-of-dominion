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

/** The vertical-slice player army from AGENT.md §73. */
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
