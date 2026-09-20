import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import { UNIT_DEFINITIONS } from '../../data/units.js';
import type { ArmyStack, CombatState } from '../../types.js';
import { NECROMANTIC_RAISE_RATIO, RECRUIT_COSTS, raiseSkeletons } from '../city.js';
import { moveFoodCost } from '../food.js';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunEvent, RunState } from '../types.js';

function fighting(doctrine: string | null, army?: ArmyStack[]): RunState {
  const base = createRun(5, 'warlord');
  const run: RunState = { ...base, army: army ?? base.army, city: { ...base.city, doctrine } };
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n));
  return applyRunAction({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

/** Wins the battle after `lost` units of the first stack fell (the enemy is wiped, then End Turn). */
function winWithLosses(run: RunState, lost: number): { run: RunState; events: RunEvent[] } {
  const combat = run.combat!;
  const first = combat.playerArmy[0]!;
  const remaining = first.count - lost;
  const hp = UNIT_DEFINITIONS[first.unitId].hpPerUnit;
  const wounded: CombatState = {
    ...combat,
    playerArmy: combat.playerArmy.map((s) => (s.stackId === first.stackId ? { ...s, count: remaining, currentHp: remaining * hp } : s)),
    enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
  };
  const res = applyRunAction({ ...run, combat: wounded }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
  return { run: res.run, events: res.events };
}

const skeletons = (run: RunState) => run.army.filter((s) => s.unitId === 'skeleton');
const raisedEvent = (events: RunEvent[]) => events.find((e) => e.type === 'UNITS_RAISED');

describe('AO-D073 Skeleton unit', () => {
  it('is a weak undead that eats nothing and cannot be recruited', () => {
    const def = UNIT_DEFINITIONS.skeleton;
    expect(def.tags).toContain('undead');
    expect(def.foodPerUnit).toBe(0);
    expect(def.hpPerUnit).toBeLessThan(UNIT_DEFINITIONS.swordsman.hpPerUnit);
    expect(def.damage).toBeLessThanOrEqual(UNIT_DEFINITIONS.swordsman.damage);
    expect('skeleton' in RECRUIT_COSTS).toBe(false);
    const run = { ...createRun(1), phase: 'city' as const, gold: 9999, food: 9999 };
    const res = applyRunAction(run, { type: 'RECRUIT', unitId: 'skeleton', count: 1 } as never);
    expect(res.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(res.run.gold).toBe(9999);
  });

  it('adds no daily Food upkeep', () => {
    const run = createRun(1);
    const withSkeletons = [...run.army, createStack('skeleton', 'player', 6, 40)];
    expect(moveFoodCost(withSkeletons, run.city)).toBe(moveFoodCost(run.army, run.city));
  });
});

describe('AO-D073 Necromantic Doctrine', () => {
  it('raises 25% (rounded down) of the casualties as a new Skeleton stack and reports UNITS_RAISED', () => {
    const { run, events } = winWithLosses(fighting('necromantic'), 2);
    // 2 casualties x 25% = 0.5 -> nothing yet
    expect(skeletons(run)).toHaveLength(0);
    expect(raisedEvent(events)).toBeUndefined();

    const big = winWithLosses(fighting('necromantic', [createStack('swordsman', 'player', 1, 40), createStack('knight', 'player', 2, 2)]), 21);
    expect(big.run.phase).toBe('reward');
    expect(skeletons(big.run)).toHaveLength(1);
    expect(skeletons(big.run)[0]!.count).toBe(Math.floor(21 * NECROMANTIC_RAISE_RATIO));
    expect(skeletons(big.run)[0]!.currentHp).toBe(5 * UNIT_DEFINITIONS.skeleton.hpPerUnit);
    expect(raisedEvent(big.events)).toEqual({ type: 'UNITS_RAISED', count: 5 });
  });

  it('reinforces the existing Skeleton stack instead of opening a second one', () => {
    const army = [createStack('swordsman', 'player', 1, 40), createStack('skeleton', 'player', 2, 3)];
    const { run } = winWithLosses(fighting('necromantic', army), 20);
    expect(skeletons(run)).toHaveLength(1);
    expect(skeletons(run)[0]!.count).toBe(3 + 5);
    expect(skeletons(run)[0]!.preBattleMaxCount).toBe(8);
  });

  it('raises nothing when the army has no room and no Skeleton stack', () => {
    const army = (['swordsman', 'archer', 'knight', 'priest', 'swordsman', 'knight'] as const).map((u, i) => createStack(u, 'player', (i + 1) as 1, i === 0 ? 40 : 3));
    const { run, events } = winWithLosses(fighting('necromantic', army), 20);
    expect(skeletons(run)).toHaveLength(0);
    expect(run.army).toHaveLength(6);
    expect(raisedEvent(events)).toBeUndefined();
  });

  it('does nothing without the doctrine', () => {
    const army = [createStack('swordsman', 'player', 1, 40), createStack('knight', 'player', 2, 2)];
    const { run, events } = winWithLosses(fighting(null, army), 20);
    expect(skeletons(run)).toHaveLength(0);
    expect(raisedEvent(events)).toBeUndefined();
  });

  it('raiseSkeletons rounds down and never raises from a zero share', () => {
    const army = [createStack('swordsman', 'player', 1, 5)];
    expect(raiseSkeletons(army, 3, 0.25)).toEqual({ army, raised: 0 });
    expect(raiseSkeletons(army, 8, 0.25).raised).toBe(2);
    expect(raiseSkeletons(army, 8, 0.25).army.find((s) => s.unitId === 'skeleton')!.count).toBe(2);
  });
});
