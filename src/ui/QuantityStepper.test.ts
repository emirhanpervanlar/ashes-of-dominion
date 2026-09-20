import { describe, expect, it } from 'vitest';
import { holdDelay, stepValue } from './QuantityStepper.js';

describe('stepValue', () => {
  it('moves by the delta and stops at both ends', () => {
    expect(stepValue(5, 1, 1, 10)).toBe(6);
    expect(stepValue(10, 1, 1, 10)).toBe(10);
    expect(stepValue(1, -1, 1, 10)).toBe(1);
  });

  it('a limit below the minimum collapses to the minimum (nothing affordable keeps 1)', () => {
    expect(stepValue(1, 1, 1, 0)).toBe(1);
  });
});

describe('holdDelay', () => {
  it('speeds up while held and never gets faster than the floor', () => {
    expect(holdDelay(0)).toBe(400);
    expect(holdDelay(3)).toBeLessThan(holdDelay(1));
    expect(holdDelay(50)).toBe(50);
  });
});
