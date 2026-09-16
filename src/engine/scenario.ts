import { CARD_DEFINITIONS } from './data/cards.js';
import { UNIT_DEFINITIONS } from './data/units.js';
import { createRng } from './rng.js';
import { startBattle } from './combat.js';
import type { ApplyResult, ArmyStack, CardInstance, Hero, Position, Side, UnitId } from './types.js';

function createStack(unitId: UnitId, side: Side, position: Position, count: number): ArmyStack {
  const def = UNIT_DEFINITIONS[unitId];
  const maxHp = count * def.hpPerUnit;
  return {
    stackId: `${side}_${unitId}_${position}`,
    unitId,
    side,
    position,
    count,
    currentHp: maxHp,
    maxHp,
    startingCount: count,
    morale: 0,
    veterancy: 0,
    block: 0,
    statuses: [],
  };
}

function buildDeck(cardIds: string[]): CardInstance[] {
  return cardIds.map((cardId, i) => ({ instanceId: `${cardId}#${i}`, cardId }));
}

/**
 * The exact vertical-slice scenario from AGENT.md §73.
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

  const playerArmy: ArmyStack[] = [
    createStack('knight', 'player', 1, 18),
    createStack('swordsman', 'player', 2, 80),
    createStack('knight', 'player', 3, 8),
    createStack('archer', 'player', 4, 30),
    createStack('mage', 'player', 5, 10),
    createStack('priest', 'player', 6, 15),
  ];

  const enemyArmy: ArmyStack[] = [
    createStack('orc', 'enemy', 1, 42),
    createStack('orc', 'enemy', 2, 30),
    createStack('wolf', 'enemy', 3, 20),
    createStack('shaman', 'enemy', 4, 12),
    createStack('goblin', 'enemy', 5, 45),
    createStack('goblin', 'enemy', 6, 45),
  ];

  const deck = buildDeck([
    ...Object.keys(CARD_DEFINITIONS),
    'command_strike',
    'defend',
  ]);

  return startBattle({
    seed,
    rng: createRng(seed),
    hero,
    playerArmy,
    enemyArmy,
    deck,
  });
}
