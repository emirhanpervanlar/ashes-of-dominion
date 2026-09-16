export type EventEffect =
  | { kind: 'GOLD_DELTA'; amount: number }
  | { kind: 'FOOD_DELTA'; amount: number }
  | { kind: 'HERO_HEAL_PERCENT'; percent: number }
  | { kind: 'RISKY_SEARCH'; successChance: number; trapGoldLoss: number };

export interface EventOption {
  id: string;
  label: string;
  description: string;
  effect: EventEffect;
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  options: EventOption[];
}

/** AGENT.md §38/§39 — a representative subset; more variety is future content, not an MVP requirement. */
export const EVENT_DEFINITIONS: Record<string, EventDefinition> = {
  abandoned_camp: {
    id: 'abandoned_camp',
    title: 'Abandoned Camp',
    description: 'A cold campsite, recently deserted. Something might still be worth finding.',
    options: [
      {
        id: 'search',
        label: 'Search',
        description: 'Chance for a random relic; risk of a trap.',
        effect: { kind: 'RISKY_SEARCH', successChance: 0.6, trapGoldLoss: 15 },
      },
      {
        id: 'rest',
        label: 'Rest',
        description: 'Hero heals 20% of max HP.',
        effect: { kind: 'HERO_HEAL_PERCENT', percent: 20 },
      },
      {
        id: 'burn',
        label: 'Burn it down',
        description: 'Salvage what you can for Gold.',
        effect: { kind: 'GOLD_DELTA', amount: 15 },
      },
    ],
  },
  bandit_toll: {
    id: 'bandit_toll',
    title: 'Bandit Toll',
    description: 'A band of highwaymen demands payment for safe passage.',
    options: [
      {
        id: 'pay',
        label: 'Pay the toll',
        description: 'Lose 20 Gold.',
        effect: { kind: 'GOLD_DELTA', amount: -20 },
      },
      {
        id: 'refuse',
        label: 'Refuse and push through',
        description: 'The detour costs 10 Food.',
        effect: { kind: 'FOOD_DELTA', amount: -10 },
      },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENT_DEFINITIONS);
