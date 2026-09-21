import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../../data/cards.js';
import { generateBattleEncounter } from '../encounters.js';
import { buildPendingReward } from '../rewards.js';
import { generateMerchantInventory } from '../merchant.js';
import { CURRENT_SAVE_VERSION, applyRunAction, createRun, migrateRun } from '../runEngine.js';
import { validateSave } from '../save.js';
import type { RunState } from '../types.js';
import { pendingEventOf } from './eventHelpers.js';
import { legacySave } from './legacy.js';

function battleRun(seed: number): RunState {
  const base = createRun(seed);
  const current = base.worldMap.nodes.find((n) => n.id === base.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const worldMap = { ...base.worldMap, nodes: base.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type: 'battle' as const } : n)) };
  return applyRunAction({ ...base, worldMap }, { type: 'MOVE_TO', nodeId: nextId }).run;
}

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('AO-042: save versions', () => {
  it('a new run is stamped with the current version and the reducer keeps it', () => {
    expect(CURRENT_SAVE_VERSION).toBe(4);
    const run = createRun(1);
    expect(run.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(applyRunAction(run, { type: 'TRAVEL_TO_CITY' }).run.saveVersion).toBe(CURRENT_SAVE_VERSION);
  });

  it('a save without saveVersion is legacy: it is migrated and stamped, and a current save is not touched', () => {
    const run = createRun(2);
    const { stats: _s, seenEventIds: _e, ...rest } = legacySave(run) as unknown as Record<string, unknown>;
    const migrated = migrateRun(rest as unknown as RunState);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.seenEventIds).toEqual([]);
    expect(migrateRun(run)).toBe(run);
  });

  it('a current-version save is trusted, not patched: a missing field makes it invalid instead of being guessed', () => {
    const { seenEventIds: _e, ...damaged } = createRun(3);
    expect(validateSave(roundTrip(damaged))).toBeNull();
    expect(validateSave(roundTrip(legacySave(damaged)))).not.toBeNull(); // the same object as an old save is upgraded
  });

  it('a save from a newer build or with a nonsense version is refused', () => {
    const run = createRun(4);
    for (const version of [5, 99, 0, -1, 1.5, '3', null, NaN]) {
      expect(validateSave(roundTrip({ ...run, saveVersion: version })), `saveVersion ${String(version)}`).toBeNull();
    }
  });
});

describe('AO-042: validateSave', () => {
  it('accepts a run that went through JSON in every phase the game can be saved in', () => {
    const base = { ...createRun(5), gold: 300 };
    const states: RunState[] = [
      base,
      applyRunAction(base, { type: 'TRAVEL_TO_CITY' }).run,
      battleRun(5),
      { ...base, phase: 'reward', pendingReward: buildPendingReward({ ...base.rng }, base.relics, base.masterDeck, true, false) },
      { ...base, phase: 'merchant', pendingMerchant: generateMerchantInventory({ ...base.rng }, base.relics) },
      { ...base, phase: 'event', pendingEvent: pendingEventOf('wayside_shrine') },
      { ...base, phase: 'defeat' },
      { ...base, phase: 'run_complete' },
    ];
    for (const state of states) {
      const loaded = validateSave(roundTrip(state));
      expect(loaded, state.phase).not.toBeNull();
      expect(loaded).toEqual(roundTrip(state));
    }
  });

  it('accepts an old-format save (no version, no chapter/threat/stats) and returns it upgraded', () => {
    const run = createRun(6);
    const { chapter: _c, threat: _t, bossBattle: _b, stats: _s, cardRemoval: _r, starvationDays: _d, ...rest } = legacySave(run) as unknown as Record<string, unknown>;
    const old = { ...rest, worldMap: { nodes: [{ id: 'n0_0', type: 'road', layer: 0, visibility: 'visited', connectsTo: [] }], currentNodeId: 'n0_0' } };
    const loaded = validateSave(roundTrip(old))!;
    expect(loaded).not.toBeNull();
    expect(loaded.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(loaded.chapter).toBe(1);
    expect(loaded.threat).toBe(0);
    expect(loaded.starvationDays).toBe(0);
    expect(applyRunAction(loaded, { type: 'TRAVEL_TO_CITY' }).run.phase).toBe('city'); // and it plays
  });

  it('returns null, never throws, for anything that is not a usable run', () => {
    const run = createRun(7);
    const stack = run.army[0]!;
    const bad: Array<[string, unknown]> = [
      ['null', null],
      ['number', 5],
      ['string', 'run'],
      ['array', []],
      ['empty object', {}],
      ['only a version', { saveVersion: 2 }],
      ['only a phase', { phase: 'on_map' }],
      ['legacy fragment', { phase: 'on_map', gold: 10, city: null }],
      ['legacy without city', legacySave({ ...run, city: undefined })],
      ['legacy without hero', legacySave({ ...run, hero: undefined })],
      ['unknown phase', { ...run, phase: 'bogus' }],
      ['gold null (NaN through JSON)', { ...run, gold: NaN }],
      ['negative gold', { ...run, gold: -5 }],
      ['fractional food', { ...run, food: 2.5 }],
      ['Infinity day', { ...run, day: Infinity }],
      ['no army', { ...run, army: undefined }],
      ['army not an array', { ...run, army: {} }],
      ['unknown unit', { ...run, army: [{ ...stack, unitId: 'dragon' }] }],
      ['inherited unit key', { ...run, army: [{ ...stack, unitId: 'constructor' }] }],
      ['fractional count', { ...run, army: [{ ...stack, count: 1.5 }] }],
      ['negative count', { ...run, army: [{ ...stack, count: -1 }] }],
      ['position 9', { ...run, army: [{ ...stack, position: 9 }] }],
      ['NaN hp', { ...run, army: [{ ...stack, currentHp: NaN }] }],
      ['seven stacks', { ...run, army: Array.from({ length: 7 }, (_, i) => ({ ...stack, stackId: `s${i}`, position: (i % 6) + 1 })) }],
      ['unknown card', { ...run, masterDeck: [{ instanceId: 'x', cardId: 'no_such_card' }] }],
      ['deck not an array', { ...run, masterDeck: 'cards' }],
      ['hero without stats', { ...run, hero: { ...run.hero, stats: undefined } }],
      ['NaN mana', { ...run, hero: { ...run.hero, mana: NaN } }],
      ['map without nodes', { ...run, worldMap: { currentNodeId: 'x' } }],
      ['current node missing', { ...run, worldMap: { ...run.worldMap, currentNodeId: 'nope' } }],
      ['dangling connection', { ...run, worldMap: { ...run.worldMap, nodes: run.worldMap.nodes.map((n, i) => (i === 0 ? { ...n, connectsTo: ['ghost'] } : n)) } }],
      ['battle phase without combat', { ...run, phase: 'in_battle', combat: null }],
      ['reward phase without reward', { ...run, phase: 'reward', pendingReward: null }],
      ['merchant phase without stock', { ...run, phase: 'merchant', pendingMerchant: null }],
      ['event phase without event', { ...run, phase: 'event', pendingEvent: null }],
      ['event with unknown id', { ...run, phase: 'event', pendingEvent: { eventId: 'nope', choice: null, resolved: null } }],
      ['combat of another shape', { ...run, phase: 'in_battle', combat: { turnNumber: 1 } }],
      ['city level 9', { ...run, city: { ...run.city, level: 9 } }],
      ['relics not an array', { ...run, relics: 3 }],
      ['log missing', { ...run, log: undefined }],
    ];
    for (const [name, value] of bad) {
      let result: RunState | null | 'threw' = 'threw';
      expect(() => {
        result = validateSave(roundTrip(value));
      }, name).not.toThrow();
      expect(result, name).toBeNull();
    }
  });
});

describe('AO-042: work in progress in a legacy save', () => {
  it('a battle in progress is restarted from its start: same encounter, fresh combat, army and input untouched', () => {
    const inBattle = battleRun(8);
    const legacy = legacySave({ ...inBattle, combat: { ancientCombatShape: true, turn: 3 } });
    const before = JSON.stringify(legacy);
    const migrated = migrateRun(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(migrated.phase).toBe('in_battle');
    expect(migrated.combat!.turnNumber).toBe(1);
    expect(migrated.combat!.hand.length).toBeGreaterThan(0);
    const node = migrated.worldMap.nodes.find((n) => n.id === migrated.worldMap.currentNodeId)!;
    expect(migrated.combat!.enemyArmy.map((s) => [s.unitId, s.count])).toEqual(generateBattleEncounter(node.layer, false, migrated.chapter, migrated.threat).map((s) => [s.unitId, s.count]));
    expect(migrated.army).toEqual(legacy.army);
    expect(validateSave(roundTrip(legacy))).not.toBeNull();
    expect(applyRunAction(migrated, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).events.some((e) => e.type === 'ACTION_REJECTED')).toBe(false);
  });

  it('a battle phase saved with no combat at all is restarted too', () => {
    const legacy = legacySave({ ...battleRun(9), combat: null });
    expect(validateSave(roundTrip(legacy))!.combat).not.toBeNull();
  });

  it('a pending reward keeps the options that still exist and drops the ones that do not', () => {
    const base = createRun(10);
    const valid = Object.keys(CARD_DEFINITIONS)[0]!;
    const legacy = legacySave({ ...base, phase: 'reward', pendingReward: { cardOptions: [valid, 'card_removed_long_ago'], relicOffer: null } });
    const migrated = migrateRun(legacy);
    expect(migrated.pendingReward).toEqual({ cardOptions: [valid], upgradeOptions: [], relicGained: null, relicChoices: [] });
    expect(validateSave(roundTrip(legacy))).not.toBeNull();
  });

  it('a pending reward with nothing usable left is re-rolled, so the player never lands on an empty reward screen', () => {
    const base = createRun(11);
    const legacy = legacySave({ ...base, phase: 'reward', pendingReward: { cardOptions: ['gone_1', 'gone_2'], upgradeOptions: [], relicOffer: null } });
    const migrated = migrateRun(legacy);
    expect(migrated.pendingReward!.cardOptions.length + migrated.pendingReward!.upgradeOptions.length).toBeGreaterThan(0);
    expect(migrated.pendingReward!.cardOptions.every((id) => id in CARD_DEFINITIONS)).toBe(true);
    expect(validateSave(roundTrip(legacy))).not.toBeNull();
  });
});
