import { describe, expect, it } from 'vitest';
import { HERO_DEFINITIONS } from '../data/heroes.js';
import { applyRunAction, createRun } from '../run/runEngine.js';
import { createHero } from '../scenario.js';
import type { RunState } from '../run/types.js';

function fightingRun(mutate: (run: RunState) => RunState = (r) => r): RunState {
  const run = mutate(createRun(5, 'warlord'));
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n));
  return applyRunAction({ ...run, worldMap: { ...run.worldMap, nodes } }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

describe('AO-D065 mana', () => {
  it('fresh heroes start at Warlord 3, Rogue 3, Mage 4', () => {
    expect(createHero('warlord').maxMana).toBe(3);
    expect(createHero('rogue').maxMana).toBe(3);
    expect(createHero('mage').maxMana).toBe(4);
    for (const id of ['warlord', 'rogue', 'mage'] as const) expect(HERO_DEFINITIONS[id].baseMana).toBe(3);
  });

  it('a battle never starts below max Mana even when the hero carries 0 from the previous one', () => {
    const run = fightingRun((r) => ({ ...r, hero: { ...r.hero, mana: 0 } }));
    expect(run.combat!.hero.mana).toBe(run.combat!.hero.maxMana);
    expect(run.combat!.hero.maxMana).toBe(3);
  });

  it('win a battle spending Mana, start another: Mana is max again', () => {
    let run = fightingRun();
    const spent = { ...run.combat!, hero: { ...run.combat!.hero, mana: 0 }, enemyArmy: run.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
    run = applyRunAction({ ...run, combat: spent }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
    expect(run.phase).toBe('reward');
    expect(run.hero.mana).toBe(0);
    const again = fightingRun(() => ({ ...run, phase: 'on_map', pendingReward: null, combat: null }));
    expect(again.combat!.hero.mana).toBe(3);
  });
});
