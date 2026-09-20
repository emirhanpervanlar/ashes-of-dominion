import { describe, expect, it } from 'vitest';
import { createStack } from '../../army.js';
import { ceilSafe, floorSafe, roundSafe } from '../../floatSafe.js';
import { createRng } from '../../rng.js';
import type { UnitId } from '../../types.js';
import { RECRUIT_COSTS, createInitialCityState, recruitCost, settleArmyAfterVictory } from '../city.js';
import { starvationForecast, starvationLossRate, starveArmy } from '../food.js';
import { createRun } from '../runEngine.js';

const deaths = (units: number, shortageRatio: number, days = 1) =>
  starveArmy([createStack('swordsman', 'player', 1, units)], createRng(1), shortageRatio, days).deaths.reduce((n, d) => n + d.count, 0);

describe('AO-042: float-safe rounding', () => {
  it('ceilSafe / floorSafe / roundSafe ignore float noise but keep real fractions', () => {
    expect(3.0000000000000004).not.toBe(3);
    expect(ceilSafe(3.0000000000000004)).toBe(3);
    expect(ceilSafe(3.000001)).toBe(4);
    expect(floorSafe(2.9999999999999996)).toBe(3);
    expect(floorSafe(2.99999)).toBe(2);
    expect(roundSafe(127.49999999999999)).toBe(128);
    expect(roundSafe(127.4)).toBe(127);
  });

  it('starvation deaths do not gain a unit from float noise (reviewer case: need 11, deficit 2, 55 units -> exactly 3)', () => {
    const rate = starvationLossRate(2 / 11, 1);
    expect(rate * 55).toBeGreaterThan(3); // the raw float product is 3.0000000000000004
    expect(deaths(55, 2 / 11)).toBe(3);
  });

  it('starvation deaths (reviewer case: need 16, deficit 7, 40 units -> exactly 3)', () => {
    expect(starvationLossRate(7 / 16, 1) * 40).toBeGreaterThan(3);
    expect(deaths(40, 7 / 16)).toBe(3);
  });

  it('the forecast the UI shows matches the deaths that happen (55 Archers eat 11, 9 Food in stock)', () => {
    const run = { ...createRun(1), army: [createStack('archer', 'player', 1, 55)], food: 9 };
    const forecast = starvationForecast(run);
    expect(forecast.willStarve).toBe(true);
    expect(forecast.shortageRatio).toBeCloseTo(2 / 11, 12);
    expect(forecast.expectedDeaths).toBe(3);
  });

  it('Market recruit prices round the intended amount (half up on exact decimals), for every unit and count', () => {
    const city = { ...createInitialCityState(), buildings: ['market'] };
    for (const unitId of Object.keys(RECRUIT_COSTS) as UnitId[]) {
      for (let count = 1; count <= 400; count++) {
        const exact = Math.floor((RECRUIT_COSTS[unitId]!.gold * count * 85 + 50) / 100); // 15% off, integer math
        expect(recruitCost(city, unitId, count)!.gold, `${unitId} x${count}`).toBe(exact);
      }
    }
  });

  it('Shrine revives exactly floor(10% of the casualties) for every casualty count', () => {
    const city = { ...createInitialCityState(), buildings: ['shrine'] };
    for (let casualties = 1; casualties <= 600; casualties++) {
      const before = createStack('swordsman', 'player', 1, 1000);
      const after = { ...before, count: 1000 - casualties, currentHp: (1000 - casualties) * 10 };
      expect(settleArmyAfterVictory([after], city).revived, `${casualties} casualties`).toBe(Math.floor(casualties / 10));
    }
  });
});
