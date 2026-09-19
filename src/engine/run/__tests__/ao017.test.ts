import { describe, expect, it } from 'vitest';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../../data/relics.js';
import { createRng } from '../../rng.js';
import type { CombatState } from '../../types.js';
import { generateMerchantInventory } from '../merchant.js';
import { pickRelicId, RELIC_PRICE_BY_RARITY, RELIC_WEIGHTS } from '../relicSources.js';
import { applyRunAction, createRun } from '../runEngine.js';
import type { RunState } from '../types.js';
import { generateWorldMap } from '../worldMap.js';
import type { NodeType } from '../worldMap.js';

function onMap(seed: number, relicId = 'royal_banner'): RunState {
  return applyRunAction(createRun(seed), { type: 'CHOOSE_STARTING_RELIC', relicId }).run;
}

function withNextNodeType(run: RunState, type: NodeType): { run: RunState; nodeId: string } {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const nextId = current.connectsTo[0]!;
  const nodes = run.worldMap.nodes.map((n) => (n.id === nextId ? { ...n, type } : n));
  return { run: { ...run, worldMap: { ...run.worldMap, nodes } }, nodeId: nextId };
}

function winBattleAt(seed: number, type: NodeType): RunState {
  const { run, nodeId } = withNextNodeType(onMap(seed), type);
  const fighting = applyRunAction(run, { type: 'MOVE_TO', nodeId }).run;
  const wiped: CombatState = { ...fighting.combat!, enemyArmy: fighting.combat!.enemyArmy.map((s) => ({ ...s, count: 0, currentHp: 0 })) };
  return applyRunAction({ ...fighting, combat: wiped }, { type: 'COMBAT_ACTION', action: { type: 'END_TURN' } }).run;
}

function buyOffer(run: RunState, relicId: string): RunState {
  const price = RELIC_PRICE_BY_RARITY[RELIC_DEFINITIONS[relicId]!.rarity];
  const shop: RunState = { ...run, phase: 'merchant', gold: 1000, pendingMerchant: { cardOffers: [], relicOffer: { relicId, price } } };
  return applyRunAction(shop, { type: 'BUY_RELIC', relicId }).run;
}

describe('AO-D037: starting relic pool', () => {
  it('is exactly 5 relics, disjoint from the found-relic pool, every one choosable', () => {
    const ids = Object.keys(STARTING_RELIC_DEFINITIONS);
    expect(ids).toHaveLength(5);
    expect(ids.every((id) => !(id in RELIC_DEFINITIONS))).toBe(true);
    for (const id of ids) {
      const run = onMap(3, id);
      expect(run.phase).toBe('on_map');
      expect(run.relics.map((r) => r.id)).toEqual([id]);
    }
  });

  it('rejects a found relic as a starting pick', () => {
    const result = applyRunAction(createRun(3), { type: 'CHOOSE_STARTING_RELIC', relicId: 'blood_banner' });
    expect(result.run.phase).toBe('choosing_starting_relic');
    expect(result.run.relics).toHaveLength(0);
  });
});

describe('AO-D043: relic tweaks', () => {
  it('the starting five are Royal Banner, Whetstone, Padded Vest, Lucky Charm, Traveler Purse', () => {
    expect(Object.keys(STARTING_RELIC_DEFINITIONS).sort()).toEqual(['lucky_charm', 'padded_vest', 'royal_banner', 'travelers_purse', 'whetstone']);
  });

  it('Arcane Crystal is a rare found relic (rarity price) with unchanged effects', () => {
    const def = RELIC_DEFINITIONS.arcane_crystal!;
    expect(def.rarity).toBe('rare');
    expect('arcane_crystal' in STARTING_RELIC_DEFINITIONS).toBe(false);
    const bought = buyOffer(onMap(5), 'arcane_crystal');
    expect(bought.hero.maxMana).toBe(onMap(5).hero.maxMana + 2);
    expect(bought.gold).toBe(1000 - RELIC_PRICE_BY_RARITY.rare);
    expect(bought.army.find((s) => s.unitId === 'swordsman')!.count).toBe(Math.floor(12 * 0.9));
  });

  it('Abandoned Camp Search finds a relic about 25% of the time', () => {
    let relics = 0;
    const trials = 400;
    for (let seed = 1; seed <= trials; seed++) {
      const run: RunState = { ...onMap(seed), phase: 'event', pendingEvent: { eventId: 'abandoned_camp' } };
      const result = applyRunAction(run, { type: 'CHOOSE_EVENT_OPTION', optionId: 'search' });
      if (result.events.some((e) => e.type === 'EVENT_RESOLVED' && e.outcome === 'search_relic')) relics++;
    }
    expect(relics / trials).toBeGreaterThan(0.18);
    expect(relics / trials).toBeLessThan(0.32);
  });
});

describe('AO-D037: rarity and drawbacks', () => {
  const all = [...Object.values(RELIC_DEFINITIONS), ...Object.values(STARTING_RELIC_DEFINITIONS)];

  it('every relic has a rarity, a description, and the found pool spans all three rarities', () => {
    for (const r of all) {
      expect(['common', 'rare', 'epic']).toContain(r.rarity);
      expect(r.description.length).toBeGreaterThan(0);
    }
    const rarities = new Set(Object.values(RELIC_DEFINITIONS).map((r) => r.rarity));
    expect(rarities).toEqual(new Set(['common', 'rare', 'epic']));
  });

  it('drawbacks are stated in the description', () => {
    for (const id of ['blood_banner', 'cursed_crown', 'hawks_eye', 'crown_of_champions', 'banner_of_the_horde', 'bulwark_standard', 'shadow_ring', 'glass_cannon_idol', 'misers_ledger', 'hunters_quiver']) {
      expect(RELIC_DEFINITIONS[id]!.description).toMatch(/takes \+|deals -|deal -|max Mana -|Healing -/);
    }
    expect(RELIC_DEFINITIONS.kings_crown!.effects).toHaveLength(1);
    expect(RELIC_DEFINITIONS.iron_bracers!.effects).toHaveLength(1);
    expect(RELIC_DEFINITIONS.field_chaplains_charm!.effects).toHaveLength(1);
  });

  it('negative max Mana is clamped so the hero keeps at least 1', () => {
    const base = onMap(5);
    const normal = buyOffer({ ...base, hero: { ...base.hero, maxMana: 5, mana: 5 } }, 'shadow_ring');
    expect(normal.hero.maxMana).toBe(4);
    expect(normal.hero.mana).toBe(4);

    const tiny = buyOffer({ ...base, hero: { ...base.hero, maxMana: 1, mana: 1 } }, 'shadow_ring');
    expect(tiny.hero.maxMana).toBe(1);
    expect(tiny.hero.mana).toBeLessThanOrEqual(tiny.hero.maxMana);
    expect(tiny.hero.mana).toBeGreaterThanOrEqual(0);
    expect(tiny.relics.some((r) => r.id === 'shadow_ring')).toBe(true);
  });
});

describe('AO-D037: merchant relic', () => {
  it('prices follow rarity (common < rare < epic)', () => {
    expect(RELIC_PRICE_BY_RARITY.common).toBeLessThan(RELIC_PRICE_BY_RARITY.rare);
    expect(RELIC_PRICE_BY_RARITY.rare).toBeLessThan(RELIC_PRICE_BY_RARITY.epic);
  });

  it('stocks a non-starting, unowned relic at its rarity price, over many seeds', () => {
    const owned = [STARTING_RELIC_DEFINITIONS.royal_banner!, RELIC_DEFINITIONS.blood_banner!, RELIC_DEFINITIONS.iron_bracers!];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const offer = generateMerchantInventory(createRng(seed), owned).relicOffer!;
      const def = RELIC_DEFINITIONS[offer.relicId]!;
      expect(def).toBeDefined();
      expect(owned.some((r) => r.id === offer.relicId)).toBe(false);
      expect(offer.price).toBe(RELIC_PRICE_BY_RARITY[def.rarity]);
      seen.add(def.rarity);
    }
    expect(seen).toEqual(new Set(['common', 'rare', 'epic']));
  });

  it('has nothing to sell once every found relic is owned', () => {
    expect(generateMerchantInventory(createRng(1), Object.values(RELIC_DEFINITIONS)).relicOffer).toBeNull();
    expect(pickRelicId(createRng(1), 'elite', Object.values(RELIC_DEFINITIONS))).toBeNull();
  });

  it('buying charges the rarity price and grants the relic', () => {
    const base = onMap(7);
    const bought = buyOffer(base, 'glass_cannon_idol');
    expect(bought.gold).toBe(1000 - RELIC_PRICE_BY_RARITY.epic);
    expect(bought.relics.some((r) => r.id === 'glass_cannon_idol')).toBe(true);
  });
});

describe('AO-D037: elite relic reward', () => {
  it('an elite victory offers one unowned found relic; a normal victory offers none (AO-D006)', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const elite = winBattleAt(seed, 'elite_battle');
      expect(elite.phase).toBe('reward');
      const offer = elite.pendingReward!.relicOffer!;
      expect(RELIC_DEFINITIONS[offer]).toBeDefined();
      expect(elite.relics.some((r) => r.id === offer)).toBe(false);

      expect(winBattleAt(seed, 'battle').pendingReward!.relicOffer).toBeNull();
    }
  });

  it('claiming grants the relic and keeps the reward open for the normal pick, which then closes it', () => {
    const elite = winBattleAt(9, 'elite_battle');
    const offer = elite.pendingReward!.relicOffer!;
    const claimed = applyRunAction(elite, { type: 'CLAIM_RELIC', relicId: offer });
    expect(claimed.run.relics.some((r) => r.id === offer)).toBe(true);
    expect(claimed.run.phase).toBe('reward');
    expect(claimed.run.pendingReward!.relicOffer).toBeNull();

    const again = applyRunAction(claimed.run, { type: 'CLAIM_RELIC', relicId: offer });
    expect(again.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(again.run.relics.filter((r) => r.id === offer)).toHaveLength(1);

    const finished = applyRunAction(claimed.run, { type: 'SKIP_REWARD' });
    expect(finished.run.phase).toBe('on_map');
  });

  it('rejects claiming a relic that is not on offer', () => {
    const elite = winBattleAt(9, 'elite_battle');
    const other = Object.keys(RELIC_DEFINITIONS).find((id) => id !== elite.pendingReward!.relicOffer)!;
    const result = applyRunAction(elite, { type: 'CLAIM_RELIC', relicId: other });
    expect(result.events.some((e) => e.type === 'ACTION_REJECTED')).toBe(true);
    expect(result.run.relics.some((r) => r.id === other)).toBe(false);
  });

  it('elites draw rare/epic more often than merchants and events do', () => {
    const share = (source: 'elite' | 'merchant' | 'event') => {
      let high = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const id = pickRelicId(createRng(seed), source, [])!;
        if (RELIC_DEFINITIONS[id]!.rarity !== 'common') high++;
      }
      return high / 1000;
    };
    expect(share('elite')).toBeGreaterThan(share('merchant') + 0.1);
    expect(share('elite')).toBeGreaterThan(share('event') + 0.1);
    expect(RELIC_WEIGHTS.elite.epic).toBeGreaterThan(RELIC_WEIGHTS.merchant.epic);
  });
});

describe('AO-D037: event relics', () => {
  function bandits(seed: number): RunState {
    return { ...onMap(seed), phase: 'event', pendingEvent: { eventId: 'bandit_toll' }, food: 50 };
  }

  it('Bandit Toll: refusing keeps its Food cost and only rarely also yields a relic; paying never does', () => {
    let relics = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const refused = applyRunAction(bandits(seed), { type: 'CHOOSE_EVENT_OPTION', optionId: 'refuse' }).run;
      expect(refused.food).toBe(40);
      expect(refused.relics.length).toBeLessThanOrEqual(2);
      if (refused.relics.length === 2) relics++;

      const paid = applyRunAction(bandits(seed), { type: 'CHOOSE_EVENT_OPTION', optionId: 'pay' }).run;
      expect(paid.relics).toHaveLength(1);
    }
    expect(relics).toBeGreaterThan(10);
    expect(relics).toBeLessThan(80);
  });

  it('the relic found is never a duplicate', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const refused = applyRunAction(bandits(seed), { type: 'CHOOSE_EVENT_OPTION', optionId: 'refuse' }).run;
      expect(new Set(refused.relics.map((r) => r.id)).size).toBe(refused.relics.length);
    }
  });
});

describe('AO-D039 + AO-D049: no early Elite Battle', () => {
  it('layers 0-5 never contain an elite over many seeds, and elites still exist deeper', () => {
    let deepElites = 0;
    for (let seed = 1; seed <= 500; seed++) {
      for (const node of generateWorldMap(createRng(seed)).nodes) {
        if (node.type !== 'elite_battle') continue;
        expect(node.layer).toBeGreaterThan(5);
        deepElites++;
      }
    }
    expect(deepElites).toBeGreaterThan(0);
  });

  it('stays deterministic per seed', () => {
    expect(generateWorldMap(createRng(77))).toEqual(generateWorldMap(createRng(77)));
  });
});
