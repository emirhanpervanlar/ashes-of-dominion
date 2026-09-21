import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../engine/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardView } from './cardView.js';

const pct = (multiplier: number): string => `${Math.round(multiplier * 100)}%`;

describe('card texts follow the engine data', () => {
  it('has a text for every card and none for a card that does not exist', () => {
    expect(Object.keys(CARD_DESCRIPTIONS).sort()).toEqual(Object.keys(CARD_DEFINITIONS).sort());
  });

  it('never says "in reach" (AO-D075)', () => {
    for (const id of Object.keys(CARD_DEFINITIONS)) {
      expect(cardView(id)!.description.toLowerCase(), id).not.toContain('in reach');
      expect(cardView(id, true)!.description.toLowerCase(), id).not.toContain('in reach');
    }
  });

  it('states the numbers of every damage effect it is made of', () => {
    for (const card of Object.values(CARD_DEFINITIONS)) {
      const text = CARD_DESCRIPTIONS[card.id]!;
      for (const effect of card.effects) {
        if (effect.kind === 'ATTACK_SPLASH') expect([pct(effect.primaryMultiplier), pct(effect.secondaryMultiplier)].filter((p) => !text.includes(p)), card.id).toEqual([]);
        if (effect.kind === 'CHAIN_DAMAGE') expect([pct(effect.primaryMultiplier), pct(effect.secondaryMultiplier), String(effect.maxSecondaryTargets)].filter((p) => !text.includes(p)), card.id).toEqual([]);
        if (effect.kind === 'DAMAGE_UP_TO_N_ENEMIES') expect([pct(effect.multiplier), String(effect.maxTargets)].filter((p) => !text.includes(p)), card.id).toEqual([]);
        if (effect.kind === 'DAMAGE_ALL_ENEMIES') expect([pct(effect.multiplier), pct(effect.multiplier + effect.primaryBonusMultiplier)].filter((p) => !text.includes(p)), card.id).toEqual([]);
      }
    }
  });

  it('Fireball states its splash', () => {
    expect(CARD_DESCRIPTIONS.fireball).toContain('left and right');
  });

  it('a hero-cast card carries the stat it scales with; other cards do not', () => {
    expect(cardView('fireball')!.scalesWith).toBe('intelligence');
    expect(cardView('volley')!.scalesWith).toBe('dexterity');
    expect(cardView('command_strike', true)!.scalesWith).toBe('strength');
    expect(cardView('charge')!.scalesWith).toBeUndefined();
  });

  it('hero-cast cards show their real Mana cost, upgraded or not', () => {
    for (const id of ['command_strike', 'volley', 'fireball', 'frost', 'chain_lightning', 'arcane_storm', 'arrow_rain']) {
      expect(cardView(id)!.manaCost, id).toBe(CARD_DEFINITIONS[id]!.manaCost);
    }
    expect(cardView('arcane_storm', true)!.manaCost).toBe(3);
  });
});
