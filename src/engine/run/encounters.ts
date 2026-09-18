import { createStack } from '../army.js';
import type { ArmyStack, Position, UnitId } from '../types.js';

/**
 * PROTOTYPE scaling (AGENT.md §41 threat/anti-snowball, §70 not locked):
 * deeper map layers and Elite nodes field larger stacks so the run can't
 * be farmed forever at the same difficulty.
 */
function scale(base: number, layer: number, eliteMultiplier: number): number {
  const layerMultiplier = 1 + layer * 0.18;
  return Math.max(1, Math.round(base * layerMultiplier * eliteMultiplier));
}

/**
 * Slots are revealed progressively by layer so early fights are a single small pack
 * and the full 6-stack formation only appears once the player has had a chance to
 * grow past the small starting garrison (AGENT.md §73 vertical slice, revised: the
 * player now starts with 1-2 stacks, so early encounters must match that).
 */
function slotsForLayer(layer: number, elite: boolean): number {
  const base = elite ? 2 : 1;
  return Math.min(6, base + layer);
}

const NON_ELITE_TEMPLATE: Array<[UnitId, Position, number]> = [
  ['goblin', 2, 5],
  ['orc', 1, 4],
  ['wolf', 3, 3],
  ['goblin', 5, 5],
  ['shaman', 4, 3],
  ['goblin', 6, 5],
];

const ELITE_TEMPLATE: Array<[UnitId, Position, number]> = [
  ['orc', 1, 6],
  ['wolf', 3, 4],
  ['orc', 2, 6],
  ['shaman', 4, 3],
  ['wolf', 5, 4],
  ['shaman', 6, 3],
];

export function generateBattleEncounter(layer: number, elite: boolean): ArmyStack[] {
  const eliteMultiplier = elite ? 1.3 : 1;
  const template = elite ? ELITE_TEMPLATE : NON_ELITE_TEMPLATE;
  const slotCount = slotsForLayer(layer, elite);
  const activeSlots = template.slice(0, slotCount);

  return activeSlots.map(([unitId, position, base]) => createStack(unitId, 'enemy', position, scale(base, layer, eliteMultiplier)));
}

/**
 * PLACEHOLDER boss encounter — v3 §22 "The Ashen Warlord" (a named 3-phase boss
 * entity with its own HP/behavior, not a stack of a roster unit) is Phase 6
 * content per v3 §43 and not implemented yet. This stands in with an
 * oversized elite formation so the run's final battle still exists end-to-end.
 */
export function generateBossEncounter(): ArmyStack[] {
  const positions: Array<[UnitId, Position, number]> = [
    ['orc', 1, 60],
    ['orc', 2, 60],
    ['orc', 3, 60],
    ['wolf', 4, 30],
    ['shaman', 5, 18],
    ['wolf', 6, 30],
  ];
  return positions.map(([unitId, position, count]) => createStack(unitId, 'enemy', position, count));
}
