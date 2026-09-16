import { describe, expect, it } from 'vitest';
import { applyPlayerAction } from '../combat.js';
import { generateEnemyIntents } from '../intents.js';
import { createVerticalSliceScenario } from '../scenario.js';
import type { CombatState } from '../types.js';

function withHand(state: CombatState, cardIds: string[]): CombatState {
  return { ...state, hand: cardIds.map((cardId, i) => ({ instanceId: `test_${cardId}_${i}`, cardId })) };
}

function handCard(state: CombatState, cardId: string) {
  const card = state.hand.find((c) => c.cardId === cardId);
  if (!card) throw new Error(`Card ${cardId} not in hand`);
  return card;
}

function attackEvent(events: ReturnType<typeof applyPlayerAction>['events']) {
  const e = events.find((e) => e.type === 'STACK_ATTACKED');
  if (!e || e.type !== 'STACK_ATTACKED') throw new Error('no STACK_ATTACKED event');
  return e;
}

describe('Morale affects damage (Horde archetype)', () => {
  it('positive morale increases damage, negative morale decreases it', () => {
    const { state } = createVerticalSliceScenario(500);
    const withHandState = withHand(state, ['command_strike']);

    const buffed: CombatState = {
      ...withHandState,
      playerArmy: withHandState.playerArmy.map((s) => (s.stackId === 'player_knight_1' ? { ...s, morale: 5 } : s)),
    };
    const debuffed: CombatState = {
      ...withHandState,
      playerArmy: withHandState.playerArmy.map((s) => (s.stackId === 'player_knight_1' ? { ...s, morale: -5 } : s)),
    };

    const buffedDmg = attackEvent(
      applyPlayerAction(buffed, {
        type: 'PLAY_CARD',
        instanceId: handCard(buffed, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;
    const debuffedDmg = attackEvent(
      applyPlayerAction(debuffed, {
        type: 'PLAY_CARD',
        instanceId: handCard(debuffed, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    expect(buffedDmg).toBeGreaterThan(debuffedDmg);
  });
});

describe('Veterancy affects damage (Immortal Knights archetype)', () => {
  it('higher veterancy deals more damage', () => {
    const { state } = createVerticalSliceScenario(501);
    const withHandState = withHand(state, ['command_strike']);
    const veteran: CombatState = {
      ...withHandState,
      playerArmy: withHandState.playerArmy.map((s) => (s.stackId === 'player_knight_1' ? { ...s, veterancy: 9 } : s)),
    };

    const baseDmg = attackEvent(
      applyPlayerAction(withHandState, {
        type: 'PLAY_CARD',
        instanceId: handCard(withHandState, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;
    const veteranDmg = attackEvent(
      applyPlayerAction(veteran, {
        type: 'PLAY_CARD',
        instanceId: handCard(veteran, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    expect(veteranDmg).toBeGreaterThan(baseDmg);
  });
});

describe('Guard Stance / Taunt (Immortal Knights archetype)', () => {
  it('a taunting stack overrides normal enemy row targeting in freshly-generated intents', () => {
    // Intents are locked in at the start of a turn (AGENT.md §8) — Taunt
    // applied mid-turn protects starting next turn, not retroactively, so
    // this tests generateEnemyIntents directly rather than going through
    // an END_TURN that would still be executing the turn's original intents.
    const { state } = createVerticalSliceScenario(502);
    const taunting: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) =>
        s.stackId === 'player_archer_4' ? { ...s, statuses: [{ type: 'taunt' as const, amount: 1, duration: 2 }] } : s
      ),
    };
    const intents = generateEnemyIntents(taunting);
    const attackIntents = intents.filter((i) => i.kind === 'attack');
    expect(attackIntents.length).toBeGreaterThan(0);
    for (const intent of attackIntents) {
      expect(intent.targetStackId).toBe('player_archer_4');
    }
  });

  it('Guard Stance grants Taunt and Block to the target stack', () => {
    let { state } = createVerticalSliceScenario(503);
    state = withHand(state, ['guard_stance']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'guard_stance').instanceId,
      actingStackId: 'player_swordsman_2',
    });
    const stack = result.state.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!;
    expect(stack.statuses.some((s) => s.type === 'taunt')).toBe(true);
    expect(stack.block).toBe(15);
  });
});

describe('Focus Fire / Vulnerable', () => {
  it('a vulnerable target takes increased damage', () => {
    let { state } = createVerticalSliceScenario(504);
    state = withHand(state, ['focus_fire']);
    const applied = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'focus_fire').instanceId,
      targetStackId: 'enemy_orc_1',
    });

    const strikeBase = withHand(state, ['command_strike']);
    const baseDmg = attackEvent(
      applyPlayerAction(strikeBase, {
        type: 'PLAY_CARD',
        instanceId: handCard(strikeBase, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    const strikeVulnerable = withHand(applied.state, ['command_strike']);
    const vulnDmg = attackEvent(
      applyPlayerAction(strikeVulnerable, {
        type: 'PLAY_CARD',
        instanceId: handCard(strikeVulnerable, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    expect(vulnDmg).toBeGreaterThan(baseDmg);
  });
});

describe('Execute', () => {
  it('deals bonus damage against a target below the HP threshold', () => {
    let { state } = createVerticalSliceScenario(505);
    const woundedTarget: CombatState = {
      ...state,
      enemyArmy: state.enemyArmy.map((s) => (s.stackId === 'enemy_orc_1' ? { ...s, currentHp: Math.round(s.maxHp * 0.2) } : s)),
    };
    const healthyState = withHand(state, ['execute']);
    const woundedState = withHand(woundedTarget, ['execute']);

    const healthyDmg = attackEvent(
      applyPlayerAction(healthyState, {
        type: 'PLAY_CARD',
        instanceId: handCard(healthyState, 'execute').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;
    const woundedDmg = attackEvent(
      applyPlayerAction(woundedState, {
        type: 'PLAY_CARD',
        instanceId: handCard(woundedState, 'execute').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    expect(woundedDmg).toBeGreaterThan(healthyDmg);
  });
});

describe('Necromancy / Skeletons (Undying Legion archetype)', () => {
  it('Grave Crown raises a fraction of player casualties as Skeletons', () => {
    const { state } = createVerticalSliceScenario(506);
    // The vertical-slice army fills all 6 stack slots — free position 6 so raiseSkeletons has somewhere to go.
    const withRelic: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_priest_6' ? { ...s, count: 0, currentHp: 0 } : s)),
      activeRelicEffects: [{ kind: 'NECROMANCY', ratio: 1 }],
    };
    const result = applyPlayerAction(withRelic, { type: 'END_TURN' });
    expect(result.events.some((e) => e.type === 'SKELETONS_RAISED')).toBe(true);
    expect(result.state.playerArmy.some((s) => s.unitId === 'skeleton' && s.count > 0)).toBe(true);
  });

  it('without Necromancy, casualties never raise Skeletons', () => {
    const { state } = createVerticalSliceScenario(507);
    const freeSlot: CombatState = {
      ...state,
      playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_priest_6' ? { ...s, count: 0, currentHp: 0 } : s)),
    };
    const result = applyPlayerAction(freeSlot, { type: 'END_TURN' });
    expect(result.events.some((e) => e.type === 'SKELETONS_RAISED')).toBe(false);
  });

  it('Raise Dead sacrifices part of a stack to summon Skeletons directly', () => {
    let { state } = createVerticalSliceScenario(508);
    state = {
      ...state,
      playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_priest_6' ? { ...s, count: 0, currentHp: 0 } : s)),
    };
    state = withHand(state, ['raise_dead']);
    const swordsmanBefore = state.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!.count;

    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'raise_dead').instanceId,
      actingStackId: 'player_swordsman_2',
    });

    const swordsmanAfter = result.state.playerArmy.find((s) => s.stackId === 'player_swordsman_2')!.count;
    expect(swordsmanAfter).toBeLessThan(swordsmanBefore);
    expect(result.state.playerArmy.some((s) => s.unitId === 'skeleton' && s.count > 0)).toBe(true);
  });
});

describe("Veteran's Resolve and Commander's Presence", () => {
  it("Veteran's Resolve deals more damage than a plain strike (1.3x multiplier)", () => {
    let { state } = createVerticalSliceScenario(509);
    const plain = withHand(state, ['command_strike']);
    const resolve = withHand(state, ['veterans_resolve']);

    const plainDmg = attackEvent(
      applyPlayerAction(plain, {
        type: 'PLAY_CARD',
        instanceId: handCard(plain, 'command_strike').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;
    const resolveDmg = attackEvent(
      applyPlayerAction(resolve, {
        type: 'PLAY_CARD',
        instanceId: handCard(resolve, 'veterans_resolve').instanceId,
        actingStackId: 'player_knight_1',
        targetStackId: 'enemy_orc_1',
      }).events
    ).rawDamage;

    expect(resolveDmg).toBeGreaterThan(plainDmg);
  });

  it("Commander's Presence raises every friendly stack's Morale", () => {
    let { state } = createVerticalSliceScenario(510);
    state = withHand(state, ['commanders_presence']);
    const result = applyPlayerAction(state, {
      type: 'PLAY_CARD',
      instanceId: handCard(state, 'commanders_presence').instanceId,
    });
    const alive = result.state.playerArmy.filter((s) => s.count > 0);
    expect(alive.every((s) => s.morale === 1)).toBe(true);
  });
});
