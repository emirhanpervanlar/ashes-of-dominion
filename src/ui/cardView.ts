import { CARD_UPGRADES, resolveCard } from '../engine/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';

/** A card as the player sees and pays for it: the base card, or its "+" version (AO-D060). */
export interface CardView {
  name: string;
  manaCost: number;
  description: string;
  /** True only when the card really has a "+" version applied. */
  upgraded: boolean;
}

/** Name ("Charge +"), effective Mana cost and rules text of a card, upgraded or not. Undefined for an unknown id. */
export function cardView(cardId: string, upgraded = false): CardView | undefined {
  const card = resolveCard(cardId, upgraded);
  if (!card) return undefined;
  const upgrade = upgraded ? CARD_UPGRADES[cardId] : undefined;
  return {
    name: card.name,
    manaCost: card.manaCost,
    description: upgrade?.description ?? CARD_DESCRIPTIONS[cardId] ?? cardId,
    upgraded: !!upgrade,
  };
}
