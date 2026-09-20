import { describe, expect, it } from 'vitest';
import { ATTACK_ADVANTAGE_PER_POINT, FEAR_MAX_PERCENT, fearDamageMultiplier, weakDamageMultiplier } from '../damage.js';
import { STATUS_INFO, statusEffectText } from '../data/statuses.js';
import type { ArmyStack, StatusType } from '../types.js';

const ALL_STATUSES: StatusType[] = ['strength', 'weak', 'armor', 'bleed', 'poison', 'burn', 'fear', 'taunt', 'freeze'];

function withStatus(type: StatusType, amount: number): ArmyStack {
  return { statuses: [{ type, amount, duration: 1 }] } as ArmyStack;
}

describe('STATUS_INFO (AO-036)', () => {
  it('has an entry for every StatusType, keyed by its own id', () => {
    expect(Object.keys(STATUS_INFO).sort()).toEqual([...ALL_STATUSES].sort());
    for (const id of ALL_STATUSES) expect(STATUS_INFO[id].id).toBe(id);
  });

  it('classifies buffs and debuffs', () => {
    expect(ALL_STATUSES.filter((id) => STATUS_INFO[id].kind === 'buff').sort()).toEqual(['armor', 'strength', 'taunt']);
  });

  it('effect texts carry the numbers the damage code uses', () => {
    expect(STATUS_INFO.strength.effect).toContain(`${ATTACK_ADVANTAGE_PER_POINT * 100}%`);
    expect(STATUS_INFO.fear.effect).toContain(`${FEAR_MAX_PERCENT}%`);
    expect(statusEffectText('weak', 20)).toBe('Deals 20% less damage.');
    expect(weakDamageMultiplier(withStatus('weak', 20))).toBeCloseTo(0.8);
    expect(statusEffectText('fear', 30)).toContain('30%');
    expect(fearDamageMultiplier(withStatus('fear', 999))).toBeCloseTo(1 - FEAR_MAX_PERCENT / 100);
    expect(statusEffectText('poison', 7)).toContain('7 damage');
  });
});
