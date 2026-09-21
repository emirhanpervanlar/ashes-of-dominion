import type { RunState } from '../types.js';

/** The run with its fixed Barracks (AO-D080) at `tier`; defaults to the top tier so every unit type is recruitable. */
export function withBarracks(run: RunState, tier: 1 | 2 | 3 | 4 = 4): RunState {
  return { ...run, city: { ...run.city, barracksTier: tier } };
}
