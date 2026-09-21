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

  it('a back-row melee stack is blocked by ANY living front-row ally, whatever the lane (AO-D069)', () => {
    const frontRight = createStack('knight', 'player', 3, 3);
    const backLeftMelee = createStack('swordsman', 'player', 4, 5);
    expect(stackStates(backLeftMelee, 'player', [frontRight, backLeftMelee]).blocked).toBe(true);
    expect(cannotAct(backLeftMelee, 'player', [frontRight, backLeftMelee])).toBe(true);
    expect(stackStates(backLeftMelee, 'player', [backLeftMelee]).blocked).toBe(false);
    const deadFront = { ...frontRight, count: 0 };
    expect(stackStates(backLeftMelee, 'player', [deadFront, backLeftMelee]).blocked).toBe(false);
  });

  it('ranged and support stacks are never blocked by the front row', () => {
    const front = createStack('knight', 'player', 1, 3);
    const backRanged = createStack('archer', 'player', 4, 5);
    const backPriest = createStack('priest', 'player', 5, 5);
    expect(stackStates(backRanged, 'player', [front, backRanged]).blocked).toBe(false);
    expect(stackStates(backPriest, 'player', [front, backPriest]).blocked).toBe(false);
    expect(cannotAct(backPriest, 'player', [front, backPriest])).toBe(false);
  });

  it('an enemy frozen by Frost cannot act (engine cannotAct)', () => {
    const frozenEnemy = { ...createStack('goblin', 'enemy', 1, 4), statuses: [{ type: 'freeze' as const, amount: 1, duration: 1 }] };
    expect(cannotAct(frozenEnemy, 'enemy')).toBe(true);
  });
});
