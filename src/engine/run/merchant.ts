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

const CARD_PRICE = 50;

export function generateMerchantInventory(rng: RngState, ownedRelics: RelicDefinition[]): MerchantInventory {
  const cardOffers = generateCardOptions(rng, 3).map((cardId) => ({ cardId, price: CARD_PRICE }));
  const relicId = pickRelicId(rng, 'merchant', ownedRelics);

  return {
    cardOffers,
    relicOffer: relicId ? { relicId, price: RELIC_PRICE_BY_RARITY[RELIC_DEFINITIONS[relicId]!.rarity] } : null,
  };
}
