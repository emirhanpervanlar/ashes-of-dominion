import type { HeroSkillDefinition } from '../types.js';

/**
 * Hero skills (AGENT.md §5, "Active skill slots: 4") — always available
 * during combat, gated by Mana + a per-battle cooldown instead of the
 * hand/deck. Phase 3 MVP ships 2 of the 4 slots; more arrive with deeper
 * Hero builds (AGENT.md §71 Phase 7).
 */
export const HERO_SKILL_DEFINITIONS: Record<string, HeroSkillDefinition> = {
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Target stack gains 20 Block.',
    cost: { type: 'MANA', amount: 2 },
    targeting: 'ally-stack',
    effects: [{ kind: 'GAIN_BLOCK', amount: 20 }],
    cooldownTurns: 3,
  },
  inspire: {
    id: 'inspire',
    name: 'Inspire',
    description: 'All army gains +2 Morale.',
    cost: { type: 'MANA', amount: 3 },
    targeting: 'none',
    effects: [{ kind: 'GAIN_MORALE_ALL', amount: 2 }],
    cooldownTurns: 4,
  },
};

export const DEFAULT_HERO_SKILL_LOADOUT = ['second_wind', 'inspire'];
