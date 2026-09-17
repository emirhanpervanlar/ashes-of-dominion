import { describe, expect, it } from 'vitest';
import { createStack } from '../army.js';
import { computeValidTargets } from '../targeting.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import type { ArmyStack } from '../types.js';

function enemyRow(): ArmyStack[] {
  return [
    createStack('orc', 'enemy', 1, 10),
    createStack('orc', 'enemy', 2, 10),
    createStack('orc', 'enemy', 3, 10),
    createStack('shaman', 'enemy', 4, 10),
    createStack('shaman', 'enemy', 5, 10),
    createStack('shaman', 'enemy', 6, 10),
  ];
}

describe('v2 targeting geometry (v2_list.md §5)', () => {
  it('left lane reaches enemy left+center', () => {
    const attacker = createStack('swordsman', 'player', 1, 10);
    const targets = computeValidTargets(attacker, enemyRow(), UNIT_DEFINITIONS.swordsman);
    expect(targets.map((t) => t.position).sort()).toEqual([1, 2]);
  });

  it('center lane reaches all three enemy front positions', () => {
    const attacker = createStack('swordsman', 'player', 2, 10);
    const targets = computeValidTargets(attacker, enemyRow(), UNIT_DEFINITIONS.swordsman);
    expect(targets.map((t) => t.position).sort()).toEqual([1, 2, 3]);
  });

  it('right lane reaches enemy center+right', () => {
    const attacker = createStack('swordsman', 'player', 3, 10);
    const targets = computeValidTargets(attacker, enemyRow(), UNIT_DEFINITIONS.swordsman);
    expect(targets.map((t) => t.position).sort()).toEqual([2, 3]);
  });

  it('an empty/dead front lane exposes the matching backline position', () => {
    const enemy = enemyRow().map((s) => (s.position === 1 ? { ...s, count: 0, currentHp: 0 } : s));
    const attacker = createStack('swordsman', 'player', 1, 10);
    const targets = computeValidTargets(attacker, enemy, UNIT_DEFINITIONS.swordsman);
    // Left lane (front pos 1 dead) falls back to back pos 4; center front pos 2 is still alive.
    expect(targets.map((t) => t.position).sort()).toEqual([2, 4]);
  });

  it('a ranged unit (Archer) can reach every alive enemy regardless of lane', () => {
    const attacker = createStack('archer', 'player', 4, 10);
    const targets = computeValidTargets(attacker, enemyRow(), UNIT_DEFINITIONS.archer);
    expect(targets).toHaveLength(6);
  });
});
