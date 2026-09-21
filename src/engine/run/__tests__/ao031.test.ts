import { describe, expect, it } from 'vitest';
import { STARTING_RELIC_DEFINITIONS } from '../../data/relics.js';
import type { CombatState } from '../../types.js';
import { applyRunAction, createRun, migrateRun } from '../runEngine.js';
import { previewStart, startingRelicList } from '../start.js';
import { causeOfDeath, runSummary } from '../summary.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';
import { pendingEventOf, resolveEventToMap } from './eventHelpers.js';
import { legacySave } from './legacy.js';
import { pickReward } from './rewardHelpers.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);

function moveToNextAs(run: RunState, type: NodeType): RunState {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return act({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

function winCurrentBattle(run: RunState): RunState {
  const combat = run.combat!;
  const won: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return act({ ...run, combat: won }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

describe('AO-031: atomic run start', () => {
  it('createRun with a relic lands on the map with the relic applied and logged', () => {
    const run = createRun(7, 'mage', 'Ayla', 'travelers_purse');
    expect(run.phase).toBe('on_map');
    expect(run.hero.name).toBe('Ayla');
    expect(run.relics.map((r) => r.id)).toEqual(['travelers_purse']);
    expect(run.gold).toBe(150);
    expect(run.stats.largestStack).toBeGreaterThan(0);
    expect(run.log).toEqual([{ type: 'RUN_STARTED' }, { type: 'STARTING_RELIC_CHOSEN', relicId: 'travelers_purse' }]);
  });

  it('an old save still in the removed relic phase gets the default relic on migration and via the reducer', () => {
    const base = createRun(8, 'warlord', undefined, 'whetstone');
    const legacy = legacySave({ ...base, phase: 'choosing_starting_relic', relics: [] });
    const migrated = migrateRun(legacy);
    expect(migrated.phase).toBe('on_map');
    expect(migrated.relics.map((r) => r.id)).toEqual(['royal_banner']);
    expect(migrated.army.find((s) => s.unitId === 'swordsman')!.count).toBe(10);
    expect(legacy.army.find((s) => s.unitId === 'swordsman')!.count).toBe(4); // the input is not mutated
    const viaReducer = act(legacy, { type: 'TRAVEL_TO_CITY' }).run;
    expect(viaReducer.phase).toBe('city');
    expect(viaReducer.relics.map((r) => r.id)).toEqual(['royal_banner']);
  });
});

describe('AO-031: start preview', () => {
  it('lists the five starting relics in a fixed order with effect summaries', () => {
    const list = startingRelicList();
    expect(list.map((r) => r.id)).toEqual(['royal_banner', 'whetstone', 'padded_vest', 'lucky_charm', 'travelers_purse']);
    expect(list.map((r) => r.id).sort()).toEqual(Object.keys(STARTING_RELIC_DEFINITIONS).sort());
    expect(list[0]!.effectSummary).toEqual(['Largest starting stack +6 units']);
    expect(list[1]!.effectSummary).toEqual(['Damage dealt +10%']);
    expect(list[2]!.effectSummary).toEqual(['Damage taken -8%']);
    expect(list[4]!.effectSummary).toEqual(['Starting Gold +50']);
    for (const r of list) expect(r.description.length).toBeGreaterThan(0);
  });

  it('previewStart matches the run createRun really builds', () => {
    for (const hero of ['warlord', 'rogue', 'mage'] as const) {
      for (const { id } of startingRelicList()) {
        const preview = previewStart(hero, id)!;
        const run = createRun(99, hero, undefined, id);
        expect(preview.army).toEqual(run.army.map((s) => ({ unitId: s.unitId, count: s.count, position: s.position })));
        expect(preview.totalUnits).toBe(run.army.reduce((n, s) => n + s.count, 0));
        expect(preview.maxMana).toBe(run.hero.maxMana);
        expect(preview.gold).toBe(run.gold);
        expect(preview.food).toBe(run.food);
        expect(preview.relic.id).toBe(id);
      }
    }
    expect(previewStart('warlord', 'travelers_purse')!.gold).toBe(150);
    expect(previewStart('warlord', 'royal_banner')!.totalUnits).toBe(14);
    expect(previewStart('warlord', 'blood_banner')).toBeUndefined();
  });
});

describe('AO-031: run summary counters', () => {
  it('counts elite and boss victories separately from normal battles', () => {
    let run = winCurrentBattle(moveToNextAs(createRun(21), 'fort'));
    expect(run.stats.fortsTaken).toBe(1);
    run = pickReward(run).run;

    run = winCurrentBattle(moveToNextAs(run, 'battle'));
    expect(run.stats.fortsTaken).toBe(1);
    expect(run.stats.bossesDefeated).toBe(0);
    run = pickReward(run).run;

    run = winCurrentBattle(moveToNextAs(run, 'boss'));
    expect(run.stats.bossesDefeated).toBe(1);
    expect(run.stats.fortsTaken).toBe(1);
    expect(run.stats.battlesWon).toBe(3);
  });

  it('counts an event when it closes', () => {
    const run: RunState = { ...createRun(22), phase: 'event', pendingEvent: pendingEventOf('abandoned_camp') };
    expect(resolveEventToMap(run).stats.eventsResolved).toBe(1);
  });

  it('counts units that starved, and they are part of unitsLost', () => {
    let run: RunState = { ...createRun(23), food: 0 };
    for (let i = 0; i < 4 && run.phase === 'on_map'; i++) {
      const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
      run = act(run, { type: 'MOVE_TO', nodeId: current.connectsTo[0]! }).run;
      if (run.phase === 'in_battle') break;
    }
    expect(run.stats.unitsStarved).toBeGreaterThan(0);
    expect(run.stats.unitsLost).toBeGreaterThanOrEqual(run.stats.unitsStarved);
  });
});

describe('AO-031: runSummary', () => {
  it('returns ordered labelled rows, the relic names and Threat', () => {
    const run = { ...createRun(30), threat: 4, chapter: 2 };
    const summary = runSummary(run);
    expect(summary.rows.map((r) => r.id)).toEqual([
      'chapter', 'days', 'battlesWon', 'bossesDefeated', 'fortsTaken', 'eventsResolved', 'enemiesKilled', 'unitsLost', 'unitsStarved', 'unitsRevived',
      'largestStack', 'damageDealt', 'damageTaken', 'turnsPlayed', 'cardsPlayed', 'goldGathered', 'foodGathered', 'foodEaten', 'relics', 'threat',
    ]);
    expect(summary.rows.find((r) => r.id === 'chapter')!.value).toBe(2);
    expect(summary.rows.find((r) => r.id === 'threat')!.value).toBe(4);
    expect(summary.rows.find((r) => r.id === 'largestStack')!.value).toBe(10);
    expect(summary.relics).toEqual(['Royal Banner']);
    expect(summary.causeOfDeath).toBeNull();
    expect(summary.causeLabel).toBeNull();
  });

  it('names the cause of death: hero fell, starvation, army wiped', () => {
    const base = createRun(31);
    expect(causeOfDeath({ ...base, phase: 'defeat', hero: { ...base.hero, hp: 0 } })).toBe('hero_fell');
    expect(causeOfDeath({ ...base, phase: 'defeat', starvationDays: 2 })).toBe('starvation');
    expect(causeOfDeath({ ...base, phase: 'defeat' })).toBe('army_wiped');
    expect(runSummary({ ...base, phase: 'defeat' }).causeLabel).toBe('Your army was wiped out');
  });
});
