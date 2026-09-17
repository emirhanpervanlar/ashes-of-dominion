import { CARD_DEFINITIONS } from './data/cards.js';
import { HERO_SKILL_DEFINITIONS } from './data/heroSkills.js';
import { UNIT_DEFINITIONS } from './data/units.js';
import {
  applyDamageToStack,
  applyHealToStack,
  bossScalingAttackBonus,
  computeHealAmount,
  computeRawDamage,
  moraleDamageMultiplier,
  necromancyRatio,
  relicDamageMultiplier,
  relicDamageTakenMultiplier,
  relicFlatAttackBonus,
  veterancyFlatBonus,
  vulnerableDamageMultiplier,
} from './damage.js';
import { generateEnemyIntents } from './intents.js';
import { computeValidHealTargets, computeValidTargets } from './targeting.js';
import { shuffle } from './rng.js';
import type {
  ApplyResult,
  ArmyStack,
  CardCostType,
  CardEffect,
  CardInstance,
  CardTargeting,
  CombatEvent,
  CombatState,
  Hero,
  HeroSkillState,
  PlayerAction,
  Position,
  RelicEffect,
} from './types.js';

/** Shape shared by PLAY_CARD and USE_SKILL — all executeEffect/validateTargeting need. */
type TargetedAction = { actingStackId?: string; targetStackId?: string; toPosition?: Position };

const HAND_SIZE = 5;
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

function getHeroResource(hero: Hero, type: CardCostType): number {
  switch (type) {
    case 'ENERGY':
      return hero.energy;
    case 'MANA':
      return hero.mana;
  }
}

function spendHeroResource(hero: Hero, type: CardCostType, amount: number): void {
  switch (type) {
    case 'ENERGY':
      hero.energy -= amount;
      return;
    case 'MANA':
      hero.mana -= amount;
      return;
  }
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

/** Necromantic Doctrine / Grave Crown — merges into an existing player Skeleton stack or creates one in a free slot. */
function raiseSkeletons(army: ArmyStack[], count: number, events: CombatEvent[]): void {
  const hpPerUnit = UNIT_DEFINITIONS.skeleton.hpPerUnit;
  const existingIdx = army.findIndex((s) => s.unitId === 'skeleton' && s.count > 0);
  if (existingIdx >= 0) {
    const existing = army[existingIdx]!;
    army[existingIdx] = {
      ...existing,
      count: existing.count + count,
      currentHp: existing.currentHp + count * hpPerUnit,
      maxHp: existing.maxHp + count * hpPerUnit,
      startingCount: existing.startingCount + count,
    };
    events.push({ type: 'SKELETONS_RAISED', count });
    return;
  }
  const position = findFreePlayerPosition(army);
  if (position === null) return; // no room this battle — the casualties simply aren't raised (documented limitation)
  const maxHp = count * hpPerUnit;
  army.push({
    stackId: `player_skeleton_${position}`,
    unitId: 'skeleton',
    side: 'player',
    position,
    count,
    currentHp: maxHp,
    maxHp,
    startingCount: count,
    morale: 0,
    veterancy: 0,
    block: 0,
    statuses: [],
    actedThisTurn: false,
  });
  events.push({ type: 'SKELETONS_RAISED', count });
}

function resolveAttack(
  attacker: ArmyStack,
  target: ArmyStack,
  army: ArmyStack[],
  multiplier: number,
  events: CombatEvent[],
  relics: RelicEffect[],
  conditionalBonus?: { targetHpBelowPercent: number; multiplier: number }
): void {
  const attackerDef = UNIT_DEFINITIONS[attacker.unitId];
  const targetDef = UNIT_DEFINITIONS[target.unitId];

  // Relics belong to the player's Hero — only ever modify player-side attacks / player-side damage taken.
  const relicMult = attacker.side === 'player' ? relicDamageMultiplier(relics, attacker.count, attackerDef.tags) : 1;
  const relicFlat = attacker.side === 'player' ? relicFlatAttackBonus(relics, attacker.count) : 0;
  const damageTakenMult = target.side === 'player' ? relicDamageTakenMultiplier(relics) : 1;
  // `army` is the TARGET's army — for an enemy attacker that's the player's army, exactly what the Warlord mechanic needs.
  const bossFlat = attacker.side === 'enemy' ? bossScalingAttackBonus(attackerDef, army) : 0;
  // Morale/Veterancy apply to both sides — they're intrinsic stack properties, not Hero-exclusive relics.
  const moraleMult = moraleDamageMultiplier(attacker.morale);
  const veterancyFlat = veterancyFlatBonus(attacker.veterancy);
  const vulnerableMult = vulnerableDamageMultiplier(target);

  let execMult = 1;
  if (conditionalBonus && target.maxHp > 0 && (target.currentHp / target.maxHp) * 100 < conditionalBonus.targetHpBelowPercent) {
    execMult = conditionalBonus.multiplier;
  }

  const totalMultiplier = multiplier * relicMult * moraleMult * vulnerableMult * damageTakenMult * execMult;
  const raw = computeRawDamage(attacker, attackerDef.attack + relicFlat + bossFlat + veterancyFlat, targetDef.defense, totalMultiplier);
  const resolution = applyDamageToStack(target, targetDef.hpPerUnit, raw);
  replaceStack(army, resolution.stack);

  events.push({
    type: 'STACK_ATTACKED',
    attackerStackId: attacker.stackId,
    targetStackId: target.stackId,
    rawDamage: raw,
    finalDamage: resolution.finalDamage,
    blocked: resolution.blocked,
  });
  if (resolution.unitsKilled > 0) {
    events.push({ type: 'UNITS_KILLED', stackId: target.stackId, count: resolution.unitsKilled });
    if (target.side === 'player') {
      const ratio = necromancyRatio(relics);
      const raised = Math.floor(resolution.unitsKilled * ratio);
      if (raised > 0) raiseSkeletons(army, raised, events);
    }
  }
  if (resolution.stack.count === 0) {
    events.push({ type: 'STACK_DESTROYED', stackId: target.stackId });
  }
}

function executeEffect(state: CombatState, effect: CardEffect, action: TargetedAction, events: CombatEvent[]): void {
  switch (effect.kind) {
    case 'ATTACK': {
      const attacker = findStack(state.playerArmy, action.actingStackId)!;
      const target = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(attacker, target, state.enemyArmy, effect.multiplier, events, state.activeRelicEffects, effect.conditionalBonus);
      return;
    }
    case 'ATTACK_ALL_WITH_TAG': {
      const target0 = findStack(state.enemyArmy, action.targetStackId);
      if (!target0) return;
      const attackers = state.playerArmy.filter(
        (s) => s.count > 0 && UNIT_DEFINITIONS[s.unitId].tags.includes(effect.tag)
      );
      for (const attacker of attackers) {
        const target = findStack(state.enemyArmy, action.targetStackId);
        if (!target) break;
        resolveAttack(attacker, target, state.enemyArmy, effect.multiplier, events, state.activeRelicEffects);
      }
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
      stack.morale += effect.amount;
      events.push({ type: 'MORALE_CHANGED', stackId: stack.stackId, amount: effect.amount });
      return;
    }
    case 'GAIN_MORALE_ALL': {
      for (const stack of state.playerArmy) {
        if (stack.count > 0) {
          stack.morale += effect.amount;
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
    case 'GAIN_MANA_AND_DRAW': {
      state.hero.mana = Math.min(state.hero.maxMana, state.hero.mana + effect.mana);
      events.push({ type: 'MANA_GAINED', amount: effect.mana });
      drawCards(state, effect.draw, events);
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
    case 'APPLY_VULNERABLE': {
      const target = findStack(state.enemyArmy, action.targetStackId)!;
      target.statuses.push({ type: 'vulnerable', amount: effect.amount, duration: effect.duration });
      events.push({ type: 'STATUS_APPLIED', stackId: target.stackId, status: 'vulnerable', amount: effect.amount, duration: effect.duration });
      return;
    }
    case 'SACRIFICE_FOR_SKELETONS': {
      const stack = findStack(state.playerArmy, action.actingStackId)!;
      const def = UNIT_DEFINITIONS[stack.unitId];
      const sacrificeCount = Math.min(stack.count, Math.max(1, Math.floor(stack.count * (effect.sacrificePercent / 100))));
      const newCount = stack.count - sacrificeCount;
      const newMaxHp = newCount * def.hpPerUnit;
      const updated: ArmyStack = { ...stack, count: newCount, currentHp: Math.min(stack.currentHp, newMaxHp), maxHp: newMaxHp };
      replaceStack(state.playerArmy, updated);
      events.push({ type: 'UNITS_KILLED', stackId: stack.stackId, count: sacrificeCount });
      if (updated.count === 0) events.push({ type: 'STACK_DESTROYED', stackId: stack.stackId });
      const skeletonsToRaise = sacrificeCount * effect.skeletonsPerSacrificed;
      if (skeletonsToRaise > 0) raiseSkeletons(state.playerArmy, skeletonsToRaise, events);
      return;
    }
  }
}

function validateTargeting(
  state: CombatState,
  def: { id: string; targeting: CardTargeting },
  action: TargetedAction
): string | null {
  const needsAlly = def.targeting === 'ally-stack' || def.targeting === 'ally-stack+enemy-stack' || def.targeting === 'ally-stack+position';
  const needsEnemy = def.targeting === 'enemy-stack' || def.targeting === 'ally-stack+enemy-stack';
  const needsPosition = def.targeting === 'ally-stack+position';

  if (needsAlly) {
    const stack = findStack(state.playerArmy, action.actingStackId);
    if (!stack) return 'Invalid or dead friendly stack.';
    if (def.id === 'charge' && !UNIT_DEFINITIONS[stack.unitId].tags.includes('cavalry')) {
      return 'Charge requires a friendly Cavalry stack.';
    }
  }
  if (needsEnemy) {
    const stack = findStack(state.enemyArmy, action.targetStackId);
    if (!stack) return 'Invalid or dead enemy stack.';
    // v2_list.md §5 — a card tied to one acting stack (e.g. Charge, Command: Strike)
    // still respects that stack's lane geometry, same as its free basic attack.
    if (def.targeting === 'ally-stack+enemy-stack') {
      const actor = findStack(state.playerArmy, action.actingStackId)!;
      const validTargets = computeValidTargets(actor, state.enemyArmy, UNIT_DEFINITIONS[actor.unitId]);
      if (!validTargets.some((t) => t.stackId === stack.stackId)) {
        return `${UNIT_DEFINITIONS[actor.unitId].name} cannot reach that target from its position.`;
      }
    }
  }
  if (needsPosition) {
    if (!action.toPosition || action.toPosition < 1 || action.toPosition > 6) {
      return 'Invalid destination position.';
    }
    const occupied = state.playerArmy.some((s) => s.count > 0 && s.position === action.toPosition);
    if (occupied) return 'Destination position is occupied.';
  }
  return null;
}

/**
 * v2_list.md §4.2/§7 — every stack's free, card-less normal action. Melee/ranged
 * attacks reuse resolveAttack (multiplier 1); Priest's basic action heals a
 * friendly stack instead. Once per stack per player turn (ArmyStack.actedThisTurn).
 */
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

  const def = UNIT_DEFINITIONS[actor.unitId];
  const kind = def.basicAction ?? 'attack';

  if (kind === 'heal') {
    const target = findStack(state.playerArmy, action.targetStackId);
    if (!target) {
      reject(events, 'Invalid or dead friendly stack to heal.');
      return { state, events };
    }
    const amount = computeHealAmount(actor, def.healPower ?? 1);
    const resolution = applyHealToStack(target, amount);
    replaceStack(state.playerArmy, resolution.stack);
    events.push({ type: 'STACK_HEALED', stackId: target.stackId, amount: resolution.healedAmount });
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
    resolveAttack(actor, target, state.enemyArmy, 1, events, state.activeRelicEffects);
  }

  actor.actedThisTurn = true;
  replaceStack(state.playerArmy, actor);

  const result = checkBattleResult(state);
  if (result !== 'ongoing') {
    state.result = result;
    state.phase = 'ended';
    events.push({ type: 'BATTLE_ENDED', result });
  }

  return { state, events };
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

  if (getHeroResource(state.hero, cardDef.cost.type) < cardDef.cost.amount) {
    reject(events, `Not enough ${cardDef.cost.type}.`);
    return { state, events };
  }

  const targetingError = validateTargeting(state, cardDef, action);
  if (targetingError) {
    reject(events, targetingError);
    return { state, events };
  }

  spendHeroResource(state.hero, cardDef.cost.type, cardDef.cost.amount);
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

function tickStatuses(army: ArmyStack[]): void {
  for (const stack of army) {
    stack.statuses = stack.statuses.map((s) => ({ ...s, duration: s.duration - 1 })).filter((s) => s.duration > 0);
  }
}

function resolveEnemyTurn(state: CombatState, events: CombatEvent[]): void {
  for (const intent of state.enemyIntents) {
    const actor = findStack(state.enemyArmy, intent.stackId);
    if (!actor) continue;

    if (intent.kind === 'buff') {
      const target = findStack(state.enemyArmy, intent.targetStackId ?? undefined);
      if (!target || !intent.buffStatus || intent.buffAmount === undefined) continue;
      target.statuses.push({ type: intent.buffStatus, amount: intent.buffAmount, duration: 1 });
      events.push({ type: 'STATUS_APPLIED', stackId: target.stackId, status: intent.buffStatus, amount: intent.buffAmount, duration: 1 });
      continue;
    }

    let target = findStack(state.playerArmy, intent.targetStackId ?? undefined);
    if (!target) {
      target = state.playerArmy.find((s) => s.count > 0);
    }
    if (!target) continue;

    resolveAttack(actor, target, state.playerArmy, 1, events, state.activeRelicEffects);
  }
  events.push({ type: 'ENEMY_TURN_RESOLVED' });
}

function useSkill(state: CombatState, action: Extract<PlayerAction, { type: 'USE_SKILL' }>, events: CombatEvent[]): ApplyResult {
  const skillDef = HERO_SKILL_DEFINITIONS[action.skillId];
  if (!skillDef) {
    reject(events, 'Unknown skill.');
    return { state, events };
  }
  const skillState = state.heroSkills.find((s) => s.skillId === action.skillId);
  if (!skillState) {
    reject(events, 'Skill is not equipped.');
    return { state, events };
  }
  if (skillState.cooldownRemaining > 0) {
    reject(events, `${skillDef.name} is on cooldown for ${skillState.cooldownRemaining} more turn(s).`);
    return { state, events };
  }
  if (getHeroResource(state.hero, skillDef.cost.type) < skillDef.cost.amount) {
    reject(events, `Not enough ${skillDef.cost.type}.`);
    return { state, events };
  }
  const targetingError = validateTargeting(state, skillDef, action);
  if (targetingError) {
    reject(events, targetingError);
    return { state, events };
  }

  spendHeroResource(state.hero, skillDef.cost.type, skillDef.cost.amount);
  skillState.cooldownRemaining = skillDef.cooldownTurns;
  events.push({ type: 'SKILL_USED', skillId: skillDef.id });

  for (const effect of skillDef.effects) {
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

/**
 * Turn 1 starts with the Hero's configured starting resources (e.g. Mana
 * 5/8 is an intentional partial start, AGENT.md §5) — it must NOT also
 * receive the "restored each turn" bonus. Every subsequent turn restores
 * Energy to full, regenerates Mana, resets Block, and ticks statuses.
 * Every stack's free basic action (v2_list.md §7) resets every turn,
 * including the first.
 */
function startPlayerTurn(state: CombatState, events: CombatEvent[], isFirstTurn: boolean): void {
  state.turnNumber += 1;

  if (!isFirstTurn) {
    state.hero.energy = state.hero.maxEnergy;
    state.hero.mana = Math.min(state.hero.maxMana, state.hero.mana + 2);

    for (const stack of state.playerArmy) {
      stack.block = 0;
    }

    tickStatuses(state.playerArmy);
    tickStatuses(state.enemyArmy);

    for (const skill of state.heroSkills) {
      if (skill.cooldownRemaining > 0) skill.cooldownRemaining -= 1;
    }
  }

  for (const stack of state.playerArmy) {
    stack.actedThisTurn = false;
  }

  state.enemyIntents = generateEnemyIntents(state);
  events.push({ type: 'INTENTS_GENERATED', intents: state.enemyIntents });

  state.phase = 'player';
  events.push({ type: 'TURN_STARTED', side: 'player', turnNumber: state.turnNumber });

  drawCards(state, HAND_SIZE, events);
}

function endPlayerTurn(state: CombatState, events: CombatEvent[]): ApplyResult {
  for (const card of state.hand) {
    state.discard.push(card);
    events.push({ type: 'CARD_DISCARDED', instanceId: card.instanceId, cardId: card.cardId });
  }
  state.hand = [];

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
  } else if (action.type === 'USE_SKILL') {
    result = useSkill(working, action, events);
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
  /** Passive relics carried over from the run (AGENT.md §16); [] outside a run. */
  activeRelicEffects?: RelicEffect[];
  /** Hero skill loadout for this battle (AGENT.md §5); defaults to none. */
  heroSkillIds?: string[];
}

export function startBattle(params: StartBattleParams): ApplyResult {
  const events: CombatEvent[] = [{ type: 'BATTLE_STARTED' }];

  const heroSkills: HeroSkillState[] = (params.heroSkillIds ?? []).map((skillId) => ({
    skillId,
    cooldownRemaining: 0,
  }));

  const state: CombatState = {
    seed: params.seed,
    rng: params.rng,
    turnNumber: 0,
    phase: 'enemy', // placeholder so startPlayerTurn below performs a clean transition
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
    heroSkills,
    log: [],
  };

  startPlayerTurn(state, events, true);
  state.log = events;
  return { state, events };
}
