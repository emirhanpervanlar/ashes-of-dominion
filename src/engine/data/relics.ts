import type { RelicDefinition } from '../types.js';

/**
 * Found relics (AGENT.md §16). A representative subset — not every example
 * in the doc translates to a mechanic that exists yet (no recruitment, no
 * Hero-damage spells, no shops in the MVP), so those are deferred rather
 * than half-implemented. Numbers are PROTOTYPE.
 */
export const RELIC_DEFINITIONS: Record<string, RelicDefinition> = {
  kings_crown: {
    id: 'kings_crown',
    name: "King's Crown",
    description: 'Stacks with Count > 100 gain +2 Strength.',
    effects: [{ kind: 'LARGE_STACK_STRENGTH', threshold: 100, amount: 2 }],
  },
  blood_banner: {
    id: 'blood_banner',
    name: 'Blood Banner',
    description: 'Army damage +30%.',
    effects: [{ kind: 'PLAYER_DAMAGE_MULT', multiplier: 1.3 }],
  },
  cursed_crown: {
    id: 'cursed_crown',
    name: 'Cursed Crown',
    description: 'Hero max Mana +3.',
    effects: [{ kind: 'HERO_MAX_MANA', amount: 3 }],
  },
  hawks_eye: {
    id: 'hawks_eye',
    name: "Hawk's Eye",
    description: 'Ranged units +20% Attack.',
    effects: [{ kind: 'TAG_DAMAGE_MULT', tag: 'ranged', multiplier: 1.2 }],
  },
  crown_of_champions: {
    id: 'crown_of_champions',
    name: 'Crown of Champions',
    description: 'Stacks with Count < 25 deal +30% damage.',
    effects: [{ kind: 'SMALL_STACK_DAMAGE_MULT', threshold: 25, multiplier: 1.3 }],
  },
  banner_of_the_horde: {
    id: 'banner_of_the_horde',
    name: 'Banner of the Horde',
    description: 'Stacks with Count > 50 gain +3 Strength.',
    effects: [{ kind: 'LARGE_STACK_STRENGTH', threshold: 50, amount: 3 }],
  },
  bulwark_standard: {
    id: 'bulwark_standard',
    name: 'Bulwark Standard',
    description: 'Army takes -15% damage.',
    effects: [{ kind: 'PLAYER_DAMAGE_TAKEN_MULT', multiplier: 0.85 }],
  },
  shadow_ring: {
    id: 'shadow_ring',
    name: 'Shadow Ring',
    description: 'Dodge +8%.',
    effects: [{ kind: 'DODGE_BONUS_PERCENT', amount: 8 }],
  },
};

/** Starting relics (AGENT.md §17) — chosen once, before the first battle of a run. */
export const STARTING_RELIC_DEFINITIONS: Record<string, RelicDefinition> = {
  royal_banner: {
    id: 'royal_banner',
    name: 'Royal Banner',
    description: "Army size +6 (added to the run's largest starting stack).",
    effects: [{ kind: 'ARMY_SIZE_FLAT_LARGEST', amount: 6 }],
  },
  arcane_crystal: {
    id: 'arcane_crystal',
    name: 'Arcane Crystal',
    description: 'Hero max Mana +2. Army size -10%.',
    effects: [
      { kind: 'HERO_MAX_MANA', amount: 2 },
      { kind: 'ARMY_SIZE_MULT', multiplier: 0.9 },
    ],
  },
};
