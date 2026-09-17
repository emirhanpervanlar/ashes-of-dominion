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
    basicAction: 'attack',
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    side: 'player',
    hpPerUnit: 6,
    attack: 4,
    defense: 0,
    tags: ['ranged', 'archer'],
    basicAction: 'ranged_attack',
    rangedAllAccess: true,
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    side: 'player',
    hpPerUnit: 12,
    attack: 7,
    defense: 4,
    tags: ['infantry', 'heavy'],
    basicAction: 'attack',
  },
  priest: {
    id: 'priest',
    name: 'Priest',
    side: 'player',
    hpPerUnit: 8,
    attack: 1,
    defense: 1,
    tags: ['support', 'healer'],
    basicAction: 'heal',
    healPower: 4,
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    side: 'player',
    hpPerUnit: 6,
    attack: 5,
    defense: 0,
    // Not part of the v2 MVP roster (v2_list.md §61 "do not silently add
    // Mage") — kept defined but unused by the default scenario/army.
    tags: ['ranged', 'caster', 'spell'],
    basicAction: 'ranged_attack',
    rangedAllAccess: true,
  },
  cavalier: {
    id: 'cavalier',
    name: 'Cavalier',
    side: 'player',
    hpPerUnit: 11,
    attack: 6,
    defense: 2,
    // Not part of the v2 MVP roster — kept for the "Charge" card's cavalry tag.
    tags: ['cavalry', 'melee', 'fast'],
    basicAction: 'attack',
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    side: 'player',
    // Undying Legion (AGENT.md §46/§48) — cheap, expendable, raised from
    // player casualties via the Necromantic Doctrine or Grave Crown relic
    // (NECROMANCY effect) or the Raise Dead card, never recruited directly.
    hpPerUnit: 6,
    attack: 3,
    defense: 0,
    tags: ['undead', 'infantry'],
    basicAction: 'attack',
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
    basicAction: 'attack',
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
    basicAction: 'attack',
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
    basicAction: 'attack',
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
    basicAction: 'attack',
  },
  warlord: {
    id: 'warlord',
    name: 'Warlord',
    side: 'enemy',
    // AGENT.md §42 boss list — Warlord: "gains strength based on player's
    // army size." A single powerful entity (count 1), not a unit stack.
    hpPerUnit: 500,
    attack: 20,
    defense: 6,
    tags: ['boss', 'brute'],
    targetPreference: 'frontline',
    scalesWithPlayerArmy: { divisor: 15 },
    basicAction: 'attack',
  },
};
