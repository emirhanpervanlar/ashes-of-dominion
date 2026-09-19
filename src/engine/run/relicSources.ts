import { RELIC_DEFINITIONS } from '../data/relics.js';
import { nextInt, shuffle } from '../rng.js';
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

const BOSS_RELIC_CHOICES = 3;
const RARITY_ORDER: RelicRarity[] = ['epic', 'rare', 'common'];

/**
 * Boss reward (AO-D046): up to 3 unowned relics, epic first. The roster has fewer epics than
 * choices, so the remaining slots fall back to rare, then common; nothing owned is ever offered.
 */
export function pickBossRelicChoices(rng: RngState, owned: readonly RelicDefinition[]): string[] {
  const ownedIds = new Set(owned.map((r) => r.id));
  const candidates = Object.values(RELIC_DEFINITIONS).filter((r) => !ownedIds.has(r.id));
  return RARITY_ORDER.flatMap((rarity) => shuffle(rng, candidates.filter((r) => r.rarity === rarity)))
    .slice(0, BOSS_RELIC_CHOICES)
    .map((r) => r.id);
}

/** Picks a rarity by `weights` among rarities that still have an unowned relic, then a relic of it uniformly; null when none is left. */
export function pickRelicByRarity(rng: RngState, weights: Record<RelicRarity, number>, owned: readonly RelicDefinition[]): string | null {
  const ownedIds = new Set(owned.map((r) => r.id));
  const candidates = Object.values(RELIC_DEFINITIONS).filter((r) => !ownedIds.has(r.id));
  const rarities = (Object.keys(weights) as RelicRarity[]).filter((rarity) => weights[rarity] > 0 && candidates.some((r) => r.rarity === rarity));
  const total = rarities.reduce((sum, rarity) => sum + weights[rarity], 0);
  if (total === 0) return null;
  let roll = nextInt(rng, total);
  const rarity = rarities.find((r) => (roll -= weights[r]) < 0)!;
  const pool = candidates.filter((r) => r.rarity === rarity);
  return pool[nextInt(rng, pool.length)]!.id;
}
