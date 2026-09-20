import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { applyPlayerAction } from '../combat.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { createVerticalSliceScenario } from '../scenario.js';
import { computeHealAmount } from '../damage.js';
import { generateEnemyIntents } from '../intents.js';
import { computeValidTargets, isBlockedByFrontAlly } from '../targeting.js';
import type { ArmyStack, CombatState, Position } from '../types.js';
import { sturdy } from './helpers.js';

const dead = (s: ArmyStack): ArmyStack => ({ ...s, count: 0, currentHp: 0 });
const positionsFor = (attacker: ArmyStack, enemy: ArmyStack[], own?: ArmyStack[]) =>
  computeValidTargets(attacker, enemy, UNIT_DEFINITIONS[attacker.unitId], own).map((s) => s.position).sort();

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

  // AO-D044 per-attacker fallback (replaces the AO-D038 stalemate-only guard).
  const onlyRightFront = () => [dead(front()[0]!), dead(front()[1]!), front()[2]!];

  it('(a) my only front unit in a corner is hittable by every enemy melee unit whatever its lane', () => {
    const corner = createStack('swordsman', 'player', 1, 5);
    const player = [corner, createStack('archer', 'player', 5, 5)];
    for (const pos of [1, 2, 3] as Position[]) {
      const orc = createStack('orc', 'enemy', pos, 5);
      expect(positionsFor(orc, player, [orc, createStack('orc', 'enemy', 2, 5)])).toEqual([1]);
    }
  });

  it('(a, player side) my melee units all reach the enemy only front unit in the far corner', () => {
    const enemy = [...onlyRightFront(), ...back()];
    const left = createStack('swordsman', 'player', 1, 5);
    const ally = createStack('swordsman', 'player', 2, 5);
    expect(positionsFor(left, enemy, [left, ally])).toEqual([3]);
    expect(positionsFor(ally, enemy, [left, ally])).toEqual([3]);
  });

  it('(b) front row empty, a lone back-row corner unit is hittable by all enemy melee', () => {
    const lone = createStack('goblin', 'player', 4, 5);
    for (const pos of [1, 2, 3] as Position[]) {
      const orc = createStack('orc', 'enemy', pos, 5);
      expect(positionsFor(orc, [lone], [orc])).toEqual([4]);
    }
    const onlyRightBack = [...front().map(dead), dead(back()[0]!), dead(back()[1]!), back()[2]!];
    const swordsman = createStack('swordsman', 'player', 1, 5);
    expect(positionsFor(swordsman, onlyRightBack, [swordsman, createStack('knight', 'player', 2, 2)])).toEqual([6]);
  });

  it('(c) with a same/adjacent-lane target present melee stays in lane and cannot cross to the far lane', () => {
    const left = createStack('swordsman', 'player', 1, 5);
    expect(positionsFor(left, [front()[0]!, front()[2]!], [left])).toEqual([1]);
    const rightOrc = createStack('orc', 'enemy', 3, 5);
    const player = [createStack('swordsman', 'player', 1, 5), createStack('swordsman', 'player', 2, 5)];
    expect(positionsFor(rightOrc, player, [rightOrc])).toEqual([2]);
  });

  it('(d) a lone left-lane unit and a lone right-lane melee unit can hit each other', () => {
    const lonePlayer = createStack('swordsman', 'player', 1, 5);
    const rightOrc = createStack('orc', 'enemy', 3, 5);
    expect(positionsFor(rightOrc, [lonePlayer], [rightOrc])).toEqual([1]);
    expect(positionsFor(lonePlayer, [rightOrc], [lonePlayer])).toEqual([3]);
    // an ally that can act elsewhere no longer suppresses the fallback (AO-D044)
    expect(positionsFor(rightOrc, [lonePlayer], [rightOrc, createStack('orc', 'enemy', 2, 5)])).toEqual([1]);
  });

  it('(e) disciples block and Taunt narrowing are unchanged by the fallback', () => {
    const goblin = createStack('goblin', 'enemy', 4, 5);
    const guard = createStack('orc', 'enemy', 1, 5);
    const target = createStack('swordsman', 'player', 3, 5);
    expect(positionsFor(goblin, [target], [goblin, guard])).toEqual([]);
    expect(positionsFor(goblin, [target], [goblin])).toEqual([3]);
  });

  it('untargetable stacks still hold the front: nothing falls through to the backline', () => {
    const hidden = { ...createStack('swordsman', 'player', 1, 5), flags: { untargetable: true } } as ArmyStack;
    expect(positionsFor(createStack('orc', 'enemy', 3, 5), [hidden, createStack('archer', 'player', 4, 5)])).toEqual([]);
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

describe('AO-D033 back-row melee behind a living friendly stack cannot attack', () => {
  const own = (): ArmyStack[] => [createStack('orc', 'enemy', 1, 5), createStack('orc', 'enemy', 2, 5), createStack('goblin', 'enemy', 4, 5), createStack('goblin', 'enemy', 5, 5), createStack('goblin', 'enemy', 6, 5)];
  const player = (): ArmyStack[] => [createStack('swordsman', 'player', 1, 6), createStack('knight', 'player', 2, 2), createStack('swordsman', 'player', 3, 6)];

  it('has no targets when the front slot of its lane is alive, and does once that slot is empty', () => {
    const army = own();
    const [, , g4, g5, g6] = army;
    expect(isBlockedByFrontAlly(g4!, army)).toBe(true);
    expect(computeValidTargets(g4!, player(), undefined, army)).toEqual([]);
    expect(isBlockedByFrontAlly(g6!, army)).toBe(false); // lane 3 front slot is empty
    expect(computeValidTargets(g6!, player(), undefined, army).length).toBeGreaterThan(0);
    const frontDead = army.map((s) => (s.position === 2 ? dead(s) : s));
    expect(isBlockedByFrontAlly(g5!, frontDead)).toBe(false);
  });

  it('ranged units are unaffected', () => {
    const army = [createStack('swordsman', 'player', 1, 5), createStack('archer', 'player', 4, 5)];
    expect(isBlockedByFrontAlly(army[1]!, army)).toBe(false);
    expect(computeValidTargets(army[1]!, [createStack('orc', 'enemy', 1, 5)], undefined, army)).toHaveLength(1);
  });

  it('the player cannot order a blocked stack to attack', () => {
    const { state } = createVerticalSliceScenario(1);
    const setup: CombatState = {
      ...state,
      playerArmy: [createStack('knight', 'player', 1, 3), createStack('swordsman', 'player', 4, 6)],
      enemyArmy: [createStack('orc', 'enemy', 1, 5)],
    };
    const result = applyPlayerAction(setup, { type: 'BASIC_ACTION', stackId: 'player_swordsman_4', targetStackId: 'enemy_orc_1' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(result.events.some((e) => e.type === 'STACK_ATTACKED')).toBe(false);
  });

  it('a whole blocked enemy back row does not act, the front row still does, and the battle cannot stall', () => {
    const { state } = createVerticalSliceScenario(1);
    const enemy = [1, 2, 3].map((p) => createStack('orc', 'enemy', p as Position, 5)).concat([4, 5, 6].map((p) => createStack('goblin', 'enemy', p as Position, 5)));
    const setup: CombatState = { ...sturdy(state), enemyArmy: enemy };
    const ready = { ...setup, enemyIntents: generateEnemyIntents(setup) };
    const attackers = ready.enemyIntents.filter((i) => i.kind === 'attack').map((i) => i.stackId);
    expect(attackers.sort()).toEqual(['enemy_orc_1', 'enemy_orc_2', 'enemy_orc_3']);
    const result = applyPlayerAction(ready, { type: 'END_TURN' });
    expect(new Set(result.enemySteps!.map((s) => s.actorStackId))).toEqual(new Set(attackers));

    // Front orcs die: the goblins are no longer blocked and act.
    const frontDead: CombatState = { ...setup, enemyArmy: enemy.map((s) => (s.position <= 3 ? dead(s) : s)) };
    expect(generateEnemyIntents(frontDead).filter((i) => i.kind === 'attack')).toHaveLength(3);
  });
});

describe('AO-D034 healing is linear in count', () => {
  it('doubling the healer count doubles the heal', () => {
    const priest = (count: number) => createStack('priest', 'player', 5, count);
    expect(computeHealAmount(priest(100), 4)).toBe(400);
    expect(computeHealAmount(priest(100), 4)).toBe(2 * computeHealAmount(priest(50), 4));
  });
});

describe('AO-D031 balance guard: starting armies survive one passed enemy turn', () => {
  it('Warlord and Rogue starting armies survive a passed turn against the guarded_shaman formation', () => {
    for (const hero of ['warlord', 'rogue'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const { state } = createVerticalSliceScenario(seed, hero, 'guarded_shaman');
        expect(applyPlayerAction(state, { type: 'END_TURN' }).state.result).toBe('ongoing');
      }
    }
  });

  it('the Mage starting army (Archer + Priest) is never blocked from acting by the back-row rule', () => {
    const { state } = createVerticalSliceScenario(3, 'mage');
    const archer = state.playerArmy.find((s) => s.unitId === 'archer')!;
    expect(isBlockedByFrontAlly(archer, state.playerArmy)).toBe(false);
    expect(computeValidTargets(archer, state.enemyArmy, undefined, state.playerArmy).length).toBeGreaterThan(0);
  });
});
