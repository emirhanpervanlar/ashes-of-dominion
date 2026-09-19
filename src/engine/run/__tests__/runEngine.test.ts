import { describe, expect, it } from 'vitest';
import { applyRunAction, createRun } from '../runEngine.js';
import { resolveEventToMap } from './eventHelpers.js';
import type { CombatState } from '../../types.js';
import type { RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';

/**
 * The map's node types are randomized per seed, so tests that care about a
 * specific node type override the current node's first connection rather
 * than searching the random graph for one — simpler and fully deterministic.
 */
function withNextNodeType(run: RunState, type: NodeType): { run: RunState; nodeId: string } {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = {
    ...run.worldMap,
    nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)),
  };
  return { run: { ...run, worldMap }, nodeId: nextId };
}

function startOnMap(seed: number): RunState {
  const run = createRun(seed);
  const started = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
  return started.run;
}

/**
 * Reward-loop tests care about the reward/relic/upgrade mechanics, not
 * combat AI — wipe the enemy army directly (same pattern as
 * combat.test.ts's battle outcome tests) rather than simulating a
 * possibly-losing battle.
 */
function forceVictory(run: RunState): RunState {
  const combat = run.combat;
  if (!combat) throw new Error('no combat in progress');
  const wipedCombat: CombatState = {
    ...combat,
    enemyArmy: combat.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
  };
  const result = applyRunAction({ ...run, combat: wipedCombat }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
  return result.run;
}

function reachBattle(seed: number): RunState {
  const onMap = startOnMap(seed);
  const { run, nodeId } = withNextNodeType(onMap, 'battle');
  const result = applyRunAction(run, { type: 'MOVE_TO', nodeId });
  return result.run;
}

describe('run creation', () => {
  it('starts in choosing_starting_relic with the default Hero (Warlord) army/deck/map/resources', () => {
    const run = createRun(1);
    expect(run.phase).toBe('choosing_starting_relic');
    expect(run.army.map((s) => s.count)).toEqual([6, 2]);
    expect(run.masterDeck.length).toBe(10);
    expect(run.combat).toBeNull();
    expect(run.gold).toBe(100);
    expect(run.food).toBe(50);
    expect(run.day).toBe(1);
    expect(run.worldMap.nodes.length).toBeGreaterThan(10);
    const start = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
    expect(start.visibility).toBe('visited');
  });
});

describe('starting relic', () => {
  it('Royal Banner adds +6 to the largest starting stack and moves to the map', () => {
    const run = createRun(2);
    const result = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const swordsman = result.run.army.find((s) => s.unitId === 'swordsman')!;
    expect(swordsman.count).toBe(12); // 6 (Warlord's largest starting stack) + 6 (AO-D014)
    expect(result.run.phase).toBe('on_map');
    expect(result.run.combat).toBeNull();
  });

  it("Traveler's Purse grants +50 Gold once at run start and does not count as gathered income (AO-D043)", () => {
    const run = createRun(3);
    const result = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'travelers_purse' });
    expect(result.run.gold).toBe(run.gold + 50);
    expect(result.run.stats.goldGathered).toBe(run.stats.goldGathered);
  });

  it('rejects choosing a starting relic twice', () => {
    const run = createRun(4);
    const first = applyRunAction(run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' });
    const second = applyRunAction(first.run, { type: 'CHOOSE_STARTING_RELIC', relicId: 'arcane_crystal' });
    expect(second.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('movement', () => {
  it('rejects moving to a node not connected to the current one', () => {
    const onMap = startOnMap(10);
    const maxLayer = Math.max(...onMap.worldMap.nodes.map((n) => n.layer));
    const farNode = onMap.worldMap.nodes.find((n) => n.layer === maxLayer)!;
    const result = applyRunAction(onMap, { type: 'MOVE_TO', nodeId: farNode.id });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });

  it('consumes Food and advances the Day counter on every move', () => {
    const onMap = startOnMap(11);
    const { run, nodeId } = withNextNodeType(onMap, 'start');
    const result = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    expect(result.run.food).toBeLessThan(run.food);
    expect(result.run.day).toBe(run.day + 1);
    expect(result.run.worldMap.currentNodeId).toBe(nodeId);
  });

  it('applies Starvation (HP -5%, Morale -1) instead of ending the run when Food runs out', () => {
    const onMap = startOnMap(12);
    const starving = { ...onMap, food: 0 };
    const { run, nodeId } = withNextNodeType(starving, 'start');
    const hpBefore = run.army[0]!.currentHp;
    const result = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    expect(result.run.food).toBe(0);
    expect(result.run.phase).not.toBe('defeat');
    expect(result.run.army[0]!.currentHp).toBeLessThan(hpBefore);
    expect(result.run.army[0]!.morale).toBeLessThan(run.army[0]!.morale);
  });

  it('a resource node grants Gold and Food and stays on the map', () => {
    const onMap = startOnMap(13);
    const { run, nodeId } = withNextNodeType(onMap, 'resource');
    const result = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    expect(result.run.phase).toBe('on_map');
    expect(result.run.gold).toBeGreaterThan(run.gold - 3); // food cost only reduces food, not gold
    expect(result.run.food).toBeGreaterThan(0);
  });

  it('the boss node starts a battle, not an immediate run_complete', () => {
    const onMap = startOnMap(14);
    const { run, nodeId } = withNextNodeType(onMap, 'boss');
    const result = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    expect(result.run.phase).toBe('in_battle');
    expect(result.run.bossBattle).toBe(true);
    const total = result.run.combat!.enemyArmy.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBeGreaterThan(150);
  });
});

describe('battle -> reward -> back to map loop', () => {
  it('winning a battle offers a reward, and claiming it returns to the map at once (not run_complete)', () => {
    const won = forceVictory(reachBattle(20));

    expect(won.phase).toBe('reward');
    expect(won.pendingReward).not.toBeNull();
    expect(won.battlesWon).toBe(1);

    const cardId = won.pendingReward!.cardOptions[0]!;
    const claimed = applyRunAction(won, { type: 'CLAIM_CARD', cardId });

    expect(claimed.run.phase).toBe('on_map');
    expect(claimed.run.pendingReward).toBeNull();
    expect(claimed.run.masterDeck.some((c) => c.cardId === cardId)).toBe(true);
    expect(claimed.run.masterDeck.length).toBe(11);
  });

  // The v3 canonical doc's upgrade model (§15) modifies a card's own state rather than
  // swapping to a "_plus" card id — that system isn't implemented yet (Phase 3 "Deck /
  // Build"), so the id-swap CARD_UPGRADES map is intentionally empty for now and no
  // upgrade options are offered.
  it('offers no upgrade options while CARD_UPGRADES is empty (pending the v3 upgrade system)', () => {
    const won = forceVictory(reachBattle(21));
    expect(won.pendingReward!.upgradeOptions).toHaveLength(0);
  });

  it('losing a battle moves to defeat, not run_complete', () => {
    const onMap = startOnMap(22);
    const { run, nodeId } = withNextNodeType(onMap, 'battle');
    const started = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    const wiped: CombatState = {
      ...started.run.combat!,
      playerArmy: started.run.combat!.playerArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })),
    };
    const result = applyRunAction({ ...started.run, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } });
    expect(result.run.phase).toBe('defeat');
  });
});

describe('events', () => {
  it('entering an event node pauses the map and resolving an option returns to it', () => {
    const onMap = startOnMap(30);
    const { run, nodeId } = withNextNodeType(onMap, 'event');
    const arrived = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    expect(arrived.run.phase).toBe('event');
    expect(arrived.run.pendingEvent).not.toBeNull();

    const resolved = resolveEventToMap(arrived.run);
    expect(resolved.phase).toBe('on_map');
    expect(resolved.pendingEvent).toBeNull();
  });
});

describe('merchant', () => {
  it('entering a merchant node offers cards/a relic for Gold, purchasable while affordable', () => {
    const onMap = startOnMap(40);
    const richRun = { ...onMap, gold: 500 };
    const { run, nodeId } = withNextNodeType(richRun, 'merchant');
    const arrived = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    expect(arrived.run.phase).toBe('merchant');
    expect(arrived.run.pendingMerchant!.cardOffers.length).toBeGreaterThan(0);

    const offer = arrived.run.pendingMerchant!.cardOffers[0]!;
    const bought = applyRunAction(arrived.run, { type: 'BUY_CARD', cardId: offer.cardId });
    expect(bought.run.gold).toBe(500 - offer.price);
    expect(bought.run.masterDeck.some((c) => c.cardId === offer.cardId)).toBe(true);

    const left = applyRunAction(bought.run, { type: 'LEAVE_MERCHANT' });
    expect(left.run.phase).toBe('on_map');
  });

  it('rejects a purchase without enough Gold', () => {
    const onMap = startOnMap(41);
    const poorRun = { ...onMap, gold: 0 };
    const { run, nodeId } = withNextNodeType(poorRun, 'merchant');
    const arrived = applyRunAction(run, { type: 'MOVE_TO', nodeId });
    const offer = arrived.run.pendingMerchant!.cardOffers[0]!;
    const result = applyRunAction(arrived.run, { type: 'BUY_CARD', cardId: offer.cardId });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
  });
});

describe('determinism', () => {
  it('identical seed + identical actions produce identical run state', () => {
    const run = (seed: number) => forceVictory(reachBattle(seed));
    const a = run(100);
    const b = run(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
