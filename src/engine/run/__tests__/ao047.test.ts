import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import type { CombatState } from '../../types.js';
import { GOLD_MINE_DAILY_GOLD } from '../city.js';
import { battleLootBands } from '../loot.js';
import { MINE, mineDailyGold } from '../mines.js';
import { isSimpleRelic } from '../relicSources.js';
import { RELIC_DEFINITIONS } from '../../data/relics.js';
import { CURRENT_SAVE_VERSION, applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import { validateSave } from '../save.js';
import { NODE_WEIGHTS, generateWorldMap, type NodeType } from '../worldMap.js';
import { legacySave } from './legacy.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function arriveAt(run: RunState, type: NodeType): RunState {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return act({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

function winFight(fighting: RunState): RunState {
  const combat = fighting.combat!;
  const won: CombatState = { ...combat, enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return act({ ...fighting, combat: won }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

describe('AO-047 item 1 (AO-D076): node generation', () => {
  it('a chapter map only holds the new node types and mixes every objective', () => {
    const seen = new Set<string>();
    const allowed = new Set(['start', 'boss', ...Object.keys(NODE_WEIGHTS)]);
    for (let seed = 1; seed <= 40; seed++) {
      for (const chapter of [1, 2, 3]) {
        for (const n of generateWorldMap(createRng(seed), chapter, (chapter - 1) * 30 + 1).nodes) {
          expect(allowed.has(n.type)).toBe(true);
          seen.add(n.type);
        }
      }
    }
    expect(seen).toEqual(allowed);
  });
});

describe('AO-047 item 1: mines', () => {
  it('capturing a mine pays a small one-off find, stays on the map and counts in the stats', () => {
    const run = arriveAt(createRun(5), 'mine');
    expect(run.phase).toBe('on_map');
    expect(run.mines).toBe(1);
    expect(run.stats.minesCaptured).toBe(1);
    const found = run.log.find((e) => e.type === 'MINE_CAPTURED');
    if (found?.type !== 'MINE_CAPTURED') throw new Error('no MINE_CAPTURED');
    expect(found.mines).toBe(1);
    expect(found.gold).toBeGreaterThanOrEqual(MINE.find.gold[0]);
    expect(found.gold).toBeLessThanOrEqual(MINE.find.gold[1]);
  });

  it('is deterministic per seed', () => {
    expect(arriveAt(createRun(9), 'mine').gold).toBe(arriveAt(createRun(9), 'mine').gold);
  });

  it('every captured mine pays its Gold on every day, stacking with the Gold Mine building', () => {
    let run = createRun(6);
    for (let i = 0; i < 3; i++) run = arriveAt(run, 'mine');
    expect(run.mines).toBe(3);
    expect(mineDailyGold(run)).toBe(3 * MINE.dailyGold);

    const incomeOf = (r: RunState): number => {
      const next = arriveAt(r, 'event');
      const income = next.log.slice(r.log.length).find((e) => e.type === 'DAILY_INCOME');
      return income?.type === 'DAILY_INCOME' ? income.gold : 0;
    };
    expect(incomeOf(run)).toBe(3 * MINE.dailyGold);

    const withBuilding = { ...run, city: { ...run.city, buildings: [...run.city.buildings, 'gold_mine'] } };
    expect(incomeOf(withBuilding)).toBe(3 * MINE.dailyGold + GOLD_MINE_DAILY_GOLD);
  });
});

describe('AO-047 item 2 (AO-D077): forts', () => {
  it('a fort victory grants a drawback-free relic automatically and counts as a fort taken', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const fort = arriveAt(createRun(seed), 'fort');
      expect(fort.phase).toBe('in_battle');
      const won = winFight(fort);
      expect(won.phase).toBe('reward');
      expect(won.stats.fortsTaken).toBe(1);
      const gained = won.pendingReward!.relicGained!;
      expect(isSimpleRelic(RELIC_DEFINITIONS[gained]!)).toBe(true);
      expect(won.relics.some((r) => r.id === gained)).toBe(true);
    }
  });

  it('a fort pays more Gold and a better Food chance than a plain battle', () => {
    for (const chapter of [1, 2, 3]) {
      const ctx = { chapter, day: (chapter - 1) * 30 + 10, threat: 0 };
      const plain = battleLootBands({ ...ctx, fort: false });
      const fort = battleLootBands({ ...ctx, fort: true });
      expect(fort.gold[0]).toBeGreaterThan(plain.gold[0]);
      expect(fort.gold[1]).toBeGreaterThan(plain.gold[1]);
      expect(fort.foodChance).toBeGreaterThan(plain.foodChance);
      expect(fort.food[1]).toBeGreaterThan(plain.food[1]);
    }
  });
});

describe('AO-047: save migration', () => {
  /** A version-3 save as the previous build wrote it. */
  function oldSave(seed: number): RunState {
    const run = createRun(seed);
    const types = ['resource', 'elite_battle'];
    const nodes = run.worldMap.nodes.map((n, i) => (n.type === 'start' || n.type === 'boss' ? n : { ...n, type: types[i % 2]! }));
    const { mines: _m, ...rest } = run;
    const { fortsTaken: _f, minesCaptured: _c, ...stats } = run.stats;
    const log = [{ type: 'ARRIVED_AT_NODE', nodeId: 'x', nodeType: 'resource' }, { type: 'RESOURCE_FOUND', gold: 30, food: 12 }];
    return roundTrip({ ...rest, saveVersion: 3, worldMap: { ...run.worldMap, nodes }, stats: { ...stats, elitesDefeated: 4 }, log }) as unknown as RunState;
  }

  it('resource nodes become mines, elite battles forts, elite stats forts taken, and the run starts with no captured mines', () => {
    const migrated = migrateRun(oldSave(3));
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    const types = new Set<string>(migrated.worldMap.nodes.map((n) => n.type));
    expect(types.has('mine')).toBe(true);
    expect(types.has('fort')).toBe(true);
    expect(types.has('resource') || types.has('elite_battle')).toBe(false);
    expect(migrated.stats.fortsTaken).toBe(4);
    expect(migrated.stats.minesCaptured).toBe(0);
    expect('elitesDefeated' in migrated.stats).toBe(false);
    expect(migrated.mines).toBe(0);
    expect(migrated.log[0]).toMatchObject({ nodeType: 'mine' });
    expect(migrated.log[1]).toMatchObject({ type: 'MINE_CAPTURED', gold: 30, food: 12 });
    expect(validateSave(oldSave(3))).not.toBeNull();
  });

  it('a pre-versioning battle at an elite node restarts as a fort encounter', () => {
    const fort = arriveAt(createRun(8), 'fort');
    const expected = fort.combat!.enemyArmy.map((s) => s.count);
    const old = legacySave(roundTrip(fort)) as unknown as { worldMap: { nodes: { id: string; type: string }[]; currentNodeId: string } };
    for (const n of old.worldMap.nodes) if (n.id === old.worldMap.currentNodeId) n.type = 'elite_battle';
    const migrated = validateSave(old)!;
    expect(migrated.phase).toBe('in_battle');
    expect(migrated.combat!.enemyArmy.map((s) => s.count)).toEqual(expected);
  });
});
