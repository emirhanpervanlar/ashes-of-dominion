import { RELIC_DEFINITIONS } from '../data/relics.js';
import type { RngState } from '../rng.js';
import type { RelicDefinition } from '../types.js';
import { pickRelicId, RELIC_PRICE_BY_RARITY } from './relicSources.js';
import { generateCardOptions } from './rewards.js';

export interface MerchantCardOffer {
  cardId: string;
  price: number;
}

export interface MerchantRelicOffer {
  relicId: string;
  price: number;
}

export interface MerchantInventory {
  cardOffers: MerchantCardOffer[];
  relicOffer: MerchantRelicOffer | null;
}

/** Gold price of every card on offer at a merchant. */
export const MERCHANT_CARD_PRICE = 50;

export function generateMerchantInventory(rng: RngState, ownedRelics: RelicDefinition[]): MerchantInventory {
  const cardOffers = generateCardOptions(rng, 3).map((cardId) => ({ cardId, price: MERCHANT_CARD_PRICE }));
  const relicId = pickRelicId(rng, 'merchant', ownedRelics);

  return {
    cardOffers,
    relicOffer: relicId ? { relicId, price: RELIC_PRICE_BY_RARITY[RELIC_DEFINITIONS[relicId]!.rarity] } : null,
  };
}
