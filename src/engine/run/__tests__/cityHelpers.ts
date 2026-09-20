import type { RunState } from '../types.js';

/** The run with a Barracks at `tier` (AO-D071: nothing can be recruited without one); the building slot is not modelled. */
export function withBarracks(run: RunState, tier: 1 | 2 | 3 | 4 = 4): RunState {
  return { ...run, city: { ...run.city, barracksTier: tier } };
}
