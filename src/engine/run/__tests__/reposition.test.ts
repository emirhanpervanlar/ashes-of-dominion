import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import type { ArmyStack, Position } from '../../types.js';
import { BUILDING_DEFINITIONS } from '../city.js';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunAction, RunPhase, RunState } from '../types.js';
import { withBarracks } from './cityHelpers.js';

function base(phase: RunState['phase'], army: ArmyStack[]): RunState {
  return withBarracks({ ...createRun(70), phase, army, gold: 1000, food: 1000 });
}
const pos = (run: RunState, id: string) => run.army.find((s) => s.stackId === id)!.position;
const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');

describe('AO-007: MOVE_STACK', () => {
  const army = () => [createStack('swordsman', 'player', 1, 5), createStack('knight', 'player', 2, 3), createStack('archer', 'player', 4, 4)];

  it('relocates to an empty slot, in the map and the city', () => {
    for (const phase of ['on_map', 'city'] as const) {
      const r = applyRunAction(base(phase, army()), { type: 'MOVE_STACK', stackId: 'player_archer_4', toPosition: 6 });
      expect(rejected(r.events)).toBe(false);
      expect(pos(r.run, 'player_archer_4')).toBe(6);
      expect(r.run.army).toHaveLength(3);
    }
  });

  it('swaps with an occupied slot and keeps ids', () => {
    const r = applyRunAction(base('on_map', army()), { type: 'MOVE_STACK', stackId: 'player_swordsman_1', toPosition: 2 });
    expect(pos(r.run, 'player_swordsman_1')).toBe(2);
    expect(pos(r.run, 'player_knight_2')).toBe(1);
  });

  it('is a silent no-op on the same slot', () => {
    const run = base('on_map', army());
    const r = applyRunAction(run, { type: 'MOVE_STACK', stackId: 'player_knight_2', toPosition: 2 });
    expect(r.events).toEqual([]);
    expect(r.run.army).toEqual(run.army);
  });

  it('is rejected in battle, reward, event and merchant phases and for bad input', () => {
    for (const phase of ['battle', 'reward', 'event', 'merchant'] as RunPhase[]) {
      const r = applyRunAction(base(phase, army()), { type: 'MOVE_STACK', stackId: 'player_archer_4', toPosition: 5 });
      expect(rejected(r.events)).toBe(true);
      expect(pos(r.run, 'player_archer_4')).toBe(4);
    }
    expect(rejected(applyRunAction(base('on_map', army()), { type: 'MOVE_STACK', stackId: 'nope', toPosition: 5 }).events)).toBe(true);
    expect(rejected(applyRunAction(base('on_map', army()), { type: 'MOVE_STACK', stackId: 'player_archer_4', toPosition: 7 as Position }).events)).toBe(true);
  });

  it('keeps ids and positions unique across recruit / move / swap / split / merge', () => {
    let run = base('city', army());
    const step = (a: RunAction) => {
      const r = applyRunAction(run, a);
      expect(rejected(r.events)).toBe(false);
      run = r.run;
      expect(new Set(run.army.map((s) => s.stackId)).size).toBe(run.army.length);
      expect(new Set(run.army.map((s) => s.position)).size).toBe(run.army.length);
    };
    step({ type: 'MOVE_STACK', stackId: 'player_archer_4', toPosition: 5 });
    step({ type: 'RECRUIT', unitId: 'priest', count: 2 });
    step({ type: 'MOVE_STACK', stackId: 'player_swordsman_1', toPosition: 6 });
    step({ type: 'SPLIT_STACK', stackId: 'player_swordsman_1', splitCount: 2 }); // free slot 1: label player_swordsman_1 is taken by the moved stack
    step({ type: 'MOVE_STACK', stackId: 'player_knight_2', toPosition: 1 });
    step({ type: 'SPLIT_STACK', stackId: 'player_swordsman_1', splitCount: 1 });
    const swords = run.army.filter((s) => s.unitId === 'swordsman');
    expect(swords).toHaveLength(3);
    step({ type: 'MERGE_STACKS', stackIdA: swords[0]!.stackId, stackIdB: swords[1]!.stackId });
    step({ type: 'MOVE_STACK', stackId: swords[2]!.stackId, toPosition: 3 });
    expect(run.army.filter((s) => s.unitId === 'swordsman').reduce((n, s) => n + s.count, 0)).toBe(5);
  });

  it('recruit merges into the same type, otherwise takes the first free slot (AO-D015)', () => {
    let run = base('city', [createStack('swordsman', 'player', 2, 5), createStack('knight', 'player', 3, 2)]);
    run = applyRunAction(run, { type: 'RECRUIT', unitId: 'swordsman', count: 2 }).run;
    expect(run.army).toHaveLength(2);
    expect(run.army.find((s) => s.unitId === 'swordsman')).toMatchObject({ count: 7, position: 2 });
    run = applyRunAction(run, { type: 'RECRUIT', unitId: 'priest', count: 2 }).run;
    expect(run.army.find((s) => s.unitId === 'priest')!.position).toBe(1);
  });

  it('Training Hall describes the +2 max Mana it grants', () => {
    expect(BUILDING_DEFINITIONS.training_hall!.description).toContain('Mana +2');
    expect(BUILDING_DEFINITIONS.training_hall!.description).not.toMatch(/AC|DC/);
  });
});
