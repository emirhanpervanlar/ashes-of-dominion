import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import type { CombatState } from '../../types.js';
import { nextCityVisitRaisesThreat } from '../chapters.js';
import { buildPendingReward } from '../rewards.js';
import { CURRENT_SAVE_VERSION, applyRunAction, createRun, migrateRun } from '../runEngine.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';
import { validateSave } from '../save.js';
import { pickReward } from './rewardHelpers.js';

const act = (run: RunState, action: RunAction) => applyRunAction(run, action);
const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A run standing at a fresh node of `type` one step from the current one, arrived and (for fights) in battle. */
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

describe('AO-046 item 1 (AO-D068): the reward cannot be skipped', () => {
  it('always offers at least 2 new cards, also when nothing in the deck can be upgraded', () => {
    const deck = createRun(1).masterDeck.map((c) => ({ ...c, upgraded: true }));
    for (let seed = 1; seed <= 30; seed++) {
      const reward = buildPendingReward(createRng(seed), [], deck, false);
      expect(reward.upgradeOptions).toHaveLength(0);
      expect(reward.cardOptions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('SKIP_REWARD no longer exists and REMOVE_CARD is refused on the reward screen', () => {
    const won = winFight(arriveAt(createRun(3), 'battle'));
    expect(won.phase).toBe('reward');
    expect(rejected(act(won, { type: 'SKIP_REWARD' } as unknown as RunAction).events)).toBe(true);
    const removal = act(won, { type: 'REMOVE_CARD', instanceId: won.masterDeck[0]!.instanceId });
    expect(rejected(removal.events)).toBe(true);
    expect(removal.run.phase).toBe('reward');
  });

  it('an elite win grants the relic at once (one RELIC_CLAIMED with the id stored as relicGained); a boss win still offers a choice', () => {
    const elite = arriveAt(createRun(5), 'elite_battle');
    const won = winFight(elite);
    const id = won.pendingReward!.relicGained!;
    expect(won.relics.map((r) => r.id)).toContain(id);
    expect(won.log.filter((e) => e.type === 'RELIC_CLAIMED' && e.relicId === id)).toHaveLength(1);

    const boss = winFight(arriveAt({ ...createRun(5), day: 29 }, 'boss'));
    expect(boss.pendingReward!.relicGained).toBeNull();
    expect(boss.pendingReward!.relicChoices).toHaveLength(3);
  });

  it('a version-2 save waiting on the old elite relic offer is granted that relic when it loads', () => {
    const run = createRun(6);
    const legacy = { ...roundTrip(run), saveVersion: 2, phase: 'reward', pendingReward: { cardOptions: ['charge'], upgradeOptions: [], relicOffer: 'arcane_crystal', relicChoices: [] } };
    const migrated = validateSave(legacy)!;
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.relics.map((r) => r.id)).toContain('arcane_crystal');
    expect(migrated.pendingReward).toEqual({ cardOptions: ['charge'], upgradeOptions: [], relicGained: 'arcane_crystal', relicChoices: [] });
    expect(migrateRun(migrated)).toBe(migrated);
  });
});

describe('AO-046 item 2 (AO-D070): free city visits', () => {
  const visit = (run: RunState): RunState => act(act(run, { type: 'TRAVEL_TO_CITY' }).run, { type: 'LEAVE_CITY' }).run;

  it('the first visit of the run is free, later ones raise Threat, and the helper tells the UI in advance', () => {
    let run = createRun(7);
    expect(nextCityVisitRaisesThreat(run)).toBe(false);
    run = visit(run);
    expect([run.threat, run.cityVisitsThisChapter]).toEqual([0, 1]);
    expect(nextCityVisitRaisesThreat(run)).toBe(true);
    run = visit(run);
    run = visit(run);
    expect([run.threat, run.cityVisitsThisChapter]).toEqual([2, 3]);
  });

  it('the first visit of every new chapter is free again (counter reset on CHAPTER_STARTED)', () => {
    let run = visit(visit(createRun(8)));
    expect(run.threat).toBe(1);
    const boss = winFight(arriveAt({ ...run, day: 29 }, 'boss'));
    const started = pickReward(boss);
    expect(started.events.some((e) => e.type === 'CHAPTER_STARTED')).toBe(true);
    run = started.run;
    expect(run.cityVisitsThisChapter).toBe(0);
    expect(nextCityVisitRaisesThreat(run)).toBe(false);
    expect(visit(run).threat).toBe(1);
    expect(visit(visit(run)).threat).toBe(2);
  });

  it('old saves: a run that carries Threat counts as having visited; one without does not', () => {
    const fresh = roundTrip({ ...createRun(9), saveVersion: 2 }) as unknown as Record<string, unknown>;
    delete fresh.cityVisitsThisChapter;
    expect(validateSave(fresh)!.cityVisitsThisChapter).toBe(0);
    expect(validateSave({ ...fresh, threat: 3 })!.cityVisitsThisChapter).toBe(1);
  });
});
