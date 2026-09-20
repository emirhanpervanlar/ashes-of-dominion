import { describe, expect, it } from 'vitest';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../../data/relics.js';
import type { RelicDefinition } from '../../types.js';
import { createStack } from '../../army.js';
import { applyPlayerAction } from '../../combat.js';
import { UNIT_DEFINITIONS } from '../../data/units.js';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunState } from '../types.js';
import { foundRelicInfo, foundRelicList, startingRelicList } from '../start.js';
import { legacySave } from './legacy.js';

function hasDownside(def: RelicDefinition): boolean {
  return def.effects.some((e) => {
    switch (e.kind) {
      case 'PLAYER_DAMAGE_MULT':
      case 'TAG_DAMAGE_MULT':
      case 'HEALING_MULT':
      case 'ARMY_SIZE_MULT':
      case 'SMALL_STACK_DAMAGE_MULT':
        return e.multiplier < 1;
      case 'PLAYER_DAMAGE_TAKEN_MULT':
        return e.multiplier > 1;
      case 'HERO_MAX_MANA':
      case 'LARGE_STACK_STRENGTH':
      case 'DODGE_BONUS_PERCENT':
      case 'GOLD_FLAT':
        return e.amount < 0;
      default:
        return false;
    }
  });
}

describe('AO-036: structured relic drawbacks', () => {
  const all = [...Object.values(RELIC_DEFINITIONS), ...Object.values(STARTING_RELIC_DEFINITIONS)];

  it('every relic with a downside lists it in drawbacks, and only those', () => {
    for (const def of all) expect(!!def.drawbacks?.length, def.id).toBe(hasDownside(def));
  });

  it('each drawback is a sentence of the unchanged description', () => {
    for (const def of all) for (const line of def.drawbacks ?? []) expect(def.description, def.id).toContain(line);
  });

  it('the list helpers expose drawbacks (empty for pure-benefit relics)', () => {
    expect(startingRelicList().every((r) => r.drawbacks.length === 0)).toBe(true);
    const found = foundRelicList();
    expect(found).toHaveLength(Object.keys(RELIC_DEFINITIONS).length);
    expect(foundRelicInfo('cursed_crown')?.drawbacks).toEqual(['Army takes +20% damage.']);
    expect(foundRelicInfo('iron_bracers')?.drawbacks).toEqual([]);
    expect(foundRelicInfo('nope')).toBeUndefined();
  });
});

describe('AO-036: Royal Banner mid-run', () => {
  // The only mid-run route: a pre-AO-D029 save (phase choosing_starting_relic) is granted the default starting relic on load.
  it('adds units to the largest stack without healing its wounds', () => {
    const wounded = { ...createStack('swordsman', 'player', 1, 10), count: 5, currentHp: 45 }; // 5 of 10 soldiers left
    const legacy = legacySave({ ...createRun(3, 'warlord'), army: [wounded, createStack('archer', 'player', 4, 4)], relics: [], phase: 'choosing_starting_relic' });
    const { run } = applyRunAction(legacy, { type: 'LEAVE_MERCHANT' }); // rejected, but every action migrates the save first
    const grown = run.army.find((s) => s.stackId === wounded.stackId)!;
    const hp = UNIT_DEFINITIONS.swordsman.hpPerUnit;
    expect(run.relics.map((r) => r.id)).toEqual(['royal_banner']);
    expect(grown.currentHp).toBe(45 + 6 * hp);
    expect(grown.count).toBe(5 + 6);
    expect(grown.maxHp).toBe(16 * hp);
    expect(grown.preBattleMaxCount).toBe(16);
    expect(grown.startingCount).toBe(16);
  });

  it('a fresh run still starts the stack at full health', () => {
    const run = createRun(3, 'warlord', undefined, 'royal_banner');
    for (const s of run.army) expect(s.currentHp).toBe(s.maxHp);
  });
});

describe('AO-036: enemySteps on the run result', () => {
  function inBattle(): RunState {
    const run = createRun(11, 'warlord');
    const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    const nextId = current.connectsTo[0]!;
    const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n)) };
    return applyRunAction({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
  }

  it('COMBAT_ACTION END_TURN returns the same steps the combat engine produced', () => {
    const run = inBattle();
    expect(run.phase).toBe('in_battle');
    const expected = applyPlayerAction(run.combat!, { type: 'END_TURN' }).enemySteps!;
    expect(expected.length).toBeGreaterThan(0);
    const result = applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
    expect(result.enemySteps).toEqual(expected);
  });

  it('other actions carry no enemySteps', () => {
    const run = inBattle();
    const stack = run.combat!.playerArmy[0]!;
    const enemy = run.combat!.enemyArmy[0]!;
    const result = applyRunAction(run, { type: 'COMBAT_ACTION', action: { type: 'BASIC_ACTION', stackId: stack.stackId, targetStackId: enemy.stackId } });
    expect(result.enemySteps).toBeUndefined();
    expect(applyRunAction(createRun(1), { type: 'LEAVE_CITY' }).enemySteps).toBeUndefined();
  });
});
