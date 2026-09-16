import { describe, expect, it } from 'vitest';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunState } from '../types.js';
import type { CombatState } from '../../types.js';

/** Resolves whatever a MOVE_TO just triggered (battle/event/merchant) back to 'on_map', or stops at 'city'. */
function resolveUntilOnMapOrCity(run: RunState): RunState {
  let current = run;
  let guard = 0;
  while (current.phase !== 'on_map' && current.phase !== 'city' && guard < 20) {
    guard += 1;
    if (current.phase === 'in_battle') {
      const combat = current.combat!;
      const wiped: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
      current = applyRunAction({ ...current, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
      if (current.phase === 'reward') {
        current = applyRunAction(current, { type: 'CONFIRM_REWARD' }).run;
      }
      continue;
    }
    if (current.phase === 'event') {
      const optionId = current.pendingEvent!.eventId === 'abandoned_camp' ? 'rest' : 'pay';
      current = applyRunAction(current, { type: 'CHOOSE_EVENT_OPTION', optionId }).run;
      continue;
    }
    if (current.phase === 'merchant') {
      current = applyRunAction(current, { type: 'LEAVE_MERCHANT' }).run;
      continue;
    }
    break;
  }
  return current;
}

/** Walks to the map's one guaranteed City node (layer 3, AGENT.md §55), resolving anything en route. */
function reachCity(seed: number): RunState {
  let run = createRun(seed);
  run = resolveUntilOnMapOrCity(applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' }).run);
  const cityId = run.worldMap.nodes.find((n) => n.type === 'city')!.id;

  while (run.phase === 'on_map') {
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const nextId = current.connectsTo.includes(cityId) ? cityId : current.connectsTo[0]!;
    run = resolveUntilOnMapOrCity(applyRunAction(run, { type: 'MOVE_TO', nodeId: nextId }).run);
  }
  if (run.phase !== 'city') throw new Error(`reachCity(${seed}) ended in unexpected phase: ${run.phase}`);
  return run;
}

describe('reaching the city', () => {
  it('the map always has exactly one city node, reachable', () => {
    const run = createRun(1);
    const cityNodes = run.worldMap.nodes.filter((n) => n.type === 'city');
    expect(cityNodes).toHaveLength(1);
    expect(cityNodes[0]!.layer).toBe(3);
  });

  it('arriving at the city node opens the city phase', () => {
    const run = reachCity(2);
    expect(run.phase).toBe('city');
    expect(run.city.level).toBe(1);
    expect(run.city.buildings).toEqual([]);
  });
});

describe('recruitment', () => {
  it('recruits into a matching existing field-army stack, spending Gold and Food', () => {
    let run = reachCity(3);
    run = { ...run, gold: 200, food: 200 };
    const swordsmanBefore = run.army.find((s) => s.unitId === 'swordsman')!.count;

    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 10, destination: 'army' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    const swordsmanAfter = result.run.army.find((s) => s.unitId === 'swordsman')!.count;
    expect(swordsmanAfter).toBe(swordsmanBefore + 10);
    expect(result.run.gold).toBe(200 - 8 * 10);
    expect(result.run.food).toBe(200 - 1 * 10);
  });

  it('rejects recruiting Mage before Mage Tower is built', () => {
    let run = reachCity(4);
    run = { ...run, gold: 200, food: 200 };
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'mage', count: 1, destination: 'army' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('rejects recruiting without enough Gold', () => {
    let run = reachCity(5);
    run = { ...run, gold: 0, food: 200 };
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 5, destination: 'army' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('routes recruits to the garrison when requested, never touching the field army', () => {
    let run = reachCity(6);
    run = { ...run, gold: 200, food: 200 };
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 5, destination: 'garrison' });
    expect(result.run.city.garrison.some((s) => s.unitId === 'swordsman' && s.count === 5)).toBe(true);
    expect(result.run.army.find((s) => s.unitId === 'swordsman')!.count).toBe(run.army.find((s) => s.unitId === 'swordsman')!.count);
  });
});

describe('buildings', () => {
  it('building Mage Tower unlocks Mage recruitment', () => {
    let run = reachCity(7);
    run = { ...run, gold: 500, food: 200 };
    const built = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'mage_tower' });
    expect(built.events.some((e) => e.type === 'BUILDING_BUILT')).toBe(true);

    const recruited = applyRunAction(built.run, { type: 'RECRUIT', unitId: 'mage', count: 3, destination: 'garrison' });
    expect(recruited.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
  });

  it('rejects building past the level-1 slot cap (3 slots)', () => {
    let run = reachCity(8);
    run = { ...run, gold: 1000, food: 200 };
    let current = run;
    const buildingIds = ['market', 'gold_mine', 'mage_tower', 'stable'];
    let lastResult = applyRunAction(current, { type: 'BUILD_BUILDING', buildingId: buildingIds[0]! });
    current = lastResult.run;
    lastResult = applyRunAction(current, { type: 'BUILD_BUILDING', buildingId: buildingIds[1]! });
    current = lastResult.run;
    lastResult = applyRunAction(current, { type: 'BUILD_BUILDING', buildingId: buildingIds[2]! });
    current = lastResult.run;
    expect(current.city.buildings).toHaveLength(3); // level 1 cap

    lastResult = applyRunAction(current, { type: 'BUILD_BUILDING', buildingId: buildingIds[3]! });
    expect(lastResult.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('Gold Mine grants +100 Gold immediately', () => {
    let run = reachCity(9);
    run = { ...run, gold: 100, food: 200 };
    const result = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'gold_mine' });
    expect(result.run.gold).toBe(100 - 80 + 100);
  });

  it('Training Hall permanently raises Hero max AC/DC', () => {
    let run = reachCity(10);
    run = { ...run, gold: 200, food: 200 };
    const result = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'training_hall' });
    expect(result.run.hero.maxAc).toBe(4);
    expect(result.run.hero.maxDc).toBe(4);
  });
});

describe('city leveling', () => {
  it('upgrading the city raises the level and building slot cap, costing Gold', () => {
    let run = reachCity(11);
    run = { ...run, gold: 500, food: 200 };
    const result = applyRunAction(run, { type: 'UPGRADE_CITY' });
    expect(result.run.city.level).toBe(2);
    expect(result.run.gold).toBe(500 - 150);
  });

  it('rejects upgrading without enough Gold', () => {
    let run = reachCity(12);
    run = { ...run, gold: 0, food: 200 };
    const result = applyRunAction(run, { type: 'UPGRADE_CITY' });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('garrison transfer', () => {
  it('transfers a garrison stack into the field army', () => {
    let run = reachCity(13);
    run = { ...run, gold: 200, food: 200 };
    const recruited = applyRunAction(run, { type: 'RECRUIT', unitId: 'priest', count: 4, destination: 'garrison' });
    const stack = recruited.run.city.garrison[0]!;

    const transferred = applyRunAction(recruited.run, { type: 'TRANSFER_GARRISON_TO_ARMY', stackId: stack.stackId });
    expect(transferred.run.city.garrison).toHaveLength(0);
    const priestStack = transferred.run.army.find((s) => s.unitId === 'priest')!;
    expect(priestStack.count).toBeGreaterThanOrEqual(4);
  });
});

describe('leaving the city', () => {
  it('returns to on_map', () => {
    const run = reachCity(14);
    const result = applyRunAction(run, { type: 'LEAVE_CITY' });
    expect(result.run.phase).toBe('on_map');
  });
});

describe('shrine', () => {
  it('heals the army on every subsequent visit once built', () => {
    let run = reachCity(15);
    run = { ...run, gold: 500, food: 200 };
    run = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'shrine' }).run;
    // Damage a stack, leave, come back.
    run = {
      ...run,
      army: run.army.map((s, i) => (i === 0 ? { ...s, currentHp: Math.floor(s.maxHp * 0.5) } : s)),
    };
    const left = applyRunAction(run, { type: 'LEAVE_CITY' }).run;
    const hpBefore = left.army[0]!.currentHp;
    const revisit = applyRunAction(left, { type: 'ENTER_CITY' });
    expect(revisit.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(revisit.run.phase).toBe('city');
    expect(revisit.run.army[0]!.currentHp).toBeGreaterThan(hpBefore);
  });
});
