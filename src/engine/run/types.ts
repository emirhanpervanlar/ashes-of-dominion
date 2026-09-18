import type { RngState } from '../rng.js';
import type { ArmyStack, CardInstance, CombatState, Hero, PlayerAction, RelicDefinition, UnitId } from '../types.js';
import type { CityState } from './city.js';
import type { MerchantInventory } from './merchant.js';
import type { WorldMapState } from './worldMap.js';

export type RunPhase =
  | 'choosing_starting_relic'
  | 'on_map'
  | 'in_battle'
  | 'reward'
  | 'event'
  | 'merchant'
  | 'city'
  | 'run_complete'
  | 'defeat';

export interface PendingReward {
  relicOptions: string[];
  cardOptions: string[];
  upgradeOptions: { instanceId: string; cardId: string; upgradedCardId: string }[];
  chosenRelicId: string | null;
  chosenCardId: string | null;
  chosenUpgradeInstanceId: string | null;
}

export interface PendingEvent {
  eventId: string;
}

export type RunEvent =
  | { type: 'RUN_STARTED' }
  | { type: 'STARTING_RELIC_CHOSEN'; relicId: string }
  | { type: 'MOVED'; nodeId: string; foodCost: number }
  | { type: 'STARVING'; unitsLost: number }
  | { type: 'RESOURCE_FOUND'; gold: number; food: number }
  | { type: 'ARRIVED_AT_NODE'; nodeId: string; nodeType: string }
  | { type: 'BATTLE_WON' }
  | { type: 'BATTLE_LOST' }
  | { type: 'RELIC_CLAIMED'; relicId: string }
  | { type: 'CARD_REWARD_CLAIMED'; cardId: string }
  | { type: 'CARD_UPGRADED'; instanceId: string; fromCardId: string; toCardId: string }
  | { type: 'REWARD_SKIPPED' }
  | { type: 'EVENT_RESOLVED'; eventId: string; optionId: string; outcome: string }
  | { type: 'ITEM_PURCHASED'; itemId: string; price: number }
  | { type: 'UNITS_RECRUITED'; unitId: string; count: number }
  | { type: 'BUILDING_BUILT'; buildingId: string }
  | { type: 'CITY_LEVELED_UP'; level: number }
  | { type: 'DOCTRINE_CHOSEN'; doctrineId: string }
  | { type: 'RUN_COMPLETE' }
  | { type: 'ACTION_REJECTED'; reason: string };

export interface RunState {
  seed: number;
  rng: RngState;
  hero: Hero;
  /** Authoritative army (with persistent casualties) between battles; combat.playerArmy is authoritative during a battle. */
  army: ArmyStack[];
  /** All owned cards — the pool combat decks are built from at the start of each battle. */
  masterDeck: CardInstance[];
  relics: RelicDefinition[];
  gold: number;
  food: number;
  day: number;
  battlesWon: number;
  worldMap: WorldMapState;
  city: CityState;
  /** Set when the current battle was triggered by the map's Boss node — its reward routes to 'run_complete' instead of 'on_map'. */
  finalBattle: boolean;
  phase: RunPhase;
  combat: CombatState | null;
  pendingReward: PendingReward | null;
  pendingEvent: PendingEvent | null;
  pendingMerchant: MerchantInventory | null;
  log: RunEvent[];
}

export type RunAction =
  | { type: 'CHOOSE_STARTING_RELIC'; relicId: string }
  | { type: 'MOVE_TO'; nodeId: string }
  | { type: 'COMBAT_ACTION'; action: PlayerAction }
  | { type: 'CLAIM_RELIC'; relicId: string }
  | { type: 'CLAIM_CARD'; cardId: string }
  | { type: 'CLAIM_UPGRADE'; instanceId: string }
  | { type: 'CONFIRM_REWARD' }
  | { type: 'CHOOSE_EVENT_OPTION'; optionId: string }
  | { type: 'BUY_CARD'; cardId: string }
  | { type: 'BUY_RELIC'; relicId: string }
  | { type: 'LEAVE_MERCHANT' }
  | { type: 'ENTER_CITY' }
  | { type: 'RECRUIT'; unitId: UnitId; count: number }
  | { type: 'BUILD_BUILDING'; buildingId: string }
  | { type: 'UPGRADE_CITY' }
  | { type: 'CHOOSE_DOCTRINE'; doctrineId: string }
  | { type: 'LEAVE_CITY' }
  | { type: 'SPLIT_STACK'; stackId: string; splitCount: number }
  | { type: 'MERGE_STACKS'; stackIdA: string; stackIdB: string };

export interface RunApplyResult {
  run: RunState;
  events: RunEvent[];
}
