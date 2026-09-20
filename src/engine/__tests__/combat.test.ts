import { describe, expect, it } from 'vitest';
import { applyPlayerAction } from '../combat.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CombatState } from '../types.js';
import { sturdy } from './helpers.js';

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

function attackEvent(events: ReturnType<typeof applyPlayerAction>['events']) {
  const e = events.find((e) => e.type === 'STACK_ATTACKED');
  if (!e || e.type !== 'STACK_ATTACKED') throw new Error('no STACK_ATTACKED event');
  return e;
}

describe('vertical slice scenario setup (Warlord vs Guarded Shaman)', () => {
  it('starts with the Warlord Hero, starting army, and a fresh hand', () => {
    const { state } = createVerticalSliceScenario(1);
    expect(state.hero.heroType).toBe('warlord');
    expect(state.hero.hp).toBe(100);
    expect(state.hero.mana).toBeGreaterThan(0);
    expect(state.playerArmy.map((s) => s.count)).toEqual([6, 2]);
    expect(state.enemyArmy.map((s) => s.count)).toEqual([10, 10, 10, 10, 8, 10]);
    expect(state.hand.length).toBe(5); // v3 §10 "Initial draw 5"
    expect(state.enemyIntents.length).toBeGreaterThan(0);
    expect(state.phase).toBe('player');
  });
});

describe('v3 §4 free basic action', () => {
  it('a basic attack deals damage without spending Mana and marks the stack as acted', () => {
    const { state } = createVerticalSliceScenario(2);
    const manaBefore = state.hero.mana;
    const result = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    expect(result.events.some((e) => e.type === 'STACK_ATTACKED')).toBe(true);
    expect(result.state.hero.mana).toBe(manaBefore);
    expect(result.state.playerArmy.find((s) => s.stackId === 'player_swordsman_1')!.actedThisTurn).toBe(true);
  });

  it('rejects a second basic action from the same stack in the same turn', () => {
    const { state } = createVerticalSliceScenario(3);
    const first = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    const second = applyPlayerAction(first.state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_2' });
    expect(second.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('a stack given no order deals no damage itself but can still be attacked', () => {
    const { state } = createVerticalSliceScenario(4);
    const endResult = applyPlayerAction(state, { type: 'END_TURN' });
    expect(endResult.events.some((e) => e.type === 'STACK_ATTACKED' && e.attackerStackId === 'player_swordsman_1')).toBe(false);
  });

  it("Priest's basic action heals a friendly stack instead of attacking", () => {
    const { state: baseState } = createVerticalSliceScenario(5, 'mage');
    // Mage's v3-reduced army: Archer (back, ranged) and Priest (back).
    const damaged: CombatState = {
      ...baseState,
      playerArmy: baseState.playerArmy.map((s) => (s.unitId === 'archer' ? { ...s, currentHp: Math.max(1, s.maxHp - 10) } : s)),
    };
    const archer = damaged.playerArmy.find((s) => s.unitId === 'archer')!;
    const priest = damaged.playerArmy.find((s) => s.unitId === 'priest')!;
    const result = applyPlayerAction(damaged, { type: 'BASIC_ACTION', stackId: priest.stackId, targetStackId: archer.stackId });
    expect(result.events.some((e) => e.type === 'STACK_HEALED')).toBe(true);
    const healed = result.state.playerArmy.find((s) => s.stackId === archer.stackId)!;
    expect(healed.currentHp).toBeGreaterThan(archer.currentHp);
  });
});

describe('v3 §5 targeting geometry gates both basic actions and single-target cards', () => {
  it('rejects a basic attack against a target outside the lane geometry', () => {
    const { state } = createVerticalSliceScenario(6);
    // player_swordsman_1 is front-left (lane left -> enemy left+center only); enemy_orc_3 is front-right.
    const result = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_3' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('rejects a unit-tied card against an out-of-geometry target', () => {
    let { state } = createVerticalSliceScenario(7);
    state = withHand(state, ['charge']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'charge').instanceId,
      actingStackId: 'player_swordsman_1',
      targetStackId: 'enemy_orc_3',
    });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('Mana economy', () => {
  it('rejects a card when Mana is insufficient, spending nothing', () => {
    let { state } = createVerticalSliceScenario(8);
    state = { ...state, hero: { ...state.hero, mana: 0 } };
    state = withHand(state, ['charge']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'charge').instanceId,
      actingStackId: 'player_swordsman_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(result.state.hero.mana).toBe(0);
    expect(result.state.hand.some((c) => c.cardId === 'charge')).toBe(true);
  });

  it('spends Mana equal to the card cost on a successful play', () => {
    let { state } = createVerticalSliceScenario(9);
    state = withHand(state, ['charge']);
    const manaBefore = state.hero.mana;
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'charge').instanceId,
      actingStackId: 'player_swordsman_1',
      targetStackId: 'enemy_orc_1',
    });
    expect(result.state.hero.mana).toBe(manaBefore - 1);
  });
});

describe('v3 §10 "unit card active if source unit count > 0"', () => {
  it('rejects a unit-sourced card once its unit stack is wiped', () => {
    let { state } = createVerticalSliceScenario(10);
    state = {
      ...state,
      playerArmy: state.playerArmy.map((s) => (s.unitId === 'swordsman' ? { ...s, count: 0, currentHp: 0 } : s)),
    };
    state = withHand(state, ['shield_bash']); // a Swordsman-sourced card
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'shield_bash').instanceId,
      actingStackId: 'player_knight_2',
      targetStackId: 'enemy_orc_1',
    });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('turn loop', () => {
  it('End Turn resolves enemy intents, restores Mana, and starts a fresh player turn', () => {
    const state = sturdy(createVerticalSliceScenario(11).state);
    const result = applyPlayerAction(state, { type: 'END_TURN' });

    expect(result.state.turnNumber).toBe(2);
    expect(result.state.phase).toBe('player');
    expect(result.state.hero.mana).toBe(result.state.hero.maxMana);
    expect(result.state.hand.length).toBeGreaterThan(0);
    expect(result.events.some((e) => e.type === 'ENEMY_TURN_RESOLVED')).toBe(true);
    expect(result.events.some((e) => e.type === 'INTENTS_GENERATED')).toBe(true);
  });

  it('actedThisTurn resets for every player stack at the start of the next player turn', () => {
    const state = sturdy(createVerticalSliceScenario(12).state);
    const acted = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    const afterEndTurn = applyPlayerAction(acted.state, { type: 'END_TURN' });
    const swordsman = afterEndTurn.state.playerArmy.find((s) => s.stackId === 'player_swordsman_1')!;
    expect(swordsman.actedThisTurn).toBe(false);
  });
});

describe('determinism', () => {
  it('identical seed + identical actions produce identical results', () => {
    const run = (seed: number) => {
      const { state } = createVerticalSliceScenario(seed);
      const r1 = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
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

describe('relics', () => {
  it('PLAYER_DAMAGE_MULT increases friendly attack damage', () => {
    const { state: baseState } = createVerticalSliceScenario(13);
    const buffedState: CombatState = { ...baseState, activeRelicEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.5 }] };

    const base = applyPlayerAction(baseState, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    const buffed = applyPlayerAction(buffedState, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });

    const baseDamage = attackEvent(base.events).rawDamage;
    const buffedDamage = attackEvent(buffed.events).rawDamage;
    expect(buffedDamage).toBeGreaterThan(baseDamage);
  });

  it('relics never affect enemy-side attacks', () => {
    const { state: baseState } = createVerticalSliceScenario(14);
    const buffedState: CombatState = { ...baseState, activeRelicEffects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 5 }] };

    const baseEnd = applyPlayerAction(baseState, { type: 'END_TURN' });
    const buffedEnd = applyPlayerAction(buffedState, { type: 'END_TURN' });

    const baseDmg = baseEnd.events.filter((e) => e.type === 'STACK_ATTACKED').map((e) => (e.type === 'STACK_ATTACKED' ? e.finalDamage : 0));
    const buffedDmg = buffedEnd.events
      .filter((e) => e.type === 'STACK_ATTACKED')
      .map((e) => (e.type === 'STACK_ATTACKED' ? e.finalDamage : 0));
    expect(buffedDmg).toEqual(baseDmg);
  });
});

describe('long-run stability', () => {
  it('survives many consecutive End Turns without throwing or violating invariants', () => {
    let { state } = createVerticalSliceScenario(99);
    for (let i = 0; i < 300 && state.result === 'ongoing'; i++) {
      const result = applyPlayerAction(state, { type: 'END_TURN' });
      state = result.state;

      expect(state.hand.length).toBeLessThanOrEqual(10);
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
    const { state } = createVerticalSliceScenario(15);
    const wiped: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    const result = applyPlayerAction(wiped, { type: 'END_TURN' });
    expect(result.state.result).toBe('defeat');
    expect(result.state.phase).toBe('ended');
  });

  it('is victory when the entire enemy army is destroyed (battle-scoped only, Hero untouched)', () => {
    const { state } = createVerticalSliceScenario(16);
    const wiped: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    const result = applyPlayerAction(wiped, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true); // no living enemy to target
    const ended = applyPlayerAction(wiped, { type: 'END_TURN' });
    expect(ended.state.result).toBe('victory');
    expect(ended.state.phase).toBe('ended');
    expect(ended.state.hero.hp).toBe(100); // hero is untouched; run continues at a higher layer
  });
});

describe('melee reach vs the backline (AO-D013)', () => {
  it('rejects a backline target while any front stack lives; an out-of-lane melee stack falls back to the only front stack (AO-D044)', () => {
    const { state } = createVerticalSliceScenario(8);
    // Only the right front stack survives: the left-lane Swordsman has none in lane reach and falls back to it.
    const laneEmpty: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => (s.position <= 2 ? { ...s, count: 0, currentHp: 0 } : s)),
    };
    const backline = laneEmpty.enemyArmy.find((s) => s.position === 4)!;
    const result = applyPlayerAction(laneEmpty, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: backline.stackId });
    const rejected = result.events.find((e) => e.type === 'ACTION_REJECTED');
    expect(rejected).toBeDefined();
    const front = laneEmpty.enemyArmy.find((s) => s.position === 3)!;
    const hit = applyPlayerAction(laneEmpty, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: front.stackId });
    expect(hit.events.some((e) => e.type === 'STACK_ATTACKED' && e.targetStackId === front.stackId)).toBe(true);
  });

  it('a melee army can finish a lone backline goblin once the front row is empty (softlock fixed)', () => {
    const { state } = createVerticalSliceScenario(8);
    const goblinOnly: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => (s.position === 5 ? { ...s, count: 1, currentHp: UNIT_DEFINITIONS[s.unitId].hpPerUnit } : { ...s, count: 0, currentHp: 0 })),
      hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 } },
    };
    const goblin = goblinOnly.enemyArmy.find((s) => s.count > 0)!;
    const result = applyPlayerAction(goblinOnly, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: goblin.stackId });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(result.events.some((e) => e.type === 'STACK_ATTACKED' && e.targetStackId === goblin.stackId)).toBe(true);
  });
});
