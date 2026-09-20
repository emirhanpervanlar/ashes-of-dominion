import { MAX_ARMY_STACKS, UNIT_DEFINITIONS } from '../../engine/index.js';
import type { Position, UnitId } from '../../engine/index.js';
import {
  BUILDING_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  FARM_TIERS,
  GOLD_MINE_DAILY_GOLD,
  LEVEL_SLOTS,
  LEVEL_UP_COST,
  MAGE_TOWER_TIERS,
  RECRUIT_COSTS,
  ROMAN,
  SHRINE_REVIVE_RATIO,
  addUnitsToArmy,
  dailyFoodNet,
  dailyProduction,
  moveFoodCost,
  recruitCost,
} from '../../engine/run/index.js';
import type { RunState } from '../../engine/run/index.js';
import { BUILDING_ICONS, DOCTRINE_ICONS } from '../mapIcons.js';
import type { IconName } from '../pixel/icons.js';

/** Units the Barracks sells, in display order. */
export const RECRUITABLE_UNITS: UnitId[] = (['swordsman', 'archer', 'knight', 'priest'] as UnitId[]).filter((id) => id in RECRUIT_COSTS);

/** The three fixed hotspots are always open; the eight others are built into the slots. */
export const FIXED_BUILDINGS = ['townhall', 'barracks', 'temple'] as const;
export type FixedBuildingId = (typeof FIXED_BUILDINGS)[number];

export const FIXED_BUILDING_INFO: Record<FixedBuildingId, { name: string; hint: string }> = {
  townhall: { name: 'Town Hall', hint: 'Upgrade the city for more building slots, and remove cards from your deck.' },
  barracks: { name: 'Barracks', hint: 'Recruit units into your army.' },
  temple: { name: 'Temple', hint: 'Choose one permanent doctrine.' },
};

/** Optional buildings in scene order (two rows of four). */
export const SCENE_BUILDINGS = ['market', 'stable', 'forge', 'training_hall', 'farm', 'gold_mine', 'mage_tower', 'shrine'].filter((id) => id in BUILDING_DEFINITIONS);

export type PlotState = 'built' | 'buildable' | 'unaffordable' | 'locked';

export function freeSlots(run: Pick<RunState, 'city'>): number {
  return LEVEL_SLOTS[run.city.level] - run.city.buildings.length;
}

/** Why the building cannot be built right now, or null when it can. Mirrors the engine's rejections; a built building has no blocker. */
export function buildBlocker(run: Pick<RunState, 'city' | 'gold'>, buildingId: string): string | null {
  const def = BUILDING_DEFINITIONS[buildingId];
  if (!def || run.city.buildings.includes(buildingId)) return null;
  if (freeSlots(run) <= 0) return 'No free building slot. Upgrade the Town Hall for more.';
  if (run.gold < def.cost) return `Not enough Gold (${def.cost} needed).`;
  return null;
}

export function plotState(run: Pick<RunState, 'city' | 'gold'>, buildingId: string): PlotState {
  if (run.city.buildings.includes(buildingId)) return 'built';
  if (freeSlots(run) <= 0) return 'locked';
  return run.gold >= BUILDING_DEFINITIONS[buildingId]!.cost ? 'buildable' : 'unaffordable';
}

export type Placement = 'merge' | 'free' | 'full';

export interface RecruitQuote {
  gold: number;
  food: number;
  /** Gold for one unit at the current discount, fractional (Market: 6.8 not 7). */
  goldPerUnit: number;
  /** Food spent once when recruiting one unit. */
  foodPerUnit: number;
  /** Food this unit eats every day afterwards. */
  upkeepPerUnit: number;
  placement: Placement;
  /** The slot a brand new stack would take (only when placement is 'free'). */
  slot: Position | null;
  /** Largest count Gold and Food allow (0 when even one is too dear), capped at MAX_RECRUIT. */
  maxAffordable: number;
  /** Why Recruit is disabled, or null. */
  blocker: string | null;
}

export const MAX_RECRUIT = 999;

/** Everything the Barracks card shows for `count` recruits of one type. Costs and placement come from the engine (recruitCost, addUnitsToArmy). */
export function recruitQuote(run: Pick<RunState, 'city' | 'gold' | 'food' | 'army'>, unitId: UnitId, count: number): RecruitQuote {
  const one = recruitCost(run.city, unitId, 1)!;
  const many = recruitCost(run.city, unitId, count)!;
  const hundred = recruitCost(run.city, unitId, 100)!;
  const afford = (n: number): boolean => {
    const c = recruitCost(run.city, unitId, n)!;
    return run.gold >= c.gold && run.food >= c.food;
  };
  let maxAffordable = 0;
  while (maxAffordable < MAX_RECRUIT && afford(maxAffordable + 1)) maxAffordable++;

  const joined = addUnitsToArmy(run.army, unitId, 1);
  const merges = run.army.some((s) => s.unitId === unitId && s.count > 0);
  const placement: Placement = !joined ? 'full' : merges ? 'merge' : 'free';
  const slot = placement === 'free' ? joined!.find((s) => !run.army.includes(s))?.position ?? null : null;

  let blocker: string | null = null;
  if (placement === 'full') blocker = `Army full: ${MAX_ARMY_STACKS} stacks and no stack of this type to join.`;
  else if (count < 1) blocker = 'Choose how many to recruit.';
  else if (run.gold < many.gold) blocker = 'Not enough Gold.';
  else if (run.food < many.food) blocker = 'Not enough Food.';

  return {
    gold: many.gold,
    food: many.food,
    goldPerUnit: hundred.gold / 100,
    foodPerUnit: one.food,
    upkeepPerUnit: UNIT_DEFINITIONS[unitId].foodPerUnit,
    placement,
    slot,
    maxAffordable,
    blocker,
  };
}

/** One line of the Barracks card explaining where the recruits go (AO-D015). */
export function placementText(quote: Pick<RecruitQuote, 'placement' | 'slot'>, existing: number, unitName: string): string {
  if (quote.placement === 'merge') return `Joins your ${unitName} stack (${existing} now).`;
  if (quote.placement === 'free') return `Forms a new stack in slot ${quote.slot}.`;
  return `Your army is full: ${MAX_ARMY_STACKS} stacks and none of this type to join.`;
}

export interface TierRow {
  tier: number;
  label: string;
  /** Cumulative bonus at this tier. */
  bonus: string;
  cost: number;
  state: 'built' | 'next' | 'locked';
}

/** Mage Tower (I-III) and Farm (I-V) ladders from the engine tier tables. `currentTier` 0 = not built (tier I is the build itself). */
export function tierRows(kind: 'mage_tower' | 'farm', currentTier: number): TierRow[] {
  const table = kind === 'mage_tower' ? MAGE_TOWER_TIERS : FARM_TIERS;
  return table.map((entry, i) => ({
    tier: i + 1,
    label: `Tier ${ROMAN[i]}`,
    bonus: kind === 'mage_tower' ? `Hero max Mana +${(entry as (typeof MAGE_TOWER_TIERS)[number]).maxMana}` : `+${(entry as (typeof FARM_TIERS)[number]).food} Food per day`,
    cost: entry.cost,
    state: i < currentTier ? 'built' : i === currentTier ? 'next' : 'locked',
  }));
}

export interface LevelRow {
  level: 1 | 2 | 3;
  slots: number;
  /** Gold to reach this level (0 for level 1). */
  cost: number;
  state: 'built' | 'next' | 'locked';
}

export function levelRows(currentLevel: 1 | 2 | 3): LevelRow[] {
  return ([1, 2, 3] as const).map((level) => ({
    level,
    slots: LEVEL_SLOTS[level],
    cost: level === 1 ? 0 : LEVEL_UP_COST[level],
    state: level <= currentLevel ? 'built' : level === currentLevel + 1 ? 'next' : 'locked',
  }));
}

export interface CityEffect {
  id: string;
  icon: IconName;
  title: string;
  text: string;
}

/** The effect a built building has right now, worded from engine data; null when it has none (not built). */
export function buildingEffect(run: Pick<RunState, 'city' | 'army'>, buildingId: string): CityEffect | null {
  const { city } = run;
  const def = BUILDING_DEFINITIONS[buildingId];
  if (!def || !city.buildings.includes(buildingId)) return null;
  const base = { id: buildingId, icon: BUILDING_ICONS[buildingId]! };
  switch (buildingId) {
    case 'mage_tower':
      return { ...base, title: `${def.name}, tier ${ROMAN[city.mageTowerTier - 1]}`, text: `Hero max Mana +${MAGE_TOWER_TIERS[city.mageTowerTier - 1]!.maxMana}.` };
    case 'farm':
      return { ...base, title: `${def.name}, tier ${ROMAN[city.farmTier - 1]}`, text: `+${dailyProduction({ city })} Food every day.` };
    case 'gold_mine':
      return { ...base, title: def.name, text: `+${GOLD_MINE_DAILY_GOLD} Gold every day.` };
    case 'forge': {
      const mult = def.combatEffects?.find((e) => e.kind === 'PLAYER_DAMAGE_MULT');
      return { ...base, title: def.name, text: mult && mult.kind === 'PLAYER_DAMAGE_MULT' ? `Army attack +${Math.round((mult.multiplier - 1) * 100)}%.` : def.description };
    }
    case 'shrine':
      return { ...base, title: def.name, text: `After every battle ${Math.round(SHRINE_REVIVE_RATIO * 100)}% of your casualties (rounded down) rise again.` };
    case 'stable': {
      const saved = moveFoodCost(run.army) - moveFoodCost(run.army, city);
      return { ...base, title: def.name, text: saved > 0 ? `${def.description} Saves ${saved} Food a day for your army now.` : def.description };
    }
    default:
      return { ...base, title: def.name, text: def.description };
  }
}

/** Every effect the built buildings and the doctrine grant right now, in scene order, doctrine last. */
export function activeEffects(run: Pick<RunState, 'city' | 'army'>): CityEffect[] {
  const effects: CityEffect[] = [];
  for (const id of SCENE_BUILDINGS) {
    const effect = buildingEffect(run, id);
    if (effect) effects.push(effect);
  }
  const doctrine = run.city.doctrine ? DOCTRINE_DEFINITIONS[run.city.doctrine] : null;
  if (doctrine) effects.push({ id: doctrine.id, icon: DOCTRINE_ICONS[doctrine.id]!, title: doctrine.name, text: doctrine.description });
  return effects;
}

/** Gold and Food change per day from the city, for the "Per day" strip. */
export function dailyChange(run: Pick<RunState, 'city' | 'army'>): { gold: number; food: number } {
  return { gold: run.city.buildings.includes('gold_mine') ? GOLD_MINE_DAILY_GOLD : 0, food: dailyFoodNet(run) };
}
