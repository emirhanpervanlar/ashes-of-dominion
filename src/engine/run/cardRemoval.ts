import type { RunState } from './types.js';

/**
 * Card removal prices and limits: AO-D035 (Reward, Merchant) and AO-D052 (City). Nothing else
 * in the engine hard-codes these numbers.
 */
export const CARD_REMOVAL = {
  /** The deck can never be thinned below this many cards. */
  minDeckSize: 5,
  /** Merchant price = baseGold + stepGold * removals already bought there this run. */
  merchant: { baseGold: 50, stepGold: 25 },
  /** AO-D052: the first City removal of the run is free, then the price is firstPaidGold x growth^(paid removals so far): 50, 100, 200, 400 ... */
  city: { firstPaidGold: 50, growth: 2 },
} as const;

export interface CardRemovalState {
  merchantUses: number;
  /** Removals done at the City this run (the first is free). */
  cityUses: number;
}

export function createCardRemovalState(): CardRemovalState {
  return { merchantUses: 0, cityUses: 0 };
}

/** Gold the City charges for its next removal, given how many were done there already. */
export function cityRemovalPrice(cityUses: number): number {
  return cityUses === 0 ? 0 : CARD_REMOVAL.city.firstPaidGold * CARD_REMOVAL.city.growth ** (cityUses - 1);
}

export type CardRemovalQuote = { allowed: true; gold: number } | { allowed: false; reason: string };

/** What removing a card would cost right now; the UI reads this to show the price / disable the button. */
export function cardRemovalQuote(run: RunState): CardRemovalQuote {
  if (run.masterDeck.length <= CARD_REMOVAL.minDeckSize) {
    return { allowed: false, reason: `Deck cannot go below ${CARD_REMOVAL.minDeckSize} cards.` };
  }
  switch (run.phase) {
    case 'reward':
      return { allowed: true, gold: 0 };
    case 'merchant': {
      const gold = CARD_REMOVAL.merchant.baseGold + CARD_REMOVAL.merchant.stepGold * run.cardRemoval.merchantUses;
      return run.gold >= gold ? { allowed: true, gold } : { allowed: false, reason: 'Not enough Gold.' };
    }
    case 'city': {
      const gold = cityRemovalPrice(run.cardRemoval.cityUses);
      return run.gold >= gold ? { allowed: true, gold } : { allowed: false, reason: 'Not enough Gold.' };
    }
    default:
      return { allowed: false, reason: 'Cards can only be removed at a reward, merchant or city.' };
  }
}
