import { buildVerticalSliceEnemyArmy, buildVerticalSlicePlayerArmy } from './army.js';
import { CARD_DEFINITIONS } from './data/cards.js';
import { DEFAULT_HERO_SKILL_LOADOUT } from './data/heroSkills.js';
import { createRng } from './rng.js';
import { startBattle } from './combat.js';
import type { ApplyResult, CardInstance, Hero } from './types.js';

function buildDeck(cardIds: string[]): CardInstance[] {
  return cardIds.map((cardId, i) => ({ instanceId: `${cardId}#${i}`, cardId }));
}

/**
 * The exact vertical-slice scenario from AGENT.md §73 — a single
 * standalone battle with no run/relics/rewards wrapper. See engine/run/
 * for the persistent multi-battle run layer (Phase 3+).
 */
export function createVerticalSliceScenario(seed: number): ApplyResult {
  const hero: Hero = {
    id: 'commander',
    name: 'Commander',
    hp: 100,
    maxHp: 100,
    mana: 5,
    maxMana: 8,
    ac: 3,
    maxAc: 3,
    dc: 3,
    maxDc: 3,
  };

  const deck = buildDeck([
    ...Object.keys(CARD_DEFINITIONS).filter((id) => !id.endsWith('_plus')),
    'command_strike',
    'defend',
  ]);

  return startBattle({
    seed,
    rng: createRng(seed),
    hero,
    playerArmy: buildVerticalSlicePlayerArmy(),
    enemyArmy: buildVerticalSliceEnemyArmy(),
    deck,
    activeRelicEffects: [],
    heroSkillIds: DEFAULT_HERO_SKILL_LOADOUT,
  });
}
