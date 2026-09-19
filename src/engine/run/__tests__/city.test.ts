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
        current = applyRunAction(current, { type: 'SKIP_REWARD' }).run;
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

/** Opens the city from the map (AO-D047: reachable any time). */
function reachCity(seed: number): RunState {
  let run = createRun(seed);
  run = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' }).run;
  run = applyRunAction(run, { type: 'TRAVEL_TO_CITY' }).run;
  if (run.phase !== 'city') throw new Error(`reachCity(${seed}) ended in unexpected phase: ${run.phase}`);
  return run;
}

describe('reaching the city', () => {
  it('opens the city phase with the initial city state', () => {
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

    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 10 });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    const swordsmanAfter = result.run.army.find((s) => s.unitId === 'swordsman')!.count;
    expect(swordsmanAfter).toBe(swordsmanBefore + 10);
    expect(result.run.gold).toBe(200 - 8 * 10);
    expect(result.run.food).toBe(200 - 1 * 10);
  });

  it('rejects recruiting without enough Gold', () => {
    let run = reachCity(5);
    run = { ...run, gold: 0, food: 200 };
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 5 });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('recruiting a unit type not already in the army adds a new stack', () => {
    let run = reachCity(6);
    run = { ...run, gold: 200, food: 200 };
    expect(run.army.some((s) => s.unitId === 'priest')).toBe(false);
    const result = applyRunAction(run, { type: 'RECRUIT', unitId: 'priest', count: 5 });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
    expect(result.run.army.find((s) => s.unitId === 'priest')?.count).toBe(5);
  });
});

describe('buildings', () => {
  it('building Mage Tower is constructible and takes a slot', () => {
    let run = reachCity(7);
    run = { ...run, gold: 500, food: 200 };
    const built = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'mage_tower' });
    expect(built.events.some((e) => e.type === 'BUILDING_BUILT')).toBe(true);
    expect(built.run.city.buildings).toContain('mage_tower');
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

  it('Training Hall permanently raises Hero max Mana', () => {
    let run = reachCity(10);
    run = { ...run, gold: 200, food: 200 };
    const before = run.hero.maxMana;
    const result = applyRunAction(run, { type: 'BUILD_BUILDING', buildingId: 'training_hall' });
    expect(result.run.hero.maxMana).toBe(before + 2);
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

describe('leaving the city', () => {
  it('returns to on_map', () => {
    const run = reachCity(14);
    const result = applyRunAction(run, { type: 'LEAVE_CITY' });
    expect(result.run.phase).toBe('on_map');
  });
});

describe('doctrines', () => {
  it('choosing a doctrine is permanent and rejects a second pick', () => {
    const run = reachCity(16);
    const first = applyRunAction(run, { type: 'CHOOSE_DOCTRINE', doctrineId: 'military' });
    expect(first.run.city.doctrine).toBe('military');

    const second = applyRunAction(first.run, { type: 'CHOOSE_DOCTRINE', doctrineId: 'economic' });
    expect(second.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(second.run.city.doctrine).toBe('military');
  });

  it('Economic Doctrine increases resource-node payouts', () => {
    const base = reachCity(17);
    const withDoctrine = applyRunAction(base, { type: 'CHOOSE_DOCTRINE', doctrineId: 'economic' }).run;

    const leftBase = applyRunAction(base, { type: 'LEAVE_CITY' }).run;
    const leftDoctrine = applyRunAction(withDoctrine, { type: 'LEAVE_CITY' }).run;

    // Force the next node to a resource node for both, using the same seed's RNG state so the roll matches.
    const withNextResource = (r: RunState) => {
      const current = r.worldMap.nodes.find((n) => n.id === r.worldMap.currentNodeId)!;
      const nextId = current.connectsTo[0]!;
      const worldMap = { ...r.worldMap, nodes: r.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'resource' as const } : n)) };
      return { run: { ...r, worldMap }, nodeId: nextId };
    };

    const baseNode = withNextResource(leftBase);
    const doctrineNode = withNextResource(leftDoctrine);
    const baseResult = applyRunAction(baseNode.run, { type: 'MOVE_TO', nodeId: baseNode.nodeId });
    const doctrineResult = applyRunAction(doctrineNode.run, { type: 'MOVE_TO', nodeId: doctrineNode.nodeId });

    const baseFound = baseResult.events.find((e) => e.type === 'RESOURCE_FOUND');
    const doctrineFound = doctrineResult.events.find((e) => e.type === 'RESOURCE_FOUND');
    expect(baseFound?.type).toBe('RESOURCE_FOUND');
    expect(doctrineFound?.type).toBe('RESOURCE_FOUND');
    if (baseFound?.type === 'RESOURCE_FOUND' && doctrineFound?.type === 'RESOURCE_FOUND') {
      expect(doctrineFound.gold).toBeGreaterThan(baseFound.gold);
    }
  });

  // Necromantic Doctrine's Skeleton-raising is deferred with the rest of the Undying
  // Legion archetype — there is no Skeleton unit in the v3 MVP roster (§3 "explicitly
  // excluded"), so combat.ts's raiseSkeletons is currently a documented no-op.
});
