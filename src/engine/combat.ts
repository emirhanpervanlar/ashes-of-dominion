import { CARD_DEFINITIONS } from './data/cards.js';
import { UNIT_DEFINITIONS } from './data/units.js';
import { applyDamageToStack, computeRawDamage } from './damage.js';
import { generateEnemyIntents } from './intents.js';
import { shuffle } from './rng.js';
import type {
  ApplyResult,
  ArmyStack,
  CardDefinition,
  CardEffect,
  CardInstance,
  CombatEvent,
  CombatState,
  Hero,
  PlayerAction,
  Position,
} from './types.js';

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

function getHeroResource(hero: Hero, type: CardDefinition['cost']['type']): number {
  switch (type) {
    case 'AC':
      return hero.ac;
    case 'DC':
      return hero.dc;
    case 'MANA':
      return hero.mana;
  }
}

function spendHeroResource(hero: Hero, type: CardDefinition['cost']['type'], amount: number): void {
  switch (type) {
    case 'AC':
      hero.ac -= amount;
      return;
    case 'DC':
      hero.dc -= amount;
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

function resolveAttack(
  attacker: ArmyStack,
  target: ArmyStack,
  army: ArmyStack[],
  multiplier: number,
  events: CombatEvent[]
): void {
  const attackerDef = UNIT_DEFINITIONS[attacker.unitId];
  const targetDef = UNIT_DEFINITIONS[target.unitId];
  const raw = computeRawDamage(attacker, attackerDef.attack, targetDef.defense, multiplier);
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
  }
  if (resolution.stack.count === 0) {
    events.push({ type: 'STACK_DESTROYED', stackId: target.stackId });
  }
}

function executeEffect(
  state: CombatState,
  effect: CardEffect,
  action: Extract<PlayerAction, { type: 'PLAY_CARD' }>,
  events: CombatEvent[]
): void {
  switch (effect.kind) {
    case 'ATTACK': {
      const attacker = findStack(state.playerArmy, action.actingStackId)!;
      const target = findStack(state.enemyArmy, action.targetStackId)!;
      resolveAttack(attacker, target, state.enemyArmy, effect.multiplier, events);
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
        resolveAttack(attacker, target, state.enemyArmy, effect.multiplier, events);
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
  }
}

function validateTargeting(
  state: CombatState,
  cardDef: CardDefinition,
  action: Extract<PlayerAction, { type: 'PLAY_CARD' }>
): string | null {
  const needsAlly = cardDef.targeting === 'ally-stack' || cardDef.targeting === 'ally-stack+enemy-stack' || cardDef.targeting === 'ally-stack+position';
  const needsEnemy = cardDef.targeting === 'enemy-stack' || cardDef.targeting === 'ally-stack+enemy-stack';
  const needsPosition = cardDef.targeting === 'ally-stack+position';

  if (needsAlly) {
    const stack = findStack(state.playerArmy, action.actingStackId);
    if (!stack) return 'Invalid or dead friendly stack.';
    if (cardDef.id === 'charge' && !UNIT_DEFINITIONS[stack.unitId].tags.includes('cavalry')) {
      return 'Charge requires a friendly Cavalry stack.';
    }
  }
  if (needsEnemy) {
    const stack = findStack(state.enemyArmy, action.targetStackId);
    if (!stack) return 'Invalid or dead enemy stack.';
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

    resolveAttack(actor, target, state.playerArmy, 1, events);
  }
  events.push({ type: 'ENEMY_TURN_RESOLVED' });
}

/**
 * Turn 1 starts with the Hero's configured starting resources (e.g. Mana
 * 5/8 is an intentional partial start, AGENT.md §5) — it must NOT also
 * receive the "restored each turn" bonus. Every subsequent turn restores
 * AC/DC to full, regenerates Mana, resets Block, and ticks statuses.
 */
function startPlayerTurn(state: CombatState, events: CombatEvent[], isFirstTurn: boolean): void {
  state.turnNumber += 1;

  if (!isFirstTurn) {
    state.hero.ac = state.hero.maxAc;
    state.hero.dc = state.hero.maxDc;
    state.hero.mana = Math.min(state.hero.maxMana, state.hero.mana + 2);

    for (const stack of state.playerArmy) {
      stack.block = 0;
    }

    tickStatuses(state.playerArmy);
    tickStatuses(state.enemyArmy);
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

  const result = action.type === 'END_TURN' ? endPlayerTurn(working, events) : playCard(working, action, events);
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
}

export function startBattle(params: StartBattleParams): ApplyResult {
  const events: CombatEvent[] = [{ type: 'BATTLE_STARTED' }];

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
    log: [],
  };

  startPlayerTurn(state, events, true);
  state.log = events;
  return { state, events };
}
