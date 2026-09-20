import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../engine/index.js';
import { groupCards, polarityTabs } from './deckView.js';

describe('groupCards', () => {
  it('collapses duplicates into counts', () => {
    const groups = groupCards([{ cardId: 'charge' }, { cardId: 'charge' }, { cardId: 'focus_fire' }, { cardId: 'charge' }]);
    expect(groups.find((g) => g.cardId === 'charge')?.count).toBe(3);
    expect(groups.find((g) => g.cardId === 'focus_fire')?.count).toBe(1);
    expect(groups).toHaveLength(2);
  });

  it('keeps an upgraded card apart from its plain copies, plain first', () => {
    const groups = groupCards([{ cardId: 'charge', upgraded: true }, { cardId: 'charge' }, { cardId: 'charge' }]);
    expect(groups.map((g) => [g.upgraded, g.count])).toEqual([
      [false, 2],
      [true, 1],
    ]);
  });

  it('sorts by Mana cost, then name, regardless of input order', () => {
    const ids = Object.keys(CARD_DEFINITIONS);
    const shuffled = [...ids].reverse().map((cardId) => ({ cardId }));
    const groups = groupCards(shuffled);
    for (let i = 1; i < groups.length; i++) {
      const a = CARD_DEFINITIONS[groups[i - 1]!.cardId]!;
      const b = CARD_DEFINITIONS[groups[i]!.cardId]!;
      expect(a.manaCost <= b.manaCost).toBe(true);
      if (a.manaCost === b.manaCost) expect(a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
    }
    expect(groupCards(ids.map((cardId) => ({ cardId })))).toEqual(groups);
  });

  it('returns nothing for an empty pile', () => {
    expect(groupCards([])).toEqual([]);
  });
});

describe('polarityTabs', () => {
  it('starts with All and only lists card types that are present', () => {
    const tabs = polarityTabs([{ cardId: 'charge' }, { cardId: 'hold_formation' }, { cardId: 'charge' }]);
    expect(tabs.map((t) => t.id)).toEqual(['all', 'attack', 'defense']);
    expect(tabs[0]!.cards).toHaveLength(3);
    expect(tabs[1]!.cards).toHaveLength(2);
  });
});
