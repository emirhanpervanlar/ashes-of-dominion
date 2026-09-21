import { roundSafe } from '../floatSafe.js';
import { nextInt, type RngState } from '../rng.js';
import type { RunState } from './types.js';

/**
 * AO-D076 mines. Arriving at a mine node captures it: a small one-off find, then a permanent passive Gold income every day
 * (stacks with the Gold Mine building and with every other captured mine). Every number lives here.
 */
export const MINE = {
  /** Gold per day for every captured mine. */
  dailyGold: 2,
  /** One-off find on capture: inclusive ranges (the Economic Doctrine scales them). About a third of the old free resource node (AO-D076). */
  find: { gold: [7, 13], food: [3, 7] },
} as const;

/** Gold the captured mines pay every day. */
export function mineDailyGold(run: Pick<RunState, 'mines'>): number {
  return run.mines * MINE.dailyGold;
}

/** Gold first, then Food, both from the run RNG; `multiplier` is the Economic Doctrine's (1 without it). */
export function rollMineFind(rng: RngState, multiplier: number): { gold: number; food: number } {
  const [goldMin, goldMax] = MINE.find.gold;
  const [foodMin, foodMax] = MINE.find.food;
  const gold = roundSafe((goldMin + nextInt(rng, goldMax - goldMin + 1)) * multiplier);
  const food = roundSafe((foodMin + nextInt(rng, foodMax - foodMin + 1)) * multiplier);
  return { gold, food };
}
