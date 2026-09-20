import type { NodeType } from '../engine/run/worldMap.js';
import type { IconName } from './pixel/icons.js';

export const NODE_ICONS: Record<NodeType, IconName> = {
  start: 'node_start',
  battle: 'node_battle',
  elite_battle: 'node_elite',
  resource: 'node_resource',
  merchant: 'node_merchant',
  event: 'node_event',
  boss: 'node_boss',
};

/** Engine building ids plus the three fixed city hotspots (town hall, barracks, temple), which are not buildable. */
export const BUILDING_ICONS: Record<string, IconName> = {
  townhall: 'bld_townhall',
  barracks: 'bld_barracks',
  temple: 'bld_temple',
  market: 'bld_market',
  gold_mine: 'bld_gold_mine',
  mage_tower: 'bld_mage_tower',
  farm: 'bld_farm',
  stable: 'bld_stable',
  training_hall: 'bld_training',
  forge: 'bld_forge',
  shrine: 'bld_shrine',
};
