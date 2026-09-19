import type { HeroId } from '../engine/index.js';
import type { IconName } from './pixel/icons.js';

export const HERO_ICONS: Record<HeroId, IconName> = {
  warlord: 'hero_warlord',
  rogue: 'hero_rogue',
  mage: 'hero_mage',
};
