import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack } from '../types.js';
import { FARM_TIERS, type CityState } from './city.js';
import type { RunState } from './types.js';

export function totalArmyCount(army: ArmyStack[]): number {
  return army.reduce((sum, s) => sum + s.count, 0);
}

/** AO-D020: a Stable cuts the daily Food upkeep by 25% (rounded down, never below 1). */
const STABLE_FOOD_DISCOUNT = 0.25;

/** AO-D048 / AGENT.md §21: the warning shows when Food would run out within this many days at the current net. */
export const FOOD_WARNING_DAYS = 3;

/** What one stack eats per day: count x the unit's foodPerUnit (AO-D048). Fractional; the daily total is rounded up. */
export function stackUpkeep(stack: Pick<ArmyStack, 'unitId' | 'count'>): number {
  return Math.round(stack.count * UNIT_DEFINITIONS[stack.unitId].foodPerUnit * 10) / 10;
}

/** Whole Food the army eats in one day (also what one map move costs): sum of the stacks, rounded up, Stable -25% (round down, min 1). */
export function moveFoodCost(army: ArmyStack[], city?: CityState): number {
  const raw = Math.ceil(army.reduce((sum, s) => sum + stackUpkeep(s), 0));
  if (raw === 0 || !city?.buildings.includes('stable')) return raw;
  return Math.max(1, Math.floor(raw * (1 - STABLE_FOOD_DISCOUNT)));
}

export function dailyUpkeep(run: Pick<RunState, 'army' | 'city'>): number {
  return moveFoodCost(run.army, run.city);
}

/** Food the Farm produces each day (AO-D048); 0 without one. */
export function dailyProduction(run: Pick<RunState, 'city'>): number {
  const tier = run.city.farmTier;
  return tier > 0 ? FARM_TIERS[tier - 1]!.food : 0;
}

/** Production minus upkeep; negative means the stockpile shrinks every day. */
export function dailyFoodNet(run: Pick<RunState, 'army' | 'city'>): number {
  return dailyProduction(run) - dailyUpkeep(run);
}

/** Full days the army can still march before starving (Infinity when the net is not negative). */
export function foodDaysLeft(run: Pick<RunState, 'army' | 'city' | 'food'>): number {
  const net = dailyFoodNet(run);
  return net >= 0 ? Infinity : Math.floor(run.food / -net);
}

/** True when Food will run out (starvation on a move) within FOOD_WARNING_DAYS days at the current net. */
export function foodWarning(run: Pick<RunState, 'army' | 'city' | 'food'>): boolean {
  return foodDaysLeft(run) < FOOD_WARNING_DAYS;
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
