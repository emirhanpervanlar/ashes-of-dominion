import { UNIT_DEFINITIONS } from '../data/units.js';
import { ceilSafe, floorSafe, roundSafe } from '../floatSafe.js';
import { nextInt, type RngState } from '../rng.js';
import type { ArmyStack, UnitId } from '../types.js';
import { FARM_TIERS, STABLE_FOOD_DISCOUNT, type CityState } from './city.js';
import { villageDailyFood } from './villages.js';
import type { RunState, UnitCount } from './types.js';

export function totalArmyCount(army: ArmyStack[]): number {
  return army.reduce((sum, s) => sum + s.count, 0);
}

/** AO-D048: the warning shows when Food would run out within this many days at the current net. */
export const FOOD_WARNING_DAYS = 3;

/** What one stack eats per day: count x the unit's foodPerUnit (AO-D048). Fractional; the daily total is rounded to the nearest whole Food. */
export function stackUpkeep(stack: Pick<ArmyStack, 'unitId' | 'count'>): number {
  return roundSafe(stack.count * UNIT_DEFINITIONS[stack.unitId].foodPerUnit * 100) / 100;
}

/** Whole Food the army eats in one day (also what one map move costs): sum of the stacks, rounded to nearest (at least 1 for a living army), Stable -25% (round down, min 1). */
export function moveFoodCost(army: ArmyStack[], city?: CityState): number {
  const sum = army.reduce((total, s) => total + stackUpkeep(s), 0);
  const raw = totalArmyCount(army) === 0 ? 0 : Math.max(1, roundSafe(sum));
  if (raw === 0 || !city?.buildings.includes('stable')) return raw;
  return Math.max(1, floorSafe(raw * (1 - STABLE_FOOD_DISCOUNT)));
}

export function dailyUpkeep(run: Pick<RunState, 'army' | 'city'>): number {
  return moveFoodCost(run.army, run.city);
}

/** Food produced each day: the Farm (AO-D048, 0 without one) plus every helped village (AO-D072). */
export function dailyProduction(run: Pick<RunState, 'city' | 'villages'>): number {
  const tier = run.city.farmTier;
  return (tier > 0 ? FARM_TIERS[tier - 1]!.food : 0) + villageDailyFood(run);
}

/** Production minus upkeep; negative means the stockpile shrinks every day. */
export function dailyFoodNet(run: Pick<RunState, 'army' | 'city' | 'villages'>): number {
  return dailyProduction(run) - dailyUpkeep(run);
}

/** Full days the army can still march before starving (Infinity when the net is not negative). */
export function foodDaysLeft(run: Pick<RunState, 'army' | 'city' | 'food' | 'villages'>): number {
  const net = dailyFoodNet(run);
  return net >= 0 ? Infinity : Math.floor(run.food / -net);
}

/** True while the army is already starving, or when Food will run out (starvation on a move) within FOOD_WARNING_DAYS days at the current net. */
export function foodWarning(run: Pick<RunState, 'army' | 'city' | 'food' | 'starvationDays' | 'villages'>): boolean {
  return run.starvationDays > 0 || foodDaysLeft(run) < FOOD_WARNING_DAYS;
}

/**
 * AO-D057 starvation model, tuning block. When a day's Food cannot cover the upkeep the stockpile drops to 0 and units die:
 * deaths = ceil(lossRate x units), lossRate = min(CAP, (BASE + PER_SHORTAGE x shortageRatio) x (1 + GROWTH x (consecutiveDays - 1))).
 * Full first-day starvation is BASE + PER_SHORTAGE = 12%, a 10% shortage about 5%.
 */
export const STARVATION = {
  lossBase: 0.04,
  lossPerShortage: 0.08,
  /** Linear escalation per further consecutive starving day. */
  escalationGrowth: 0.5,
  lossCap: 0.6,
  /** Consecutive starving days before battles start with a Morale malus. */
  moraleAfterDays: 3,
  /** Malus (Morale points off 100) on the first affected day, then `moraleStep` more per further day, never above `moraleMax`. */
  moraleBase: 10,
  moraleStep: 8,
  moraleMax: 100,
} as const;

/** Share of the army that dies on a starving day: `shortageRatio` = deficit / daily need in (0, 1]. */
export function starvationLossRate(shortageRatio: number, consecutiveDays: number): number {
  const rate = (STARVATION.lossBase + STARVATION.lossPerShortage * shortageRatio) * (1 + STARVATION.escalationGrowth * (consecutiveDays - 1));
  return Math.min(STARVATION.lossCap, rate);
}

/** Morale points every player stack loses at the start of a battle after `consecutiveDays` starving days in a row (AO-D057). */
export function starvationMoraleMalus(consecutiveDays: number): number {
  if (consecutiveDays < STARVATION.moraleAfterDays) return 0;
  return Math.min(STARVATION.moraleMax, STARVATION.moraleBase + STARVATION.moraleStep * (consecutiveDays - STARVATION.moraleAfterDays));
}

export interface StarvationForecast {
  /** The next day's Food (stockpile + Farm) will not cover the upkeep. */
  willStarve: boolean;
  /** Deficit / daily need of that day, 0 when fed. */
  shortageRatio: number;
  /** Share of the army that would die on that day (a full shortage when it is not starving yet: the worst case). */
  lossShare: number;
  /** Deaths that share means for today's army. */
  expectedDeaths: number;
  /** Consecutive starving days the army has behind it now. */
  consecutiveDays: number;
  /** Morale malus its battles carry now, and the one after one more starving day. */
  moraleMalus: number;
  moraleMalusIfStarves: number;
}

/** What starvation would do if the next day starves; for the UI warning. */
export function starvationForecast(run: Pick<RunState, 'army' | 'city' | 'food' | 'starvationDays' | 'villages'>): StarvationForecast {
  const need = dailyUpkeep(run);
  const deficit = Math.max(0, need - (run.food + dailyProduction(run)));
  const shortageRatio = need > 0 ? deficit / need : 0;
  const lossShare = starvationLossRate(shortageRatio > 0 ? shortageRatio : 1, run.starvationDays + 1);
  const total = totalArmyCount(run.army);
  return {
    willStarve: deficit > 0,
    shortageRatio,
    lossShare,
    expectedDeaths: starvationDeaths(total, lossShare),
    consecutiveDays: run.starvationDays,
    moraleMalus: starvationMoraleMalus(run.starvationDays),
    moraleMalusIfStarves: starvationMoraleMalus(run.starvationDays + 1),
  };
}

function starvationDeaths(total: number, lossRate: number): number {
  return Math.min(Math.max(0, total - 1), Math.max(1, ceilSafe(lossRate * total)));
}

/** A stack after losing `amount` units (HP capped to the smaller pool, the stack's baselines follow the new size). */
export function removeUnits(stack: ArmyStack, amount: number): ArmyStack {
  const count = stack.count - amount;
  const maxHp = count * UNIT_DEFINITIONS[stack.unitId].hpPerUnit;
  return { ...stack, count, currentHp: Math.min(stack.currentHp, maxHp), maxHp, startingCount: count, preBattleMaxCount: count };
}

export interface StarvationResult {
  army: ArmyStack[];
  deaths: UnitCount[];
}

/** One starving day: units die one at a time, each picked uniformly among all living units through the run RNG. The army is never wiped (one unit always survives). */
export function starveArmy(army: ArmyStack[], rng: RngState, shortageRatio: number, consecutiveDays: number): StarvationResult {
  const counts = new Map<string, number>(army.map((s) => [s.stackId, s.count]));
  const remaining = new Map(counts);
  let total = totalArmyCount(army);
  const kills = starvationDeaths(total, starvationLossRate(shortageRatio, consecutiveDays));
  for (let i = 0; i < kills; i++) {
    let pick = nextInt(rng, total);
    for (const stack of army) {
      const left = remaining.get(stack.stackId)!;
      if (pick < left) {
        remaining.set(stack.stackId, left - 1);
        break;
      }
      pick -= left;
    }
    total -= 1;
  }
  const deaths = new Map<UnitId, number>();
  const survivors: ArmyStack[] = [];
  for (const stack of army) {
    const lost = counts.get(stack.stackId)! - remaining.get(stack.stackId)!;
    if (lost > 0) deaths.set(stack.unitId, (deaths.get(stack.unitId) ?? 0) + lost);
    if (remaining.get(stack.stackId)! > 0) survivors.push(lost > 0 ? removeUnits(stack, lost) : stack);
  }
  return { army: survivors, deaths: [...deaths].map(([unitId, count]) => ({ unitId, count })) };
}
