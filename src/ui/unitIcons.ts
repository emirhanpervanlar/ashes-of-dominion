import type { UnitId } from '../engine/index.js';
import type { IconName } from './pixel/icons.js';

/** Small role badge shown next to the portrait, so the fighting style reads at a glance. */
export const UNIT_ROLE_ICONS: Record<UnitId, IconName> = {
  swordsman: 'role_melee',
  archer: 'role_ranged',
  knight: 'role_tank',
  priest: 'role_support',
  skeleton: 'role_melee',
  goblin: 'role_melee',
  orc: 'role_melee',
  shaman: 'role_caster',
  wolf: 'role_beast',
};
