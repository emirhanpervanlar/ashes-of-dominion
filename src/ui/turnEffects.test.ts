import { describe, expect, it } from 'vitest';
import { applyPlayerAction, createStack, createVerticalSliceScenario } from '../engine/index.js';
import type { ArmyStack, CardInstance, CombatState } from '../engine/index.js';
import { turnEffects } from './turnEffects.js';

const sword = (position: 1 | 2 | 3 | 4 | 5 | 6, extra: Partial<ArmyStack> = {}): ArmyStack => ({ ...createStack('swordsman', 'player', position, 6), ...extra });

/** Plays `cardId` from a hand holding just that card and returns the resulting army. */
function play(cardId: string, army: ArmyStack[], actingStackId?: string): ArmyStack[] {
  const { state } = createVerticalSliceScenario(1);
  const card: CardInstance = { instanceId: 'c1', cardId };
  const before: CombatState = { ...state, playerArmy: army, hand: [card], hero: { ...state.hero, mana: 5, maxMana: 5 } };
  const result = applyPlayerAction(before, { type: 'PLAY_CARD', instanceId: 'c1', actingStackId });
  expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
  return result.state.playerArmy;
}

describe('turnEffects', () => {
  it('shows nothing for a plain army', () => {
    expect(turnEffects([sword(1), sword(2)])).toEqual([]);
  });

  it('Focus Fire becomes a "Next attack +50%" chip naming the stack', () => {
    const army = play('focus_fire', [sword(1), sword(2)], 'player_swordsman_1');
    const chips = turnEffects(army);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ icon: 'st_strength', text: 'Next attack +50%' });
    expect(chips[0]!.tip.lines?.[0]?.text).toContain('Swordsman');
  });

  it('Hold the Line puts armor on every frontline stack: one chip with the summed amount', () => {
    const army = play('hold_the_line', [sword(1), sword(2), sword(4)]);
    const armored = army.filter((s) => s.statuses.some((st) => st.type === 'armor'));
    expect(armored).toHaveLength(2);
    const total = armored.reduce((sum, s) => sum + s.statuses.filter((st) => st.type === 'armor').reduce((a, st) => a + st.amount, 0), 0);
    const chips = turnEffects(army);
    expect(chips).toHaveLength(1);
    expect(chips[0]!.text).toBe(`Armor +${total}`);
    expect(chips[0]!.tip.body).toContain('2 stacks');
  });

  it('two armor applications on one stack read as one chip with both amounts added', () => {
    const stack = sword(1, { statuses: [{ type: 'armor', amount: 2, duration: 1 }, { type: 'armor', amount: 3, duration: 2 }] });
    const chips = turnEffects([stack]);
    expect(chips.map((c) => c.text)).toEqual(['Armor +5']);
    expect(chips[0]!.tip.lines?.[0]?.text).toBe('Lasts 2 more turns.');
  });

  it('ignores dead stacks and debuffs', () => {
    const dead = sword(1, { count: 0, flags: { nextAttackDamageBonusPercent: 50 } });
    const weak = sword(2, { statuses: [{ type: 'weak', amount: 20, duration: 1 }] });
    expect(turnEffects([dead, weak])).toEqual([]);
  });
});
