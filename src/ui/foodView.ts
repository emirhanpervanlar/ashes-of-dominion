import { moveFoodCost, dailyUpkeep, stackUpkeep } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';

type FoodRun = Pick<RunState, 'army' | 'city'>;

export interface FoodBreakdown {
  /** Exact Food each living stack eats a day (decimals). */
  stacks: { stackId: string; unitId: string; count: number; food: number }[];
  /** Sum of the stack rows, before rounding. */
  subtotal: number;
  /** The whole Food the army eats a day before the Stable (`moveFoodCost` without a city): the "Rounded" line. */
  rounded: number;
  /** What the bar shows: `dailyUpkeep`, i.e. `rounded` after the Stable discount. */
  upkeep: number;
  /** True when the Stable changed the rounded number. */
  stableApplied: boolean;
}

/** The lines of the Food popup, so the rows add up to the same whole number the resource bar shows. */
export function foodBreakdown(run: FoodRun): FoodBreakdown {
  const living = run.army.filter((s) => s.count > 0);
  const stacks = living.map((s) => ({ stackId: s.stackId, unitId: s.unitId, count: s.count, food: stackUpkeep(s) }));
  const rounded = moveFoodCost(living);
  const upkeep = dailyUpkeep(run);
  return {
    stacks,
    subtotal: Math.round(stacks.reduce((sum, s) => sum + s.food, 0) * 100) / 100,
    rounded,
    upkeep,
    stableApplied: upkeep !== rounded,
  };
}
