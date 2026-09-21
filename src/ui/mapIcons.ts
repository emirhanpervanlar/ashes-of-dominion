import type { NodeType } from '../engine/run/worldMap.js';
import type { IconName } from './pixel/icons.js';

export const NODE_ICONS: Record<NodeType, IconName> = {
  start: 'node_start',
  battle: 'node_battle',
  fort: 'node_fort',
  mine: 'node_mine',
  merchant: 'node_merchant',
  event: 'node_event',
  boss: 'node_boss',
  village: 'node_village',
};

/** Engine building ids plus the fixed city hotspots (town hall, barracks, temple, marketplace), which take no building slot. */
export const BUILDING_ICONS: Record<string, IconName> = {
  townhall: 'bld_townhall',
  barracks: 'bld_barracks',
  temple: 'bld_temple',
  marketplace: 'bld_marketplace',
  market: 'bld_market',
  gold_mine: 'bld_gold_mine',
  mage_tower: 'bld_mage_tower',
  farm: 'bld_farm',
  stable: 'bld_stable',
  training_hall: 'bld_training',
  forge: 'bld_forge',
  shrine: 'bld_shrine',
};

/** Temple doctrines (engine ids) have no icons of their own yet, so each borrows the closest existing one. */
export const DOCTRINE_ICONS: Record<string, IconName> = {
  military: 'doctrine_military',
  arcane: 'doctrine_arcane',
  necromantic: 'doctrine_necromantic',
  economic: 'doctrine_economic',
};
