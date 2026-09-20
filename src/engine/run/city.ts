import { clearCombatState } from '../army.js';
import { floorSafe, roundSafe } from '../floatSafe.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack, Position, RelicEffect, UnitId } from '../types.js';

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

/** AO-D020 building numbers. */
export const GOLD_MINE_DAILY_GOLD = 10;
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

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
}export const SHRINE_REVIVE_RATIO = 0.1;

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
 * City Doctrines (AGENT.md §27) — one permanent specialization choice.
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
    description: 'Army damage +15%.',
    combatEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.15 }],
  },
  arcane: {
    id: 'arcane',
    name: 'Arcane Doctrine',
    description: 'Caster units (Mage) +20% Attack.',
    combatEffects: [{ kind: 'TAG_DAMAGE_MULT', tag: 'caster', multiplier: 1.2 }],
  },
  necromantic: {
    id: 'necromantic',
    name: 'Necromantic Doctrine',
    description: '25% of your casualties rise again as Skeletons.',
    combatEffects: [{ kind: 'NECROMANCY', ratio: 0.25 }],
  },
  economic: {
    id: 'economic',
    name: 'Economic Doctrine',
    description: 'Resource nodes yield +30% Gold/Food.',
    combatEffects: [],
  },
};

/**
 * AGENT.md §26 — "6 active slots, ~10 possible buildings, player cannot
 * build everything." 7 buildings so the choice of which one to skip is
 * real without the full ~10-building catalog (§70: not locked).
 */
export const BUILDING_DEFINITIONS: Record<string, CityBuildingDefinition> = {
  market: {
    id: 'market',
    name: 'Market',
    description: 'Recruitment costs -15% Gold.',
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
    description: 'Movement Food cost -25%.',
    category: 'army',
    cost: 80,
  },
  training_hall: {
    id: 'training_hall',
    name: 'Training Hall',
    description: 'Hero max Mana +2, immediately.',
    category: 'hero',
    cost: 80,
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    description: 'Army attack +5%.',
    category: 'hero',
    cost: 80,
    combatEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.05 }],
  },
  shrine: {
    id: 'shrine',
    name: 'Shrine',
    description: 'After every battle, 10% of your casualties (rounded down) rise again.',
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
  const discount = city.buildings.includes('market') ? 0.85 : 1;
  return {
    gold: roundSafe(base.gold * count * discount),
    food: base.food * count,
  };
}

function findFreePosition(army: ArmyStack[]): Position | null {
  const taken = new Set(army.filter((s) => s.count > 0).map((s) => s.position));
  for (let p = 1 as Position; p <= 6; p++) {
    if (!taken.has(p)) return p;
  }
  return null;
}

/**
 * Merges into an existing matching stack (blending veterancy by a weighted
 * average — deterministic per AGENT.md §30), or creates a new stack in a
 * free slot. Returns null if there's no matching stack AND no free slot
 * (the field army is capped at 6 stacks).
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

  const position = findFreePosition(army);
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

