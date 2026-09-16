import type { UnitDefinition, UnitId } from '../types.js';

/**
 * MVP unit stats — AGENT.md §10. All values PROTOTYPE, not balanced.
 */
export const UNIT_DEFINITIONS: Record<UnitId, UnitDefinition> = {
  swordsman: {
    id: 'swordsman',
    name: 'Swordsman',
    side: 'player',
    hpPerUnit: 10,
    attack: 3,
    defense: 2,
    tags: ['infantry', 'melee'],
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    side: 'player',
    hpPerUnit: 6,
    attack: 4,
    defense: 0,
    tags: ['ranged', 'archer'],
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    side: 'player',
    hpPerUnit: 12,
    attack: 7,
    defense: 4,
    tags: ['infantry', 'heavy'],
  },
  priest: {
    id: 'priest',
    name: 'Priest',
    side: 'player',
    hpPerUnit: 8,
    attack: 1,
    defense: 1,
    tags: ['support', 'healer'],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    side: 'player',
    hpPerUnit: 6,
    attack: 5,
    defense: 0,
    // Smallest spell-oriented prototype per AGENT.md §73 — no special
    // passive yet, just a fragile, high-attack ranged/caster unit.
    tags: ['ranged', 'caster', 'spell'],
  },
  cavalier: {
    id: 'cavalier',
    name: 'Cavalier',
    side: 'player',
    hpPerUnit: 11,
    attack: 6,
    defense: 2,
    // First cavalry-tagged unit — unlocks the "Charge" card (AGENT.md §15),
    // which previously had no valid MVP target.
    tags: ['cavalry', 'melee', 'fast'],
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    side: 'enemy',
    hpPerUnit: 5,
    attack: 2,
    defense: 0,
    tags: ['infantry'],
    // AGENT.md §9 only defines targeting for Orc/Wolf/Shaman/Assassin.
    // ASSUMPTION: Goblin behaves like a basic grunt and targets the frontline.
    targetPreference: 'frontline',
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    side: 'enemy',
    hpPerUnit: 12,
    attack: 5,
    defense: 0,
    tags: ['infantry', 'brute'],
    targetPreference: 'frontline',
  },
  shaman: {
    id: 'shaman',
    name: 'Shaman',
    side: 'enemy',
    hpPerUnit: 8,
    attack: 2,
    defense: 0,
    tags: ['support', 'caster'],
    targetPreference: 'buff-weakest-ally',
  },
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    side: 'enemy',
    hpPerUnit: 7,
    attack: 4,
    defense: 0,
    tags: ['beast', 'fast'],
    targetPreference: 'backline',
  },
};
