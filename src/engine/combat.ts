import { CARD_DEFINITIONS } from './data/cards.js';
import { UNIT_DEFINITIONS } from './data/units.js';
import { damageStatFor, statEffectiveness } from './heroStats.js';
import {
  applyDamageToStack,
  applyHealToStack,
  armorReduction,
  computeHealAmount,
  computeRawDamage,
  effectiveCount,
  fearDamageMultiplier,
  moraleDamageMultiplier,
  moraleDefenseMultiplier,
  necromancyRatio,
  passiveDamageBonusMultiplier,
  passiveDefenseBonus,
  relicDamageMultiplier,
  relicDamageTakenMultiplier,
  relicDodgeBonusPercent,
  relicFlatAttackBonus,
  relicHealingMultiplier,
  rollDodge,
  statusAmount,
  veterancyDamageMultiplier,
} from './damage.js';
import { computeValidHealTargets, computeValidTargets, laneOf } from './targeting.js';
import { generateEnemyIntents } from './intents.js';
import { shuffle } from './rng.js';
import type {
  ApplyResult,
  ArmyStack,
  CardEffect,
  CardInstance,
  CardTargeting,
  CombatEvent,
  CombatState,
  Hero,
  PlayerAction,
  Position,
  RelicEffect,
  StatusType,
  UnitDefinition,
} from './types.js';

type TargetedAction = { actingStackId?: string; targetStackId?: string; secondTargetStackId?: string; toPosition?: Position };

const HAND_SIZE_FIRST_TURN = 5;
const HAND_SIZE_PER_TURN = 3;
const MAX_HAND = 10;

function cloneState(state: CombatState): CombatState {
  return JSON.parse(JSON.stringify(state)) as CombatState;
}

function findStack(army: ArmyStack[], stackId: string | undefined): ArmyStack | undefined {
  return army.find((s) => s.stackId === stackId && s.count > 0);
}

function replaceStack(army: ArmyStack[], updated: ArmyStack): void {
  const idx = army.findIndex((s) => s.stackId === updated.stackId);
  if (idx >= 0) army[idx] = updated;
}

function reject(events: CombatEvent[], reason: string): void {
  events.push({ type: 'ACTION_REJECTED', reason });
}

export function checkBattleResult(state: CombatState): 'ongoing' | 'victory' | 'defeat' {
  const playerAlive = state.playerArmy.some((s) => s.count > 0);
  const enemyAlive = state.enemyArmy.some((s) => s.count > 0);
  if (state.hero.hp <= 0 || !playerAlive) return 'defeat';
  if (!enemyAlive) return 'victory';
  return 'ongoing';
}

function drawCards(state: CombatState, amount: number, events: CombatEvent[]): void {
  for (let i = 0; i < amount; i++) {
    if (state.hand.length >= MAX_HAND) return;
    if (state.deck.length === 0) {
      if (state.discard.length === 0) return;
      state.deck = shuffle(state.rng, state.discard);
      state.discard = [];
      events.push({ type: 'DECK_RESHUFFLED' });
    }
    const card = state.deck.shift();
    if (!card) return;
    state.hand.push(card);
    events.push({ type: 'CARD_DRAWN', instanceId: card.instanceId, cardId: card.cardId });
  }
}

function findFreePlayerPosition(army: ArmyStack[]): Position | null {
  const taken = new Set(army.filter((s) => s.count > 0).map((s) => s.position));
  for (let p = 1 as Position; p <= 6; p++) {
    if (!taken.has(p)) return p;
  }
  return null;
}

function raiseSkeletons(_army: ArmyStack[], _count: number, _events: CombatEvent[]): void {
  // Necromancy relics are not part of the v3 MVP roster (no Skeleton unit) — kept as a
  // documented no-op so old NECROMANCY relic effects don't crash if one is still active.
}

/**
 * Card text expresses defense buffs as "+N% Defense". Base Defense stats are tiny (0-4), so a
 * flat +N armor status (using N directly, e.g. 20) would dwarf any attacker's Attack stat (1-7)
 * and make the target nearly unhittable. Scale N as a percentage of the unit's base Defense
 * instead (with a floor of 2 so 0-Defense units still get a small, non-zero bonus).
 */
function defenseBuffAmount(unitId: ArmyStack['unitId'], percent: number): number {
  if (percent === 0) return 0;
  const baseDefense = Math.max(2, UNIT_DEFINITIONS[unitId].defense);
  const raw = Math.round((baseDefense * percent) / 100);
  return percent > 0 ? Math.max(1, raw) : Math.min(-1, raw);
}

/** v3 §8 Knight "Guard" passive / the Protect card's explicit redirect — first checks an explicit flag, then the passive. */
function resolveRedirect(target: ArmyStack, army: ArmyStack[]): { toStackId: string; percent: number } | null {
  if (target.flags.redirectToStackId && target.flags.redirectPercent) {
    const guardian = army.find((s) => s.stackId === target.flags.redirectToStackId && s.count > 0);
    if (guardian) return { toStackId: guardian.stackId, percent: target.flags.redirectPercent };
  }
  const adjacentKnight = army.find(
    (s) => s.count > 0 && s.unitId === 'knight' && s.stackId !== target.stackId && s.position <= 3 && Math.abs(s.position - target.position) === 1
  );
  if (adjacentKnight && target.position <= 3) return { toStackId: adjacentKnight.stackId, percent: 25 };
  return null;
}

function resolveAttack(
  state: CombatState,
  attacker: ArmyStack,
  target: ArmyStack,
  army: ArmyStack[],
  multiplier: number,
  events: CombatEvent[],
  relics: RelicEffect[],
  conditionalBonus?: { targetHpBelowPercent: number; multiplier: number }
): void {
  const attackerDef = UNIT_DEFINITIONS[attacker.unitId];
  let targetDef = UNIT_DEFINITIONS[target.unitId];

  // Guard/Protect redirect — the damage lands on the guardian instead, using the guardian's own defense.
  const redirect = resolveRedirect(target, army);
  let actualTarget = target;
  if (redirect && !attacker.flags.nextAttackCannotBeRedirected) {
    const guardian = findStack(army, redirect.toStackId);
    if (guardian) actualTarget = guardian;
  }
  targetDef = UNIT_DEFINITIONS[actualTarget.unitId];

  // Dodge (Hero Dexterity + relics, player side only).
  const dodgeMult = actualTarget.flags.dodgeMultiplier ?? 1;
  const dodged = rollDodge(state.rng, state.hero, actualTarget.side, dodgeMult, relicDodgeBonusPercent(relics));
  if (dodged) {
    events.push({ type: 'STACK_ATTACKED', attackerStackId: attacker.stackId, targetStackId: actualTarget.stackId, rawDamage: 0, finalDamage: 0, blocked: 0 });
    return;
  }

  const relicMult = attacker.side === 'player' ? relicDamageMultiplier(relics, attacker.count, attackerDef.tags) : 1;
  const relicFlat = attacker.side === 'player' ? relicFlatAttackBonus(relics, attacker.count) : 0;
  const damageTakenMult = actualTarget.side === 'player' ? relicDamageTakenMultiplier(relics) : 1;
  const moraleMult = moraleDamageMultiplier(attacker.morale);
  const targetMoraleDefMult = moraleDefenseMultiplier(actualTarget.morale);
  const veterancyMult = veterancyDamageMultiplier(attacker.veterancy);
  const fearMult = fearDamageMultiplier(attacker);
  const passiveMult = passiveDamageBonusMultiplier(attacker, attackerDef, actualTarget.side, army, actualTarget);
  const heroEffectiveness = attacker.side === 'player' ? statEffectiveness(state.hero.stats[damageStatFor(attackerDef.tags)]) : 1;

  const nextAttackBonus = attacker.flags.nextAttackDamageBonusPercent ? 1 + attacker.flags.nextAttackDamageBonusPercent / 100 : 1;
  const ignoresArmor = !!attacker.flags.nextAttackIgnoresArmor;

  let execMult = 1;
  if (conditionalBonus && actualTarget.maxHp > 0 && (actualTarget.currentHp / actualTarget.maxHp) * 100 < conditionalBonus.targetHpBelowPercent) {
    execMult = conditionalBonus.multiplier;
  }

  const incomingReduction = actualTarget.flags.incomingDamageReductionPercent ? 1 - actualTarget.flags.incomingDamageReductionPercent / 100 : 1;
  const passiveDefBonus = passiveDefenseBonus(actualTarget, targetDef, army);
  const armor = ignoresArmor ? 0 : armorReduction(actualTarget);
  const effectiveTargetDefense = (targetDef.defense + passiveDefBonus + armor) / targetMoraleDefMult;

  const totalMultiplier = multiplier * relicMult * moraleMult * fearMult * passiveMult * damageTakenMult * execMult * nextAttackBonus * veterancyMult * incomingReduction;
  const raw = computeRawDamage({
    attackerStack: attacker,
    attackerBaseAttack: attackerDef.attack + relicFlat,
    targetDefense: effectiveTargetDefense,
    multiplier: totalMultiplier,
    heroEffectiveness,
  });
  let resolution = applyDamageToStack(actualTarget, targetDef.hpPerUnit, raw);

  // Divine Protection — a lethal blow instead leaves the stack at 1 soldier, once.
  if (resolution.stack.count === 0 && actualTarget.flags.divineShield) {
    const survivorHp = targetDef.hpPerUnit;
    resolution = { ...resolution, stack: { ...actualTarget, count: 1, currentHp: survivorHp, flags: { ...actualTarget.flags, divineShield: false } }, unitsKilled: actualTarget.count - 1 };
    events.push({ type: 'DIVINE_SHIELD_CONSUMED', stackId: actualTarget.stackId });
  }

  replaceStack(army, resolution.stack);

  events.push({
    type: 'STACK_ATTACKED',
    attackerStackId: attacker.stackId,
    targetStackId: actualTarget.stackId,
    rawDamage: raw,
    finalDamage: resolution.finalDamage,
    blocked: resolution.blocked,
  });
  if (resolution.unitsKilled > 0) {
    events.push({ type: 'UNITS_KILLED', stackId: actualTarget.stackId, count: resolution.unitsKilled });
    if (actualTarget.side === 'player') {
      const ratio = necromancyRatio(relics);
      const raised = Math.floor(resolution.unitsKilled * ratio);
      if (raised > 0) raiseSkeletons(army, raised, events);
    }
  }
  if (resolution.stack.count === 0) {
    events.push({ type: 'STACK_DESTROYED', stackId: actualTarget.stackId });
  }

  // "next attack applies status" (Poison Arrow-style buffs) resolve after a successful hit.
  if (attacker.flags.nextAttackAppliesStatus && resolution.stack.count > 0) {
    const { status, amount, duration } = attacker.flags.nextAttackAppliesStatus;
    const withStatus = { ...resolution.stack, statuses: [...resolution.stack.statuses, { type: status, amount, duration }] };
    replaceStack(army, withStatus);
    events.push({ type: 'STATUS_APPLIED', stackId: withStatus.stackId, status, amount, duration });
  }

  // Blood Rage-style self cost, paid once the buffed attack lands.
  if (attacker.flags.selfCasualtyPercentAfterAttack) {
    const attackerArmy = attacker.side === 'player' ? state.playerArmy : state.enemyArmy;
    const current = findStack(attackerArmy, attacker.stackId);
    if (current && current.count > 1) {
      const loss = Math.min(current.count - 1, Math.max(1, Math.ceil((current.count * attacker.flags.selfCasualtyPercentAfterAttack) / 100)));
      const newCount = current.count - loss;
      const hpPerUnit = UNIT_DEFINITIONS[current.unitId].hpPerUnit;
      const updated: ArmyStack = { ...current, count: newCount, currentHp: Math.min(current.currentHp, newCount * hpPerUnit) };
      replaceStack(attackerArmy, updated);
      events.push({ type: 'UNITS_KILLED', stackId: updated.stackId, count: loss });
    }
  }

  // Counterattack — the defender (if it still lives and hasn't used its window) strikes back.
  if (resolution.stack.count > 0 && resolution.stack.flags.counterattackPercent && (resolution.stack.flags.counterattackUsesLeft ?? 0) > 0) {
    const counterArmy = actualTarget.side === 'player' ? state.playerArmy : state.enemyArmy;
    const counterStack = findStack(counterArmy, resolution.stack.stackId);
    if (counterStack) {
      const withUsed: ArmyStack = {
        ...counterStack,
        flags: { ...counterStack.flags, counterattackUsesLeft: (counterStack.flags.counterattackUsesLeft ?? 1) - 1 },
      };
      replaceStack(counterArmy, withUsed);
      const attackerArmy = attacker.side === 'player' ? state.playerArmy : state.enemyArmy;
      const stillAttacker = findStack(attackerArmy, attacker.stackId);
      if (stillAttacker) {
        events.push({ type: 'COUNTERATTACK_TRIGGERED', stackId: withUsed.stackId, targetStackId: attacker.stackId });
        resolveAttack(state, withUsed, stillAttacker, attackerArmy, (counterStack.flags.counterattackPercent ?? 0) / 100, events, relics);
      }
    }
  }

  // Clear one-shot "next attack" flags on the attacker after it has acted.
  const attackerArmy = attacker.side === 'player' ? state.playerArmy : state.enemyArmy;
  const stillLive = findStack(attackerArmy, attacker.stackId);
  if (stillLive) {
    const {
      nextAttackDamageBonusPercent,
      nextAttackAccuracyBonusPercent,
      nextAttackIgnoresArmor,
      nextAttackCannotBeRedirected,
      nextAttackAppliesStatus,
      ...restFlags
    } = stillLive.flags;
    void nextAttackDamageBonusPercent;
    void nextAttackAccuracyBonusPercent;
    void nextAttackIgnoresArmor;
    void nextAttackCannotBeRedirected;
    void nextAttackAppliesStatus;
    replaceStack(attackerArmy, { ...stillLive, flags: restFlags });
  }
}

function resolveHeal(state: CombatState, healer: ArmyStack, target: ArmyStack, army: ArmyStack[], multiplier: number, events: CombatEvent[]): void {
  const healerDef = UNIT_DEFINITIONS[healer.unitId];
  const healPower = healerDef.healPower ?? 3;
  const wisdomEff = healer.side === 'player' ? statEffectiveness(state.hero.stats.wisdom) : 1;
  const healingMult = healer.side === 'player' ? relicHealingMultiplier(state.activeRelicEffects) : 1;
  const passiveMult = healerDef.passiveId === 'devotion' ? 1.1 : 1;
  const amount = Math.round(computeHealAmount(healer, healPower, wisdomEff, healingMult * passiveMult) * multiplier);
  const targetDef = UNIT_DEFINITIONS[target.unitId];
  const resolution = applyHealToStack(target, amount, targetDef.hpPerUnit);
  replaceStack(army, resolution.stack);
  events.push({ type: 'STACK_HEALED', stackId: target.stackId, amount: resolution.healedAmount });
}

function adjacentAllies(army: ArmyStack[], stack: ArmyStack): ArmyStack[] {
  return army.filter((s) => s.count > 0 && s.stackId !== stack.stackId && s.position <= 3 && Math.abs(s.position - stack.position) === 1);
}

function executeEffect(state: CombatState, effect: CardEffect, action: TargetedAction, events: CombatEvent[]): void {
  const actor = findStack(state.playerArmy, action.actingStackId);
  switch (effect.kind) {
    case 'ATTACK': {
      const attacker = actor!;
      const target = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(state, attacker, target, state.enemyArmy, effect.multiplier, events, state.activeRelicEffects, effect.conditionalBonus);
      return;
    }
    case 'ATTACK_ALL_WITH_TAG': {
      const attackers = state.playerArmy.filter((s) => s.count > 0 && UNIT_DEFINITIONS[s.unitId].tags.includes(effect.tag));
      for (const attacker of attackers) {
        const target = findStack(state.enemyArmy, action.targetStackId);
        if (!target) break;
        resolveAttack(state, attacker, target, state.enemyArmy, effect.multiplier, events, state.activeRelicEffects);
      }
      return;
    }
    case 'ATTACK_SPLASH': {
      const attacker = actor!;
      const primary = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(state, attacker, primary, state.enemyArmy, effect.primaryMultiplier, events, state.activeRelicEffects);
      const others = state.enemyArmy.filter((s) => s.count > 0 && s.stackId !== primary.stackId).slice(0, effect.maxSecondaryTargets);
      for (const other of others) {
        resolveAttack(state, attacker, other, state.enemyArmy, effect.secondaryMultiplier, events, state.activeRelicEffects);
      }
      return;
    }
    case 'ATTACK_PRIMARY_AND_BEHIND': {
      const attacker = actor!;
      const primary = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(state, attacker, primary, state.enemyArmy, effect.primaryMultiplier, events, state.activeRelicEffects);
      const lane = laneOf(primary.position);
      const behindPos = primary.position <= 3 ? (({ left: 4, center: 5, right: 6 } as const)[lane]) : (({ left: 1, center: 2, right: 3 } as const)[lane]);
      const behind = state.enemyArmy.find((s) => s.count > 0 && s.position === behindPos);
      if (behind) resolveAttack(state, attacker, behind, state.enemyArmy, effect.behindMultiplier, events, state.activeRelicEffects);
      return;
    }
    case 'ATTACK_TWICE': {
      const attacker = actor!;
      const target0 = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(state, attacker, target0, state.enemyArmy, effect.firstMultiplier, events, state.activeRelicEffects);
      const target1 = findStack(state.enemyArmy, action.targetStackId);
      if (target1) resolveAttack(state, attacker, target1, state.enemyArmy, effect.secondMultiplier, events, state.activeRelicEffects);
      return;
    }
    case 'DAMAGE_UP_TO_N_ENEMIES': {
      const attacker = actor!;
      const targets = state.enemyArmy.filter((s) => s.count > 0).slice(0, effect.maxTargets);
      for (const target of targets) {
        const live = findStack(state.enemyArmy, target.stackId);
        if (live) resolveAttack(state, attacker, live, state.enemyArmy, effect.multiplier, events, state.activeRelicEffects);
      }
      return;
    }
    case 'DAMAGE_ALL_ENEMIES': {
      const attacker = actor!;
      const targets = state.enemyArmy.filter((s) => s.count > 0);
      targets.forEach((target, i) => {
        const live = findStack(state.enemyArmy, target.stackId);
        if (live) resolveAttack(state, attacker, live, state.enemyArmy, i === 0 ? effect.multiplier + effect.primaryBonusMultiplier : effect.multiplier, events, state.activeRelicEffects);
      });
      return;
    }
    case 'CHAIN_DAMAGE': {
      const attacker = actor!;
      const primary = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(state, attacker, primary, state.enemyArmy, effect.primaryMultiplier, events, state.activeRelicEffects);
      const others = state.enemyArmy.filter((s) => s.count > 0 && s.stackId !== primary.stackId).slice(0, effect.maxSecondaryTargets);
      for (const other of others) {
        resolveAttack(state, attacker, other, state.enemyArmy, effect.secondaryMultiplier, events, state.activeRelicEffects);
      }
      return;
    }
    case 'HEAL': {
      const healer = actor!;
      const target = findStack(state.playerArmy, action.secondTargetStackId ?? action.targetStackId)!;
      resolveHeal(state, healer, target, state.playerArmy, effect.multiplier, events);
      return;
    }
    case 'RESTORE_SOLDIERS_PERCENT': {
      const stack = findStack(state.playerArmy, action.actingStackId)!;
      const def = UNIT_DEFINITIONS[stack.unitId];
      const amount = Math.round(stack.preBattleMaxCount * (effect.percent / 100)) * def.hpPerUnit;
      const resolution = applyHealToStack(stack, amount, def.hpPerUnit);
      replaceStack(state.playerArmy, resolution.stack);
      events.push({ type: 'STACK_HEALED', stackId: stack.stackId, amount: resolution.healedAmount });
      return;
    }
    case 'MODIFY_STAT': {
      const source = findStack(state.playerArmy, action.actingStackId ?? action.targetStackId)!;
      const affected = effect.scope === 'self' ? [source] : adjacentAllies(state.playerArmy, source);
      for (const stack of affected) {
        const statusType: StatusType = effect.stat === 'defense' ? 'armor' : 'strength';
        const amount =
          effect.stat === 'defense'
            ? defenseBuffAmount(stack.unitId, effect.amount)
            : Math.round((UNIT_DEFINITIONS[stack.unitId].attack * effect.amount) / 100);
        const updated = { ...stack, statuses: [...stack.statuses, { type: statusType, amount, duration: effect.duration }] };
        replaceStack(state.playerArmy, updated);
        events.push({ type: 'STATUS_APPLIED', stackId: stack.stackId, status: statusType, amount, duration: effect.duration });
      }
      return;
    }
    case 'DEFENSE_BUFF_ALL_FRONTLINE': {
      for (const stack of state.playerArmy) {
        if (stack.count > 0 && stack.position <= 3) {
          const amount = defenseBuffAmount(stack.unitId, effect.amount);
          const updated = { ...stack, statuses: [...stack.statuses, { type: 'armor' as const, amount, duration: effect.duration }] };
          replaceStack(state.playerArmy, updated);
          events.push({ type: 'STATUS_APPLIED', stackId: stack.stackId, status: 'armor', amount, duration: effect.duration });
        }
      }
      return;
    }
    case 'DEFENSE_BUFF_ADJACENT_THREE': {
      const source = findStack(state.playerArmy, action.actingStackId)!;
      const affected = [source, ...adjacentAllies(state.playerArmy, source)].slice(0, 3);
      for (const stack of affected) {
        const amount = defenseBuffAmount(stack.unitId, effect.amount);
        const updated = { ...stack, statuses: [...stack.statuses, { type: 'armor' as const, amount, duration: effect.duration }] };
        replaceStack(state.playerArmy, updated);
        events.push({ type: 'STATUS_APPLIED', stackId: stack.stackId, status: 'armor', amount, duration: effect.duration });
      }
      return;
    }
    case 'DAMAGE_BUFF_ALL_WITH_TAG': {
      for (const stack of state.playerArmy) {
        if (stack.count > 0 && UNIT_DEFINITIONS[stack.unitId].tags.includes(effect.tag)) {
          const amount = Math.round((UNIT_DEFINITIONS[stack.unitId].attack * effect.amount) / 100);
          const updated = { ...stack, statuses: [...stack.statuses, { type: 'strength' as const, amount, duration: effect.duration }] };
          replaceStack(state.playerArmy, updated);
          events.push({ type: 'STATUS_APPLIED', stackId: stack.stackId, status: 'strength', amount, duration: effect.duration });
        }
      }
      return;
    }
    case 'DAMAGE_AND_DEFENSE_BUFF': {
      const target = findStack(state.playerArmy, action.targetStackId ?? action.actingStackId)!;
      const dmgAmount = Math.round((UNIT_DEFINITIONS[target.unitId].attack * effect.damageAmount) / 100);
      const defAmount = defenseBuffAmount(target.unitId, effect.defenseAmount);
      const updated = {
        ...target,
        statuses: [
          ...target.statuses,
          { type: 'strength' as const, amount: dmgAmount, duration: effect.duration },
          { type: 'armor' as const, amount: defAmount, duration: effect.duration },
        ],
      };
      replaceStack(state.playerArmy, updated);
      events.push({ type: 'STATUS_APPLIED', stackId: target.stackId, status: 'strength', amount: dmgAmount, duration: effect.duration });
      events.push({ type: 'STATUS_APPLIED', stackId: target.stackId, status: 'armor', amount: defAmount, duration: effect.duration });
      return;
    }
    case 'APPLY_STATUS': {
      const target = findStack(state.enemyArmy, action.targetStackId) ?? findStack(state.playerArmy, action.targetStackId ?? action.actingStackId)!;
      const targetArmy = target.side === 'player' ? state.playerArmy : state.enemyArmy;
      const updated = { ...target, statuses: [...target.statuses, { type: effect.status, amount: effect.amount, duration: effect.duration }] };
      replaceStack(targetArmy, updated);
      events.push({ type: 'STATUS_APPLIED', stackId: target.stackId, status: effect.status, amount: effect.amount, duration: effect.duration });
      return;
    }
    case 'REMOVE_STATUSES': {
      const target = findStack(state.playerArmy, action.actingStackId ?? action.targetStackId)!;
      const updated = { ...target, statuses: target.statuses.filter((s) => !effect.statuses.includes(s.type)) };
      replaceStack(state.playerArmy, updated);
      events.push({ type: 'STATUSES_REMOVED', stackId: target.stackId, statuses: effect.statuses });
      return;
    }
    case 'GAIN_BLOCK': {
      const stack = findStack(state.playerArmy, action.actingStackId)!;
      stack.block += effect.amount;
      replaceStack(state.playerArmy, stack);
      events.push({ type: 'BLOCK_GAINED', stackId: stack.stackId, amount: effect.amount });
      return;
    }
    case 'GAIN_BLOCK_ALL_FRONT': {
      for (const stack of state.playerArmy) {
        if (stack.count > 0 && stack.position <= 3) {
          stack.block += effect.amount;
          events.push({ type: 'BLOCK_GAINED', stackId: stack.stackId, amount: effect.amount });
        }
      }
      return;
    }
    case 'MOVE_STACK': {
      const stack = findStack(state.playerArmy, action.actingStackId)!;
      const from = stack.position;
      const to = action.toPosition as Position;
      stack.position = to;
      events.push({ type: 'STACK_MOVED', stackId: stack.stackId, fromPosition: from, toPosition: to });
      return;
    }
    case 'GAIN_MORALE': {
      const stack = findStack(state.playerArmy, action.actingStackId)!;
      stack.morale = Math.min(100, stack.morale + effect.amount);
      events.push({ type: 'MORALE_CHANGED', stackId: stack.stackId, amount: effect.amount });
      return;
    }
    case 'GAIN_MORALE_ALL': {
      for (const stack of state.playerArmy) {
        if (stack.count > 0) {
          stack.morale = Math.min(100, stack.morale + effect.amount);
          events.push({ type: 'MORALE_CHANGED', stackId: stack.stackId, amount: effect.amount });
        }
      }
      return;
    }
    case 'GAIN_MANA': {
      state.hero.mana = Math.min(state.hero.maxMana, state.hero.mana + effect.amount);
      events.push({ type: 'MANA_GAINED', amount: effect.amount });
      return;
    }
    case 'DRAW': {
      drawCards(state, effect.amount, events);
      return;
    }
    case 'GAIN_TAUNT': {
      const stack = findStack(state.playerArmy, action.actingStackId)!;
      stack.statuses.push({ type: 'taunt', amount: 1, duration: effect.duration });
      events.push({ type: 'STATUS_APPLIED', stackId: stack.stackId, status: 'taunt', amount: 1, duration: effect.duration });
      return;
    }
    case 'SET_FLAGS': {
      const primary = findStack(state.playerArmy, action.actingStackId);
      const secondary = findStack(state.playerArmy, action.secondTargetStackId ?? action.targetStackId) ?? findStack(state.enemyArmy, action.targetStackId);
      const stack = effect.target === 'self' ? primary : secondary ?? primary;
      if (!stack) return;
      const army = stack.side === 'player' ? state.playerArmy : state.enemyArmy;
      const resolvedFlags = { ...effect.flags };
      if (resolvedFlags.redirectToStackId === '$ACTING' && primary) resolvedFlags.redirectToStackId = primary.stackId;
      const updated = { ...stack, flags: { ...stack.flags, ...resolvedFlags } };
      replaceStack(army, updated);
      return;
    }
    case 'SET_FLAGS_ALL_WITH_TAG': {
      for (const stack of state.playerArmy) {
        if (stack.count > 0 && UNIT_DEFINITIONS[stack.unitId].tags.includes(effect.tag)) {
          replaceStack(state.playerArmy, { ...stack, flags: { ...stack.flags, ...effect.flags } });
        }
      }
      return;
    }
  }
}

function validateTargeting(state: CombatState, def: { id: string; targeting: CardTargeting }, action: TargetedAction): string | null {
  const needsAlly =
    def.targeting === 'ally-stack' ||
    def.targeting === 'ally-stack+enemy-stack' ||
    def.targeting === 'ally-stack+position' ||
    def.targeting === 'ally-stack+ally-stack';
  const needsEnemy = def.targeting === 'enemy-stack' || def.targeting === 'ally-stack+enemy-stack';
  const needsSecondAlly = def.targeting === 'ally-stack+ally-stack';
  const needsPosition = def.targeting === 'ally-stack+position';

  if (needsAlly) {
    const stack = findStack(state.playerArmy, action.actingStackId);
    if (!stack) return 'Invalid or dead friendly stack.';
  }
  if (needsEnemy) {
    const stack = findStack(state.enemyArmy, action.targetStackId);
    if (!stack) return 'Invalid or dead enemy stack.';
    if (def.targeting === 'ally-stack+enemy-stack') {
      const actor = findStack(state.playerArmy, action.actingStackId)!;
      const validTargets = computeValidTargets(actor, state.enemyArmy, UNIT_DEFINITIONS[actor.unitId]);
      if (!validTargets.some((t) => t.stackId === stack.stackId)) {
        return `${UNIT_DEFINITIONS[actor.unitId].name} cannot reach that target from its position.`;
      }
    }
  }
  if (needsSecondAlly) {
    const stack = findStack(state.playerArmy, action.secondTargetStackId ?? action.targetStackId);
    if (!stack) return 'Invalid or dead friendly stack.';
  }
  if (needsPosition) {
    const mover = findStack(state.playerArmy, action.actingStackId);
    if (mover?.flags.cannotMove) return `${UNIT_DEFINITIONS[mover.unitId].name} cannot move this turn.`;
    if (!action.toPosition || action.toPosition < 1 || action.toPosition > 6) {
      return 'Invalid destination position.';
    }
    const occupied = state.playerArmy.some((s) => s.count > 0 && s.position === action.toPosition);
    if (occupied) return 'Destination position is occupied.';
  }
  return null;
}

/** v3 §10 "Unit card active if source unit count >0" — Hero/Neutral cards are always active. */
function isCardActive(state: CombatState, cardId: string): boolean {
  const def = CARD_DEFINITIONS[cardId];
  if (!def) return false;
  if (def.source.type !== 'unit') return true;
  const sourceUnitId = def.source.unitId;
  return state.playerArmy.some((s) => s.count > 0 && s.unitId === sourceUnitId);
}

function playCard(state: CombatState, action: Extract<PlayerAction, { type: 'PLAY_CARD' }>, events: CombatEvent[]): ApplyResult {
  const cardIndex = state.hand.findIndex((c) => c.instanceId === action.instanceId);
  if (cardIndex === -1) {
    reject(events, 'Card is not in hand.');
    return { state, events };
  }
  const instance = state.hand[cardIndex]!;
  const cardDef = CARD_DEFINITIONS[instance.cardId];
  if (!cardDef) {
    reject(events, 'Unknown card definition.');
    return { state, events };
  }
  if (!isCardActive(state, instance.cardId)) {
    reject(events, `${cardDef.name} is inactive — you have no living ${cardDef.source.type === 'unit' ? cardDef.source.unitId : ''} stack.`);
    return { state, events };
  }
  if (state.hero.mana < cardDef.manaCost) {
    reject(events, 'Not enough Mana.');
    return { state, events };
  }

  const targetingError = validateTargeting(state, cardDef, action);
  if (targetingError) {
    reject(events, targetingError);
    return { state, events };
  }

  state.hero.mana -= cardDef.manaCost;
  state.hand.splice(cardIndex, 1);
  events.push({ type: 'CARD_PLAYED', instanceId: instance.instanceId, cardId: instance.cardId });

  if (cardDef.exhaust) {
    state.exhausted.push(instance);
    events.push({ type: 'CARD_EXHAUSTED', instanceId: instance.instanceId, cardId: instance.cardId });
  } else {
    state.discard.push(instance);
    events.push({ type: 'CARD_DISCARDED', instanceId: instance.instanceId, cardId: instance.cardId });
  }

  for (const effect of cardDef.effects) {
    executeEffect(state, effect, action, events);
  }

  const result = checkBattleResult(state);
  if (result !== 'ongoing') {
    state.result = result;
    state.phase = 'ended';
    events.push({ type: 'BATTLE_ENDED', result });
  }

  return { state, events };
}

/** v3 §4/§7 — every stack's free, card-less basic action (attack, ranged attack, or Priest's heal). */
function basicAction(state: CombatState, action: Extract<PlayerAction, { type: 'BASIC_ACTION' }>, events: CombatEvent[]): ApplyResult {
  const actor = findStack(state.playerArmy, action.stackId);
  if (!actor) {
    reject(events, 'Invalid or dead friendly stack.');
    return { state, events };
  }
  if (actor.actedThisTurn) {
    reject(events, 'That stack has already acted this turn.');
    return { state, events };
  }
  if (actor.flags.cannotAttack || statusAmount(actor, 'freeze') > 0) {
    reject(events, 'That stack cannot act this turn.');
    return { state, events };
  }

  const def = UNIT_DEFINITIONS[actor.unitId];
  const kind = def.basicAction ?? 'attack';

  if (kind === 'heal') {
    const target = findStack(state.playerArmy, action.targetStackId);
    if (!target) {
      reject(events, 'Invalid or dead friendly stack to heal.');
      return { state, events };
    }
    resolveHeal(state, actor, target, state.playerArmy, 1, events);
  } else {
    const target = findStack(state.enemyArmy, action.targetStackId);
    if (!target) {
      reject(events, 'Invalid or dead enemy stack.');
      return { state, events };
    }
    const validTargets = computeValidTargets(actor, state.enemyArmy, def);
    if (!validTargets.some((t) => t.stackId === target.stackId)) {
      reject(events, `${def.name} cannot reach that target from its position.`);
      return { state, events };
    }
    resolveAttack(state, actor, target, state.enemyArmy, 1, events, state.activeRelicEffects);
  }

  const stillActor = findStack(state.playerArmy, actor.stackId) ?? actor;
  replaceStack(state.playerArmy, { ...stillActor, actedThisTurn: true });

  const result = checkBattleResult(state);
  if (result !== 'ongoing') {
    state.result = result;
    state.phase = 'ended';
    events.push({ type: 'BATTLE_ENDED', result });
  }

  return { state, events };
}

/** Poison/Bleed/Burn DoT + status duration tick, run at the start of the owning side's turn. */
function tickStatuses(army: ArmyStack[], events: CombatEvent[]): void {
  const dotTypes: StatusType[] = ['poison', 'bleed', 'burn'];
  for (const stack of army) {
    if (stack.count === 0) continue;
    let dot = 0;
    for (const s of stack.statuses) {
      if (dotTypes.includes(s.type)) dot += s.amount;
    }
    if (dot > 0) {
      const def = UNIT_DEFINITIONS[stack.unitId];
      const resolution = applyDamageToStack(stack, def.hpPerUnit, dot);
      Object.assign(stack, resolution.stack);
      events.push({ type: 'STACK_ATTACKED', attackerStackId: stack.stackId, targetStackId: stack.stackId, rawDamage: dot, finalDamage: resolution.finalDamage, blocked: resolution.blocked });
      if (resolution.unitsKilled > 0) events.push({ type: 'UNITS_KILLED', stackId: stack.stackId, count: resolution.unitsKilled });
      if (resolution.stack.count === 0) events.push({ type: 'STACK_DESTROYED', stackId: stack.stackId });
    }
    stack.statuses = stack.statuses.map((s) => ({ ...s, duration: s.duration - 1 })).filter((s) => s.duration > 0);
  }
}

function resolveEnemyTurn(state: CombatState, events: CombatEvent[]): void {
  for (const intent of state.enemyIntents) {
    const actor = findStack(state.enemyArmy, intent.stackId);
    // Intents are captured at the start of the player's turn — if the player kills this
    // stack (or its buff target) mid-turn, its stale intent must not still resolve.
    if (!actor || actor.count <= 0) continue;

    if (intent.kind === 'buff') {
      const target = findStack(state.enemyArmy, intent.targetStackId ?? undefined);
      if (!target || target.count <= 0 || !intent.buffStatus || intent.buffAmount === undefined) continue;
      target.statuses.push({ type: intent.buffStatus, amount: intent.buffAmount, duration: 1 });
      events.push({ type: 'STATUS_APPLIED', stackId: target.stackId, status: intent.buffStatus, amount: intent.buffAmount, duration: 1 });
      continue;
    }

    let target = findStack(state.playerArmy, intent.targetStackId ?? undefined);
    if (!target || target.count <= 0) {
      target = state.playerArmy.find((s) => s.count > 0);
    }
    if (!target) continue;

    resolveAttack(state, actor, target, state.playerArmy, 1, events, state.activeRelicEffects);
  }
  events.push({ type: 'ENEMY_TURN_RESOLVED' });
}

function startPlayerTurn(state: CombatState, events: CombatEvent[], isFirstTurn: boolean): void {
  state.turnNumber += 1;

  if (!isFirstTurn) {
    state.hero.mana = state.hero.maxMana;

    for (const stack of state.playerArmy) {
      stack.block = 0;
    }

    tickStatuses(state.playerArmy, events);
    tickStatuses(state.enemyArmy, events);
  }

  for (const stack of state.playerArmy) {
    stack.actedThisTurn = false;
  }

  state.enemyIntents = generateEnemyIntents(state);
  events.push({ type: 'INTENTS_GENERATED', intents: state.enemyIntents });

  state.phase = 'player';
  events.push({ type: 'TURN_STARTED', side: 'player', turnNumber: state.turnNumber });

  drawCards(state, isFirstTurn ? HAND_SIZE_FIRST_TURN : HAND_SIZE_PER_TURN, events);
}

function endPlayerTurn(state: CombatState, events: CombatEvent[]): ApplyResult {
  const kept: CardInstance[] = [];
  for (const card of state.hand) {
    const def = CARD_DEFINITIONS[card.cardId];
    if (def?.retain) {
      kept.push(card);
      continue;
    }
    state.discard.push(card);
    events.push({ type: 'CARD_DISCARDED', instanceId: card.instanceId, cardId: card.cardId });
  }
  state.hand = kept;

  state.phase = 'enemy';
  events.push({ type: 'TURN_STARTED', side: 'enemy', turnNumber: state.turnNumber });

  resolveEnemyTurn(state, events);

  const result = checkBattleResult(state);
  if (result !== 'ongoing') {
    state.result = result;
    state.phase = 'ended';
    events.push({ type: 'BATTLE_ENDED', result });
    return { state, events };
  }

  startPlayerTurn(state, events, false);
  return { state, events };
}

export function applyPlayerAction(state: CombatState, action: PlayerAction): ApplyResult {
  const working = cloneState(state);
  const events: CombatEvent[] = [];

  if (working.phase !== 'player' || working.result !== 'ongoing') {
    reject(events, 'Not player turn, or battle already ended.');
    working.log = [...working.log, ...events];
    return { state: working, events };
  }

  let result: ApplyResult;
  if (action.type === 'END_TURN') {
    result = endPlayerTurn(working, events);
  } else if (action.type === 'BASIC_ACTION') {
    result = basicAction(working, action, events);
  } else {
    result = playCard(working, action, events);
  }
  result.state.log = [...result.state.log, ...result.events];
  return result;
}

export interface StartBattleParams {
  seed: number;
  rng: CombatState['rng'];
  hero: Hero;
  playerArmy: ArmyStack[];
  enemyArmy: ArmyStack[];
  deck: CardInstance[];
  activeRelicEffects?: RelicEffect[];
}

export function startBattle(params: StartBattleParams): ApplyResult {
  const events: CombatEvent[] = [{ type: 'BATTLE_STARTED' }];

  const state: CombatState = {
    seed: params.seed,
    rng: params.rng,
    turnNumber: 0,
    phase: 'enemy',
    result: 'ongoing',
    hero: params.hero,
    playerArmy: params.playerArmy,
    enemyArmy: params.enemyArmy,
    deck: shuffle(params.rng, params.deck),
    hand: [],
    discard: [],
    exhausted: [],
    enemyIntents: [],
    activeRelicEffects: params.activeRelicEffects ?? [],
    log: [],
  };

  startPlayerTurn(state, events, true);
  state.log = events;
  return { state, events };
}
