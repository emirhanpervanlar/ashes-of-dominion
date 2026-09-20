import { describe, expect, it } from 'vitest';
import { createStack } from '../engine/index.js';
import { cannotAct, stackStates } from './stackStatus.js';

describe('stackStates', () => {
  it('a ready stack can act', () => {
    const s = createStack('swordsman', 'player', 1, 5);
    expect(cannotAct(s, 'player', [s])).toBe(false);
  });

  it('acted only fades the player side', () => {
    const s = { ...createStack('swordsman', 'player', 1, 5), actedThisTurn: true };
    expect(stackStates(s, 'player').acted).toBe(true);
    expect(stackStates(s, 'enemy').acted).toBe(false);
  });

  it('frozen and cannotAttack stop the action, cannotMove only shows chains', () => {
    const base = createStack('swordsman', 'player', 1, 5);
    const frozen = { ...base, statuses: [{ type: 'freeze' as const, amount: 1, duration: 1 }] };
    expect(stackStates(frozen, 'player').frozen).toBe(true);
    expect(cannotAct(frozen, 'player')).toBe(true);
    const held = { ...base, flags: { cannotAttack: true } };
    expect(stackStates(held, 'player').chained).toBe(true);
    expect(cannotAct(held, 'player')).toBe(true);
    const rooted = { ...base, flags: { cannotMove: true } };
    expect(stackStates(rooted, 'player').chained).toBe(true);
    expect(cannotAct(rooted, 'player')).toBe(false);
  });

  it('a back-row melee stack behind a living ally is blocked (AO-D033); ranged is not', () => {
    const front = createStack('knight', 'player', 1, 3);
    const backMelee = createStack('swordsman', 'player', 4, 5);
    const backRanged = createStack('archer', 'player', 4, 5);
    expect(stackStates(backMelee, 'player', [front, backMelee]).blocked).toBe(true);
    expect(cannotAct(backMelee, 'player', [front, backMelee])).toBe(true);
    expect(stackStates(backRanged, 'player', [front, backRanged]).blocked).toBe(false);
    expect(stackStates(backMelee, 'player', [backMelee]).blocked).toBe(false);
  });
});
