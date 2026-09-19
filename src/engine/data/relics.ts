import type { RelicDefinition } from '../types.js';

/**
 * Found relics (AO-D037): earned from elite battles, rarely from events, or bought from merchants.
 * Rarity follows power; some carry a drawback, stated in the description. Numbers are PROTOTYPE.
 * "Infantry" is the tag every player melee fighter (Swordsman, Knight) has, so it stands in for "melee".
 */
export const RELIC_DEFINITIONS: Record<string, RelicDefinition> = {
  iron_bracers: {
    id: 'iron_bracers',
    name: 'Iron Bracers',
    description: 'Army takes -10% damage.',
    rarity: 'common',
    effects: [{ kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 0.9 }],
  },
  field_chaplains_charm: {
    id: 'field_chaplains_charm',
    name: "Field Chaplain's Charm",
    description: 'Healing +30%.',
    rarity: 'common',
    effects: [{ kind: 'HEALING_MULT', multiplier: 1.3 }],
  },
  hawks_eye: {
    id: 'hawks_eye',
    name: "Hawk's Eye",
    description: 'Ranged units deal +20% damage. Infantry deal -10% damage.',
    rarity: 'common',
    effects: [
      { kind: 'TAG_DAMAGE_MULT', tag: 'ranged', multiplier: 1.2 },
      { kind: 'TAG_DAMAGE_MULT', tag: 'infantry', multiplier: 0.9 },
    ],
  },
  bulwark_standard: {
    id: 'bulwark_standard',
    name: 'Bulwark Standard',
    description: 'Army takes -15% damage. Army deals -10% damage.',
    rarity: 'common',
    effects: [
      { kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 0.85 },
      { kind: 'PLAYER_DAMAGE_MULT', multiplier: 0.9 },
    ],
  },
  shadow_ring: {
    id: 'shadow_ring',
    name: 'Shadow Ring',
    description: 'Dodge +8%. Hero max Mana -1.',
    rarity: 'common',
    effects: [
      { kind: 'DODGE_BONUS_PERCENT', amount: 8 },
      { kind: 'HERO_MAX_MANA', amount: -1 },
    ],
  },
  hunters_quiver: {
    id: 'hunters_quiver',
    name: "Hunter's Quiver",
    description: 'Ranged units deal +30% damage. Infantry deal -20% damage.',
    rarity: 'common',
    effects: [
      { kind: 'TAG_DAMAGE_MULT', tag: 'ranged', multiplier: 1.3 },
      { kind: 'TAG_DAMAGE_MULT', tag: 'infantry', multiplier: 0.8 },
    ],
  },
  kings_crown: {
    id: 'kings_crown',
    name: "King's Crown",
    description: 'Stacks with Count > 100 gain +2 Strength.',
    rarity: 'rare',
    effects: [{ kind: 'LARGE_STACK_STRENGTH', threshold: 100, amount: 2 }],
  },
  blood_banner: {
    id: 'blood_banner',
    name: 'Blood Banner',
    description: 'Army deals +30% damage. Army takes +15% damage.',
    rarity: 'rare',
    effects: [
      { kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.3 },
      { kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 1.15 },
    ],
  },
  crown_of_champions: {
    id: 'crown_of_champions',
    name: 'Crown of Champions',
    description: 'Stacks with Count < 25 deal +30% damage. Army takes +10% damage.',
    rarity: 'rare',
    effects: [
      { kind: 'SMALL_STACK_DAMAGE_MULT', threshold: 25, multiplier: 1.3 },
      { kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 1.1 },
    ],
  },
  banner_of_the_horde: {
    id: 'banner_of_the_horde',
    name: 'Banner of the Horde',
    description: 'Stacks with Count > 50 gain +3 Strength. Ranged units deal -10% damage.',
    rarity: 'rare',
    effects: [
      { kind: 'LARGE_STACK_STRENGTH', threshold: 50, amount: 3 },
      { kind: 'TAG_DAMAGE_MULT', tag: 'ranged', multiplier: 0.9 },
    ],
  },
  misers_ledger: {
    id: 'misers_ledger',
    name: "Miser's Ledger",
    description: 'Hero max Mana +2. Healing -30%.',
    rarity: 'rare',
    effects: [
      { kind: 'HERO_MAX_MANA', amount: 2 },
      { kind: 'HEALING_MULT', multiplier: 0.7 },
    ],
  },
  cursed_crown: {
    id: 'cursed_crown',
    name: 'Cursed Crown',
    description: 'Hero max Mana +3. Army takes +20% damage.',
    rarity: 'epic',
    effects: [
      { kind: 'HERO_MAX_MANA', amount: 3 },
      { kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 1.2 },
    ],
  },
  glass_cannon_idol: {
    id: 'glass_cannon_idol',
    name: 'Glass Cannon Idol',
    description: 'Army deals +40% damage. Army takes +25% damage.',
    rarity: 'epic',
    effects: [
      { kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.4 },
      { kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 1.25 },
    ],
  },
};

/**
 * Starting relics (AO-D037): a separate pool of exactly 5, all offered on the hero-choice screen,
 * chosen once before the first battle. Simple; Arcane Crystal is the only one with a (small) drawback.
 */
export const STARTING_RELIC_DEFINITIONS: Record<string, RelicDefinition> = {
  royal_banner: {
    id: 'royal_banner',
    name: 'Royal Banner',
    description: "Army size +6 (added to the run's largest starting stack).",
    rarity: 'common',
    effects: [{ kind: 'ARMY_SIZE_FLAT_LARGEST', amount: 6 }],
  },
  arcane_crystal: {
    id: 'arcane_crystal',
    name: 'Arcane Crystal',
    description: 'Hero max Mana +2. Army size -10%.',
    rarity: 'common',
    effects: [
      { kind: 'HERO_MAX_MANA', amount: 2 },
      { kind: 'ARMY_SIZE_MULT', multiplier: 0.9 },
    ],
  },
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'Army deals +10% damage.',
    rarity: 'common',
    effects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.1 }],
  },
  padded_vest: {
    id: 'padded_vest',
    name: 'Padded Vest',
    description: 'Army takes -8% damage.',
    rarity: 'common',
    effects: [{ kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 0.92 }],
  },
  lucky_charm: {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    description: 'Dodge +5%.',
    rarity: 'common',
    effects: [{ kind: 'DODGE_BONUS_PERCENT', amount: 5 }],
  },
};
