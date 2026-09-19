import { RELIC_DEFINITIONS } from '../data/relics.js';
import { nextInt } from '../rng.js';
import type { RngState } from '../rng.js';
import type { RelicDefinition, RelicRarity } from '../types.js';

/** Merchant price per rarity (AO-D037: price rises with rarity/power). */
export const RELIC_PRICE_BY_RARITY: Record<RelicRarity, number> = { common: 60, rare: 100, epic: 160 };

export type RelicSource = 'merchant' | 'elite' | 'event';

/** Relative drawing weight per rarity. Elites lean toward rare/epic; merchants and events lean common. */
export const RELIC_WEIGHTS: Record<RelicSource, Record<RelicRarity, number>> = {
  merchant: { common: 6, rare: 3, epic: 1 },
  elite: { common: 2, rare: 4, epic: 3 },
  event: { common: 6, rare: 3, epic: 1 },
};

/** Weighted draw from the non-starting pool, never an owned relic; null when everything is owned. Consumes one rng draw. */
export function pickRelicId(rng: RngState, source: RelicSource, owned: readonly RelicDefinition[]): string | null {
  const ownedIds = new Set(owned.map((r) => r.id));
  const candidates = Object.values(RELIC_DEFINITIONS).filter((r) => !ownedIds.has(r.id));
  const weights = RELIC_WEIGHTS[source];
  const total = candidates.reduce((sum, r) => sum + weights[r.rarity], 0);
  if (total === 0) return null;
  let roll = nextInt(rng, total);
  for (const r of candidates) {
    roll -= weights[r.rarity];
    if (roll < 0) return r.id;
  }
  return null;
}
