import type { RunState } from './types.js';

/**
 * AO-D026 card removal. Every number here is a PROPOSAL awaiting the owner's
 * answer to the removal DDR; nothing else in the engine hard-codes them.
 */
export const CARD_REMOVAL = {
  /** The deck can never be thinned below this many cards. */
  minDeckSize: 5,
  /** Merchant price = baseGold + stepGold * removals already bought there this run. */
  merchant: { baseGold: 50, stepGold: 25 },
  /** City removal is free, at most once per this many days. */
  city: { cooldownDays: 7 },
} as const;

export interface CardRemovalState {
  merchantUses: number;
  /** Day of the last City removal, null if never. */
  lastCityDay: number | null;
}

export function createCardRemovalState(): CardRemovalState {
  return { merchantUses: 0, lastCityDay: null };
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
      const last = run.cardRemoval.lastCityDay;
      if (last !== null && run.day - last < CARD_REMOVAL.city.cooldownDays) {
        return { allowed: false, reason: `City removal is available once every ${CARD_REMOVAL.city.cooldownDays} days.` };
      }
      return { allowed: true, gold: 0 };
    }
    default:
      return { allowed: false, reason: 'Cards can only be removed at a reward, merchant or city.' };
  }
}
