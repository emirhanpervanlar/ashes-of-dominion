import { describe, expect, it } from 'vitest';
import { createRun, runSummary } from '../engine/run/index.js';
import { highlights, ratioShare, statGroups } from './runEndView.js';

describe('run end view', () => {
  const run = createRun(7);
  const summary = runSummary(run);

  it('builds Battle, Journey, Economy and Army groups with one row per stat and no duplicates', () => {
    const groups = statGroups(run, summary);
    expect(groups.map((g) => g.label)).toEqual(['Battle', 'Journey', 'Economy', 'Army']);
    const ids = groups.flatMap((g) => g.rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['damageDealt', 'damageTaken', 'days', 'goldGathered', 'unitsLost', 'largestStack', 'unitsNow']));
  });

  it('the army row counts the living units and the highlights are the three headline numbers', () => {
    const army = statGroups(run, summary).find((g) => g.label === 'Army')!;
    expect(army.rows.find((r) => r.id === 'unitsNow')!.value).toBe(run.army.reduce((n, s) => n + s.count, 0));
    expect(highlights(summary).map((h) => h.label)).toEqual(['Days survived', 'Largest stack', 'Enemies killed']);
  });

  it('ratioShare is the first part in percent, and an empty comparison splits evenly', () => {
    expect(ratioShare(75, 25)).toBe(75);
    expect(ratioShare(0, 10)).toBe(0);
    expect(ratioShare(10, 0)).toBe(100);
    expect(ratioShare(0, 0)).toBe(50);
  });
});
