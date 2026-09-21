import type { HeroId, HeroStats, UnitId } from '../types.js';

export interface HeroDefinition {
  id: HeroId;
  name: string;
  stats: HeroStats;
  baseMana: number;
  startingArmy: Array<{ unitId: UnitId; count: number }>;
  startingDeck: string[];
  /** Example traits (v3 §6) — chosen at level 5/8/11 once Hero leveling ships; not wired into combat yet. */
  traitPool: Array<{ id: string; name: string; description: string }>;
}

export const HERO_DEFINITIONS: Record<HeroId, HeroDefinition> = {
  warlord: {
    id: 'warlord',
    name: 'Warlord',
    stats: { strength: 16, dexterity: 10, intelligence: 8, vitality: 14, wisdom: 8 },
    baseMana: 3,
    // AO-D074 start balance (AO-046 measurements): every hero opens with a solid front line, 8 units in total;
    // the run grows the army from the City and the garrison, not from a day-1 horde.
    startingArmy: [
      { unitId: 'swordsman', count: 4 },
      { unitId: 'knight', count: 2 },
      { unitId: 'priest', count: 2 },
    ],
    // AO-D075: starting decks hold only cards that need no specific unit type (unit skills like Charge come later, as rewards).
    startingDeck: [
      'command_strike',
      'command_strike',
      'command_strike',
      'command_strike',
      'hold_the_line',
      'hold_the_line',
      'hold_the_line',
      'formation',
      'focus_fire',
      'focus_fire',
    ],
    traitPool: [
      { id: 'iron_commander', name: 'Iron Commander', description: 'Frontline +10% Defense.' },
      { id: 'blood_commander', name: 'Blood Commander', description: 'Melee +15% damage below 50% original count.' },
      { id: 'horde_master', name: 'Horde Master', description: 'Count-based effects +20%.' },
      { id: 'knight_lord', name: 'Knight Lord', description: 'Knight skills +20%.' },
      { id: 'defender', name: 'Defender', description: 'Protective effects +1 turn where legal.' },
      { id: 'berserker', name: 'Berserker', description: 'Melee +20% when Hero HP <50%.' },
    ],
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    stats: { strength: 9, dexterity: 18, intelligence: 10, vitality: 9, wisdom: 13 },
    baseMana: 3,
    startingArmy: [
      { unitId: 'swordsman', count: 3 },
      { unitId: 'knight', count: 1 },
      { unitId: 'archer', count: 3 },
      { unitId: 'priest', count: 1 },
    ],
    startingDeck: [
      'volley',
      'volley',
      'volley',
      'volley',
      'evasion',
      'evasion',
      'formation',
      'formation',
      'focus_fire',
      'focus_fire',
    ],
    traitPool: [
      { id: 'shadow_hunter', name: 'Shadow Hunter', description: 'Marked targets receive +15% ranged damage.' },
      { id: 'venom_master', name: 'Venom Master', description: 'Poison +50%.' },
      { id: 'evasion_expert', name: 'Evasion Expert', description: 'Dodge granted by abilities +25% relative.' },
      { id: 'assassin', name: 'Assassin', description: 'Damage vs enemies below 30% count +25%.' },
      { id: 'hunter', name: 'Hunter', description: 'Ranged basic attacks +10%.' },
      { id: 'shadow_adept', name: 'Shadow Adept', description: 'Shadowstep costs 0 once/combat.' },
    ],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    stats: { strength: 7, dexterity: 9, intelligence: 18, vitality: 8, wisdom: 16 },
    baseMana: 3,
    startingArmy: [
      { unitId: 'swordsman', count: 5 },
      { unitId: 'archer', count: 2 },
      { unitId: 'priest', count: 1 },
    ],
    startingDeck: [
      'fireball',
      'fireball',
      'fireball',
      'fireball',
      'formation',
      'formation',
      'heal',
      'heal',
      'focus_fire',
      'focus_fire',
    ],
    traitPool: [
      { id: 'arcane_scholar', name: 'Arcane Scholar', description: 'Max Mana +2.' },
      { id: 'elementalist', name: 'Elementalist', description: 'Elemental damage +20%.' },
      { id: 'necromancer', name: 'Necromancer', description: 'Death-trigger effects gain additional value.' },
      { id: 'battle_mage', name: 'Battle Mage', description: 'Magic cards can empower the next basic attack.' },
      { id: 'support_mage', name: 'Support Mage', description: 'Healing/support +20%.' },
      { id: 'mana_weaver', name: 'Mana Weaver', description: 'First Mana-generation effect each combat grants +1 extra temporary Mana.' },
    ],
  },
};
