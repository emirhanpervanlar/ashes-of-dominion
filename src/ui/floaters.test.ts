import { describe, expect, it } from 'vitest';
import { applyPlayerAction, createStack, createVerticalSliceScenario } from '../engine/index.js';
import type { CombatState } from '../engine/index.js';
import { cuesForStep, cuesFromEvents, enemyPhaseBoard } from './battleCues.js';
import { floatersFromCues, staggerFloaters } from './FloatingText.js';
import type { FloaterQueue } from './FloatingText.js';
import type { Floater } from './FloatingText.js';

function sturdy(state: CombatState, factor = 100): CombatState {
  return {
    ...state,
    playerArmy: state.playerArmy.map((s) => ({ ...s, count: s.count * factor, currentHp: s.currentHp * factor, maxHp: s.maxHp * factor, startingCount: s.startingCount * factor, preBattleMaxCount: s.preBattleMaxCount * factor })),
  };
}

describe('floaters exist for every hit (AO-043 item 14)', () => {
  it('every hit of every enemy step (kills, wounds, blocks, dodges) has a floater on its target', () => {
    let hits = 0;
    for (const formation of ['horde', 'guarded_shaman', 'wolf_pack', 'elite_guard'] as const) {
      for (const factor of [1, 3, 100]) {
        for (let seed = 1; seed <= 6; seed++) {
          const pre = sturdy(createVerticalSliceScenario(seed, 'warlord', formation).state, factor);
          const steps = applyPlayerAction(pre, { type: 'END_TURN' }).enemySteps!;
          for (const step of steps) {
            const floaters = floatersFromCues(cuesForStep(step, enemyPhaseBoard(pre)));
            for (const hit of step.hits) {
              hits++;
              expect(floaters.some((f) => f.stackId === hit.targetStackId), `${formation}/${factor}/${seed}`).toBe(true);
            }
          }
        }
      }
    }
    expect(hits).toBeGreaterThan(20);
  });

  it('player basic attacks and the cards that attack give one floater per hit target, on the enemy side', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { state } = createVerticalSliceScenario(seed);
      const archer = createStack('archer', 'player', 4, 5);
      const before: CombatState = { ...state, playerArmy: [...state.playerArmy, archer] };
      for (const target of before.enemyArmy.filter((s) => s.count > 0)) {
        const result = applyPlayerAction(before, { type: 'BASIC_ACTION', stackId: archer.stackId, targetStackId: target.stackId });
        const attacked = result.events.filter((e) => e.type === 'STACK_ATTACKED');
        const floaters = floatersFromCues(cuesFromEvents(result.events, before, result.state));
        for (const e of attacked) expect(floaters.some((f) => f.stackId === e.targetStackId)).toBe(true);
      }
    }
  });

  it('a kill reads as a big "-N units" floater and a no-kill hit as "Wounded"', () => {
    const cue = (unitsKilled: number, hpDamage: number) => ({ kind: 'attack' as const, attackerStackId: 'a', style: 'melee' as const, hits: [{ targetStackId: 't', unitsKilled, hpDamage, blocked: 0, dodged: false, countAfter: 5 }] });
    expect(floatersFromCues([cue(3, 30)])[0]).toMatchObject({ text: '-3 units', kind: 'damage' });
    expect(floatersFromCues([cue(0, 4)])[0]).toMatchObject({ text: 'Wounded', kind: 'wound' });
    expect(floatersFromCues([cue(0, 0)])[0]).toMatchObject({ text: 'No damage' });
  });
});

describe('staggerFloaters', () => {
  const entry = (stackId: string, delayMs = 0): Omit<Floater, 'id'> => ({ stackId, text: 'x', kind: 'damage', delayMs });

  it('queues floaters on one stack apart so they never overlap', () => {
    const busy = new Map<string, FloaterQueue>();
    const [a] = staggerFloaters([entry('s')], 1000, busy);
    const [b] = staggerFloaters([entry('s')], 1000, busy);
    const [c] = staggerFloaters([entry('s')], 1100, busy);
    expect(a!.delayMs).toBe(0);
    expect(b!.delayMs).toBeGreaterThanOrEqual(400);
    expect(c!.delayMs).toBeGreaterThan(b!.delayMs - 100);
  });

  it('leaves other stacks and later moments alone', () => {
    const busy = new Map<string, FloaterQueue>();
    staggerFloaters([entry('s')], 1000, busy);
    expect(staggerFloaters([entry('other')], 1000, busy)[0]!.delayMs).toBe(0);
    expect(staggerFloaters([entry('s')], 5000, busy)[0]!.delayMs).toBe(0);
  });
});

describe('floater lanes', () => {
  it('floaters that share the screen sit on different heights and the lane resets once they are gone', () => {
    const queue = new Map<string, FloaterQueue>();
    const e: Omit<Floater, 'id'> = { stackId: 's', text: 'x', kind: 'damage', delayMs: 0 };
    const lanes = staggerFloaters([e, e, e, e], 0, queue).map((f) => f.lane);
    expect(lanes).toEqual([0, 1, 2, 0]);
    expect(staggerFloaters([e], 60_000, queue)[0]!.lane).toBe(0);
  });
});
