import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import { applyPlayerAction, startBattle } from '../../combat.js';
import { CARD_DEFINITIONS } from '../../data/cards.js';
import { createRng, nextInt } from '../../rng.js';
import { createVerticalSliceScenario } from '../../scenario.js';
import type { ArmyStack, CombatState, PlayerAction, StackFlags } from '../../types.js';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunState } from '../types.js';

const LEAKED_FLAGS: StackFlags = {
  cannotAttack: true,
  cannotMove: true,
  untargetable: true,
  dodgeMultiplier: 2,
  incomingDamageReductionPercent: 50,
  nextAttackDamageBonusPercent: 40,
  selfCasualtyPercentAfterAttack: 10,
  counterattackPercent: 50,
  counterattackUsesLeft: 1,
  divineShield: true,
  nextAttackIgnoresArmor: true,
};

function dirty(stack: ArmyStack): ArmyStack {
  return {
    ...stack,
    block: 7,
    actedThisTurn: true,
    flags: { ...LEAKED_FLAGS },
    statuses: [
      { type: 'armor', amount: 3, duration: 2 },
      { type: 'armor', amount: 3, duration: 2 },
      { type: 'strength', amount: 2, duration: 1 },
    ],
  };
}

function expectClean(stack: ArmyStack): void {
  expect(stack.flags).toEqual({});
  expect(stack.statuses).toEqual([]);
  expect(stack.block).toBe(0);
  expect(stack.actedThisTurn).toBe(false);
}

function play(state: CombatState, cardId: string, extra: Partial<Extract<PlayerAction, { type: 'PLAY_CARD' }>>) {
  const withCard: CombatState = { ...state, hand: [{ instanceId: `t_${cardId}`, cardId }] };
  return applyPlayerAction(withCard, { type: 'PLAY_CARD', instanceId: `t_${cardId}`, ...extra });
}

describe('AO-034 B1: Emergency Retreat lasts one turn', () => {
  it('untargetable is cleared when the owner next turn starts', () => {
    const { state } = createVerticalSliceScenario(3);
    const actor = state.playerArmy[0]!;
    const played = play({ ...state, hero: { ...state.hero, mana: 5 } }, 'emergency_retreat', { actingStackId: actor.stackId });
    expect(played.state.playerArmy.find((s) => s.stackId === actor.stackId)!.flags.untargetable).toBe(true);
    const next = applyPlayerAction(played.state, { type: 'END_TURN' }).state;
    expect(next.result).toBe('ongoing');
    expect(next.playerArmy.find((s) => s.stackId === actor.stackId)!.flags.untargetable).toBeUndefined();
  });
});

describe('AO-034 B2: per-battle state does not leak into the run army', () => {
  it('startBattle clears every transient field on the player army', () => {
    const { state } = createVerticalSliceScenario(4);
    const started = startBattle({
      seed: 4,
      rng: createRng(4),
      hero: state.hero,
      playerArmy: state.playerArmy.map(dirty),
      enemyArmy: state.enemyArmy,
      deck: [],
    }).state;
    started.playerArmy.forEach(expectClean);
  });

  it('a won battle hands back a clean army (flags, statuses, block, actedThisTurn), keeping counts and veterancy', () => {
    const run0 = createRun(9, 'warlord', undefined, 'lucky_charm');
    const { state } = createVerticalSliceScenario(9);
    const run: RunState = {
      ...run0,
      phase: 'in_battle',
      combat: {
        ...state,
        playerArmy: state.playerArmy.map((s) => ({ ...dirty(s), veterancy: 2 as const })),
        enemyArmy: state.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
      },
    };
    const won = applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(won.phase).toBe('reward');
    expect(won.army.length).toBe(state.playerArmy.length);
    won.army.forEach((s, i) => {
      expectClean(s);
      expect(s.veterancy).toBe(2);
      expect(s.count).toBe(state.playerArmy[i]!.count);
    });
  });
});

describe('AO-034 B3: Arcane Crystal mid-run', () => {
  function grantCrystal(army: ArmyStack[]): ArmyStack[] {
    const run: RunState = {
      ...createRun(2, 'warlord', undefined, 'lucky_charm'),
      army,
      phase: 'reward',
      pendingReward: { cardOptions: [], upgradeOptions: [], relicOffer: 'arcane_crystal', relicChoices: [] },
    };
    const r = applyRunAction(run, { type: 'CLAIM_RELIC', relicId: 'arcane_crystal' });
    expect(r.run.relics.some((x) => x.id === 'arcane_crystal')).toBe(true);
    return r.run.army;
  }

  it('never empties a living stack', () => {
    const army = grantCrystal([createStack('swordsman', 'player', 1, 1), createStack('archer', 'player', 4, 2)]);
    expect(army.map((s) => s.count)).toEqual([1, 1]);
  });

  it('scales large stacks by flooring and keeps wounds', () => {
    const wounded = { ...createStack('swordsman', 'player', 1, 12), currentHp: 30 };
    const [s] = grantCrystal([wounded]);
    expect(s!.count).toBe(10);
    expect(s!.currentHp).toBe(30);
    expect(s!.maxHp).toBeGreaterThan(30);
  });

  it('an unhurt stack stays at full HP of the new size', () => {
    const [s] = grantCrystal([createStack('swordsman', 'player', 1, 12)]);
    expect(s!.currentHp).toBe(s!.maxHp);
  });
});

describe('AO-034 B4: PLAY_CARD validates target sides', () => {
  it('rejects an ally-stack card aimed at an enemy stack instead of throwing', () => {
    const { state } = createVerticalSliceScenario(1);
    const res = play({ ...state, hero: { ...state.hero, mana: 5 } }, 'last_stand', { actingStackId: state.playerArmy[0]!.stackId, targetStackId: state.enemyArmy[0]!.stackId });
    expect(res.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(res.state.hero.mana).toBe(5);
  });

  it('random legal and illegal actions never throw (all cards, several seeds)', () => {
    const cardIds = Object.keys(CARD_DEFINITIONS);
    const heroes = ['warlord', 'rogue', 'mage'] as const;
    for (const seed of [1, 2, 3, 4, 5]) {
      const rng = createRng(seed * 7919);
      const pick = <T>(a: readonly T[]): T => a[nextInt(rng, a.length)]!;
      let state = createVerticalSliceScenario(seed, pick(heroes)).state;
      for (let i = 0; i < 1500; i++) {
        if (state.result !== 'ongoing') state = createVerticalSliceScenario(seed + i, pick(heroes)).state;
        const ids: Array<string | undefined> = [...state.playerArmy.map((s) => s.stackId), ...state.enemyArmy.map((s) => s.stackId), 'nope', undefined];
        const kind = nextInt(rng, 6);
        let action: PlayerAction;
        if (kind === 0) action = { type: 'END_TURN' };
        else if (kind === 1) action = { type: 'BASIC_ACTION', stackId: pick(ids) ?? 'nope', targetStackId: pick(ids) };
        else {
          const instanceId = `f${i}`;
          state = { ...state, hand: [{ instanceId, cardId: pick(cardIds) }], hero: { ...state.hero, mana: 9 } };
          action = { type: 'PLAY_CARD', instanceId, actingStackId: pick(ids), targetStackId: pick(ids), toPosition: nextInt(rng, 8) as 1 };
        }
        state = applyPlayerAction(state, action).state;
      }
    }
  });
});
