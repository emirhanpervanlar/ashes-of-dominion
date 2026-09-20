import { describe, expect, it } from 'vitest';
import { createStack } from '../engine/index.js';
import { freePositions, resolveDrop } from './armyDrop.js';

const sword = createStack('swordsman', 'player', 1, 5);
const sword2 = createStack('swordsman', 'player', 2, 3);
const archer = createStack('archer', 'player', 4, 4);
const army = [sword, sword2, archer];

describe('resolveDrop', () => {
  it('moves onto an empty slot', () => {
    expect(resolveDrop(army, sword.stackId, 6)).toEqual({ kind: 'move', stackId: sword.stackId, toPosition: 6 });
  });

  it('swaps with a different unit type', () => {
    expect(resolveDrop(army, sword.stackId, 4)).toEqual({ kind: 'swap', stackId: sword.stackId, toPosition: 4 });
  });

  it('merges into a stack of the same unit type, keeping the target', () => {
    expect(resolveDrop(army, sword.stackId, 2)).toEqual({ kind: 'merge', keepStackId: sword2.stackId, absorbStackId: sword.stackId });
  });

  it('ignores a drop on its own slot or an unknown stack', () => {
    expect(resolveDrop(army, sword.stackId, 1)).toEqual({ kind: 'none' });
    expect(resolveDrop(army, 'nope', 3)).toEqual({ kind: 'none' });
  });

  it('treats dead stacks as empty slots', () => {
    const dead = { ...archer, count: 0 };
    expect(resolveDrop([sword, dead], sword.stackId, 4)).toEqual({ kind: 'move', stackId: sword.stackId, toPosition: 4 });
  });
});

describe('freePositions', () => {
  it('lists the empty slots', () => {
    expect(freePositions(army)).toEqual([3, 5, 6]);
  });
});
