import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../../data/cards.js';
import type { CombatState } from '../../types.js';
import { createRng } from '../../rng.js';
import { EVENT_TUNING, eventView, upgradableCardIds } from '../events.js';
import { buildPendingReward, generateUpgradeOptions } from '../rewards.js';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunState } from '../types.js';
import { pendingEventOf } from './eventHelpers.js';

const rejected = (events: { type: string }[]) => events.some((e) => e.type === 'ACTION_REJECTED');

function onMap(seed: number): RunState {
  return applyRunAction(createRun(seed), { type: 'CHOOSE_STARTING_RELIC', relicId: 'royal_banner' }).run;
}

function atReward(seed: number): RunState {
  const run = onMap(seed);
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const map = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n)) };
  const fighting = applyRunAction({ ...run, worldMap: map }, { type: 'MOVE_TO', nodeId: nextId }).run;
  const wiped: CombatState = { ...fighting.combat!, enemyArmy: fighting.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return applyRunAction({ ...fighting, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

describe('AO-032: reward Upgrade pick', () => {
  it('offers one upgradable deck card next to two new cards, never an already upgraded one', () => {
    const deck = createRun(1).masterDeck.map((c, i) => (i < 9 ? { ...c, upgraded: true } : c));
    for (let seed = 1; seed <= 20; seed++) {
      const reward = buildPendingReward(createRng(seed), [], deck, false);
      expect(reward.upgradeOptions).toEqual([{ instanceId: deck[9]!.instanceId, cardId: deck[9]!.cardId }]);
      expect(reward.cardOptions).toHaveLength(2);
    }
    expect(generateUpgradeOptions(createRng(1), deck.map((c) => ({ ...c, upgraded: true })), 3)).toEqual([]);
  });

  it('with nothing upgradable the screen falls back to three new cards', () => {
    const deck = createRun(1).masterDeck.map((c) => ({ ...c, upgraded: true }));
    const reward = buildPendingReward(createRng(3), [], deck, false);
    expect(reward.upgradeOptions).toHaveLength(0);
    expect(reward.cardOptions).toHaveLength(3);
  });

  it('CLAIM_UPGRADE marks the same card instance as upgraded and closes the reward', () => {
    const run = atReward(21);
    const option = run.pendingReward!.upgradeOptions[0]!;
    const claimed = applyRunAction(run, { type: 'CLAIM_UPGRADE', instanceId: option.instanceId });
    expect(claimed.events.some((e) => e.type === 'CARD_UPGRADED' && e.instanceId === option.instanceId && e.cardId === option.cardId)).toBe(true);
    const card = claimed.run.masterDeck.find((c) => c.instanceId === option.instanceId)!;
    expect(card).toMatchObject({ cardId: option.cardId, upgraded: true });
    expect(claimed.run.masterDeck).toHaveLength(run.masterDeck.length);
    expect(claimed.run.phase).toBe('on_map');
    expect(claimed.run.pendingReward).toBeNull();
  });

  it('an already upgraded card cannot be claimed again, and a card that is not on offer is rejected', () => {
    const run = atReward(21);
    const option = run.pendingReward!.upgradeOptions[0]!;
    const already = { ...run, masterDeck: run.masterDeck.map((c) => (c.instanceId === option.instanceId ? { ...c, upgraded: true } : c)) };
    const again = applyRunAction(already, { type: 'CLAIM_UPGRADE', instanceId: option.instanceId });
    expect(rejected(again.events)).toBe(true);
    expect(again.run.phase).toBe('reward');
    expect(rejected(applyRunAction(run, { type: 'CLAIM_UPGRADE', instanceId: 'nope' }).events)).toBe(true);
  });

  it('the upgraded card reaches the next battle as an upgraded instance', () => {
    const run = atReward(21);
    const option = run.pendingReward!.upgradeOptions[0]!;
    const back = applyRunAction(run, { type: 'CLAIM_UPGRADE', instanceId: option.instanceId }).run;
    const current = back.worldMap.nodes.find((n) => n.id === back.worldMap.currentNodeId)!;
    const nextId = current.connectsTo[0]!;
    const map = { ...back.worldMap, nodes: back.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n)) };
    const fighting = applyRunAction({ ...back, worldMap: map }, { type: 'MOVE_TO', nodeId: nextId }).run;
    const inBattle = [...fighting.combat!.hand, ...fighting.combat!.deck].find((c) => c.instanceId === option.instanceId);
    expect(inBattle).toMatchObject({ cardId: option.cardId, upgraded: true });
  });
});

describe('AO-032: event upgrades (Study, Sharpen)', () => {
  const atEvent = (eventId: string, patch: Partial<RunState> = {}): RunState => ({ ...onMap(1), phase: 'event', pendingEvent: pendingEventOf(eventId), ...patch });

  it('Forgotten Library Study upgrades the picked card once', () => {
    const run = atEvent('forgotten_library');
    expect(upgradableCardIds(run)).toHaveLength(run.masterDeck.length);
    const picking = applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId: 'study' }).run;
    expect(picking.pendingEvent!.choice).toMatchObject({ kind: 'card', action: 'upgrade' });
    const target = run.masterDeck[3]!;
    const done = applyRunAction(picking, { type: 'CHOOSE_EVENT_CARD', instanceId: target.instanceId });
    expect(done.run.masterDeck.find((c) => c.instanceId === target.instanceId)).toMatchObject({ cardId: target.cardId, upgraded: true });
    expect(done.run.masterDeck.filter((c) => c.upgraded)).toHaveLength(1);
    expect(done.run.phase).toBe('on_map');

    // The upgraded card is no longer offered, and cannot be picked by hand either.
    const second = { ...run, masterDeck: done.run.masterDeck };
    expect(upgradableCardIds(second)).not.toContain(target.instanceId);
    const pickingAgain = applyRunAction(second, { type: 'CHOOSE_EVENT_OPTION', optionId: 'study' }).run;
    expect(pickingAgain.pendingEvent!.choice).toMatchObject({ kind: 'card', action: 'upgrade' });
    expect(rejected(applyRunAction(pickingAgain, { type: 'CHOOSE_EVENT_CARD', instanceId: target.instanceId }).events)).toBe(true);
  });

  it('Wandering Smith Sharpen charges the Gold and upgrades the picked card', () => {
    const gold = 200;
    const run = atEvent('wandering_smith', { gold });
    const picking = applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId: 'sharpen' }).run;
    const target = run.masterDeck[0]!;
    const done = applyRunAction(picking, { type: 'CHOOSE_EVENT_CARD', instanceId: target.instanceId });
    expect(done.run.masterDeck.find((c) => c.instanceId === target.instanceId)!.upgraded).toBe(true);
    expect(done.run.gold).toBe(gold - EVENT_TUNING.wandering_smith.sharpenGold);
  });

  it('both options are unavailable when every card is already upgraded', () => {
    const upgraded = onMap(1).masterDeck.map((c) => ({ ...c, upgraded: true }));
    for (const [eventId, optionId] of [['forgotten_library', 'study'], ['wandering_smith', 'sharpen']] as const) {
      const run = atEvent(eventId, { masterDeck: upgraded, gold: 500 });
      expect(eventView(run)!.options.find((o) => o.id === optionId)).toMatchObject({ available: false, reason: 'No card in your deck can be upgraded.' });
      expect(rejected(applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId }).events)).toBe(true);
    }
  });

  it('every starting-deck card is upgradable', () => {
    for (const hero of ['warlord', 'rogue', 'mage'] as const) {
      for (const c of createRun(1, hero).masterDeck) expect(CARD_DEFINITIONS[c.cardId] && upgradableCardIds({ masterDeck: [c] })).toHaveLength(1);
    }
  });
});
