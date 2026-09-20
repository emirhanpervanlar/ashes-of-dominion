import { roundSafe } from '../floatSafe.js';
import type { RunState } from './types.js';

/**
 * AO-D071 Marketplace: Food for Gold, always available in the city (no building slot). A pack costs
 * baseGold x priceGrowth^(packs bought so far this run), rounded, with no decay over time (owner: no slow price recovery).
 */
export const FOOD_MARKET = {
  baseGold: 12,
  priceGrowth: 1.08,
  foodPerPack: 10,
  /** Most packs one BUY_FOOD may buy (keeps the price loop and the UI stepper bounded). */
  maxPacksPerAction: 20,
} as const;

/** Gold price of the pack bought after `purchases` earlier packs. */
export function foodPackPrice(purchases: number): number {
  return roundSafe(FOOD_MARKET.baseGold * FOOD_MARKET.priceGrowth ** purchases);
}

export interface FoodMarketQuote {
  packs: number;
  /** Food the packs give. */
  food: number;
  /** Gold the packs cost, each pack at its own price. */
  gold: number;
  /** Price of the first pack of this purchase. */
  packPrice: number;
  /** Price of the next pack after this purchase. */
  nextPackPrice: number;
  /** Largest pack count (up to the per-action cap) the run's Gold pays for right now. */
  maxAffordable: number;
}

/** What buying `packs` packs would cost right now; the UI reads this and the reducer charges exactly this. */
export function foodMarketQuote(run: Pick<RunState, 'foodPurchases' | 'gold'>, packs = 1): FoodMarketQuote {
  let gold = 0;
  for (let i = 0; i < packs; i++) gold += foodPackPrice(run.foodPurchases + i);
  let maxAffordable = 0;
  for (let spent = 0; maxAffordable < FOOD_MARKET.maxPacksPerAction; ) {
    spent += foodPackPrice(run.foodPurchases + maxAffordable);
    if (spent > run.gold) break;
    maxAffordable += 1;
  }
  return {
    packs,
    food: packs * FOOD_MARKET.foodPerPack,
    gold,
    packPrice: foodPackPrice(run.foodPurchases),
    nextPackPrice: foodPackPrice(run.foodPurchases + packs),
    maxAffordable,
  };
}
