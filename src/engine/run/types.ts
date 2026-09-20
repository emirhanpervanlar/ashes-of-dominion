import type { RngState } from '../rng.js';
import type { ArmyStack, CardInstance, CombatState, EnemyStep, Hero, PlayerAction, Position, RelicDefinition, UnitId } from '../types.js';
import type { CityState } from './city.js';
import type { VillageOffer } from './villages.js';
import type { Garrison } from './garrison.js';
import type { CardRemovalState } from './cardRemoval.js';
import type { MerchantInventory } from './merchant.js';
import type { RunStats } from './stats.js';
import type { WorldMapState } from './worldMap.js';

export type RunPhase =
  | 'on_map'
  | 'in_battle'
  | 'reward'
  | 'event'
  | 'merchant'
  | 'village'
  | 'city'
  | 'run_complete'
  | 'defeat';

/** One pick resolves the reward (AO-D026): a new card or an upgrade (AO-D068: no skip, no removal). */
export interface PendingReward {
  cardOptions: string[];
  upgradeOptions: { instanceId: string; cardId: string }[];
  /** Elite victories only (AO-D068): the relic already granted for the win (RELIC_CLAIMED), shown as a "Relic gained" banner. */
  relicGained: string | null;
  /** Boss victories before the last chapter (AO-D046): pick one via CLAIM_RELIC; the rest are forfeited. */
  relicChoices: string[];
}

/** A sub-step some options need before they resolve: the player picks one of these cards or units (or backs out with CANCEL_EVENT_CHOICE). */
export type PendingEventChoice =
  | { kind: 'card'; optionId: string; action: 'upgrade' | 'remove' | 'give'; instanceIds: string[] }
  | { kind: 'unit'; optionId: string; unitIds: UnitId[] };

/** A village node waits for the player's choice (AO-D072): what Raid and Help would pay, fixed on arrival. */
export type PendingVillage = VillageOffer;

export interface PendingEvent {
  eventId: string;
  choice: PendingEventChoice | null;
  /** Set once the option has been applied but a pendingUnitChoice still blocks the event from closing (AO-D054). */
  resolved: { optionId: string; outcome: string; text: string } | null;
}

/**
 * AO-D054: an event granted a unit but all 6 stack slots are taken. The newcomer waits here as a
 * temporary 7th entry (its `position` is a placeholder, not a real slot) until the player
 * dismisses a stack (DISMISS_STACK, the newcomer included) or gives the unit up (DECLINE_UNIT_GAIN).
 */
export interface PendingUnitChoice {
  newcomer: ArmyStack;
}

export interface UnitCount {
  unitId: UnitId;
  count: number;
}

export type RunEvent =
  | { type: 'RUN_STARTED' }
  | { type: 'STARTING_RELIC_CHOSEN'; relicId: string }
  | { type: 'MOVED'; nodeId: string; foodCost: number }
  /** AO-D057: a day (or an event's upkeep payment) the Food could not cover; `deaths` is the units that starved, `consecutiveDays` the streak including this one. */
  | { type: 'STARVED'; deaths: UnitCount[]; day: number; consecutiveDays: number }
  | { type: 'RESOURCE_FOUND'; gold: number; food: number }
  | { type: 'ARRIVED_AT_NODE'; nodeId: string; nodeType: string }
  | { type: 'BATTLE_WON' }
  | { type: 'BATTLE_LOST' }
  | { type: 'RELIC_CLAIMED'; relicId: string }
  | { type: 'CARD_REWARD_CLAIMED'; cardId: string }
  | { type: 'CARD_UPGRADED'; instanceId: string; cardId: string }
  | { type: 'CARD_REMOVED'; instanceId: string; cardId: string; goldPaid: number }
  | { type: 'UNITS_REVIVED'; count: number }
  | { type: 'DAILY_INCOME'; gold: number; food: number }
  | { type: 'BATTLE_LOOT'; gold: number; food: number }
  | { type: 'FARM_UPGRADED'; tier: number }
  | { type: 'BARRACKS_UPGRADED'; tier: number }
  | { type: 'FOOD_PURCHASED'; packs: number; food: number; gold: number }
  /** AO-D072: Raid pays Gold and Food at once and raises Threat (a THREAT_CHANGED event follows). */
  | { type: 'VILLAGE_RAIDED'; gold: number; food: number }
  /** Help pays a small gift; `villages` is the number of helped villages now (each: Food every day, militia every week). */
  | { type: 'VILLAGE_HELPED'; gold: number; food: number; villages: number }
  /** AO-D071: the weekly garrison growth (only the units that actually fit under the cap). */
  | { type: 'GARRISON_GROWN'; units: UnitCount[] }
  | { type: 'GARRISON_COLLECTED'; unitId: UnitId; count: number }
  | { type: 'EVENT_RESOLVED'; eventId: string; optionId: string; outcome: string; text: string }
  | { type: 'THREAT_CHANGED'; threat: number; delta: number }
  | { type: 'UNITS_GAINED'; unitId: UnitId; count: number }
  | { type: 'UNITS_LOST'; unitId: UnitId; count: number }
  | { type: 'UNITS_DISMISSED'; unitId: UnitId; count: number }
  | { type: 'UNIT_GAIN_DECLINED'; unitId: UnitId; count: number }
  | { type: 'ITEM_PURCHASED'; itemId: string; price: number }
  | { type: 'UNITS_RECRUITED'; unitId: string; count: number }
  | { type: 'BUILDING_BUILT'; buildingId: string }
  | { type: 'CITY_LEVELED_UP'; level: number }
  | { type: 'MAGE_TOWER_UPGRADED'; tier: number }
  | { type: 'DOCTRINE_CHOSEN'; doctrineId: string }
  /** `free`: AO-D070, the first visit of the run or of the chapter did not raise Threat. */
  | { type: 'CITY_VISITED'; threat: number; free: boolean }
  | { type: 'BOSS_DEFEATED'; chapter: number }
  | { type: 'CHAPTER_STARTED'; chapter: number }
  | { type: 'RUN_COMPLETE' }
  | { type: 'ACTION_REJECTED'; reason: string };

export interface RunState {
  /** Shape of this object (CURRENT_SAVE_VERSION in runEngine.ts); missing on saves from before versioning. */
  saveVersion: number;
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
  /** Consecutive starving days so far (AO-D057); reset by the first fully fed day. Drives loss escalation and the battle Morale malus. */
  starvationDays: number;
  day: number;
  battlesWon: number;
  stats: RunStats;
  cardRemoval: CardRemovalState;
  worldMap: WorldMapState;
  city: CityState;
  /** Free soldiers waiting in the city (AO-D071): grows every 7 days by Barracks tier, collected with COLLECT_GARRISON. */
  garrison: Garrison;
  /** Food packs bought at the city Marketplace this run (AO-D071); each one raises the next price. */
  foodPurchases: number;
  /** Helped villages (AO-D072): permanent, each gives Food every day and militia to the weekly garrison. */
  villages: number;
  /** 1-3 (AO-D046): the boss is due on day 30 x chapter. */
  chapter: number;
  /** Raised by each city visit after the free one (AO-D047, AO-D070); scales enemy unit counts. */
  threat: number;
  /** City visits made in the current chapter (AO-D070); the first one is free, reset when a chapter starts. */
  cityVisitsThisChapter: number;
  /** Event ids already drawn (AO-D050); the pool resets when exhausted, keeping the last few excluded. */
  seenEventIds: string[];
  /** The last won battle's fallen units, net of Shrine revival; what event revivals draw from. */
  lastCasualties: UnitCount[];
  /** Set while a boss battle or its reward is pending: resolving the reward starts the next chapter, or completes the run after the last. */
  bossBattle: boolean;
  phase: RunPhase;
  combat: CombatState | null;
  pendingReward: PendingReward | null;
  pendingEvent: PendingEvent | null;
  pendingUnitChoice: PendingUnitChoice | null;
  pendingMerchant: MerchantInventory | null;
  pendingVillage: PendingVillage | null;
  log: RunEvent[];
}

export type RunAction =
  | { type: 'MOVE_TO'; nodeId: string }
  | { type: 'COMBAT_ACTION'; action: PlayerAction }
  | { type: 'CLAIM_CARD'; cardId: string }
  | { type: 'CLAIM_UPGRADE'; instanceId: string }
  | { type: 'CLAIM_RELIC'; relicId: string }
  | { type: 'REMOVE_CARD'; instanceId: string }
  | { type: 'CHOOSE_EVENT_OPTION'; optionId: string }
  | { type: 'CHOOSE_EVENT_CARD'; instanceId: string }
  | { type: 'CHOOSE_EVENT_UNIT'; unitId: UnitId }
  | { type: 'CANCEL_EVENT_CHOICE' }
  | { type: 'DISMISS_STACK'; stackId: string; count?: number }
  | { type: 'DECLINE_UNIT_GAIN' }
  | { type: 'BUY_CARD'; cardId: string }
  | { type: 'BUY_RELIC'; relicId: string }
  | { type: 'LEAVE_MERCHANT' }
  | { type: 'TRAVEL_TO_CITY' }
  | { type: 'RECRUIT'; unitId: UnitId; count: number }
  | { type: 'BUILD_BUILDING'; buildingId: string }
  | { type: 'UPGRADE_CITY' }
  | { type: 'UPGRADE_MAGE_TOWER' }
  | { type: 'UPGRADE_FARM' }
  | { type: 'UPGRADE_BARRACKS' }
  /** Marketplace (AO-D071): buys `packs` Food packs with Gold, each at the rising price. */
  | { type: 'BUY_FOOD'; packs: number }
  /** Village choice (AO-D072), phase `village`. */
  | { type: 'RAID_VILLAGE' }
  | { type: 'HELP_VILLAGE' }
  /** Moves the waiting garrison into the army (one unit type, or all when `unitId` is omitted); what does not fit stays. */
  | { type: 'COLLECT_GARRISON'; unitId?: UnitId }
  | { type: 'CHOOSE_DOCTRINE'; doctrineId: string }
  | { type: 'LEAVE_CITY' }
  | { type: 'SPLIT_STACK'; stackId: string; splitCount: number }
  | { type: 'MERGE_STACKS'; stackIdA: string; stackIdB: string }
  | { type: 'MOVE_STACK'; stackId: string; toPosition: Position };

export interface RunApplyResult {
  run: RunState;
  events: RunEvent[];
  /** Set by COMBAT_ACTION END_TURN: the enemy turn as ordered steps (AO-D023), so the UI need not re-run the turn. */
  enemySteps?: EnemyStep[];
}
