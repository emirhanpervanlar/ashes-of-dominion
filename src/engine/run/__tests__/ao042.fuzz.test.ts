import { describe, expect, it } from 'vitest';
import { applyRunAction, createRun } from '../runEngine.js';
import { buildPendingReward } from '../rewards.js';
import { generateMerchantInventory } from '../merchant.js';
import { pendingEventOf } from './eventHelpers.js';
import type { RunAction, RunState } from '../types.js';
import type { NodeType } from '../worldMap.js';

/** Small deterministic generator so a failing case is reproducible from its seed. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOSTILE_VALUES: unknown[] = [
  NaN, Infinity, -Infinity, -1, 0, -0, 1, 1.5, 0.1, 2, 7, 1e15, 1e308, Number.MAX_SAFE_INTEGER, Number.MIN_VALUE,
  '', 'x', '1', 'constructor', '__proto__', 'toString', 'hasOwnProperty', null, undefined, true, false, {}, [], [1], { type: 'END_TURN' },
];

const ACTION_TYPES = [
  'MOVE_TO', 'COMBAT_ACTION', 'CLAIM_CARD', 'CLAIM_UPGRADE', 'CLAIM_RELIC', 'REMOVE_CARD', 'CHOOSE_EVENT_OPTION',
  'CHOOSE_EVENT_CARD', 'CHOOSE_EVENT_UNIT', 'CANCEL_EVENT_CHOICE', 'DISMISS_STACK', 'DECLINE_UNIT_GAIN', 'BUY_CARD', 'BUY_RELIC',
  'LEAVE_MERCHANT', 'TRAVEL_TO_CITY', 'RECRUIT', 'BUILD_BUILDING', 'UPGRADE_CITY', 'UPGRADE_MAGE_TOWER', 'UPGRADE_FARM', 'UPGRADE_BARRACKS', 'COLLECT_GARRISON',
  'CHOOSE_DOCTRINE', 'LEAVE_CITY', 'SPLIT_STACK', 'MERGE_STACKS', 'MOVE_STACK', 'NOT_AN_ACTION', '', 'constructor',
];
const FIELDS = ['nodeId', 'action', 'cardId', 'instanceId', 'relicId', 'optionId', 'unitId', 'stackId', 'count', 'buildingId', 'doctrineId', 'splitCount', 'stackIdA', 'stackIdB', 'toPosition'];

/** Ids that exist in the state, so hostile actions also reach past the shape check into the handlers. */
function realValues(run: RunState): unknown[] {
  const node = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId);
  return [
    ...run.army.map((s) => s.stackId), ...run.masterDeck.map((c) => c.instanceId), ...run.masterDeck.map((c) => c.cardId),
    ...(node?.connectsTo ?? []), ...(run.pendingReward?.cardOptions ?? []), ...(run.pendingMerchant?.cardOffers.map((o) => o.cardId) ?? []),
    run.pendingMerchant?.relicOffer?.relicId, run.pendingEvent?.eventId, 'swordsman', 'archer', 'knight', 'priest', 'market', 'farm', 'training_hall',
    'mage_tower', 'military', 'economic', 'stable', 'shrine', ...run.combat?.hand.map((c) => c.instanceId) ?? [], ...run.combat?.enemyArmy.map((s) => s.stackId) ?? [],
    3, 4, 5, 6,
  ];
}

function hostileAction(run: RunState, random: () => number): unknown {
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)]!;
  const values = [...HOSTILE_VALUES, ...realValues(run)];
  const combat = () => (random() < 0.5 ? { type: pick(['PLAY_CARD', 'BASIC_ACTION', 'END_TURN', 'X']), instanceId: pick(values), stackId: pick(values), actingStackId: pick(values), targetStackId: pick(values), toPosition: pick(values) } : pick(values));
  if (random() < 0.05) return pick([null, undefined, 5, 'MOVE_TO', [], {}]);
  const action: Record<string, unknown> = { type: pick(ACTION_TYPES) };
  for (const field of FIELDS) {
    if (random() < 0.45) action[field] = field === 'action' ? combat() : pick(values);
  }
  return action;
}

function stepTo(run: RunState, type: NodeType): RunState {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...run.worldMap, nodes: run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n)) };
  return applyRunAction({ ...run, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

function startStates(seed: number): RunState[] {
  const fresh = createRun(seed);
  const base = { ...fresh, gold: 500, food: 80, city: { ...fresh.city, barracksTier: 2 as const }, garrison: { swordsman: 3, archer: 2 } };
  const reward: RunState = { ...base, phase: 'reward', pendingReward: buildPendingReward({ ...base.rng }, base.relics, base.masterDeck, true, false) };
  const merchant: RunState = { ...base, phase: 'merchant', pendingMerchant: generateMerchantInventory({ ...base.rng }, base.relics) };
  const event: RunState = { ...base, phase: 'event', pendingEvent: pendingEventOf('mercenary_camp') };
  const city = applyRunAction(base, { type: 'TRAVEL_TO_CITY' }).run;
  return [base, city, stepTo(base, 'battle'), stepTo(base, 'event'), reward, merchant, event];
}

function violations(run: RunState): string[] {
  const bad: string[] = [];
  const whole = (name: string, value: number) => {
    if (!Number.isInteger(value) || value < 0) bad.push(`${name}=${value}`);
  };
  whole('gold', run.gold);
  whole('food', run.food);
  whole('threat', run.threat);
  whole('starvationDays', run.starvationDays);
  whole('day', run.day);
  for (const [unitId, count] of Object.entries(run.garrison)) whole(`garrison.${unitId}`, count);
  whole('mana', run.hero.mana);
  whole('maxMana', run.hero.maxMana);
  for (const stack of [...run.army, ...(run.combat?.playerArmy ?? []), ...(run.combat?.enemyArmy ?? [])]) {
    whole(`${stack.stackId}.count`, stack.count);
    if (!Number.isFinite(stack.currentHp) || stack.currentHp < 0) bad.push(`${stack.stackId}.currentHp=${stack.currentHp}`);
    if (!Number.isFinite(stack.maxHp) || stack.maxHp < 0) bad.push(`${stack.stackId}.maxHp=${stack.maxHp}`);
    if (!Number.isInteger(stack.position) || stack.position < 1 || stack.position > 6) bad.push(`${stack.stackId}.position=${stack.position}`);
  }
  const positions = run.army.filter((s) => s.count > 0).map((s) => s.position);
  if (new Set(positions).size !== positions.length) bad.push('two army stacks share a position');
  if (run.army.length > 6) bad.push(`army has ${run.army.length} stacks`);
  return bad;
}

describe('AO-042: the reducer survives hostile actions', () => {
  it('never throws, never leaves NaN/negative/fractional numbers and never mutates its input (thousands of hostile actions)', () => {
    let applied = 0;
    let rejected = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const random = makeRandom(seed * 7919);
      for (const start of startStates(seed)) {
        let run = start;
        for (let i = 0; i < 60; i++) {
          const action = hostileAction(run, random);
          const before = JSON.stringify(run);
          let result;
          try {
            result = applyRunAction(run, action as RunAction);
          } catch (error) {
            throw new Error(`seed ${seed}, step ${i}: ${JSON.stringify(action)} threw ${(error as Error).stack}`);
          }
          expect(JSON.stringify(run), `input mutated by ${JSON.stringify(action)}`).toBe(before);
          expect(violations(result.run), `after ${JSON.stringify(action)}`).toEqual([]);
          applied += 1;
          if (result.events.some((e) => e.type === 'ACTION_REJECTED')) rejected += 1;
          run = result.run;
        }
      }
    }
    expect(applied).toBeGreaterThan(15000);
    expect(rejected).toBeGreaterThan(applied / 2);
  });

  it('rejects malformed counts, positions and ids with ACTION_REJECTED and leaves the run unchanged', () => {
    const city = applyRunAction({ ...createRun(3), gold: 900, city: { ...createRun(3).city, barracksTier: 4 } }, { type: 'TRAVEL_TO_CITY' }).run;
    const stack = city.army[0]!;
    const bad: unknown[] = [
      { type: 'RECRUIT', unitId: 'swordsman', count: NaN },
      { type: 'RECRUIT', unitId: 'swordsman', count: Infinity },
      { type: 'RECRUIT', unitId: 'swordsman', count: 1.5 },
      { type: 'RECRUIT', unitId: 'swordsman', count: -3 },
      { type: 'RECRUIT', unitId: 'swordsman', count: 0 },
      { type: 'RECRUIT', unitId: 'swordsman', count: '2' },
      { type: 'RECRUIT', unitId: 'constructor', count: 1 },
      { type: 'RECRUIT', unitId: 'swordsman' },
      { type: 'SPLIT_STACK', stackId: stack.stackId, splitCount: 1.5 },
      { type: 'SPLIT_STACK', stackId: stack.stackId, splitCount: NaN },
      { type: 'SPLIT_STACK', stackId: 'nope', splitCount: 1 },
      { type: 'DISMISS_STACK', stackId: stack.stackId, count: NaN },
      { type: 'DISMISS_STACK', stackId: stack.stackId, count: -1 },
      { type: 'DISMISS_STACK', stackId: stack.stackId, count: 0.5 },
      { type: 'DISMISS_STACK', stackId: 'nope' },
      { type: 'MERGE_STACKS', stackIdA: stack.stackId },
      { type: 'MERGE_STACKS', stackIdA: stack.stackId, stackIdB: stack.stackId },
      { type: 'MOVE_STACK', stackId: stack.stackId, toPosition: 0 },
      { type: 'MOVE_STACK', stackId: stack.stackId, toPosition: 7 },
      { type: 'MOVE_STACK', stackId: stack.stackId, toPosition: 2.5 },
      { type: 'MOVE_STACK', stackId: stack.stackId, toPosition: NaN },
      { type: 'MOVE_STACK', stackId: 'nope', toPosition: 3 },
      { type: 'BUILD_BUILDING', buildingId: 'constructor' },
      { type: 'CHOOSE_DOCTRINE', doctrineId: '__proto__' },
      { type: 'MOVE_TO' },
      { type: 'COMBAT_ACTION', action: { type: 'PLAY_CARD', instanceId: 5 } },
    ];
    for (const action of bad) {
      const result = applyRunAction(city, action as RunAction);
      expect(result.events.map((e) => e.type), JSON.stringify(action)).toEqual(['ACTION_REJECTED']);
      expect({ ...result.run, log: [] }, JSON.stringify(action)).toEqual({ ...city, log: [] });
    }
  });

  it('an unknown or non-object action is rejected, never undefined', () => {
    const run = createRun(2);
    for (const action of [{ type: 'NOT_AN_ACTION' }, { type: 5 }, {}, null, undefined, 'MOVE_TO', 7, []]) {
      const result = applyRunAction(run, action as unknown as RunAction);
      expect(result).toBeDefined();
      expect(result.events.map((e) => e.type)).toEqual(['ACTION_REJECTED']);
      expect(result.run.log.at(-1)).toMatchObject({ type: 'ACTION_REJECTED' });
    }
  });
});
