import { MAX_ARMY_STACKS, createStack } from '../army.js';
import { roundSafe } from '../floatSafe.js';
import type { ArmyStack, Position, UnitId } from '../types.js';
import { BOSS_CHAPTER_MULTIPLIER, CHAPTER_DEPTH_BONUS, ENCOUNTER_DEPTH_SLOPE, ENCOUNTER_EXTRA_SLOTS, LAYERS_PER_DEPTH, threatMultiplier } from './chapters.js';

/**
 * PROTOTYPE scaling: deeper map layers, later chapters (AO-D046), fort nodes and Threat (AO-D047) all
 * field larger stacks so the run can't be farmed forever at the same difficulty.
 */
function scale(base: number, depth: number, fortMultiplier: number, threat: number): number {
  const depthMultiplier = 1 + depth * ENCOUNTER_DEPTH_SLOPE;
  return Math.max(1, roundSafe(base * depthMultiplier * fortMultiplier * threatMultiplier(threat)));
}

/** A chapter is ~30 layers, so difficulty depth advances every LAYERS_PER_DEPTH layers and jumps by CHAPTER_DEPTH_BONUS per later chapter. */
function encounterDepth(layer: number, chapter: number): number {
  return Math.ceil(layer / LAYERS_PER_DEPTH) + (chapter - 1) * CHAPTER_DEPTH_BONUS;
}

/**
 * Slots are revealed progressively by depth so early fights are a single small pack
 * and the full 6-stack formation only appears once the player has had a chance to
 * grow past the small starting army (AO-D007: the player starts with 2 stacks,
 * so early encounters must match that).
 */
function slotsForDepth(depth: number, fort: boolean): number {
  const base = fort ? 2 : 1;
  return Math.min(MAX_ARMY_STACKS, base + depth + ENCOUNTER_EXTRA_SLOTS);
}

const NON_FORT_TEMPLATE: Array<[UnitId, Position, number]> = [
  ['goblin', 2, 8],
  ['orc', 1, 7],
  ['wolf', 3, 6],
  ['goblin', 5, 5],
  ['shaman', 4, 3],
  ['goblin', 6, 5],
];

const FORT_TEMPLATE: Array<[UnitId, Position, number]> = [
  ['orc', 1, 6],
  ['wolf', 3, 6],
  ['orc', 2, 6],
  ['shaman', 4, 3],
  ['wolf', 5, 4],
  ['shaman', 6, 3],
];

export function generateBattleEncounter(layer: number, fort: boolean, chapter = 1, threat = 0): ArmyStack[] {
  const fortMultiplier = fort ? 1.3 : 1;
  const template = fort ? FORT_TEMPLATE : NON_FORT_TEMPLATE;
  const depth = encounterDepth(layer, chapter);
  const activeSlots = template.slice(0, slotsForDepth(depth, fort));

  return activeSlots.map(([unitId, position, base]) => createStack(unitId, 'enemy', position, scale(base, depth, fortMultiplier, threat)));
}

/** The chapter 1 boss at Threat 0 (AO-D078: about a third of the old 258 units); later chapters multiply it by BOSS_CHAPTER_MULTIPLIER. */
export const BOSS_FORMATION: ReadonlyArray<readonly [UnitId, Position, number]> = [
  ['orc', 1, 24],
  ['orc', 2, 24],
  ['orc', 3, 24],
  ['wolf', 4, 13],
  ['shaman', 5, 5],
  ['wolf', 6, 13],
];

/**
 * PLACEHOLDER boss encounter — v3 §22 "The Ashen Warlord" (a named 3-phase boss
 * entity with its own HP/behavior, not a stack of a roster unit) is Phase 6
 * content per v3 §43 and not implemented yet. This stands in with an
 * oversized fort formation; chapters 2 and 3 scale the same formation
 * (BOSS_CHAPTER_MULTIPLIER) rather than adding new boss definitions.
 */
export function generateBossEncounter(chapter = 1, threat = 0): ArmyStack[] {
  const multiplier = (BOSS_CHAPTER_MULTIPLIER[chapter - 1] ?? BOSS_CHAPTER_MULTIPLIER[BOSS_CHAPTER_MULTIPLIER.length - 1]!) * threatMultiplier(threat);
  return BOSS_FORMATION.map(([unitId, position, count]) => createStack(unitId, 'enemy', position, Math.max(1, roundSafe(count * multiplier))));
}
