import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { HERO_DEFINITIONS } from '../data/heroes.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CardEffect, HeroId, StatusType } from '../types.js';

const HEROES: HeroId[] = ['warlord', 'rogue', 'mage'];
const BENEFICIAL_STATUSES: StatusType[] = ['strength', 'armor', 'taunt'];

/** AO-D028: starting decks carry no debuff/status card (Weak, Freeze, Poison, Mark, ...). */
function appliesDebuff(effect: CardEffect): boolean {
  if (effect.kind === 'APPLY_STATUS') return !BENEFICIAL_STATUSES.includes(effect.status);
  if (effect.kind === 'SET_FLAGS' || effect.kind === 'SET_FLAGS_ALL_WITH_TAG') {
    return effect.flags.markedRangedBonusPercent !== undefined || effect.flags.nextAttackAppliesStatus !== undefined;
  }
  return false;
}

describe('AO-014 simple starting decks', () => {
  it.each(HEROES)('%s starts with 10 cards of exactly 4 distinct, known, debuff-free ids', (heroId) => {
    const deck = HERO_DEFINITIONS[heroId].startingDeck;
    expect(deck).toHaveLength(10);
    expect(new Set(deck).size).toBe(4);
    for (const id of deck) {
      const card = CARD_DEFINITIONS[id];
      expect(card, id).toBeDefined();
      expect(card!.effects.some(appliesDebuff), id).toBe(false);
    }
  });

  it.each(HEROES)('%s opening hand can be drawn from the 10-card deck', (heroId) => {
    const { state } = createVerticalSliceScenario(7, heroId);
    expect(state.hand.length).toBeGreaterThan(0);
    expect(state.hand.length + state.deck.length + state.discard.length).toBe(10);
  });
});
