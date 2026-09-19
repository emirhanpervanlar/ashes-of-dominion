import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { createVerticalSliceScenario } from '../scenario.js';
import { computeValidTargets } from '../targeting.js';
import type { ArmyStack, CombatState, Position } from '../types.js';
import { sturdy } from './helpers.js';

const dead = (s: ArmyStack): ArmyStack => ({ ...s, count: 0, currentHp: 0 });
const positionsFor = (attacker: ArmyStack, enemy: ArmyStack[]) =>
  computeValidTargets(attacker, enemy, UNIT_DEFINITIONS[attacker.unitId]).map((s) => s.position).sort();

describe('AO-D021 lane rule for melee', () => {
  const front = (): ArmyStack[] => [1, 2, 3].map((p) => createStack('orc', 'enemy', p as Position, 10));
  const back = (): ArmyStack[] => [4, 5, 6].map((p) => createStack('goblin', 'enemy', p as Position, 10));

  it('front row alive: left reaches left+center, center reaches all, right reaches center+right', () => {
    const enemy = [...front(), ...back()];
    expect(positionsFor(createStack('swordsman', 'player', 1, 5), enemy)).toEqual([1, 2]);
    expect(positionsFor(createStack('swordsman', 'player', 4, 5), enemy)).toEqual([1, 2]);
    expect(positionsFor(createStack('swordsman', 'player', 2, 5), enemy)).toEqual([1, 2, 3]);
    expect(positionsFor(createStack('swordsman', 'player', 3, 5), enemy)).toEqual([2, 3]);
  });

  it('front row dead: melee reaches the backline only in its own/adjacent lanes (left never reaches the right back stack)', () => {
    const enemy = [...front().map(dead), ...back()];
    expect(positionsFor(createStack('swordsman', 'player', 1, 5), enemy)).toEqual([4, 5]);
    expect(positionsFor(createStack('swordsman', 'player', 3, 5), enemy)).toEqual([5, 6]);
  });

  it('a ranged unit ignores the lane rule and reaches every living stack', () => {
    const enemy = [...front(), ...back()];
    expect(positionsFor(createStack('archer', 'player', 4, 5), enemy)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('enemy melee obeys the same rule against the player', () => {
    const player = [createStack('swordsman', 'player', 1, 5), createStack('archer', 'player', 3, 5), createStack('priest', 'player', 6, 5)];
    expect(positionsFor(createStack('orc', 'enemy', 1, 5), player)).toEqual([1]);
    expect(positionsFor(createStack('orc', 'enemy', 3, 5), player)).toEqual([3]);
  });

  it('softlock guard: when the lane rule leaves no target, the nearest lane becomes legal', () => {
    const onlyRightFront = [dead(front()[0]!), dead(front()[1]!), front()[2]!, ...back()];
    expect(positionsFor(createStack('swordsman', 'player', 1, 5), onlyRightFront)).toEqual([3]);

    const onlyRightBack = [...front().map(dead), dead(back()[0]!), dead(back()[1]!), back()[2]!];
    expect(positionsFor(createStack('swordsman', 'player', 1, 5), onlyRightBack)).toEqual([6]);
  });

  it('a planned enemy target that left reach (player moved) is re-picked inside the lane rule', () => {
    const { state } = createVerticalSliceScenario(1);
    const player = [createStack('swordsman', 'player', 3, 500), createStack('knight', 'player', 1, 500)];
    const orc = createStack('orc', 'enemy', 1, 5);
    const setup: CombatState = {
      ...state,
      hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 } },
      playerArmy: player,
      enemyArmy: [orc],
      enemyIntents: [{ stackId: orc.stackId, kind: 'attack', targetStackId: player[0]!.stackId }],
    };
    const result = applyPlayerAction(setup, { type: 'END_TURN' });
    expect(result.enemySteps).toHaveLength(1);
    expect(result.enemySteps![0]!.targetStackId).toBe(player[1]!.stackId);
  });
});

describe('AO-D022 kill counts', () => {
  it('a landed hit reports HP damage and units killed on the log entry', () => {
    const { state } = createVerticalSliceScenario(2);
    const result = applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    const hit = result.state.log.find((e) => e.type === 'STACK_ATTACKED');
    if (!hit || hit.type !== 'STACK_ATTACKED') throw new Error('no hit');
    const orc = result.state.enemyArmy.find((s) => s.stackId === 'enemy_orc_1')!;
    const before = state.enemyArmy.find((s) => s.stackId === 'enemy_orc_1')!;
    expect(hit.finalDamage).toBeGreaterThan(0);
    expect(hit.unitsKilled).toBe(before.count - orc.count);
    expect(hit.countAfter).toBe(orc.count);
  });

  it('a hit that only wounds reports 0 units killed', () => {
    const { state } = createVerticalSliceScenario(2);
    // One swordsman (about 3 damage) cannot fell a 12 HP orc: the stack is merely wounded.
    const weak: CombatState = { ...state, playerArmy: state.playerArmy.map((s) => (s.stackId === 'player_swordsman_1' ? { ...s, count: 1, currentHp: 10 } : s)) };
    const result = applyPlayerAction(weak, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' });
    const hit = result.events.find((e) => e.type === 'STACK_ATTACKED');
    if (!hit || hit.type !== 'STACK_ATTACKED') throw new Error('no hit');
    expect(hit.finalDamage).toBeGreaterThan(0);
    expect(hit.unitsKilled).toBe(0);
  });
});

describe('AO-D023 enemy step list', () => {
  const formations = ['horde', 'guarded_shaman', 'wolf_pack', 'elite_guard'] as const;

  it('replaying the steps reproduces the final army state and every hit adds up', () => {
    for (const formation of formations) {
      for (let seed = 1; seed <= 6; seed++) {
        const start = sturdy(createVerticalSliceScenario(seed, 'warlord', formation).state);
        const result = applyPlayerAction(start, { type: 'END_TURN' });
        const steps = result.enemySteps!;
        expect(steps.length).toBeGreaterThan(0);

        const replay = new Map<string, { count: number; currentHp: number }>();
        for (const s of [...start.playerArmy, ...start.enemyArmy]) replay.set(s.stackId, { count: s.count, currentHp: s.currentHp });
        for (const step of steps) {
          for (const hit of step.hits) {
            const before = replay.get(hit.targetStackId)!;
            expect(hit.countAfter).toBeLessThanOrEqual(before.count);
            expect(before.count - hit.countAfter).toBeGreaterThanOrEqual(hit.unitsKilled);
            if (hit.dodged) expect(hit.hpDamage).toBe(0);
          }
          for (const snap of step.resulting) replay.set(snap.stackId, { count: snap.count, currentHp: snap.currentHp });
        }
        for (const s of [...result.state.playerArmy, ...result.state.enemyArmy]) {
          expect(replay.get(s.stackId)).toEqual({ count: s.count, currentHp: s.currentHp });
        }
      }
    }
  });

  it('a single attack step carries the exact HP delta and kill count', () => {
    const { state } = createVerticalSliceScenario(1);
    const swordsman = createStack('swordsman', 'player', 1, 6);
    const orc = createStack('orc', 'enemy', 1, 3);
    const setup: CombatState = {
      ...state,
      hero: { ...state.hero, stats: { ...state.hero.stats, dexterity: 0 } },
      playerArmy: [swordsman],
      enemyArmy: [orc],
      enemyIntents: [{ stackId: orc.stackId, kind: 'attack', targetStackId: swordsman.stackId }],
    };
    const result = applyPlayerAction(setup, { type: 'END_TURN' });
    const [step] = result.enemySteps!;
    const after = result.state.playerArmy[0]!;
    expect(step!.kind).toBe('attack');
    expect(step!.actorStackId).toBe(orc.stackId);
    expect(step!.hits[0]!.hpDamage).toBeGreaterThan(0);
    expect(step!.hits[0]!.hpDamage).toBe(swordsman.currentHp - after.currentHp);
    expect(step!.hits[0]!.unitsKilled).toBe(swordsman.count - after.count);
    expect(step!.resulting.find((r) => r.stackId === swordsman.stackId)!.count).toBe(after.count);
  });

  it('a shaman buff is its own step with the applied status', () => {
    const start = sturdy(createVerticalSliceScenario(1, 'warlord', 'guarded_shaman').state);
    const steps = applyPlayerAction(start, { type: 'END_TURN' }).enemySteps!;
    const buff = steps.find((s) => s.kind === 'buff');
    expect(buff).toBeDefined();
    expect(buff!.hits).toEqual([]);
    expect(buff!.statuses[0]).toMatchObject({ status: 'strength', amount: 2 });
  });

  it('non-END_TURN actions return no step list', () => {
    const { state } = createVerticalSliceScenario(2);
    expect(applyPlayerAction(state, { type: 'BASIC_ACTION', stackId: 'player_swordsman_1', targetStackId: 'enemy_orc_1' }).enemySteps).toBeUndefined();
  });
});
