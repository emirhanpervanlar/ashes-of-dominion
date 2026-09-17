import type { UnitId } from '../engine/index.js';

/**
 * Token shape by role: ranged = triangle, magic/caster = octagon, aggressive
 * melee/fast attackers = circle, everything else (generic infantry/support) = square.
 */
export type UnitShape = 'triangle' | 'square' | 'octagon' | 'circle';

export const UNIT_SHAPES: Record<UnitId, UnitShape> = {
  archer: 'triangle',
  mage: 'octagon',
  shaman: 'octagon',
  knight: 'circle',
  wolf: 'circle',
  cavalier: 'circle',
  warlord: 'circle',
  swordsman: 'square',
  priest: 'square',
  skeleton: 'square',
  goblin: 'square',
  orc: 'square',
};

/** Small role badge shown at the bottom-center of the token, so the weapon/role reads at a glance. */
export const UNIT_ROLE_ICONS: Record<UnitId, string> = {
  swordsman: '⚔️',
  archer: '🏹',
  knight: '🗡️',
  priest: '➕',
  mage: '🪄',
  cavalier: '🐴',
  skeleton: '🦴',
  goblin: '🔪',
  orc: '🪓',
  shaman: '🔮',
  wolf: '🐾',
  warlord: '🔱',
};
