import { describe, expect, it } from 'vitest';
import { applyPlayerAction } from '../combat.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CombatState } from '../types.js';

/** Force a known hand for deterministic, card-specific test setups. */
function withHand(state: CombatState, cardIds: string[]): CombatState {
  return {
    ...state,
    hand: cardIds.map((cardId, i) => ({ instanceId: `test_${cardId}_${i}`, cardId })),
  };
}

function handCard(state: CombatState, cardId: string) {
  const card = state.hand.find((c) => c.cardId === cardId);
  if (!card) throw new Error(`Card ${cardId} not in hand: ${state.hand.map((c) => c.cardId).join(', ')}`);
  return card;
}

describe('vertical slice scenario setup', () => {
  it('starts with the exact armies from AGENT.md §73', () => {
    const { state } = createVerticalSliceScenario(1);
    expect(state.hero.hp).toBe(100);
    expect(state.hero.ac).toBe(3);
    expect(state.hero.dc).toBe(3);
    expect(state.hero.mana).toBe(5);
    expect(state.playerArmy.map((s) => s.count)).toEqual([18, 80, 8, 30, 10, 15]);
    expect(state.enemyArmy.map((s) => s.count)).toEqual([42, 30, 20, 12, 45, 45]);
    expect(state.hand).toHaveLength(5);
    expect(state.enemyIntents.length).toBeGreaterThan(0);
    expect(state.phase).toBe('player');
  });
});

describe('resource economy (AC/DC)', () => {
  it('rejects a card when its command pool is insufficient, without spending anything', () => {
    let { state } = createVerticalSliceScenario(2);
    state = withHand(state, ['command_strike', 'charge', 'volley']);

    const strikeResult = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'command_strike').instanceId,
      actingStackId: 'player_swordsman_2',
      targetStackId: 'enemy_orc_1',
    });
    expect(strikeResult.state.hero.ac).toBe(2);

    const chargeResult = applyPlayerAction(strikeResult.state, {
      type: 'PLAY_CARD',
      instanceId: handCard(strikeResult.state, 'charge').instanceId,
      actingStackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(chargeResult.state.hero.ac).toBe(1);

    // Volley costs 2 AC but only 1 remains.
    const volleyResult = applyPlayerAction(chargeResult.state, {
      type: 'PLAY_CARD',
      instanceId: handCard(chargeResult.state, 'volley').instanceId,
      targetStackId: 'enemy_orc_1',
    });
    expect(volleyResult.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(volleyResult.state.hero.ac).toBe(1); // unchanged, rejected plays cost nothing
    expect(volleyResult.state.hand.some((c) => c.cardId === 'volley')).toBe(true); // card stays in hand
  });

  it('a stack given no order deals no damage itself but can still be attacked', () => {
    const { state } = createVerticalSliceScenario(3);
    const endResult = applyPlayerAction(state, { type: 'END_TURN' });
    expect(endResult.events.some((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId === 'player_swordsman_2')).toBe(false);
  });
});

describe('attack cards and casualties', () => {
  it('Command: Strike damages the target and reduces its count', () => {
    let { state } = createVerticalSliceScenario(4);
    state = withHand(state, ['command_strike']);
    const orcBefore = state.enemyArmy.find((s) => s.stackId === 'enemy_orc_1')!;

    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'command_strike').instanceId,
      actingStackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });

    const orcAfter = result.state.enemyArmy.find((s) => s.stackId === 'enemy_orc_1')!;
    expect(orcAfter.currentHp).toBeLessThan(orcBefore.currentHp);
    expect(result.events.some((e) => e.type === 'STACK_ATTACKED')).toBe(true);
    expect(result.state.hero.ac).toBe(2);
  });

  it('Volley makes every friendly Archer stack attack the same target', () => {
    let { state } = createVerticalSliceScenario(5);
    state = withHand(state, ['volley']);

    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'volley').instanceId,
      targetStackId: 'enemy_goblin_5',
    });

    const attackEvents = result.events.filter((e) => e.type === 'STACK_ATTACKED');
    expect(attackEvents).toHaveLength(2); // two archer stacks in the scenario
    expect(result.state.hero.ac).toBe(1);
  });

  it('Charge is rejected from a BACK-row stack (MVP: no cavalry unit yet)', () => {
    let { state } = createVerticalSliceScenario(12);
    state = withHand(state, ['charge']);

    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'charge').instanceId,
      actingStackId: 'player_archer_4', // BACK row
      targetStackId: 'enemy_orc_1',
    });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('defense cards', () => {
  it('Shield Wall grants Block to the whole front row', () => {
    let { state } = createVerticalSliceScenario(6);
    state = withHand(state, ['shield_wall']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'shield_wall').instanceId,
    });

    const front = result.state.playerArmy.filter((s) => s.position <= 3);
    for (const stack of front) {
      expect(stack.block).toBe(25);
    }
    expect(result.state.hero.dc).toBe(2);
  });
});

describe('hero-only utility cards', () => {
  it('Tactical Insight draws 2, exhausts, and costs no Mana', () => {
    let { state } = createVerticalSliceScenario(7);
    state = withHand(state, ['tactical_insight']);
    const manaBefore = state.hero.mana;

    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'tactical_insight').instanceId,
    });

    expect(result.state.hero.mana).toBe(manaBefore);
    expect(result.state.exhausted).toHaveLength(1);
    expect(result.state.hand).toHaveLength(2); // insight consumed, 2 drawn
  });

  it('Arcane Focus converts DC into Mana', () => {
    let { state } = createVerticalSliceScenario(8);
    state = withHand(state, ['arcane_focus']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'arcane_focus').instanceId,
    });
    expect(result.state.hero.mana).toBe(7); // 5 starting + 2 from Arcane Focus
    expect(result.state.hero.dc).toBe(2);
  });
});

describe('turn loop', () => {
  it('End Turn resolves enemy intents and starts a fresh player turn', () => {
    const { state } = createVerticalSliceScenario(9);
    const result = applyPlayerAction(state, { type: 'END_TURN' });

    expect(result.state.turnNumber).toBe(2);
    expect(result.state.phase).toBe('player');
    expect(result.state.hero.ac).toBe(3);
    expect(result.state.hero.dc).toBe(3);
    expect(result.state.hand).toHaveLength(5);
    expect(result.events.some((e) => e.type === 'ENEMY_TURN_RESOLVED')).toBe(true);
    expect(result.events.some((e) => e.type === 'INTENTS_GENERATED')).toBe(true);
  });
});

describe('determinism', () => {
  it('identical seed + identical actions produce identical results', () => {
    const run = (seed: number) => {
      let { state } = createVerticalSliceScenario(seed);
      state = withHand(state, ['command_strike']);
      const r1 = applyPlayerAction(state, {
        type: 'PLAY_CARD',
        instanceId: handCard(state, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      });
      const r2 = applyPlayerAction(r1.state, { type: 'END_TURN' });
      return r2.state;
    };

    const a = run(42);
    const b = run(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const c = run(43);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});

describe('long-run stability', () => {
  it('survives many consecutive End Turns without throwing or violating invariants', () => {
    let { state } = createVerticalSliceScenario(99);
    for (let i = 0; i < 300 && state.result === 'ongoing'; i++) {
      const result = applyPlayerAction(state, { type: 'END_TURN' });
      state = result.state;

      expect(state.hand.length).toBeLessThanOrEqual(10);
      expect(state.hero.ac).toBeGreaterThanOrEqual(0);
      expect(state.hero.dc).toBeGreaterThanOrEqual(0);
      expect(state.hero.mana).toBeGreaterThanOrEqual(0);
      for (const s of [...state.playerArmy, ...state.enemyArmy]) {
        expect(s.count).toBeGreaterThanOrEqual(0);
        expect(s.currentHp).toBeGreaterThanOrEqual(0);
      }
    }
    // Player never attacks in this test, so the outcome should resolve to
    // defeat via attrition well before the safety cap.
    expect(state.result).toBe('defeat');
  });
});

describe('battle outcome', () => {
  it('is defeat when the entire player army is destroyed', () => {
    const { state } = createVerticalSliceScenario(10);
    const wiped: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    const result = applyPlayerAction(wiped, { type: 'END_TURN' });
    expect(result.state.result).toBe('defeat');
    expect(result.state.phase).toBe('ended');
  });

  it('is victory when the entire enemy army is destroyed (battle-scoped only, Hero untouched)', () => {
    const { state } = createVerticalSliceScenario(11);
    let wiped: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    wiped = withHand(wiped, ['defend']);

    const result = applyPlayerAction(wiped, {
      type: 'PLAY_CARD',
      instanceId: handCard(wiped, 'defend').instanceId,
      actingStackId: 'player_swordsman_2',
    });
    expect(result.state.result).toBe('victory');
    expect(result.state.phase).toBe('ended');
    expect(result.state.hero.hp).toBe(100); // hero is untouched; run continues at a higher layer
  });
});
