import { describe, expect, it } from 'vitest';
import { applyDamageToStack, applyHealToStack, computeRawDamage } from '../damage.js';
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

  it('a hit with attack below defense still deals damage (AO-D018: -2.5% per point, capped at -70%)', () => {
    const attacker = stack({ count: 100 }); // swordsman, base damage 1
    expect(computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 3, targetDefense: 5, multiplier: 1 })).toBe(95);
    expect(computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 3, targetDefense: 99, multiplier: 1 })).toBe(30);
    expect(computeRawDamage({ attackerStack: stack({ count: 1 }), attackerBaseAttack: 1, targetDefense: 99, multiplier: 1 })).toBe(1);
  });

  it('attack above defense adds 5% per point, capped at +300%', () => {
    const attacker = stack({ count: 100 });
    expect(computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 5, targetDefense: 3, multiplier: 1 })).toBe(110);
    expect(computeRawDamage({ attackerStack: attacker, attackerBaseAttack: 100, targetDefense: 0, multiplier: 1 })).toBe(400);
  });

  it('AO-D031: base damage comes from the unit definition, attack only feeds the modifier', () => {
    const knight = stack({ unitId: 'knight', count: 10 }); // base damage 4
    expect(computeRawDamage({ attackerStack: knight, attackerBaseAttack: 4, targetDefense: 4, multiplier: 1 })).toBe(40);
    expect(computeRawDamage({ attackerStack: knight, attackerBaseAttack: 4, targetDefense: 4, multiplier: 2 })).toBe(80);
    // Doubling attack changes only the percentage modifier (+20% for 4 points), not the base.
    expect(computeRawDamage({ attackerStack: knight, attackerBaseAttack: 8, targetDefense: 4, multiplier: 1 })).toBe(48);
  });

  it('is linear in unit count: one stack of 60 deals exactly what two stacks of 30 deal together', () => {
    const one = computeRawDamage({ attackerStack: stack({ count: 60 }), attackerBaseAttack: 4, targetDefense: 0, multiplier: 1 });
    const half = computeRawDamage({ attackerStack: stack({ count: 30 }), attackerBaseAttack: 4, targetDefense: 0, multiplier: 1 });
    expect(one).toBe(2 * half);
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

describe('Heroes 3 style heal (AO-D004)', () => {
  it('50 units / 500 HP reduced to 40 / 400: healing 10 restores exactly one unit, never above 50', () => {
    const wounded = stack({ count: 40, currentHp: 400, maxHp: 500, preBattleMaxCount: 50 });
    const healed = applyHealToStack(wounded, 10, 10);
    expect(healed.stack.count).toBe(41);
    expect(healed.stack.currentHp).toBe(410);

    const overhealed = applyHealToStack(wounded, 1000, 10);
    expect(overhealed.stack.count).toBe(50);
    expect(overhealed.stack.currentHp).toBe(500);
  });
});
