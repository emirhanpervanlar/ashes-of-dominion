import { CARD_DEFINITIONS } from '../engine/index.js';
import { cardView } from './cardView.js';
import { cardVisual } from './cardVisuals.js';
import type { CardPolarity } from './cardVisuals.js';

export interface CardEntry {
  cardId: string;
  upgraded?: boolean;
  /** A pickable copy: the group keeps the first one so a click can act on it. */
  instanceId?: string;
}

/** Identical cards (same id, same upgraded state) collapsed into one line with a count. */
export interface CardGroup {
  key: string;
  cardId: string;
  upgraded: boolean;
  count: number;
  /** The first copy's instance id, when the entries carried one. */
  instanceId?: string;
}

const nameOf = (cardId: string): string => CARD_DEFINITIONS[cardId]?.name ?? cardId;
const costOf = (group: CardGroup): number => cardView(group.cardId, group.upgraded)?.manaCost ?? 0;

/** Groups cards and sorts them by Mana cost, then name, then plain before upgraded. Never in draw order. */
export function groupCards(cards: readonly CardEntry[]): CardGroup[] {
  const groups = new Map<string, CardGroup>();
  for (const card of cards) {
    const upgraded = !!card.upgraded;
    const key = `${card.cardId}${upgraded ? '+' : ''}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { key, cardId: card.cardId, upgraded, count: 1, instanceId: card.instanceId });
  }
  return [...groups.values()].sort(
    (a, b) => costOf(a) - costOf(b) || nameOf(a.cardId).localeCompare(nameOf(b.cardId)) || Number(a.upgraded) - Number(b.upgraded)
  );
}

const POLARITY_ORDER: readonly CardPolarity[] = ['attack', 'defense', 'buff', 'debuff', 'utility'];

export interface DeckTab {
  id: string;
  label: string;
  cards: CardEntry[];
  /** Header while this tab is open ("Draw pile - 12"); falls back to the viewer's heading. */
  heading?: string;
  /** Line under the tabs ("Order hidden"). */
  note?: string;
}

const POLARITY_LABELS: Record<CardPolarity, string> = {
  attack: 'Attack',
  defense: 'Defense',
  buff: 'Buff',
  debuff: 'Debuff',
  utility: 'Utility',
};

/** Tabs for the deck viewer: All, then one per card type that has cards (empty types are hidden). */
export function polarityTabs(cards: readonly CardEntry[]): DeckTab[] {
  const tabs: DeckTab[] = [{ id: 'all', label: 'All', cards: [...cards] }];
  for (const polarity of POLARITY_ORDER) {
    const own = cards.filter((c) => cardVisual(c.cardId).polarity === polarity);
    if (own.length > 0) tabs.push({ id: polarity, label: POLARITY_LABELS[polarity], cards: own });
  }
  return tabs;
}
