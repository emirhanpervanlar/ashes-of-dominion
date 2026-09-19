import { createStack } from '../army.js';
import type { ArmyStack, Position, UnitId } from '../types.js';
import { BOSS_CHAPTER_MULTIPLIER, CHAPTER_DEPTH_BONUS, LAYERS_PER_DEPTH, threatMultiplier } from './chapters.js';

/**
 * PROTOTYPE scaling (AGENT.md §41 threat/anti-snowball, §70 not locked):
 * deeper map layers, later chapters, Elite nodes and Threat (AO-D047) all
 * field larger stacks so the run can't be farmed forever at the same difficulty.
 */
function scale(base: number, depth: number, eliteMultiplier: number, threat: number): number {
  const depthMultiplier = 1 + depth * 0.18;
  return Math.max(1, Math.round(base * depthMultiplier * eliteMultiplier * threatMultiplier(threat)));
}

/** A chapter is ~30 layers, so difficulty depth advances every LAYERS_PER_DEPTH layers and jumps by CHAPTER_DEPTH_BONUS per later chapter. */
function encounterDepth(layer: number, chapter: number): number {
  return Math.ceil(layer / LAYERS_PER_DEPTH) + (chapter - 1) * CHAPTER_DEPTH_BONUS;
}

/**
 * Slots are revealed progressively by depth so early fights are a single small pack
 * and the full 6-stack formation only appears once the player has had a chance to
 * grow past the small starting garrison (AGENT.md §73 vertical slice, revised: the
 * player now starts with 1-2 stacks, so early encounters must match that).
 */
function slotsForDepth(depth: number, elite: boolean): number {
  const base = elite ? 2 : 1;
  return Math.min(6, base + depth);
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

export function generateBattleEncounter(layer: number, elite: boolean, chapter = 1, threat = 0): ArmyStack[] {
  const eliteMultiplier = elite ? 1.3 : 1;
  const template = elite ? ELITE_TEMPLATE : NON_ELITE_TEMPLATE;
  const depth = encounterDepth(layer, chapter);
  const activeSlots = template.slice(0, slotsForDepth(depth, elite));

  return activeSlots.map(([unitId, position, base]) => createStack(unitId, 'enemy', position, scale(base, depth, eliteMultiplier, threat)));
}

/**
 * PLACEHOLDER boss encounter — v3 §22 "The Ashen Warlord" (a named 3-phase boss
 * entity with its own HP/behavior, not a stack of a roster unit) is Phase 6
 * content per v3 §43 and not implemented yet. This stands in with an
 * oversized elite formation; chapters 2 and 3 scale the same formation
 * (BOSS_CHAPTER_MULTIPLIER) rather than adding new boss definitions.
 */
export function generateBossEncounter(chapter = 1, threat = 0): ArmyStack[] {
  const positions: Array<[UnitId, Position, number]> = [
    ['orc', 1, 60],
    ['orc', 2, 60],
    ['orc', 3, 60],
    ['wolf', 4, 30],
    ['shaman', 5, 18],
    ['wolf', 6, 30],
  ];
  const multiplier = (BOSS_CHAPTER_MULTIPLIER[chapter - 1] ?? BOSS_CHAPTER_MULTIPLIER[BOSS_CHAPTER_MULTIPLIER.length - 1]!) * threatMultiplier(threat);
  return positions.map(([unitId, position, count]) => createStack(unitId, 'enemy', position, Math.max(1, Math.round(count * multiplier))));
}
