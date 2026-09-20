import type { UnitId } from '../types.js';
import { BARRACKS_TIERS, GARRISON } from './city.js';
import type { RunState, UnitCount } from './types.js';

/** Free soldiers waiting in the city (AO-D071), collected with COLLECT_GARRISON. */
export type Garrison = Partial<Record<UnitId, number>>;

/** Soldiers added to the garrison every GARRISON.intervalDays: every unlocked Barracks tier contributes its unit type. */
export function weeklyGarrison(run: Pick<RunState, 'city'>): Garrison {
  const weekly: Garrison = {};
  for (const tier of BARRACKS_TIERS.slice(0, run.city.barracksTier)) weekly[tier.unitId] = (weekly[tier.unitId] ?? 0) + tier.weekly;
  return weekly;
}

/** The garrison never holds more than GARRISON.capWeeks weeks of any unit type. */
export function garrisonCap(run: Pick<RunState, 'city'>): Garrison {
  const cap: Garrison = {};
  for (const [unitId, weekly] of Object.entries(weeklyGarrison(run)) as [UnitId, number][]) cap[unitId] = weekly * GARRISON.capWeeks;
  return cap;
}

/** The garrison as a list in Barracks tier order (only types that have soldiers waiting). */
export function garrisonUnits(garrison: Garrison): UnitCount[] {
  const order = [...BARRACKS_TIERS.map((t) => t.unitId), ...(Object.keys(garrison) as UnitId[])];
  return [...new Set(order)].map((unitId) => ({ unitId, count: garrison[unitId] ?? 0 })).filter((u) => u.count > 0);
}

/** True on the days the garrison grows (every GARRISON.intervalDays of the world clock). */
export function isGarrisonDay(day: number): boolean {
  return day % GARRISON.intervalDays === 0;
}

/** Adds one week of soldiers, up to the cap; mutates `run.garrison` and returns what was actually added. */
export function growGarrison(run: RunState): UnitCount[] {
  const cap = garrisonCap(run);
  const added: UnitCount[] = [];
  for (const [unitId, weekly] of Object.entries(weeklyGarrison(run)) as [UnitId, number][]) {
    const have = run.garrison[unitId] ?? 0;
    const grown = Math.min(cap[unitId] ?? 0, have + weekly);
    if (grown > have) {
      run.garrison[unitId] = grown;
      added.push({ unitId, count: grown - have });
    }
  }
  return added;
}
