import { describe, expect, it } from 'vitest';
import { createStack } from '../engine/index.js';
import { createRun, dailyFoodNet, dailyUpkeep } from '../engine/run/index.js';
import { foodBreakdown } from './foodView.js';

const runWith = (units: [Parameters<typeof createStack>[0], number][], stable = false) => {
  const base = createRun(3);
  return { ...base, army: units.map(([id, n], i) => createStack(id, 'player', (i + 1) as 1, n)), city: { ...base.city, buildings: stable ? ['stable'] : [] } };
};

describe('foodBreakdown', () => {
  it('the rounded line is the whole number the bar shows, however many decimals the stacks add up to', () => {
    const run = runWith([['swordsman', 7], ['archer', 3], ['knight', 3]]);
    const b = foodBreakdown(run);
    expect(b.subtotal).toBeCloseTo(0.7 + 0.6 + 1.5, 5);
    expect(b.rounded).toBe(3);
    expect(b.upkeep).toBe(dailyUpkeep(run));
    expect(-b.upkeep + 0).toBe(dailyFoodNet(run));
    expect(b.stableApplied).toBe(false);
  });

  it('a Stable changes the final number and says so', () => {
    const run = runWith([['knight', 12]], true);
    const b = foodBreakdown(run);
    expect(b.rounded).toBe(6);
    expect(b.upkeep).toBe(4);
    expect(b.stableApplied).toBe(true);
  });

  it('skips wiped stacks', () => {
    const run = runWith([['swordsman', 5], ['archer', 0]]);
    expect(foodBreakdown(run).stacks).toHaveLength(1);
  });
});
