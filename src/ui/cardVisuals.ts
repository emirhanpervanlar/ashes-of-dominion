import type { IconName } from './pixel/icons.js';

export type CardPolarity = 'attack' | 'defense' | 'buff' | 'debuff' | 'utility';

export interface CardVisual {
  icon: IconName;
  polarity: CardPolarity;
}

/** Central icon + color-glow per card id — purely cosmetic, no gameplay meaning. */
export const CARD_VISUALS: Record<string, CardVisual> = {
  // Unit Skill Cards
  shield_bash: { icon: 'shield', polarity: 'attack' },
  hold_formation: { icon: 'fx_helm', polarity: 'defense' },
  counterattack: { icon: 'ui_swap', polarity: 'defense' },
  brace: { icon: 'shield', polarity: 'defense' },
  focus_shot: { icon: 'fx_target', polarity: 'buff' },
  piercing_arrow: { icon: 'role_ranged', polarity: 'attack' },
  arrow_rain: { icon: 'role_ranged', polarity: 'attack' },
  covering_fire: { icon: 'role_ranged', polarity: 'attack' },
  charge: { icon: 'fx_horse', polarity: 'attack' },
  shield_wall: { icon: 'shield', polarity: 'defense' },
  protect: { icon: 'role_tank', polarity: 'defense' },
  lance_breaker: { icon: 'fx_dagger', polarity: 'attack' },
  greater_heal: { icon: 'heal', polarity: 'utility' },
  bless: { icon: 'fx_sparkle', polarity: 'buff' },
  purify: { icon: 'fx_sparkle', polarity: 'utility' },
  divine_protection: { icon: 'role_support', polarity: 'defense' },

  // Hero Cards — Warlord
  blood_rage: { icon: 'st_bleed', polarity: 'attack' },
  mass_charge: { icon: 'fx_horse', polarity: 'buff' },
  hold_the_line: { icon: 'shield', polarity: 'defense' },
  brutal_command: { icon: 'role_melee', polarity: 'attack' },
  rally: { icon: 'fx_banner', polarity: 'buff' },
  last_stand: { icon: 'st_burn', polarity: 'buff' },
  formation: { icon: 'fx_helm', polarity: 'defense' },
  execution_order: { icon: 'fx_skull', polarity: 'attack' },

  // Hero Cards — Rogue
  poison_arrow: { icon: 'st_poison', polarity: 'debuff' },
  double_shot: { icon: 'role_ranged', polarity: 'attack' },
  evasion: { icon: 'fx_wind', polarity: 'defense' },
  ambush: { icon: 'fx_dagger', polarity: 'attack' },
  mark_target: { icon: 'fx_target', polarity: 'debuff' },
  shadowstep: { icon: 'ui_swap', polarity: 'utility' },
  venomous_army: { icon: 'st_poison', polarity: 'debuff' },
  execute: { icon: 'fx_dagger', polarity: 'attack' },

  // Hero Cards — Mage
  fireball: { icon: 'st_burn', polarity: 'attack' },
  frost: { icon: 'st_freeze', polarity: 'attack' },
  arcane_storm: { icon: 'fx_bolt', polarity: 'attack' },
  arcane_shield: { icon: 'shield', polarity: 'defense' },
  heal: { icon: 'heal', polarity: 'utility' },
  mana_surge: { icon: 'mana', polarity: 'utility' },
  chain_lightning: { icon: 'fx_bolt', polarity: 'attack' },
  arcane_overload: { icon: 'fx_sparkle', polarity: 'utility' },

  // Neutral Cards
  focus_fire: { icon: 'fx_target', polarity: 'buff' },
  reposition: { icon: 'ui_swap', polarity: 'utility' },
  tactical_insight: { icon: 'ui_log', polarity: 'utility' },
  emergency_retreat: { icon: 'fx_flag', polarity: 'defense' },
  second_wind: { icon: 'fx_wind', polarity: 'utility' },
  battle_hardened: { icon: 'st_taunt', polarity: 'buff' },
};

/** Card-type icon shown on every card of that polarity. */
export const POLARITY_ICONS: Record<CardPolarity, IconName> = {
  attack: 'card_attack',
  defense: 'card_defense',
  buff: 'card_buff',
  debuff: 'card_debuff',
  utility: 'card_utility',
};

export function cardVisual(id: string): CardVisual {
  return CARD_VISUALS[id] ?? { icon: POLARITY_ICONS.utility, polarity: 'utility' };
}
