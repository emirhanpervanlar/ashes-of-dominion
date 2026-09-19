import type { UnitId } from '../engine/index.js';
import type { IconName } from './pixel/icons.js';

/** Portrait icon per unit; drawn as a 16x16 bust until the sprite phase (DL-10) swaps them inside UnitArt. */
export const UNIT_ICONS: Record<UnitId, IconName> = {
  swordsman: 'unit_swordsman',
  archer: 'unit_archer',
  knight: 'unit_knight',
  priest: 'unit_priest',
  goblin: 'unit_goblin',
  orc: 'unit_orc',
  shaman: 'unit_shaman',
  wolf: 'unit_wolf',
};

/** Small role badge shown next to the portrait, so the fighting style reads at a glance. */
export const UNIT_ROLE_ICONS: Record<UnitId, IconName> = {
  swordsman: 'role_melee',
  archer: 'role_ranged',
  knight: 'role_tank',
  priest: 'role_support',
  goblin: 'role_melee',
  orc: 'role_melee',
  shaman: 'role_caster',
  wolf: 'role_beast',
};
