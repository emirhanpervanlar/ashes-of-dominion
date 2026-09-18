export type CardPolarity = 'attack' | 'defense' | 'buff' | 'debuff' | 'utility';

export interface CardVisual {
  icon: string;
  polarity: CardPolarity;
}

/** Central icon + color-glow per card id — purely cosmetic, no gameplay meaning. */
export const CARD_VISUALS: Record<string, CardVisual> = {
  // Unit Skill Cards
  shield_bash: { icon: '🛡️', polarity: 'attack' },
  hold_formation: { icon: '🪖', polarity: 'defense' },
  counterattack: { icon: '🔁', polarity: 'defense' },
  brace: { icon: '🧱', polarity: 'defense' },
  focus_shot: { icon: '🎯', polarity: 'buff' },
  piercing_arrow: { icon: '🏹', polarity: 'attack' },
  arrow_rain: { icon: '🌧️', polarity: 'attack' },
  covering_fire: { icon: '🏹', polarity: 'attack' },
  charge: { icon: '🐎', polarity: 'attack' },
  shield_wall: { icon: '🛡️', polarity: 'defense' },
  protect: { icon: '🤝', polarity: 'defense' },
  lance_breaker: { icon: '🗡️', polarity: 'attack' },
  greater_heal: { icon: '💚', polarity: 'utility' },
  bless: { icon: '✨', polarity: 'buff' },
  purify: { icon: '🧼', polarity: 'utility' },
  divine_protection: { icon: '😇', polarity: 'defense' },

  // Hero Cards — Warlord
  blood_rage: { icon: '🩸', polarity: 'attack' },
  mass_charge: { icon: '🐎', polarity: 'buff' },
  hold_the_line: { icon: '🛡️', polarity: 'defense' },
  brutal_command: { icon: '⚔️', polarity: 'attack' },
  rally: { icon: '🚩', polarity: 'buff' },
  last_stand: { icon: '🔥', polarity: 'buff' },
  formation: { icon: '🪖', polarity: 'defense' },
  execution_order: { icon: '☠️', polarity: 'attack' },

  // Hero Cards — Rogue
  poison_arrow: { icon: '☠️', polarity: 'debuff' },
  double_shot: { icon: '🏹', polarity: 'attack' },
  evasion: { icon: '💨', polarity: 'defense' },
  ambush: { icon: '🗡️', polarity: 'attack' },
  mark_target: { icon: '🎯', polarity: 'debuff' },
  shadowstep: { icon: '🌀', polarity: 'utility' },
  venomous_army: { icon: '☠️', polarity: 'debuff' },
  execute: { icon: '🗡️', polarity: 'attack' },

  // Hero Cards — Mage
  fireball: { icon: '🔥', polarity: 'attack' },
  frost: { icon: '❄️', polarity: 'attack' },
  arcane_storm: { icon: '⚡', polarity: 'attack' },
  arcane_shield: { icon: '🔷', polarity: 'defense' },
  heal: { icon: '💚', polarity: 'utility' },
  mana_surge: { icon: '🔮', polarity: 'utility' },
  chain_lightning: { icon: '⚡', polarity: 'attack' },
  arcane_overload: { icon: '🌟', polarity: 'utility' },

  // Neutral Cards
  focus_fire: { icon: '🎯', polarity: 'buff' },
  reposition: { icon: '🔀', polarity: 'utility' },
  tactical_insight: { icon: '📜', polarity: 'utility' },
  emergency_retreat: { icon: '🏳️', polarity: 'defense' },
  second_wind: { icon: '🌬️', polarity: 'utility' },
  battle_hardened: { icon: '📯', polarity: 'buff' },
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
