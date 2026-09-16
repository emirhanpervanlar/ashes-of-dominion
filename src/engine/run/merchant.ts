import { RELIC_DEFINITIONS } from '../data/relics.js';
import { shuffle } from '../rng.js';
import type { RngState } from '../rng.js';
import type { RelicDefinition } from '../types.js';
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
const RELIC_PRICE = 120;

export function generateMerchantInventory(rng: RngState, ownedRelics: RelicDefinition[]): MerchantInventory {
  const cardOffers = generateCardOptions(rng, 3).map((cardId) => ({ cardId, price: CARD_PRICE }));

  const ownedIds = new Set(ownedRelics.map((r) => r.id));
  const availableRelics = Object.keys(RELIC_DEFINITIONS).filter((id) => !ownedIds.has(id));
  const relicId = shuffle(rng, availableRelics)[0];

  return {
    cardOffers,
    relicOffer: relicId ? { relicId, price: RELIC_PRICE } : null,
  };
}
