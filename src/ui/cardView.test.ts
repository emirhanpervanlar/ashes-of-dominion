import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, CARD_UPGRADES } from '../engine/index.js';
import { cardView } from './cardView.js';

describe('cardView', () => {
  it('shows the base card unchanged', () => {
    expect(cardView('charge')).toEqual({ name: 'Charge', manaCost: 1, description: 'Attack with +50% damage.', upgraded: false });
  });

  it('shows the "+" name and text', () => {
    const view = cardView('charge', true)!;
    expect(view.name).toBe('Charge +');
    expect(view.description).toBe(CARD_UPGRADES.charge!.description);
    expect(view.upgraded).toBe(true);
  });

  it('uses the reduced Mana cost of a cost-upgrade', () => {
    expect(CARD_DEFINITIONS.arrow_rain!.manaCost).toBe(3);
    expect(cardView('arrow_rain', true)!.manaCost).toBe(2);
    expect(cardView('arrow_rain')!.manaCost).toBe(3);
  });

  it('resolves every card in both forms, and an unknown id to nothing', () => {
    for (const id of Object.keys(CARD_DEFINITIONS)) {
      expect(cardView(id)).toBeDefined();
      expect(cardView(id, true)!.upgraded).toBe(id in CARD_UPGRADES);
    }
    expect(cardView('nope', true)).toBeUndefined();
  });
});
