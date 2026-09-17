import type { CardDefinition } from '../types.js';

/**
 * v2 card pool (v2_list.md §8/§9/§10) — cards are unit abilities and
 * Commander commands layered on top of each stack's free basic action, not
 * the only way units act. All costs use the single Energy resource except
 * Hero/Mana-flavored utility cards, which stay on Mana.
 *
 * "Charge" requires a friendly stack tagged 'cavalry' (enforced in
 * combat.ts's validateTargeting) — the Cavalier unit (data/units.ts) is
 * the first unit to carry that tag.
 */
export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  command_strike: {
    id: 'command_strike',
    name: 'Command: Strike',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1 }],
    exhaust: false,
    tags: ['command', 'attack'],
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1.5 }],
    exhaust: false,
    tags: ['cavalry', 'attack', 'aggressive'],
  },
  volley: {
    id: 'volley',
    name: 'Volley',
    cost: { type: 'ENERGY', amount: 2 },
    targeting: 'enemy-stack',
    effects: [{ kind: 'ATTACK_ALL_WITH_TAG', tag: 'archer', multiplier: 1 }],
    exhaust: false,
    tags: ['archer', 'attack'],
  },
  defend: {
    id: 'defend',
    name: 'Defend',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack',
    effects: [{ kind: 'GAIN_BLOCK', amount: 15 }],
    exhaust: false,
    tags: ['defense'],
  },
  shield_wall: {
    id: 'shield_wall',
    name: 'Shield Wall',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_BLOCK_ALL_FRONT', amount: 25 }],
    exhaust: false,
    tags: ['defense'],
  },
  reposition: {
    id: 'reposition',
    name: 'Reposition',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack+position',
    effects: [{ kind: 'MOVE_STACK' }],
    exhaust: false,
    tags: ['tactical'],
  },
  rally: {
    id: 'rally',
    name: 'Rally',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack',
    effects: [{ kind: 'GAIN_MORALE', amount: 2 }],
    exhaust: false,
    tags: ['morale', 'support', 'command'],
  },
  arcane_focus: {
    id: 'arcane_focus',
    name: 'Arcane Focus',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_MANA', amount: 2 }],
    exhaust: false,
    tags: ['hero', 'mana'],
  },
  battle_meditation: {
    id: 'battle_meditation',
    name: 'Battle Meditation',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_MANA_AND_DRAW', mana: 1, draw: 1 }],
    exhaust: false,
    tags: ['hero', 'mana', 'draw'],
  },
  tactical_insight: {
    id: 'tactical_insight',
    name: 'Tactical Insight',
    cost: { type: 'MANA', amount: 0 },
    targeting: 'none',
    effects: [{ kind: 'DRAW', amount: 2 }],
    exhaust: true,
    tags: ['hero', 'draw'],
  },

  // Upgraded variants (AGENT.md §14 "Upgrades may change mechanics, not
  // only numbers") — Phase 3 MVP keeps these as straightforward numeric
  // bumps; see run/cardUpgrades.ts for which base card maps to which.
  command_strike_plus: {
    id: 'command_strike_plus',
    name: 'Command: Strike+',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1.25 }],
    exhaust: false,
    tags: ['command', 'attack'],
  },
  defend_plus: {
    id: 'defend_plus',
    name: 'Defend+',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack',
    effects: [{ kind: 'GAIN_BLOCK', amount: 25 }],
    exhaust: false,
    tags: ['defense'],
  },
  shield_wall_plus: {
    id: 'shield_wall_plus',
    name: 'Shield Wall+',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_BLOCK_ALL_FRONT', amount: 35 }],
    exhaust: false,
    tags: ['defense'],
  },
  volley_plus: {
    id: 'volley_plus',
    name: 'Volley+',
    cost: { type: 'ENERGY', amount: 2 },
    targeting: 'enemy-stack',
    effects: [{ kind: 'ATTACK_ALL_WITH_TAG', tag: 'archer', multiplier: 1.2 }],
    exhaust: false,
    tags: ['archer', 'attack'],
  },

  // Phase 7 build-archetype support (AGENT.md §48) — the first 4 are from
  // the original §15 card pool (not required by §73's MVP minimum, added
  // now that Morale/Veterancy actually affect combat); the last 2 are new.
  commanders_presence: {
    id: 'commanders_presence',
    name: "Commander's Presence",
    cost: { type: 'ENERGY', amount: 2 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_MORALE_ALL', amount: 1 }],
    exhaust: false,
    tags: ['morale', 'support', 'command', 'horde'],
  },
  execute: {
    id: 'execute',
    name: 'Execute',
    cost: { type: 'ENERGY', amount: 2 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1, conditionalBonus: { targetHpBelowPercent: 30, multiplier: 1.5 } }],
    exhaust: false,
    tags: ['attack', 'finisher'],
  },
  focus_fire: {
    id: 'focus_fire',
    name: 'Focus Fire',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'enemy-stack',
    effects: [{ kind: 'APPLY_VULNERABLE', amount: 25, duration: 1 }],
    exhaust: false,
    tags: ['debuff', 'tactical'],
  },
  veterans_resolve: {
    id: 'veterans_resolve',
    name: "Veteran's Resolve",
    cost: { type: 'ENERGY', amount: 2 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1.3 }],
    exhaust: false,
    tags: ['veteran', 'attack', 'immortal-knights'],
  },
  guard_stance: {
    id: 'guard_stance',
    name: 'Guard Stance',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack',
    effects: [
      { kind: 'GAIN_TAUNT', duration: 2 },
      { kind: 'GAIN_BLOCK', amount: 15 },
    ],
    exhaust: false,
    tags: ['guard', 'defense', 'immortal-knights'],
  },
  raise_dead: {
    id: 'raise_dead',
    name: 'Raise Dead',
    cost: { type: 'ENERGY', amount: 1 },
    targeting: 'ally-stack',
    effects: [{ kind: 'SACRIFICE_FOR_SKELETONS', sacrificePercent: 20, skeletonsPerSacrificed: 1 }],
    exhaust: false,
    tags: ['death', 'sacrifice', 'summon', 'undying-legion'],
  },
};
