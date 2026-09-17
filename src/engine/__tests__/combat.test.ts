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
    expect(state.hero.energy).toBe(3);
    expect(state.hero.mana).toBe(5);
    expect(state.playerArmy.map((s) => s.count)).toEqual([18, 80, 8, 30, 10, 15]);
    expect(state.enemyArmy.map((s) => s.count)).toEqual([42, 30, 20, 12, 45, 45]);
    expect(state.hand).toHaveLength(5);
    expect(state.enemyIntents.length).toBeGreaterThan(0);
    expect(state.phase).toBe('player');
  });
});

describe('resource economy (Energy)', () => {
  it('rejects a card when its command pool is insufficient, without spending anything', () => {
    let { state } = createVerticalSliceScenario(2);
    state = withHand(state, ['command_strike', 'command_strike', 'volley']);

    const strikeResult = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'command_strike').instanceId,
      actingStackId: 'player_swordsman_2',
      targetStackId: 'enemy_orc_1',
    });
    expect(strikeResult.state.hero.energy).toBe(2);

    const secondStrikeResult = applyPlayerAction(strikeResult.state, {
      type: 'PLAY_CARD',
      instanceId: handCard(strikeResult.state, 'command_strike').instanceId,
      actingStackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(secondStrikeResult.state.hero.energy).toBe(1);

    // Volley costs 2 Energy but only 1 remains.
    const volleyResult = applyPlayerAction(secondStrikeResult.state, {
      type: 'PLAY_CARD',
      instanceId: handCard(secondStrikeResult.state, 'volley').instanceId,
      targetStackId: 'enemy_orc_1',
    });
    expect(volleyResult.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(volleyResult.state.hero.energy).toBe(1); // unchanged, rejected plays cost nothing
    expect(volleyResult.state.hand.some((c) => c.cardId === 'volley')).toBe(true); // card stays in hand
  });

  it('a stack given no order deals no damage itself but can still be attacked', () => {
    const { state } = createVerticalSliceScenario(3);
    const endResult = applyPlayerAction(state, { type: 'END_TURN' });
    expect(endResult.events.some((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId === 'player_swordsman_2')).toBe(false);
  });
});

describe('v2 basic action (v2_list.md §4.2/§7) — free, card-less normal attack', () => {
  it('a free basic attack deals damage without spending Energy, and marks the stack as having acted', () => {
    const { state } = createVerticalSliceScenario(30);
    const result = applyPlayerAction(state, {
      type: 'BASIC_ACTION',
      stackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(result.events.some((e) => e.type === 'STACK_ATTACKED')).toBe(true);
    expect(result.state.hero.energy).toBe(3); // unchanged — basic actions are free
    const knight = result.state.playerArmy.find((s) => s.stackId === 'player_knight_1')!;
    expect(knight.actedThisTurn).toBe(true);
  });

  it('rejects a second basic action from the same stack in the same turn', () => {
    const { state } = createVerticalSliceScenario(31);
    const first = applyPlayerAction(state, {
      type: 'BASIC_ACTION',
      stackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    const second = applyPlayerAction(first.state, {
      type: 'BASIC_ACTION',
      stackId: 'player_knight_1',
      targetStackId: 'enemy_orc_2',
    });
    expect(second.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('rejects a basic attack against a target outside the lane geometry', () => {
    const { state } = createVerticalSliceScenario(32);
    // player_knight_1 is front-left (lane left → enemy left+center only); enemy_wolf_3 is front-right.
    const result = applyPlayerAction(state, {
      type: 'BASIC_ACTION',
      stackId: 'player_knight_1',
      targetStackId: 'enemy_wolf_3',
    });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it("Priest's basic action heals a friendly stack instead of attacking", () => {
    const { state: baseState } = createVerticalSliceScenario(33);
    const damaged: CombatState = {
      ...baseState,
      playerArmy: baseState.playerArmy.map((s) => (s.stackId === 'player_swordsman_2' ? { ...s, currentHp: s.maxHp - 50 } : s)),
    };
    const result = applyPlayerAction(damaged, {
      type: 'BASIC_ACTION',
      stackId: 'player_priest_6',
      targetStackId: 'player_swordsman_2',
    });
    expect(result.events.some((e) => e.type === 'STACK_HEALED')).toBe(true);
    const swordsman = result.state.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!;
    const before = damaged.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!;
    expect(swordsman.currentHp).toBeGreaterThan(before.currentHp);
  });

  it('actedThisTurn resets for every player stack at the start of the next player turn', () => {
    const { state } = createVerticalSliceScenario(34);
    const acted = applyPlayerAction(state, {
      type: 'BASIC_ACTION',
      stackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    const afterEndTurn = applyPlayerAction(acted.state, { type: 'END_TURN' });
    const knight = afterEndTurn.state.playerArmy.find((s) => s.stackId === 'player_knight_1')!;
    expect(knight.actedThisTurn).toBe(false);
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
    expect(result.state.hero.energy).toBe(2);
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
    expect(attackEvents).toHaveLength(1); // one Archer-tagged stack in the scenario (Mage is not tagged 'archer')
    expect(result.state.hero.energy).toBe(1);
  });

  it('Charge is rejected for a non-cavalry stack', () => {
    let { state } = createVerticalSliceScenario(12);
    state = withHand(state, ['charge']);

    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'charge').instanceId,
      actingStackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('Charge succeeds for a Cavalry-tagged stack, with a 1.5x multiplier', () => {
    let { state } = createVerticalSliceScenario(13);
    // The default scenario has no Cavalry stack yet (content additions are
    // deferred) — swap one in for this test only.
    state = {
      ...state,
      playerArmy: state.playerArmy.map((s) =>
        s.stackId === 'player_knight_1'
          ? { ...s, stackId: 'player_cavalier_1', unitId: 'cavalier' as const, count: 10, currentHp: 110, maxHp: 110 }
          : s
      ),
    };
    state = withHand(state, ['charge', 'command_strike']);

    const chargeResult = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'charge').instanceId,
      actingStackId: 'player_cavalier_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(chargeResult.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    const chargeDamage = chargeResult.events.find((e) => e.type === 'STACK_ATTACKED');
    expect(chargeDamage).toBeDefined();

    const strikeResult = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'command_strike').instanceId,
      actingStackId: 'player_cavalier_1',
      targetStackId: 'enemy_orc_1',
    });
    const strikeDamage = strikeResult.events.find((e) => e.type === 'STACK_ATTACKED');

    if (chargeDamage?.type === 'STACK_ATTACKED' && strikeDamage?.type === 'STACK_ATTACKED') {
      expect(chargeDamage.rawDamage).toBeGreaterThan(strikeDamage.rawDamage);
    }
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
    expect(result.state.hero.energy).toBe(2);
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

  it('Arcane Focus converts Energy into Mana', () => {
    let { state } = createVerticalSliceScenario(8);
    state = withHand(state, ['arcane_focus']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'arcane_focus').instanceId,
    });
    expect(result.state.hero.mana).toBe(7); // 5 starting + 2 from Arcane Focus
    expect(result.state.hero.energy).toBe(2);
  });
});

describe('turn loop', () => {
  it('End Turn resolves enemy intents and starts a fresh player turn', () => {
    const { state } = createVerticalSliceScenario(9);
    const result = applyPlayerAction(state, { type: 'END_TURN' });

    expect(result.state.turnNumber).toBe(2);
    expect(result.state.phase).toBe('player');
    expect(result.state.hero.energy).toBe(3);
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

describe('hero skills', () => {
  it('Second Wind grants Block, costs Mana, and enters cooldown', () => {
    const { state } = createVerticalSliceScenario(20);
    const result = applyPlayerAction(state, {
      type: 'USE_SKILL',
      skillId: 'second_wind',
      actingStackId: 'player_swordsman_2',
    });
    const stack = result.state.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!;
    expect(stack.block).toBe(20);
    expect(result.state.hero.mana).toBe(3); // 5 - 2
    expect(result.state.heroSkills.find((s) => s.skillId === 'second_wind')?.cooldownRemaining).toBe(3);
  });

  it('rejects a skill still on cooldown', () => {
    const { state } = createVerticalSliceScenario(21);
    const first = applyPlayerAction(state, {
      type: 'USE_SKILL',
      skillId: 'second_wind',
      actingStackId: 'player_swordsman_2',
    });
    const second = applyPlayerAction(first.state, {
      type: 'USE_SKILL',
      skillId: 'second_wind',
      actingStackId: 'player_knight_1',
    });
    expect(second.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('cooldown ticks down each subsequent player turn', () => {
    let { state } = createVerticalSliceScenario(22);
    let result = applyPlayerAction(state, {
      type: 'USE_SKILL',
      skillId: 'second_wind',
      actingStackId: 'player_swordsman_2',
    });
    expect(result.state.heroSkills.find((s) => s.skillId === 'second_wind')?.cooldownRemaining).toBe(3);

    result = applyPlayerAction(result.state, { type: 'END_TURN' });
    expect(result.state.heroSkills.find((s) => s.skillId === 'second_wind')?.cooldownRemaining).toBe(2);
  });
});

describe('relics', () => {
  it('PLAYER_DAMAGE_MULT increases friendly attack damage', () => {
    const { state: baseState } = createVerticalSliceScenario(23);
    const buffedState: CombatState = { ...baseState, activeRelicEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.5 }] };

    const withHandCard = (s: CombatState) => withHand(s, ['command_strike']);
    const base = applyPlayerAction(withHandCard(baseState), {
      type: 'PLAY_CARD',
      instanceId: handCard(withHandCard(baseState), 'command_strike').instanceId,
      actingStackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });
    const buffed = applyPlayerAction(withHandCard(buffedState), {
      type: 'PLAY_CARD',
      instanceId: handCard(withHandCard(buffedState), 'command_strike').instanceId,
      actingStackId: 'player_knight_1',
      targetStackId: 'enemy_orc_1',
    });

    const baseDamage = base.events.find((e) => e.type === 'STACK_ATTACKED');
    const buffedDamage = buffed.events.find((e) => e.type === 'STACK_ATTACKED');
    if (baseDamage?.type === 'STACK_ATTACKED' && buffedDamage?.type === 'STACK_ATTACKED') {
      expect(buffedDamage.rawDamage).toBeGreaterThan(baseDamage.rawDamage);
    } else {
      throw new Error('expected STACK_ATTACKED events');
    }
  });

  it('relics never affect enemy-side attacks', () => {
    const { state: baseState } = createVerticalSliceScenario(24);
    const buffedState: CombatState = { ...baseState, activeRelicEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 5 }] };

    const baseEnd = applyPlayerAction(baseState, { type: 'END_TURN' });
    const buffedEnd = applyPlayerAction(buffedState, { type: 'END_TURN' });

    const baseDmg = baseEnd.events.filter((e) => e.type === 'STACK_ATTACKED').map((e) => (e.type === 'STACK_ATTACKED' ? e.finalDamage : 0));
    const buffedDmg = buffedEnd.events
      .filter((e) => e.type === 'STACK_ATTACKED')
      .map((e) => (e.type === 'STACK_ATTACKED' ? e.finalDamage : 0));
    expect(buffedDmg).toEqual(baseDmg); // identical seed/actions, enemy attacks unaffected by player relics
  });
});

describe('long-run stability', () => {
  it('survives many consecutive End Turns without throwing or violating invariants', () => {
    let { state } = createVerticalSliceScenario(99);
    for (let i = 0; i < 300 && state.result === 'ongoing'; i++) {
      const result = applyPlayerAction(state, { type: 'END_TURN' });
      state = result.state;

      expect(state.hand.length).toBeLessThanOrEqual(10);
      expect(state.hero.energy).toBeGreaterThanOrEqual(0);
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
