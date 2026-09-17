import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack, Position, RelicEffect, UnitId } from '../types.js';

export type BuildingCategory = 'economy' | 'army' | 'hero' | 'special';

export interface CityBuildingDefinition {
  id: string;
  name: string;
  description: string;
  category: BuildingCategory;
  cost: number;
}

export interface CityState {
  level: 1 | 2 | 3;
  buildings: string[];
  garrison: ArmyStack[];
  doctrine: string | null;
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
  gold_mine: {
    id: 'gold_mine',
    name: 'Gold Mine',
    description: 'Immediately grants +100 Gold.',
    category: 'economy',
    cost: 80,
  },
  mage_tower: {
    id: 'mage_tower',
    name: 'Mage Tower',
    description: 'Unlocks Mage recruitment.',
    category: 'army',
    cost: 80,
  },
  stable: {
    id: 'stable',
    name: 'Stable',
    description: 'Unlocks Cavalier recruitment.',
    category: 'army',
    cost: 80,
  },
  training_hall: {
    id: 'training_hall',
    name: 'Training Hall',
    description: 'Hero max AC +1 and max DC +1, immediately.',
    category: 'hero',
    cost: 80,
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    description: 'Hero max Mana +2, immediately.',
    category: 'hero',
    cost: 80,
  },
  shrine: {
    id: 'shrine',
    name: 'Shrine',
    description: 'Heals the field army 20% of max HP every time you visit this city.',
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
  mage: { gold: 14, food: 1 },
  cavalier: { gold: 16, food: 2 },
};

export function createInitialCityState(): CityState {
  return { level: 1, buildings: [], garrison: [], doctrine: null };
}

export function canRecruitUnit(city: CityState, unitId: UnitId): boolean {
  if (unitId === 'mage') return city.buildings.includes('mage_tower');
  if (unitId === 'cavalier') return city.buildings.includes('stable');
  return unitId in RECRUIT_COSTS;
}

export function recruitCost(city: CityState, unitId: UnitId, count: number): { gold: number; food: number } | null {
  const base = RECRUIT_COSTS[unitId];
  if (!base) return null;
  const discount = city.buildings.includes('market') ? 0.85 : 1;
  return {
    gold: Math.round(base.gold * count * discount),
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
 * (caller should route the recruits to the garrison instead).
 */
export function addUnitsToArmy(army: ArmyStack[], unitId: UnitId, count: number): ArmyStack[] | null {
  const existingIdx = army.findIndex((s) => s.unitId === unitId && s.count > 0);
  const hpPerUnit = UNIT_DEFINITIONS[unitId].hpPerUnit;

  if (existingIdx >= 0) {
    const existing = army[existingIdx]!;
    const newCount = existing.count + count;
    const newVeterancy = Math.round((existing.count * existing.veterancy + count * 0) / newCount);
    const updated: ArmyStack = {
      ...existing,
      count: newCount,
      currentHp: existing.currentHp + count * hpPerUnit,
      maxHp: existing.maxHp + count * hpPerUnit,
      startingCount: existing.startingCount + count,
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
    morale: 0,
    veterancy: 0,
    block: 0,
    statuses: [],
    actedThisTurn: false,
  };
  return [...army, newStack];
}

/** Same merge rule as addUnitsToArmy, applied to the garrison instead (no 6-slot limit). */
export function addUnitsToGarrison(garrison: ArmyStack[], unitId: UnitId, count: number): ArmyStack[] {
  const existingIdx = garrison.findIndex((s) => s.unitId === unitId && s.count > 0);
  const hpPerUnit = UNIT_DEFINITIONS[unitId].hpPerUnit;

  if (existingIdx >= 0) {
    const existing = garrison[existingIdx]!;
    const newCount = existing.count + count;
    return garrison.map((s, i) =>
      i === existingIdx
        ? {
            ...s,
            count: newCount,
            currentHp: s.currentHp + count * hpPerUnit,
            maxHp: s.maxHp + count * hpPerUnit,
            startingCount: s.startingCount + count,
          }
        : s
    );
  }

  const maxHp = count * hpPerUnit;
  const newStack: ArmyStack = {
    stackId: `garrison_${unitId}_${garrison.length}`,
    unitId,
    side: 'player',
    position: 1,
    count,
    currentHp: maxHp,
    maxHp,
    startingCount: count,
    morale: 0,
    veterancy: 0,
    block: 0,
    statuses: [],
    actedThisTurn: false,
  };
  return [...garrison, newStack];
}
