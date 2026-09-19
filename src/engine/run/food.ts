import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack } from '../types.js';
import type { CityState } from './city.js';

/** AGENT.md §20 — additional per-move food cost by total army size. PROTOTYPE. */
const ARMY_SIZE_FOOD_BRACKETS: ReadonlyArray<{ max: number; additional: number }> = [
  { max: 50, additional: 0 },
  { max: 100, additional: 1 },
  { max: 200, additional: 2 },
  { max: 400, additional: 3 },
  { max: Infinity, additional: 5 },
];

const BASE_MOVE_FOOD_COST = 2;

export function totalArmyCount(army: ArmyStack[]): number {
  return army.reduce((sum, s) => sum + s.count, 0);
}

/** AO-D020: a Stable cuts the movement Food cost by 25% (rounded down, never below 1). */
const STABLE_FOOD_DISCOUNT = 0.25;

export function moveFoodCost(army: ArmyStack[], city?: CityState): number {
  const count = totalArmyCount(army);
  const bracket = ARMY_SIZE_FOOD_BRACKETS.find((b) => count <= b.max);
  const cost = BASE_MOVE_FOOD_COST + (bracket ? bracket.additional : 5);
  if (!city?.buildings.includes('stable')) return cost;
  return Math.max(1, Math.floor(cost * (1 - STABLE_FOOD_DISCOUNT)));
}

export interface StarvationResult {
  army: ArmyStack[];
  unitsLost: number;
}

/** AGENT.md §21 — food at 0 doesn't end the run: Morale -1, Army HP -5%, possible casualties. */
export function applyStarvation(army: ArmyStack[]): StarvationResult {
  let unitsLost = 0;
  const newArmy = army.map((stack) => {
    if (stack.count === 0) return stack;
    const hpPerUnit = UNIT_DEFINITIONS[stack.unitId].hpPerUnit;
    const newHp = Math.max(0, Math.floor(stack.currentHp * 0.95));
    const newCount = newHp > 0 ? Math.ceil(newHp / hpPerUnit) : 0;
    unitsLost += stack.count - newCount;
    return { ...stack, currentHp: newHp, count: newCount, preBattleMaxCount: Math.min(stack.preBattleMaxCount, newCount), morale: stack.morale - 1 };
  });
  return { army: newArmy, unitsLost };
}
