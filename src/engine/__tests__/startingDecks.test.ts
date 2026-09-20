import { describe, expect, it } from 'vitest';
import { cardRequirement } from '../cardRequirements.js';
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

  it.each(HEROES)('%s deck needs no specific unit type (AO-D075) and has a hero attack', (heroId) => {
    const deck = HERO_DEFINITIONS[heroId].startingDeck;
    for (const id of deck) {
      expect(CARD_DEFINITIONS[id]!.source.type, id).not.toBe('unit');
      expect(cardRequirement(id), id).toBeNull();
    }
    expect(deck.some((id) => CARD_DEFINITIONS[id]!.cast === 'hero' && CARD_DEFINITIONS[id]!.effects.some((e) => e.kind === 'ATTACK' || e.kind === 'ATTACK_SPLASH'))).toBe(true);
  });

  it('each hero opens with its own hero attack scaling its own stat', () => {
    expect(HERO_DEFINITIONS.warlord.startingDeck).toContain('command_strike');
    expect(CARD_DEFINITIONS.command_strike!.scalesWith).toBe('strength');
    expect(HERO_DEFINITIONS.rogue.startingDeck).toContain('volley');
    expect(CARD_DEFINITIONS.volley!.scalesWith).toBe('dexterity');
    expect(HERO_DEFINITIONS.mage.startingDeck).toContain('fireball');
    expect(CARD_DEFINITIONS.fireball!.scalesWith).toBe('intelligence');
  });

  it.each(HEROES)('%s opening hand can be drawn from the 10-card deck', (heroId) => {
    const { state } = createVerticalSliceScenario(7, heroId);
    expect(state.hand.length).toBeGreaterThan(0);
    expect(state.hand.length + state.deck.length + state.discard.length).toBe(10);
  });
});
