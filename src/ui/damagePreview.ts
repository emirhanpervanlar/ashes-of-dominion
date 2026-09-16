import {
  UNIT_DEFINITIONS,
  computeRawDamage,
  moraleDamageMultiplier,
  relicDamageMultiplier,
  relicFlatAttackBonus,
  veterancyFlatBonus,
  vulnerableDamageMultiplier,
} from '../engine/index.js';
import type { ArmyStack, CardEffect, CombatState } from '../engine/index.js';

/**
 * Client-side estimate for the hand-hover damage preview — mirrors
 * combat.ts's resolveAttack for the player-attacks-enemy case (no boss
 * scaling or damage-taken relics, since those never apply to an enemy
 * target). Not authoritative; the engine remains the source of truth
 * when the card actually resolves.
 */
export function previewAttackDamage(
  state: CombatState,
  attacker: ArmyStack,
  target: ArmyStack,
  effect: Extract<CardEffect, { kind: 'ATTACK' }>
): number {
  const attackerDef = UNIT_DEFINITIONS[attacker.unitId];
  const targetDef = UNIT_DEFINITIONS[target.unitId];
  const relics = state.activeRelicEffects;

  const relicMult = relicDamageMultiplier(relics, attacker.count, attackerDef.tags);
  const relicFlat = relicFlatAttackBonus(relics, attacker.count);
  const moraleMult = moraleDamageMultiplier(attacker.morale);
  const veterancyFlat = veterancyFlatBonus(attacker.veterancy);
  const vulnerableMult = vulnerableDamageMultiplier(target);

  let execMult = 1;
  if (effect.conditionalBonus && target.maxHp > 0 && (target.currentHp / target.maxHp) * 100 < effect.conditionalBonus.targetHpBelowPercent) {
    execMult = effect.conditionalBonus.multiplier;
  }

  const totalMult = effect.multiplier * relicMult * moraleMult * vulnerableMult * execMult;
  return computeRawDamage(attacker, attackerDef.attack + relicFlat + veterancyFlat, targetDef.defense, totalMult);
}
