import { describe, expect, it } from 'vitest';
import { applyDamageToStack, computeRawDamage, effectiveCount } from '../damage.js';
import type { ArmyStack } from '../types.js';

function stack(overrides: Partial<ArmyStack> = {}): ArmyStack {
  return {
    stackId: 's1',
    unitId: 'swordsman',
    side: 'player',
    position: 1,
    count: 80,
    currentHp: 800,
    maxHp: 800,
    startingCount: 80,
    morale: 0,
    veterancy: 0,
    block: 0,
    statuses: [],
    actedThisTurn: false,
    ...overrides,
  };
}

describe('effectiveCount', () => {
  it('applies the correct bracket multiplier', () => {
    expect(effectiveCount(50)).toBe(50);
    expect(effectiveCount(100)).toBeCloseTo(90);
    expect(effectiveCount(200)).toBeCloseTo(150);
    expect(effectiveCount(400)).toBeCloseTo(240);
    expect(effectiveCount(1000)).toBeCloseTo(450);
  });

  it('500 soldiers are stronger than 100 but not 5x stronger', () => {
    const ratio = effectiveCount(500) / effectiveCount(100);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(5);
  });
});

describe('computeRawDamage', () => {
  it('is deterministic for identical inputs', () => {
    const attacker = stack({ count: 80 });
    const a = computeRawDamage(attacker, 3, 2, 1);
    const b = computeRawDamage(attacker, 3, 2, 1);
    expect(a).toBe(b);
  });

  it('applies Strength as a flat per-unit attack bonus', () => {
    const base = stack({ count: 10 });
    const buffed = stack({ count: 10, statuses: [{ type: 'strength', amount: 2, duration: 1 }] });
    const baseDmg = computeRawDamage(base, 3, 0, 1);
    const buffedDmg = computeRawDamage(buffed, 3, 0, 1);
    expect(buffedDmg).toBeGreaterThan(baseDmg);
  });

  it('floors per-unit damage at 0 when defense exceeds attack', () => {
    const attacker = stack({ count: 10 });
    expect(computeRawDamage(attacker, 3, 99, 1)).toBe(0);
  });
});

describe('applyDamageToStack', () => {
  it('absorbs damage with block before touching HP', () => {
    const target = stack({ count: 10, currentHp: 100, block: 50 });
    const result = applyDamageToStack(target, 10, 30);
    expect(result.blocked).toBe(30);
    expect(result.finalDamage).toBe(0);
    expect(result.stack.currentHp).toBe(100);
    expect(result.stack.count).toBe(10);
  });

  it('produces persistent casualties: count decreases and stays decreased', () => {
    const target = stack({ count: 10, currentHp: 100, maxHp: 100 });
    const afterHit = applyDamageToStack(target, 10, 35);
    expect(afterHit.stack.currentHp).toBe(65);
    expect(afterHit.stack.count).toBe(7); // ceil(65/10)
    expect(afterHit.unitsKilled).toBe(3);

    const afterSecondHit = applyDamageToStack(afterHit.stack, 10, 65);
    expect(afterSecondHit.stack.currentHp).toBe(0);
    expect(afterSecondHit.stack.count).toBe(0);
  });
});
