import { MAX_ARMY_STACKS, clearCombatState, findFreeArmyPosition } from '../army.js';
import { floorSafe, roundSafe } from '../floatSafe.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack, RelicEffect, UnitId } from '../types.js';
import type { RunState } from './types.js';

export type BuildingCategory = 'economy' | 'army' | 'hero' | 'special';

export interface CityBuildingDefinition {
  id: string;
  name: string;
  description: string;
  category: BuildingCategory;
  cost: number;
  /** Army-wide combat modifiers, fed through the same RelicEffect pipeline as relics and doctrines. */
  combatEffects?: RelicEffect[];
}

/** AO-D020 building numbers; the building and doctrine descriptions are built from these, so text and rule cannot drift apart. */
export const GOLD_MINE_DAILY_GOLD = 10;
/** Market: share taken off the Gold price of recruits. */
export const MARKET_RECRUIT_DISCOUNT = 0.15;
/** AO-D020: a Stable cuts the daily Food upkeep by this share (rounded down, never below 1). */
export const STABLE_FOOD_DISCOUNT = 0.25;
/** Training Hall: max Mana (and Mana) granted the moment it is built. */
export const TRAINING_HALL_MAX_MANA = 2;
/** Forge: army-wide damage multiplier. */
export const FORGE_DAMAGE_MULTIPLIER = 1.05;
/** Shrine: share of each stack's casualties (rounded down) that revives after a won battle. */
export const SHRINE_REVIVE_RATIO = 0.1;
/** Doctrines (one per city, permanent). */
export const MILITARY_DAMAGE_MULTIPLIER = 1.15;
export const ARCANE_CASTER_MULTIPLIER = 1.2;
export const NECROMANTIC_RAISE_RATIO = 0.25;
/** Economic Doctrine: multiplier on the Gold and Food a resource node pays. */
export const ECONOMIC_DOCTRINE_MULTIPLIER = 1.3;

/** A fraction (0.15) or a multiplier's surplus (1.05 - 1) as the whole percent the descriptions print. */
const percentOf = (fraction: number): number => roundSafe(fraction * 100);
/** AO-D036: cumulative hero max Mana and Gold cost per Mage Tower tier (index 0 = tier I, which is the build itself). */
export const MAGE_TOWER_TIERS: ReadonlyArray<{ cost: number; maxMana: number }> = [
  { cost: 80, maxMana: 1 },
  { cost: 200, maxMana: 3 },
  { cost: 500, maxMana: 6 },
];

/**
 * AO-D048 / AO-D058 Farm: cumulative Food per day and Gold cost per tier (index 0 = tier I, which is the build itself).
 * Like the Mage Tower it is one building slot at every tier. Balance points (Stable = upkeep -25%):
 * I covers the starting army, III a ~38-unit army, IV a ~60-unit army with a Stable, V a ~60-unit army even without one.
 */
export const FARM_TIERS: ReadonlyArray<{ cost: number; food: number }> = [
  { cost: 60, food: 3 },
  { cost: 140, food: 6 },
  { cost: 320, food: 9 },
  { cost: 560, food: 11 },
  { cost: 900, food: 13 },
];

/** Tier numerals for the tiered buildings (Farm has five tiers, Mage Tower three). */
export const ROMAN: readonly string[] = ['I', 'II', 'III', 'IV', 'V'];

/** Tier text for the Farm card, same shape as the Mage Tower's. `tier` 0 = not built. */
export function farmDescription(tier: number): string {
  const next = FARM_TIERS[tier];
  const current = tier > 0 ? `Tier ${ROMAN[tier - 1]}: +${FARM_TIERS[tier - 1]!.food} Food every day.` : `+${FARM_TIERS[0]!.food} Food every day (tier I).`;
  if (tier === 0) return `${current} Upgradeable to +${FARM_TIERS[FARM_TIERS.length - 1]!.food}.`;
  return next ? `${current} Next: tier ${ROMAN[tier]} (+${next.food} total) for ${next.cost} Gold.` : `${current} Max tier.`;
}

/** Tier text for the building card: current bonus and the next tier's price. `tier` 0 = not built. */
export function mageTowerDescription(tier: number): string {
  const next = MAGE_TOWER_TIERS[tier];
  const current = tier > 0 ? `Tier ${ROMAN[tier - 1]}: hero max Mana +${MAGE_TOWER_TIERS[tier - 1]!.maxMana}.` : `Hero max Mana +${MAGE_TOWER_TIERS[0]!.maxMana} (tier I).`;
  return next && tier > 0 ? `${current} Next: tier ${ROMAN[tier]} (+${next.maxMana} total) for ${next.cost} Gold.` : `${current}${tier === 0 ? ` Upgradeable to +${MAGE_TOWER_TIERS[2]!.maxMana}.` : ' Max tier.'}`;
}

export interface CityState {
  level: 1 | 2 | 3;
  buildings: string[];
  doctrine: string | null;
  /** 0 = no Mage Tower. The tower is one building slot at every tier. */
  mageTowerTier: 0 | 1 | 2 | 3;
  /** 0 = no Farm (AO-D048). One building slot at every tier. */
  farmTier: 0 | 1 | 2 | 3 | 4 | 5;
}

/**
 * City Doctrines (AO-D062, Temple) — one permanent specialization choice.
 * Military/Arcane/Necromantic route through the same RelicEffect pipeline
 * combat already reads for relics (see runEngine.ts's startBattleForRun);
 * Economic is checked directly at the resource-node payout call site
 * since it isn't a combat effect.
 */
export interface CityDoctrineDefinition {
  id: string;
  name: string;
  description: string;
  combatEffects: RelicEffect[];
}

export const DOCTRINE_DEFINITIONS: Record<string, CityDoctrineDefinition> = {
  military: {
    id: 'military',
    name: 'Military Doctrine',
    description: `Army damage +${percentOf(MILITARY_DAMAGE_MULTIPLIER - 1)}%.`,
    combatEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: MILITARY_DAMAGE_MULTIPLIER }],
  },
  arcane: {
    id: 'arcane',
    name: 'Arcane Doctrine',
    description: `Caster units (Mage) +${percentOf(ARCANE_CASTER_MULTIPLIER - 1)}% Attack.`,
    combatEffects: [{ kind: 'TAG_DAMAGE_MULT', tag: 'caster', multiplier: ARCANE_CASTER_MULTIPLIER }],
  },
  necromantic: {
    id: 'necromantic',
    name: 'Necromantic Doctrine',
    description: `${percentOf(NECROMANTIC_RAISE_RATIO)}% of your casualties rise again as Skeletons.`,
    combatEffects: [{ kind: 'NECROMANCY', ratio: NECROMANTIC_RAISE_RATIO }],
  },
  economic: {
    id: 'economic',
    name: 'Economic Doctrine',
    description: `Resource nodes yield +${percentOf(ECONOMIC_DOCTRINE_MULTIPLIER - 1)}% Gold/Food.`,
    combatEffects: [],
  },
};

/**
 * Buildings (AO-D020, AO-D036, AO-D048, AO-D062). LEVEL_SLOTS gives 3/5/6 slots
 * for 8 buildings, so the player cannot build everything and must choose what to skip.
 */
export const BUILDING_DEFINITIONS: Record<string, CityBuildingDefinition> = {
  market: {
    id: 'market',
    name: 'Market',
    description: `Recruitment costs -${percentOf(MARKET_RECRUIT_DISCOUNT)}% Gold.`,
    category: 'economy',
    cost: 80,
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    description: farmDescription(0),
    category: 'economy',
    cost: FARM_TIERS[0]!.cost,
  },
  gold_mine: {
    id: 'gold_mine',
    name: 'Gold Mine',
    description: `+${GOLD_MINE_DAILY_GOLD} Gold every day.`,
    category: 'economy',
    cost: 80,
  },
  mage_tower: {
    id: 'mage_tower',
    name: 'Mage Tower',
    description: mageTowerDescription(0),
    category: 'army',
    cost: MAGE_TOWER_TIERS[0]!.cost,
  },
  stable: {
    id: 'stable',
    name: 'Stable',
    description: `Movement Food cost -${percentOf(STABLE_FOOD_DISCOUNT)}%.`,
    category: 'army',
    cost: 80,
  },
  training_hall: {
    id: 'training_hall',
    name: 'Training Hall',
    description: `Hero max Mana +${TRAINING_HALL_MAX_MANA}, immediately.`,
    category: 'hero',
    cost: 80,
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    description: `Army attack +${percentOf(FORGE_DAMAGE_MULTIPLIER - 1)}%.`,
    category: 'hero',
    cost: 80,
    combatEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: FORGE_DAMAGE_MULTIPLIER }],
  },
  shrine: {
    id: 'shrine',
    name: 'Shrine',
    description: `After every battle, ${percentOf(SHRINE_REVIVE_RATIO)}% of your casualties (rounded down) rise again.`,
    category: 'special',
    cost: 80,
  },
};

export const LEVEL_SLOTS: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 6 };
export const LEVEL_UP_COST: Record<2 | 3, number> = { 2: 150, 3: 300 };

export const RECRUIT_COSTS: Partial<Record<UnitId, { gold: number; food: number }>> = {
  swordsman: { gold: 8, food: 1 },
  archer: { gold: 10, food: 1 },
  knight: { gold: 15, food: 2 },
  priest: { gold: 12, food: 1 },
};

/**
 * AO-D019 + AO-D020, run after every won battle: with a Shrine 10% of each
 * stack's casualties revive (never past its pre-battle count), then every
 * surviving unit is restored to full HP and the new count becomes the
 * baseline for the next battle. Per-battle state (flags, statuses, block, acted marker) is dropped.
 */
export function settleArmyAfterVictory(army: ArmyStack[], city: CityState): { army: ArmyStack[]; revived: number } {
  const hasShrine = city.buildings.includes('shrine');
  let revived = 0;
  const settled = army.map((stack) => {
    const casualties = Math.max(0, stack.preBattleMaxCount - stack.count);
    const back = hasShrine ? floorSafe(casualties * SHRINE_REVIVE_RATIO) : 0;
    const count = stack.count + back;
    if (count === 0) return clearCombatState(stack);
    revived += back;
    const maxHp = count * UNIT_DEFINITIONS[stack.unitId].hpPerUnit;
    return { ...clearCombatState(stack), count, currentHp: maxHp, maxHp, startingCount: count, preBattleMaxCount: count };
  });
  return { army: settled, revived };
}

export function createInitialCityState(): CityState {
  return { level: 1, buildings: [], doctrine: null, mageTowerTier: 0, farmTier: 0 };
}

export function canRecruitUnit(_city: CityState, unitId: UnitId): boolean {
  return unitId in RECRUIT_COSTS;
}

export function recruitCost(city: CityState, unitId: UnitId, count: number): { gold: number; food: number } | null {
  const base = RECRUIT_COSTS[unitId];
  if (!base) return null;
  const discount = city.buildings.includes('market') ? 1 - MARKET_RECRUIT_DISCOUNT : 1;
  return {
    gold: roundSafe(base.gold * count * discount),
    food: base.food * count,
  };
}

/**
 * Why `count` recruits of `unitId` cannot happen right now, or null (AO-D071 investigation: there is no time or per-visit rule; only
 * these gates exist and each names itself). The reducer and the UI read this one function.
 */
export function recruitBlocker(run: Pick<RunState, 'city' | 'gold' | 'food' | 'army'>, unitId: UnitId, count: number): string | null {
  const cost = recruitCost(run.city, unitId, count);
  if (!canRecruitUnit(run.city, unitId) || !cost) return 'That unit cannot be recruited.';
  if (run.gold < cost.gold) return 'Not enough Gold.';
  if (run.food < cost.food) return 'Not enough Food (every recruit costs Food too).';
  if (!addUnitsToArmy(run.army, unitId, count)) return `Field army is full (${MAX_ARMY_STACKS} stacks) and has no matching stack to merge into.`;
  return null;
}

/**
 * Merges into an existing matching stack (AO-D015; fresh recruits are veterancy 0,
 * so the merged stack keeps the lower tier), or creates a new stack in a
 * free slot. Returns null if there's no matching stack AND no free slot
 * (the field army is capped at MAX_ARMY_STACKS).
 */
export function addUnitsToArmy(army: ArmyStack[], unitId: UnitId, count: number): ArmyStack[] | null {
  const existingIdx = army.findIndex((s) => s.unitId === unitId && s.count > 0);
  const hpPerUnit = UNIT_DEFINITIONS[unitId].hpPerUnit;

  if (existingIdx >= 0) {
    const existing = army[existingIdx]!;
    const newCount = existing.count + count;
    // v3 §8 "retain the lower veterancy" when merging — fresh recruits are veterancy 0.
    const newVeterancy = Math.min(existing.veterancy, 0) as 0 | 1 | 2 | 3;
    const updated: ArmyStack = {
      ...existing,
      count: newCount,
      currentHp: existing.currentHp + count * hpPerUnit,
      maxHp: existing.maxHp + count * hpPerUnit,
      startingCount: existing.startingCount + count,
      preBattleMaxCount: existing.preBattleMaxCount + count,
      veterancy: newVeterancy,
    };
    return army.map((s, i) => (i === existingIdx ? updated : s));
  }

  const position = findFreeArmyPosition(army);
  if (!position) return null;

  const maxHp = count * hpPerUnit;
  const newStack: ArmyStack = {
    stackId: `player_${unitId}_${position}`,
    unitId,
    side: 'player',
    position,
    count,
    currentHp: maxHp,
    maxHp,
    startingCount: count,
    preBattleMaxCount: count,
    morale: 100,
    veterancy: 0,
    block: 0,
    statuses: [],
    flags: {},
    actedThisTurn: false,
  };
  return [...army, newStack];
}

