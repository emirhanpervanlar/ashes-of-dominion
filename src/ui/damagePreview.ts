import {
  UNIT_DEFINITIONS,
  computeRawDamage,
  damageStatFor,
  moraleDamageMultiplier,
  moraleDefenseMultiplier,
  relicDamageMultiplier,
  relicFlatAttackBonus,
  statEffectiveness,
  veterancyDamageMultiplier,
} from '../engine/index.js';
import type { ArmyStack, CardEffect, CombatState } from '../engine/index.js';

/**
 * Client-side estimate for the hand-hover damage preview — mirrors
 * combat.ts's resolveAttack for the player-attacks-enemy case (no dodge
 * roll, redirect, passives or DoT, since those aren't previewable without
 * mutating state). Not authoritative; the engine remains the source of
 * truth when the card actually resolves.
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
  const targetMoraleDefMult = moraleDefenseMultiplier(target.morale);
  const veterancyMult = veterancyDamageMultiplier(attacker.veterancy);
  const heroEffectiveness = statEffectiveness(state.hero.stats[damageStatFor(attackerDef.tags)]);

  let execMult = 1;
  if (effect.conditionalBonus && target.maxHp > 0 && (target.currentHp / target.maxHp) * 100 < effect.conditionalBonus.targetHpBelowPercent) {
    execMult = effect.conditionalBonus.multiplier;
  }

  const totalMult = effect.multiplier * relicMult * moraleMult * veterancyMult * execMult;
  return computeRawDamage({
    attackerStack: attacker,
    attackerBaseAttack: attackerDef.attack + relicFlat,
    targetDefense: targetDef.defense / targetMoraleDefMult,
    multiplier: totalMult,
    heroEffectiveness,
  });
}
