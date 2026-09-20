import { describe, expect, it } from 'vitest';
import { resourceDeltas } from './resourceDeltas.js';

describe('resourceDeltas', () => {
  const seen = { seed: 1, gold: 100, food: 50 };

  it('is one signed number per resource that changed', () => {
    expect(resourceDeltas(seen, { seed: 1, gold: 130, food: 47 })).toEqual([
      { resource: 'gold', amount: 30 },
      { resource: 'food', amount: -3 },
    ]);
    expect(resourceDeltas(seen, { seed: 1, gold: 100, food: 58 })).toEqual([{ resource: 'food', amount: 8 }]);
  });

  it('is empty when nothing changed, on the first look, and for another run', () => {
    expect(resourceDeltas(seen, { seed: 1, gold: 100, food: 50 })).toEqual([]);
    expect(resourceDeltas(null, { seed: 1, gold: 100, food: 50 })).toEqual([]);
    expect(resourceDeltas(seen, { seed: 2, gold: 999, food: 1 })).toEqual([]);
  });
});
