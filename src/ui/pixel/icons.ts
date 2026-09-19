import { CARD_ICON_GRIDS } from './icons/cards.js';
import { HUD_ICONS } from './icons/hud.js';
import { MAP_ICONS } from './icons/map.js';
import { RELIC_ICON_GRIDS } from './icons/relics.js';
import { STATUS_ICON_GRIDS } from './icons/status.js';
import { UI_ICONS } from './icons/ui.js';
import { UNIT_ICON_GRIDS } from './icons/units.js';

/** Every pixel icon by name. Ids of the game data map onto these names in the ui/*Icons.ts files. */
export const ICONS = {
  ...HUD_ICONS,
  ...UNIT_ICON_GRIDS,
  ...STATUS_ICON_GRIDS,
  ...CARD_ICON_GRIDS,
  ...MAP_ICONS,
  ...UI_ICONS,
  ...RELIC_ICON_GRIDS,
};

export type IconName = keyof typeof ICONS;
