/**
 * Deterministic PRNG (mulberry32). All combat randomness must flow through
 * this module, so a run seed plus the same actions reproduces the same state
 * (docs/SYSTEM_SPEC.md, Architecture).
 */
export interface RngState {
  seed: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

function nextFloat(state: RngState): number {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, maxExclusive). Mutates rng state in place. */
export function nextInt(state: RngState, maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('nextInt: maxExclusive must be > 0');
  return Math.floor(nextFloat(state) * maxExclusive);
}

/** Fisher-Yates shuffle, deterministic, returns a new array. */
export function shuffle<T>(state: RngState, items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(state, i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
