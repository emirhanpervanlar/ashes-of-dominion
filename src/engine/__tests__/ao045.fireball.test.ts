import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CombatEvent, CombatState, UnitId } from '../types.js';

/** AO-D074: a fresh Mage (Intelligence 18) casts Fireball at a full stack of each early enemy. */
function fireballOn(unitId: UnitId, heroId: 'mage' | 'warlord' = 'mage', upgraded = false) {
  const { state } = createVerticalSliceScenario(1, heroId);
  const setup: CombatState = {
    ...state,
    hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 } },
    enemyArmy: [createStack(unitId, 'enemy', 1, 12), createStack('goblin', 'enemy', 2, 12)],
    hand: [{ instanceId: 'f', cardId: 'fireball', upgraded }],
    enemyIntents: [],
  };
  const result = applyPlayerAction(setup, { type: 'PLAY_CARD', instanceId: 'f', targetStackId: `enemy_${unitId}_1` });
  const hit = (id: string) => result.events.find((e): e is Extract<CombatEvent, { type: 'STACK_ATTACKED' }> => e.type === 'STACK_ATTACKED' && e.targetStackId === id);
  return { primary: hit(`enemy_${unitId}_1`)!, splash: hit('enemy_goblin_2'), after: result.state.enemyArmy };
}

describe('AO-D074 Fireball balance', () => {
  it('a fresh Mage kills 2-4 goblins or wolves and never a whole stack; orcs lose 1-2', () => {
    const goblin = fireballOn('goblin').primary;
    const wolf = fireballOn('wolf').primary;
    const orc = fireballOn('orc').primary;
    expect(goblin.unitsKilled).toBeGreaterThanOrEqual(2);
    expect(goblin.unitsKilled).toBeLessThanOrEqual(4);
    expect(wolf.unitsKilled).toBeGreaterThanOrEqual(2);
    expect(wolf.unitsKilled).toBeLessThanOrEqual(4);
    expect(orc.unitsKilled).toBeGreaterThanOrEqual(1);
    expect(orc.unitsKilled).toBeLessThanOrEqual(2);
    expect(goblin.countAfter).toBeGreaterThan(0);
  });

  it('a Warlord (Intelligence 8) hits clearly softer than the Mage', () => {
    expect(fireballOn('goblin', 'warlord').primary.finalDamage).toBeLessThan(fireballOn('goblin').primary.finalDamage * 0.7);
  });

  it('the splash is 40% of the primary and the "+" version stays within the same order of magnitude', () => {
    const base = fireballOn('goblin');
    expect(base.splash!.finalDamage).toBeGreaterThan(0);
    expect(base.splash!.finalDamage).toBeLessThan(base.primary.finalDamage * 0.5);
    const plus = fireballOn('goblin', 'mage', true);
    expect(plus.primary.finalDamage).toBeGreaterThan(base.primary.finalDamage);
    expect(plus.primary.finalDamage).toBeLessThan(base.primary.finalDamage * 1.5);
  });
});
