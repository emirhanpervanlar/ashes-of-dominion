import { RELIC_DEFINITIONS } from '../data/relics.js';
import { nextInt, shuffle } from '../rng.js';
import type { RngState } from '../rng.js';
import type { RelicDefinition, RelicRarity } from '../types.js';

/** Merchant price per rarity (AO-D037: price rises with rarity/power). */
export const RELIC_PRICE_BY_RARITY: Record<RelicRarity, number> = { common: 60, rare: 100, epic: 160 };

export type RelicSource = 'merchant' | 'fort' | 'event';

/** Relative drawing weight per rarity. Forts (AO-D077) only draw from the simple pool, so their weights are low and lean common; merchants and events lean common too. */
export const RELIC_WEIGHTS: Record<RelicSource, Record<RelicRarity, number>> = {
  merchant: { common: 6, rare: 3, epic: 1 },
  fort: { common: 4, rare: 1, epic: 1 },
  event: { common: 6, rare: 3, epic: 1 },
};

/**
 * AO-D077: relics without any drawback. Forts grant their relic automatically and boss choices come out of a forced reward,
 * so neither may hand out a downside; drawback relics stay in the optional sources (merchant, events).
 */
export function isSimpleRelic(relic: RelicDefinition): boolean {
  return (relic.drawbacks ?? []).length === 0;
}

function candidatesFor(source: RelicSource | 'boss', owned: readonly RelicDefinition[]): RelicDefinition[] {
  const ownedIds = new Set(owned.map((r) => r.id));
  return Object.values(RELIC_DEFINITIONS).filter((r) => !ownedIds.has(r.id) && (source === 'merchant' || source === 'event' || isSimpleRelic(r)));
}

/** Weighted draw from the non-starting pool (the simple pool for a fort), never an owned relic; null when nothing is left. Consumes one rng draw. */
export function pickRelicId(rng: RngState, source: RelicSource, owned: readonly RelicDefinition[]): string | null {
  const candidates = candidatesFor(source, owned);
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
 * Boss reward (AO-D046, AO-D077): up to 3 unowned drawback-free relics, epic first. The roster has fewer epics than
 * choices, so the remaining slots fall back to rare, then common; nothing owned is ever offered.
 */
export function pickBossRelicChoices(rng: RngState, owned: readonly RelicDefinition[]): string[] {
  const candidates = candidatesFor('boss', owned);
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
