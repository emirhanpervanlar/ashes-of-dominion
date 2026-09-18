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
    preBattleMaxCount: 80,
    morale: 100,
    veterancy: 0,
    block: 0,
    statuses: [],
    flags: {},
    actedThisTurn: false,
    ...overrides,
  };
}

describe('effectiveCount', () => {
  it('applies the correct bracket multiplier (v3 §10: 1-20/21-50/51-100/101-200/201-400/400+)', () => {
    expect(effectiveCount(20)).toBe(20);
    expect(effectiveCount(50)).toBeCloseTo(45);
    expect(effectiveCount(100)).toBeCloseTo(75);
    expect(effectiveCount(200)).toBeCloseTo(120);
    expect(effectiveCount(400)).toBeCloseTo(180);
    expect(effectiveCount(1000)).toBeCloseTo(350);
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
    const params = { attackerStack: attacker, attackerBaseAttack: 3, targetDefense: 2, multiplier: 1 };
    const a = computeRawDamage(params);
    const b = computeRawDamage(params);
    expect(a).toBe(b);
  });

  it('applies Strength as a flat per-unit attack bonus', () => {
    const base = stack({ count: 10 });
    const buffed = stack({ count: 10, statuses: [{ type: 'strength', amount: 2, duration: 1 }] });
    const baseDmg = computeRawDamage({ attackerStack: base, attackerBaseAttack: 3, targetDefense: 0, multiplier: 1 });
    const buffedDmg = computeRawDamage({ attackerStack: buffed, attackerBaseAttack: 3, targetDefense: 0, multiplier: 1 });
    expect(buffedDmg).toBeGreaterThan(baseDmg);
  });

  it('floors per-unit damage at 0 when defense exceeds attack', () => {
    const attacker = stack({ count: 10 });
    expect(computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 3, targetDefense: 99, multiplier: 1 })).toBe(0);
  });

  it('applies Hero stat effectiveness as a multiplier', () => {
    const attacker = stack({ count: 10 });
    const base = computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 3, targetDefense: 0, multiplier: 1 });
    const boosted = computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 3, targetDefense: 0, multiplier: 1, heroEffectiveness: 1.2 });
    expect(boosted).toBeGreaterThan(base);
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
