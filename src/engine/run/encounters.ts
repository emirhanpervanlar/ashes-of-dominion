import { createStack } from '../army.js';
import type { ArmyStack, Position, UnitId } from '../types.js';

/**
 * PROTOTYPE scaling (AGENT.md §41 threat/anti-snowball, §70 not locked):
 * deeper map layers and Elite nodes field larger stacks so the run can't
 * be farmed forever at the same difficulty.
 */
function scale(base: number, layer: number, eliteMultiplier: number): number {
  const layerMultiplier = 1 + layer * 0.15;
  return Math.max(1, Math.round(base * layerMultiplier * eliteMultiplier));
}

export function generateBattleEncounter(layer: number, elite: boolean): ArmyStack[] {
  const eliteMultiplier = elite ? 1.4 : 1;
  const positions: Array<[UnitId, Position, number]> = elite
    ? [
        ['orc', 1, scale(35, layer, eliteMultiplier)],
        ['orc', 2, scale(35, layer, eliteMultiplier)],
        ['wolf', 3, scale(18, layer, eliteMultiplier)],
        ['shaman', 4, scale(10, layer, eliteMultiplier)],
        ['wolf', 5, scale(18, layer, eliteMultiplier)],
        ['shaman', 6, scale(10, layer, eliteMultiplier)],
      ]
    : [
        ['orc', 1, scale(25, layer, eliteMultiplier)],
        ['goblin', 2, scale(30, layer, eliteMultiplier)],
        ['wolf', 3, scale(12, layer, eliteMultiplier)],
        ['shaman', 4, scale(8, layer, eliteMultiplier)],
        ['goblin', 5, scale(30, layer, eliteMultiplier)],
        ['goblin', 6, scale(30, layer, eliteMultiplier)],
      ];

  return positions.map(([unitId, position, count]) => createStack(unitId, 'enemy', position, count));
}
