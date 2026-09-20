import { describe, expect, it } from 'vitest';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../../data/relics.js';
import type { RelicDefinition } from '../../types.js';
import { foundRelicInfo, foundRelicList, startingRelicList } from '../start.js';

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
