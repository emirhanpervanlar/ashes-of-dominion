import { resolveCard } from '../engine/index.js';
import type { CardDefinition, CardEffect } from '../engine/index.js';

const pct = (multiplier: number): string => `${Math.round(multiplier * 100)}%`;

function effectOf<K extends CardEffect['kind']>(card: CardDefinition, kind: K): Extract<CardEffect, { kind: K }> {
  return card.effects.find((e) => e.kind === kind) as Extract<CardEffect, { kind: K }>;
}

/**
 * Cards whose numbers the balance rounds keep moving are worded from the engine data of the card
 * itself (base or "+" version), so the text cannot drift from what the card does.
 */
const NUMBERED_TEXT: Record<string, (card: CardDefinition) => string> = {
  command_strike: (c) => `Your hero strikes the target enemy stack for ${pct(effectOf(c, 'ATTACK').multiplier)} damage.`,
  volley: (c) => `Your hero shoots the target enemy stack for ${pct(effectOf(c, 'ATTACK').multiplier)} damage.`,
  hold_the_line: (c) => `All frontline stacks +${effectOf(c, 'DEFENSE_BUFF_ALL_FRONTLINE').amount}% Defense this turn.`,
  formation: (c) => `All friendly stacks +${effectOf(c, 'DEFENSE_BUFF_ALL').amount}% Defense this turn.`,
  evasion: (c) => `Selected stack Dodge chance x${effectOf(c, 'SET_FLAGS').flags.dodgeMultiplier} this turn.`,
  fireball: (c) => {
    const splash = effectOf(c, 'ATTACK_SPLASH');
    return `Hits the target for ${pct(splash.primaryMultiplier)} and the stacks beside it in its row for ${pct(splash.secondaryMultiplier)}.`;
  },
};

/** Rules text of a card built from its engine data; undefined for cards worded by hand in CARD_DESCRIPTIONS. */
export function numberedCardText(cardId: string, upgraded: boolean): string | undefined {
  const card = resolveCard(cardId, upgraded);
  return card ? NUMBERED_TEXT[cardId]?.(card) : undefined;
}

/** Short player-facing effect text per card — v3 canonical doc §11-13. UI-only, not engine logic. */
const HAND_WORDED: Record<string, string> = {
  // Unit Skill Cards
  shield_bash: 'Attack + apply Weak (-20% damage) to the target.',
  hold_formation: 'Self +30% Defense; adjacent allies +10% Defense. 1 turn.',
  counterattack: 'Next melee attack received this turn is countered for 70% damage.',
  brace: '+50% Defense, incoming damage -40%, cannot attack. 1 turn.',
  focus_shot: 'Next basic attack +60% damage.',
  piercing_arrow: 'Primary target 125% damage; the target behind it takes 50%.',
  arrow_rain: 'Hits up to 3 enemy stacks for 55% damage each.',
  covering_fire: 'Attack for 60% damage.',
  charge: 'Attack with +50% damage.',
  shield_wall: '+60% Defense self, +20% adjacent allies. Cannot move. 1 turn.',
  protect: "Redirects 40% of an ally's next damage taken to this Knight.",
  lance_breaker: 'Attack with +100% damage and apply Weak (-15% damage). This stack loses 20% Defense for 1 turn.',
  greater_heal: 'The acting stack heals a friendly stack: lost soldiers return, up to its pre-battle size.',
  bless: 'Friendly stack +25% Damage, +15% Defense. 1 turn.',
  purify: 'Removes Poison/Bleed/Burn/Weak from a friendly stack.',
  divine_protection: 'Next lethal hit leaves the stack at 1 soldier instead. +20% Defense.',

  // Hero Cards — Warlord
  blood_rage: 'Next attack +40% damage; loses 5% of its own count after.',
  mass_charge: 'All Knight stacks +30% damage this turn.',
  brutal_command: 'Next attack +100% damage; cannot be redirected.',
  rally: 'All friendly stacks regain 30 morale; draw 1 card.',
  last_stand: 'Target gains +50% Damage, +30% Defense. 1 turn.',
  execution_order: '+100% damage if the target is below 30% HP.',

  // Hero Cards — Rogue
  poison_arrow: "The chosen stack's next attack applies Poison.",
  double_shot: 'Attack twice: 100% then 60% damage.',
  ambush: 'Attack with +25% damage.',
  mark_target: 'Marks the target — ranged damage taken +25% for 2 turns.',
  shadowstep: 'Move a friendly stack; draw 1 card.',
  venomous_army: 'All ranged stacks apply Poison on their next attack this turn.',
  execute: '+150% damage if the target is below 20% HP.',

  // Hero Cards — Mage
  frost: 'Hits the target for 80% damage and Freezes it: it skips its next turn.',
  arcane_storm: 'Hits every enemy stack for 50% damage; the first one takes 100%.',
  arcane_shield: 'Friendly stack incoming damage -35% this turn.',
  heal: 'The acting stack heals a friendly stack: lost soldiers return, up to its pre-battle size.',
  mana_surge: 'Gain +2 Mana this turn. Exhaust.',
  chain_lightning: 'Hits the target for 100% damage and up to 2 other enemy stacks for 50%.',
  arcane_overload: 'Gain +3 Mana and draw a card. Unique.',

  // Neutral Cards
  focus_fire: 'The next attack by any of your stacks deals +50% damage. Hero spells do not use it.',
  reposition: 'Move a friendly stack; its next attack +15% damage.',
  tactical_insight: 'Draw 2 cards.',
  emergency_retreat: 'Selected stack cannot be targeted or attack this turn.',
  second_wind: 'Selected stack regains soldiers equal to 10% of its pre-battle size. Exhaust.',
  battle_hardened: '+20% Damage, +20% Defense to all friendly stacks. 1 turn.',
};

export const CARD_DESCRIPTIONS: Record<string, string> = {
  ...HAND_WORDED,
  ...Object.fromEntries(Object.keys(NUMBERED_TEXT).map((id) => [id, numberedCardText(id, false)!])),
};
