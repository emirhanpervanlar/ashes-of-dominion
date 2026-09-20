import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { ARMOR_MAX, armorReduction, statusAmount } from '../damage.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { ArmyStack, CombatState } from '../types.js';

function battle(): CombatState {
  const { state } = createVerticalSliceScenario(1);
  return {
    ...state,
    hero: { ...state.hero, mana: 20, maxMana: 20 },
    playerArmy: [createStack('swordsman', 'player', 1, 20), createStack('knight', 'player', 2, 10)],
    enemyArmy: [createStack('orc', 'enemy', 1, 10)],
    hand: [],
    deck: [],
    discard: [],
    enemyIntents: [],
  };
}

const play = (state: CombatState, cardId: string, extra: { actingStackId?: string; targetStackId?: string } = {}) =>
  applyPlayerAction({ ...state, hand: [{ instanceId: `${cardId}#${state.log.length}`, cardId }] }, { type: 'PLAY_CARD', instanceId: `${cardId}#${state.log.length}`, ...extra }).state;
const swordsman = (s: CombatState): ArmyStack => s.playerArmy.find((x) => x.stackId === 'player_swordsman_1')!;

describe('AO-045 armor / defense buff stacking', () => {
  it('armor from different cards adds up', () => {
    let s = battle();
    s = play(s, 'hold_the_line');
    const one = armorReduction(swordsman(s));
    s = play(s, 'formation');
    const two = armorReduction(swordsman(s));
    s = play(s, 'hold_formation', { actingStackId: 'player_swordsman_1' });
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
    expect(armorReduction(swordsman(s))).toBeGreaterThan(two);
  });

  it('the same card played again refreshes its duration instead of adding another copy', () => {
    let s = battle();
    s = play(s, 'hold_the_line');
    const once = statusAmount(swordsman(s), 'armor');
    s = play(s, 'hold_the_line');
    expect(statusAmount(swordsman(s), 'armor')).toBe(once);
    expect(swordsman(s).statuses.filter((x) => x.type === 'armor')).toHaveLength(1);
  });

  it('total armor is capped at a sane value', () => {
    const stack = { ...createStack('swordsman', 'player', 1, 5), statuses: [{ type: 'armor' as const, amount: 30, duration: 2 }, { type: 'armor' as const, amount: 30, duration: 2 }] };
    expect(statusAmount(stack, 'armor')).toBe(60);
    expect(armorReduction(stack)).toBe(ARMOR_MAX);
  });
});
