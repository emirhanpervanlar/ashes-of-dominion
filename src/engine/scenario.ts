import { createStack, ENEMY_FORMATIONS } from './army.js';
import { HERO_DEFINITIONS } from './data/heroes.js';
import { UNIT_DEFINITIONS } from './data/units.js';
import { createRng } from './rng.js';
import { startBattle } from './combat.js';
import { maxManaFromWisdom } from './heroStats.js';
import type { ApplyResult, ArmyStack, CardInstance, Hero, HeroId, Position } from './types.js';

function buildDeck(cardIds: string[]): CardInstance[] {
  return cardIds.map((cardId, i) => ({ instanceId: `${cardId}#${i}`, cardId }));
}

export function createHero(heroId: HeroId, name?: string): Hero {
  const def = HERO_DEFINITIONS[heroId];
  const maxMana = maxManaFromWisdom(def.baseMana, def.stats.wisdom);
  return {
    id: 'hero',
    heroType: heroId,
    name: name && name.trim().length > 0 ? name.trim().slice(0, 24) : def.name,
    hp: 100,
    maxHp: 100,
    mana: maxMana,
    maxMana,
    baseMana: def.baseMana,
    level: 1,
    xp: 0,
    stats: { ...def.stats },
    traits: [],
  };
}

/** Ranged/heal-only units start in the backline, everyone else up front — so passives like
 * Archer's High Ground and Priest's heal-range actually apply from turn 1. */
export function buildHeroStartingArmy(heroId: HeroId): ArmyStack[] {
  const def = HERO_DEFINITIONS[heroId];
  const isBackliner = (unitId: (typeof def.startingArmy)[number]['unitId']) => {
    const unitDef = UNIT_DEFINITIONS[unitId];
    return !!unitDef.rangedAllAccess || unitDef.basicAction === 'heal';
  };
  const front = def.startingArmy.filter((e) => !isBackliner(e.unitId));
  const back = def.startingArmy.filter((e) => isBackliner(e.unitId));
  const frontStacks = front.map((entry, i) => createStack(entry.unitId, 'player', ((i + 1) as Position), entry.count));
  const backStacks = back.map((entry, i) => createStack(entry.unitId, 'player', ((i + 4) as Position), entry.count));
  return [...frontStacks, ...backStacks];
}

/**
 * A standalone battle scenario (v3 §61 Phase 1 milestone) — no dungeon/town wrapper.
 * Picks one of the 3 Heroes and one of the 4 enemy formations from v3 §19.
 */
export function createVerticalSliceScenario(seed: number, heroId: HeroId = 'warlord', formation: keyof typeof ENEMY_FORMATIONS = 'guarded_shaman'): ApplyResult {
  const hero = createHero(heroId);
  const def = HERO_DEFINITIONS[heroId];
  const deck = buildDeck(def.startingDeck);

  return startBattle({
    seed,
    rng: createRng(seed),
    hero,
    playerArmy: buildHeroStartingArmy(heroId),
    enemyArmy: ENEMY_FORMATIONS[formation](),
    deck,
    activeRelicEffects: [],
  });
}
