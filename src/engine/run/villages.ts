import type { UnitId } from '../types.js';
import type { RunState } from './types.js';

/**
 * AO-D072 villages. One node type: the player either raids it (Gold and Food at once, Threat rises) or helps it (a small
 * gift, then a permanent village that feeds the army every day and sends militia to the garrison every week).
 * Village upgrades are out of scope. Amounts are indexed by chapter (index 0 = chapter 1); every number lives here.
 */
export const VILLAGE = {
  raid: { gold: [60, 100, 150], food: [15, 25, 35], threat: 1 },
  help: { gold: [15, 15, 15], food: [4, 6, 8] },
  /** Food per day for every helped village (stacks; paid in the daily hook next to the Farm). */
  dailyFood: 1,
  /** Free militia added to the weekly garrison per helped village; only the first `militiaVillageCap` villages send any. */
  militiaUnit: 'swordsman' as UnitId,
  militiaPerVillage: 1,
  militiaVillageCap: 2,
} as const;

export interface VillageOffer {
  raid: { gold: number; food: number; threat: number };
  help: { gold: number; food: number };
}

const byChapter = (table: readonly number[], chapter: number): number => table[Math.min(chapter, table.length) - 1]!;

/** What the village at hand pays in this chapter; stored in `run.pendingVillage` so the UI shows exactly what the reducer pays. */
export function villageOffer(chapter: number): VillageOffer {
  return {
    raid: { gold: byChapter(VILLAGE.raid.gold, chapter), food: byChapter(VILLAGE.raid.food, chapter), threat: VILLAGE.raid.threat },
    help: { gold: byChapter(VILLAGE.help.gold, chapter), food: byChapter(VILLAGE.help.food, chapter) },
  };
}

/** Food the helped villages produce every day. */
export function villageDailyFood(run: Pick<RunState, 'villages'>): number {
  return run.villages * VILLAGE.dailyFood;
}

/** Militia the helped villages add to the garrison every week (capped). */
export function villageMilitiaPerWeek(run: Pick<RunState, 'villages'>): number {
  return Math.min(run.villages, VILLAGE.militiaVillageCap) * VILLAGE.militiaPerVillage;
}
