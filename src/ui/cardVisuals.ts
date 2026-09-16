export type CardPolarity = 'attack' | 'defense' | 'buff' | 'debuff' | 'utility';

export interface CardVisual {
  icon: string;
  polarity: CardPolarity;
}

/** Central icon + color-glow per card/skill id — purely cosmetic, no gameplay meaning. */
export const CARD_VISUALS: Record<string, CardVisual> = {
  command_strike: { icon: '⚔️', polarity: 'attack' },
  command_strike_plus: { icon: '⚔️', polarity: 'attack' },
  charge: { icon: '🐎', polarity: 'attack' },
  volley: { icon: '🏹', polarity: 'attack' },
  volley_plus: { icon: '🏹', polarity: 'attack' },
  execute: { icon: '🗡️', polarity: 'attack' },
  veterans_resolve: { icon: '⚔️', polarity: 'attack' },

  defend: { icon: '🛡️', polarity: 'defense' },
  defend_plus: { icon: '🛡️', polarity: 'defense' },
  shield_wall: { icon: '🛡️', polarity: 'defense' },
  shield_wall_plus: { icon: '🛡️', polarity: 'defense' },
  guard_stance: { icon: '🪖', polarity: 'defense' },
  reposition: { icon: '🔀', polarity: 'defense' },

  rally: { icon: '🚩', polarity: 'buff' },
  commanders_presence: { icon: '📯', polarity: 'buff' },

  focus_fire: { icon: '🎯', polarity: 'debuff' },
  raise_dead: { icon: '☠️', polarity: 'debuff' },

  arcane_focus: { icon: '✨', polarity: 'utility' },
  battle_meditation: { icon: '🧘', polarity: 'utility' },
  tactical_insight: { icon: '📜', polarity: 'utility' },

  second_wind: { icon: '🛡️', polarity: 'defense' },
  inspire: { icon: '📯', polarity: 'buff' },
};

const FALLBACKS: Record<CardPolarity, string> = {
  attack: '⚔️',
  defense: '🛡️',
  buff: '📯',
  debuff: '☠️',
  utility: '✨',
};

export function cardVisual(id: string): CardVisual {
  return CARD_VISUALS[id] ?? { icon: FALLBACKS.utility, polarity: 'utility' };
}
