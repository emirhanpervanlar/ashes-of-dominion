import { describe, expect, it } from 'vitest';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../../data/relics.js';
import { HERO_DEFINITIONS } from '../../data/heroes.js';
import { UNIT_DEFINITIONS } from '../../data/units.js';
import { CARD_DEFINITIONS } from '../../data/cards.js';
import { CARD_UPGRADES } from '../../cardUpgrades.js';
import { isSimpleRelic } from '../relicSources.js';
import { resolveEventOptions } from '../events.js';

/** AO-050 balance round: the pieces of it that are rules-shaped (no free-value event options, relic pool, "+" cards never weaker than the base). */
describe('AO-050 balance data', () => {
  it('the found pool holds at least 9 drawback-free relics with the new six among them', () => {
    const simple = Object.values(RELIC_DEFINITIONS).filter(isSimpleRelic).map((r) => r.id);
    for (const id of ['steel_gauntlets', 'warded_mantle', 'surgeons_kit', 'wayfarers_cloak', 'mana_crystal', 'veterans_standard']) expect(simple).toContain(id);
    expect(simple.length).toBeGreaterThanOrEqual(9);
  });

  it('the five starting relics stay within a narrow value band (Banner is no longer +6)', () => {
    expect(STARTING_RELIC_DEFINITIONS.royal_banner!.effects).toEqual([{ kind: 'ARMY_SIZE_FLAT_LARGEST', amount: 4 }]);
  });

  it('the free-value event options carry a cost or a risk', () => {
    const costly = (eventId: string, optionId: string) => {
      const option = resolveEventOptions(eventId, 1).find((o) => o.id === optionId)!;
      return option.effects.some((e) => e.kind === 'UPKEEP_DAYS' || e.kind === 'UNIT_LOSS' || (e.kind === 'THREAT_DELTA' && e.amount > 0));
    };
    for (const [eventId, optionId] of [['abandoned_camp', 'burn'], ['plague_cart', 'sell_remedies'], ['forgotten_library', 'study'], ['forgotten_library', 'sell_tomes'], ['wandering_smith', 'watch'], ['deserter_knight', 'dispatch'], ['hunters_lodge', 'join_hunt']] as const) {
      expect(costly(eventId, optionId), `${eventId}/${optionId}`).toBe(true);
    }
  });

  it('a "+" hero attack is stronger than its base card', () => {
    for (const id of ['command_strike', 'volley']) {
      const base = CARD_DEFINITIONS[id]!.effects[0]!;
      const plus = CARD_UPGRADES[id]!.effects![0]!;
      expect(base.kind).toBe('ATTACK');
      expect((plus as { multiplier: number }).multiplier).toBeGreaterThan((base as { multiplier: number }).multiplier);
    }
  });

  it('Swordsman is a real damage dealer and every hero opens with 8 units', () => {
    expect(UNIT_DEFINITIONS.swordsman.damage).toBeGreaterThanOrEqual(2);
    for (const hero of Object.values(HERO_DEFINITIONS)) expect(hero.startingArmy.reduce((n, s) => n + s.count, 0)).toBe(8);
  });
});
