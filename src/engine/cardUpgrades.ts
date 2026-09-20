import { CARD_DEFINITIONS } from './data/cards.js';
import type { CardDefinition, CardInstance, CardUpgradeDefinition } from './types.js';

/**
 * AO-D060 / AO-032 — the "+" version of every card, in one place. One rule per card, never a new
 * debuff, never a lost condition or drawback:
 *  (a) cost -1 on a 2+ Mana card, or
 *  (b) the main numbers +25..40% (a buff's duration is left alone), or
 *  (c) one small extra effect (draw) on a cheap card whose numbers are already high.
 * `effects` replaces the base effects in full (same kinds, same order, plus at most one appended
 * effect); `manaCost` replaces the cost; anything omitted stays as the base card has it.
 */
export const CARD_UPGRADES: Record<string, CardUpgradeDefinition> = {
  // Swordsman
  shield_bash: {
    description: 'Attack with +30% damage + apply Weak (-20% damage) to the target.',
    effects: [
      { kind: 'ATTACK', multiplier: 1.3 },
      { kind: 'APPLY_STATUS', status: 'weak', amount: 20, duration: 1 },
    ],
  },
  hold_formation: {
    description: 'Self +40% Defense; adjacent allies +13% Defense. 1 turn.',
    effects: [
      { kind: 'MODIFY_STAT', stat: 'defense', amount: 40, duration: 1, scope: 'self' },
      { kind: 'MODIFY_STAT', stat: 'defense', amount: 13, duration: 1, scope: 'adjacent-allies' },
    ],
  },
  counterattack: {
    description: 'Next melee attack received this turn is countered for 95% damage.',
    effects: [{ kind: 'SET_FLAGS', target: 'self', flags: { counterattackPercent: 95, counterattackUsesLeft: 1 } }],
  },
  brace: { description: '+50% Defense, incoming damage -40%, cannot attack. 1 turn.', manaCost: 1 },

  // Archer
  focus_shot: {
    description: 'Next basic attack +80% damage.',
    effects: [{ kind: 'SET_FLAGS', target: 'self', flags: { nextAttackDamageBonusPercent: 80, nextAttackAccuracyBonusPercent: 20 } }],
  },
  piercing_arrow: {
    description: 'Primary target 160% damage; the target behind it takes 65%.',
    effects: [{ kind: 'ATTACK_PRIMARY_AND_BEHIND', primaryMultiplier: 1.6, behindMultiplier: 0.65 }],
  },
  arrow_rain: { description: 'Hits up to 3 enemy stacks for 55% damage each.', manaCost: 2 },
  covering_fire: {
    description: 'Immediate 80% damage attack.',
    effects: [{ kind: 'ATTACK', multiplier: 0.8 }],
  },

  // Knight
  charge: {
    description: 'Attack with +100% damage.',
    effects: [{ kind: 'ATTACK', multiplier: 2 }],
  },
  shield_wall: {
    description: '+80% Defense self, +25% adjacent allies. Cannot move. 1 turn.',
    effects: [
      { kind: 'MODIFY_STAT', stat: 'defense', amount: 80, duration: 1, scope: 'self' },
      { kind: 'MODIFY_STAT', stat: 'defense', amount: 25, duration: 1, scope: 'adjacent-allies' },
      { kind: 'SET_FLAGS', target: 'self', flags: { cannotMove: true } },
    ],
  },
  protect: {
    description: "Redirects 55% of an ally's next damage taken to this Knight.",
    effects: [{ kind: 'SET_FLAGS', target: 'other', flags: { redirectPercent: 55, redirectToStackId: '$ACTING' } }],
  },
  lance_breaker: { description: '+100% damage; applies Weak; self -20% Defense. 1 turn.', manaCost: 2 },

  // Priest
  greater_heal: {
    description: 'Restores lost soldiers (+35% healing), capped at pre-battle max.',
    effects: [{ kind: 'HEAL', multiplier: 1.35 }],
  },
  bless: {
    description: 'Friendly stack +33% Damage, +20% Defense. 1 turn.',
    effects: [{ kind: 'DAMAGE_AND_DEFENSE_BUFF', damageAmount: 33, defenseAmount: 20, duration: 1 }],
  },
  purify: {
    description: 'Removes Poison/Bleed/Burn/Weak from a friendly stack. Draw 1 card.',
    effects: [
      { kind: 'REMOVE_STATUSES', statuses: ['poison', 'bleed', 'burn', 'weak'] },
      { kind: 'DRAW', amount: 1 },
    ],
  },
  divine_protection: { description: 'Next lethal hit leaves the stack at 1 soldier instead. +20% Defense.', manaCost: 2 },

  // Warlord
  command_strike: {
    description: 'Hero attack on the enemy stack with +31% power. Scales with Strength.',
    effects: [{ kind: 'ATTACK', multiplier: 1.05 }],
  },
  blood_rage: {
    description: 'Next attack +55% damage; loses 5% of its own count after.',
    effects: [{ kind: 'SET_FLAGS', target: 'self', flags: { nextAttackDamageBonusPercent: 55, selfCasualtyPercentAfterAttack: 5 } }],
  },
  mass_charge: {
    description: 'All Knight stacks +40% damage this turn.',
    effects: [{ kind: 'DAMAGE_BUFF_ALL_WITH_TAG', tag: 'heavy', amount: 40, duration: 1 }],
  },
  hold_the_line: {
    description: 'All frontline stacks +33% Defense this turn.',
    effects: [{ kind: 'DEFENSE_BUFF_ALL_FRONTLINE', amount: 33, duration: 1 }],
  },
  brutal_command: { description: 'Next attack +100% damage; cannot be redirected.', manaCost: 1 },
  rally: {
    description: 'All friendly stacks regain more morale; draw 1 card.',
    effects: [
      { kind: 'GAIN_MORALE_ALL', amount: 40 },
      { kind: 'DRAW', amount: 1 },
    ],
  },
  last_stand: {
    description: 'Target gains +65% Damage, +40% Defense. 1 turn.',
    effects: [{ kind: 'DAMAGE_AND_DEFENSE_BUFF', damageAmount: 65, defenseAmount: 40, duration: 1 }],
  },
  formation: {
    description: 'All friendly stacks +20% Defense this turn.',
    effects: [{ kind: 'DEFENSE_BUFF_ALL', amount: 20, duration: 1 }],
  },
  execution_order: {
    description: '+160% damage if the target is below 30% HP.',
    effects: [{ kind: 'ATTACK', multiplier: 1, conditionalBonus: { targetHpBelowPercent: 30, multiplier: 2.6 } }],
  },

  // Rogue
  volley: {
    description: 'Hero attack on the enemy stack with +31% power. Scales with Dexterity.',
    effects: [{ kind: 'ATTACK', multiplier: 1.05 }],
  },
  poison_arrow: {
    description: 'Next Archer attack applies stronger Poison.',
    effects: [{ kind: 'SET_FLAGS', target: 'self', flags: { nextAttackAppliesStatus: { status: 'poison', amount: 5, duration: 3 } } }],
  },
  double_shot: {
    description: 'Attack twice: 125% then 80% damage.',
    effects: [{ kind: 'ATTACK_TWICE', firstMultiplier: 1.25, secondMultiplier: 0.8 }],
  },
  evasion: {
    description: 'Selected stack Dodge chance x1.6 this turn.',
    effects: [{ kind: 'SET_FLAGS', target: 'self', flags: { dodgeMultiplier: 1.6 } }],
  },
  ambush: {
    description: 'Attack with +60% damage.',
    effects: [{ kind: 'ATTACK', multiplier: 1.6 }],
  },
  mark_target: {
    description: 'Marks the target — ranged damage taken +33% for 2 turns.',
    effects: [{ kind: 'SET_FLAGS', target: 'other', flags: { markedRangedBonusPercent: 33, markedDuration: 2 } }],
  },
  shadowstep: {
    description: 'Move a friendly stack; draw 2 cards.',
    effects: [{ kind: 'MOVE_STACK' }, { kind: 'DRAW', amount: 2 }],
  },
  venomous_army: { description: 'All ranged stacks apply Poison on their next attack this turn.', manaCost: 2 },
  execute: {
    description: '+220% damage if the target is below 20% HP.',
    effects: [{ kind: 'ATTACK', multiplier: 1, conditionalBonus: { targetHpBelowPercent: 20, multiplier: 3.2 } }],
  },

  // Mage
  fireball: {
    description: 'Damages the target and 50% to adjacent stacks.',
    effects: [{ kind: 'ATTACK_SPLASH', primaryMultiplier: 1.8, secondaryMultiplier: 0.5, maxSecondaryTargets: 2 }],
  },
  frost: {
    description: 'Full magic damage and applies Freeze.',
    effects: [
      { kind: 'ATTACK', multiplier: 1 },
      { kind: 'APPLY_STATUS', status: 'freeze', amount: 1, duration: 1 },
    ],
  },
  arcane_storm: { description: 'Hits all enemy stacks; the first takes bonus damage.', manaCost: 3 },
  arcane_shield: {
    description: 'Friendly stack incoming damage -45% this turn.',
    effects: [{ kind: 'SET_FLAGS', target: 'self', flags: { incomingDamageReductionPercent: 45 } }],
  },
  heal: {
    description: 'Restores lost soldiers (+35% healing), capped at pre-battle max.',
    effects: [{ kind: 'HEAL', multiplier: 1.35 }],
  },
  mana_surge: {
    description: 'Gain +2 Mana this turn. Draw 1 card. Exhaust.',
    effects: [
      { kind: 'GAIN_MANA', amount: 2 },
      { kind: 'DRAW', amount: 1 },
    ],
  },
  chain_lightning: { description: 'Full damage to primary, 50% to up to 2 more enemies.', manaCost: 2 },
  arcane_overload: {
    description: 'Gain +3 Mana and draw 2 cards. Unique.',
    effects: [
      { kind: 'GAIN_MANA', amount: 3 },
      { kind: 'DRAW', amount: 2 },
    ],
  },

  // Neutral
  focus_fire: {
    description: 'Next friendly attack +65% damage.',
    effects: [{ kind: 'ARMY_NEXT_ATTACK_BONUS', percent: 65 }],
  },
  reposition: {
    description: 'Move a friendly stack; its next attack +20% damage.',
    effects: [
      { kind: 'MOVE_STACK' },
      { kind: 'SET_FLAGS', target: 'self', flags: { nextAttackDamageBonusPercent: 20 } },
    ],
  },
  tactical_insight: {
    description: 'Draw 3 cards.',
    effects: [{ kind: 'DRAW', amount: 3 }],
  },
  emergency_retreat: { description: 'Selected stack cannot be targeted or attack this turn.', manaCost: 1 },
  second_wind: {
    description: 'Restore 14% of lost soldiers. Exhaust.',
    effects: [{ kind: 'RESTORE_SOLDIERS_PERCENT', percent: 14 }],
  },
  battle_hardened: {
    description: '+26% Damage, +26% Defense to all friendly stacks. 1 turn.',
    effects: [{ kind: 'DAMAGE_AND_DEFENSE_BUFF', damageAmount: 26, defenseAmount: 26, duration: 1, scope: 'army' }],
  },
};

/** A card can be upgraded once, and only if it has a "+" version. */
export function isUpgradable(card: CardInstance): boolean {
  return !card.upgraded && CARD_UPGRADES[card.cardId] !== undefined;
}

/**
 * The card as it plays: the base definition, or its "+" version (name "Charge +", upgraded cost and
 * effects) when `upgraded`. Everything else (source, tags, targeting, exhaust) is the base card's.
 */
export function resolveCard(cardId: string, upgraded = false): CardDefinition | undefined {
  const base = CARD_DEFINITIONS[cardId];
  const upgrade = CARD_UPGRADES[cardId];
  if (!base || !upgraded || !upgrade) return base;
  return { ...base, name: `${base.name} +`, manaCost: upgrade.manaCost ?? base.manaCost, effects: upgrade.effects ?? base.effects };
}
