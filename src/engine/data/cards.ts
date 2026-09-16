import type { CardDefinition } from '../types.js';

/**
 * MVP card pool — the 10 cards AGENT.md §73 names as the minimum set for
 * the combat engine vertical slice. Costs use AC/DC/Mana per AGENT.md §15.
 *
 * ASSUMPTION (documented per AGENT.md §72): "Charge" requires a cavalry
 * stack in the full design, but no MVP unit is tagged cavalry yet. For the
 * vertical slice, Charge targets any friendly FRONT-row stack instead.
 * Revisit once a cavalry unit exists.
 */
export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  command_strike: {
    id: 'command_strike',
    name: 'Command: Strike',
    cost: { type: 'AC', amount: 1 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1 }],
    exhaust: false,
    tags: ['command', 'attack'],
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    cost: { type: 'AC', amount: 1 },
    targeting: 'ally-stack+enemy-stack',
    effects: [{ kind: 'ATTACK', multiplier: 1.5 }],
    exhaust: false,
    tags: ['cavalry', 'attack', 'aggressive'],
  },
  volley: {
    id: 'volley',
    name: 'Volley',
    cost: { type: 'AC', amount: 2 },
    targeting: 'enemy-stack',
    effects: [{ kind: 'ATTACK_ALL_WITH_TAG', tag: 'archer', multiplier: 1 }],
    exhaust: false,
    tags: ['archer', 'attack'],
  },
  defend: {
    id: 'defend',
    name: 'Defend',
    cost: { type: 'DC', amount: 1 },
    targeting: 'ally-stack',
    effects: [{ kind: 'GAIN_BLOCK', amount: 15 }],
    exhaust: false,
    tags: ['defense'],
  },
  shield_wall: {
    id: 'shield_wall',
    name: 'Shield Wall',
    cost: { type: 'DC', amount: 1 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_BLOCK_ALL_FRONT', amount: 25 }],
    exhaust: false,
    tags: ['defense'],
  },
  reposition: {
    id: 'reposition',
    name: 'Reposition',
    cost: { type: 'DC', amount: 1 },
    targeting: 'ally-stack+position',
    effects: [{ kind: 'MOVE_STACK' }],
    exhaust: false,
    tags: ['tactical'],
  },
  rally: {
    id: 'rally',
    name: 'Rally',
    cost: { type: 'DC', amount: 1 },
    targeting: 'ally-stack',
    effects: [{ kind: 'GAIN_MORALE', amount: 2 }],
    exhaust: false,
    tags: ['morale', 'support', 'command'],
  },
  arcane_focus: {
    id: 'arcane_focus',
    name: 'Arcane Focus',
    cost: { type: 'DC', amount: 1 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_MANA', amount: 2 }],
    exhaust: false,
    tags: ['hero', 'mana'],
  },
  battle_meditation: {
    id: 'battle_meditation',
    name: 'Battle Meditation',
    cost: { type: 'DC', amount: 1 },
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
};
