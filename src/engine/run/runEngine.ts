import { mergeArmyStacks, splitArmyStack } from '../army.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { HERO_DEFINITIONS } from '../data/heroes.js';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../data/relics.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { applyPlayerAction, startBattle } from '../combat.js';
import { buildHeroStartingArmy, createHero } from '../scenario.js';
import { createRng, nextInt, shuffle } from '../rng.js';
import type { ArmyStack, CardInstance, CombatState, Hero, HeroId, PlayerAction, RelicDefinition, RelicEffect, UnitId } from '../types.js';
import { CARD_UPGRADES } from './cardUpgrades.js';
import {
  BUILDING_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  LEVEL_SLOTS,
  LEVEL_UP_COST,
  addUnitsToArmy,
  canRecruitUnit,
  createInitialCityState,
  recruitCost,
} from './city.js';
import { generateBattleEncounter, generateBossEncounter } from './encounters.js';
import { EVENT_DEFINITIONS, EVENT_IDS } from './events.js';
import { applyStarvation, moveFoodCost } from './food.js';
import { generateMerchantInventory } from './merchant.js';
import { buildPendingReward } from './rewards.js';
import type { RunAction, RunApplyResult, RunEvent, RunState } from './types.js';
import { findNode, generateWorldMap, visitNode } from './worldMap.js';

const STARTING_GOLD = 100;
const STARTING_FOOD = 50;

function cloneRun(run: RunState): RunState {
  return JSON.parse(JSON.stringify(run)) as RunState;
}

function buildStartingDeck(heroId: HeroId): CardInstance[] {
  return HERO_DEFINITIONS[heroId].startingDeck.map((cardId, i) => ({ instanceId: `${cardId}#${i}`, cardId }));
}

export function createRun(seed: number, heroId: HeroId = 'warlord', heroName?: string): RunState {
  const rng = createRng(seed);
  const hero: Hero = createHero(heroId, heroName);

  return {
    seed,
    rng,
    hero,
    army: buildHeroStartingArmy(heroId),
    masterDeck: buildStartingDeck(heroId),
    relics: [],
    gold: STARTING_GOLD,
    food: STARTING_FOOD,
    day: 1,
    battlesWon: 0,
    worldMap: generateWorldMap(rng),
    city: createInitialCityState(),
    finalBattle: false,
    phase: 'choosing_starting_relic',
    combat: null,
    pendingReward: null,
    pendingEvent: null,
    pendingMerchant: null,
    log: [{ type: 'RUN_STARTED' }],
  };
}

function rescaleStack(stack: ArmyStack, multiplier: number): ArmyStack {
  const def = UNIT_DEFINITIONS[stack.unitId];
  const newCount = Math.max(0, Math.floor(stack.count * multiplier));
  const newMaxHp = newCount * def.hpPerUnit;
  return { ...stack, count: newCount, currentHp: newMaxHp, maxHp: newMaxHp, startingCount: newCount, preBattleMaxCount: newCount };
}

function addFlatToLargestStack(army: ArmyStack[], amount: number): ArmyStack[] {
  if (army.length === 0) return army;
  const largest = army.reduce((a, b) => (b.count > a.count ? b : a));
  const def = UNIT_DEFINITIONS[largest.unitId];
  return army.map((s) => {
    if (s.stackId !== largest.stackId) return s;
    const newCount = s.count + amount;
    const newMaxHp = newCount * def.hpPerUnit;
    return { ...s, count: newCount, currentHp: newMaxHp, maxHp: newMaxHp, startingCount: newCount, preBattleMaxCount: newCount };
  });
}

/**
 * "Stat-boost" relic effects are applied once, permanently, right when the
 * relic is granted — see the RelicEffect doc comment in engine/types.ts.
 * ARMY_SIZE_* kinds only ever appear on starting relics, applied before any
 * casualties exist, so rescaling to a fresh maxHp/currentHp is safe.
 */
function applyRelicStatEffectsOnce(run: RunState, def: RelicDefinition): void {
  for (const effect of def.effects) {
    switch (effect.kind) {
      case 'HERO_MAX_MANA':
        run.hero.maxMana += effect.amount;
        run.hero.mana += effect.amount;
        break;
      case 'ARMY_SIZE_MULT':
        run.army = run.army.map((s) => rescaleStack(s, effect.multiplier));
        break;
      case 'ARMY_SIZE_FLAT_LARGEST':
        run.army = addFlatToLargestStack(run.army, effect.amount);
        break;
      default:
        break; // combat-modifier kinds are read dynamically from run.relics each attack — nothing to bake in here
    }
  }
}

function grantRelic(run: RunState, def: RelicDefinition, events: RunEvent[]): void {
  applyRelicStatEffectsOnce(run, def);
  run.relics.push(def);
  events.push({ type: 'RELIC_CLAIMED', relicId: def.id });
}

function startBattleForRun(run: RunState, encounterArmy: ArmyStack[]): CombatState {
  const doctrine = run.city.doctrine ? DOCTRINE_DEFINITIONS[run.city.doctrine] : undefined;
  const relicEffects: RelicEffect[] = [...run.relics.flatMap((r) => r.effects), ...(doctrine?.combatEffects ?? [])];
  const { state } = startBattle({
    seed: run.seed,
    rng: run.rng,
    hero: run.hero,
    playerArmy: run.army,
    enemyArmy: encounterArmy,
    deck: run.masterDeck,
    activeRelicEffects: relicEffects,
  });
  return state;
}

function reject(events: RunEvent[], reason: string): void {
  events.push({ type: 'ACTION_REJECTED', reason });
}

function chooseStartingRelic(run: RunState, relicId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'choosing_starting_relic') {
    reject(events, 'Starting relic already chosen.');
    return { run, events };
  }
  const def = STARTING_RELIC_DEFINITIONS[relicId];
  if (!def) {
    reject(events, 'Unknown starting relic.');
    return { run, events };
  }
  grantRelic(run, def, events);
  events[events.length - 1] = { type: 'STARTING_RELIC_CHOSEN', relicId }; // replace the generic RELIC_CLAIMED with a more specific event
  run.phase = 'on_map';
  return { run, events };
}

/** A modest, deterministic one-time pickup — see AGENT.md §35 (ongoing per-day production is future work). */
function resolveResourceNode(run: RunState, events: RunEvent[]): void {
  const econMult = run.city.doctrine === 'economic' ? 1.3 : 1;
  const gold = Math.round((20 + nextInt(run.rng, 21)) * econMult); // 20-40, +30% under Economic Doctrine
  const food = Math.round((10 + nextInt(run.rng, 11)) * econMult); // 10-20
  run.gold += gold;
  run.food += food;
  events.push({ type: 'RESOURCE_FOUND', gold, food });
}

function moveTo(run: RunState, nodeId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'on_map') {
    reject(events, 'Cannot move right now.');
    return { run, events };
  }
  const current = findNode(run.worldMap, run.worldMap.currentNodeId);
  const destination = findNode(run.worldMap, nodeId);
  if (!current || !destination || !current.connectsTo.includes(nodeId)) {
    reject(events, 'That node is not reachable from here.');
    return { run, events };
  }

  const foodCost = moveFoodCost(run.army);
  run.food -= foodCost;
  run.day += 1;
  events.push({ type: 'MOVED', nodeId, foodCost });

  if (run.food < 0) {
    run.food = 0;
    const result = applyStarvation(run.army);
    run.army = result.army;
    if (result.unitsLost > 0) events.push({ type: 'STARVING', unitsLost: result.unitsLost });
  }

  visitNode(run.worldMap, nodeId);
  events.push({ type: 'ARRIVED_AT_NODE', nodeId, nodeType: destination.type });

  switch (destination.type) {
    case 'road':
      break;
    case 'boss': {
      run.finalBattle = true;
      run.phase = 'in_battle';
      run.combat = startBattleForRun(run, generateBossEncounter());
      break;
    }
    case 'battle':
    case 'elite_battle': {
      const encounter = generateBattleEncounter(destination.layer, destination.type === 'elite_battle');
      run.phase = 'in_battle';
      run.combat = startBattleForRun(run, encounter);
      break;
    }
    case 'resource':
      resolveResourceNode(run, events);
      break;
    case 'merchant':
      run.pendingMerchant = generateMerchantInventory(run.rng, run.relics);
      run.phase = 'merchant';
      break;
    case 'event': {
      const eventId = EVENT_IDS[nextInt(run.rng, EVENT_IDS.length)]!;
      run.pendingEvent = { eventId };
      run.phase = 'event';
      break;
    }
    case 'city':
      enterCityEffects(run);
      run.phase = 'city';
      break;
  }

  return { run, events };
}

/** Shared by moveTo's 'city' arrival and re-entering a city you're already standing on. */
function enterCityEffects(run: RunState): void {
  if (run.city.buildings.includes('shrine')) {
    run.army = run.army.map((s) =>
      s.count > 0 ? { ...s, currentHp: Math.min(s.maxHp, s.currentHp + Math.round(s.maxHp * 0.2)) } : s
    );
  }
}

/**
 * The world map only moves forward (AGENT.md §19's DAG, no backward
 * edges), but a city should stay revisitable like a Heroes3 town — this
 * re-enters the city node you're currently standing on without moving.
 */
function enterCity(run: RunState, events: RunEvent[]): RunApplyResult {
  const current = findNode(run.worldMap, run.worldMap.currentNodeId);
  if (run.phase !== 'on_map' || !current || current.type !== 'city') {
    reject(events, 'Not standing on a city.');
    return { run, events };
  }
  enterCityEffects(run);
  run.phase = 'city';
  return { run, events };
}

function forwardCombatAction(run: RunState, action: PlayerAction, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'in_battle' || !run.combat) {
    reject(events, 'No battle in progress.');
    return { run, events };
  }

  const result = applyPlayerAction(run.combat, action);
  run.combat = result.state;

  if (result.state.result === 'victory') {
    run.hero = result.state.hero;
    run.army = result.state.playerArmy;
    run.rng = { seed: result.state.rng.seed };
    run.battlesWon += 1;
    events.push({ type: 'BATTLE_WON' });
    run.pendingReward = buildPendingReward(run.rng, run.relics, run.masterDeck);
    run.phase = 'reward';
  } else if (result.state.result === 'defeat') {
    run.hero = result.state.hero;
    run.army = result.state.playerArmy;
    run.rng = { seed: result.state.rng.seed };
    events.push({ type: 'BATTLE_LOST' });
    run.phase = 'defeat';
  }

  return { run, events };
}

function claimRelic(run: RunState, relicId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.relicOptions.includes(relicId)) {
    reject(events, 'That relic is not one of the current options.');
    return { run, events };
  }
  run.pendingReward.chosenRelicId = relicId;
  return { run, events };
}

function claimCard(run: RunState, cardId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.cardOptions.includes(cardId)) {
    reject(events, 'That card is not one of the current options.');
    return { run, events };
  }
  run.pendingReward.chosenCardId = cardId;
  run.pendingReward.chosenUpgradeInstanceId = null;
  return { run, events };
}

function claimUpgrade(run: RunState, instanceId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.upgradeOptions.some((o) => o.instanceId === instanceId)) {
    reject(events, 'That upgrade is not one of the current options.');
    return { run, events };
  }
  run.pendingReward.chosenUpgradeInstanceId = instanceId;
  run.pendingReward.chosenCardId = null;
  return { run, events };
}

function confirmReward(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  const reward = run.pendingReward;

  if (reward.chosenRelicId) {
    const def = RELIC_DEFINITIONS[reward.chosenRelicId];
    if (def) grantRelic(run, def, events);
  }

  if (reward.chosenCardId && CARD_DEFINITIONS[reward.chosenCardId]) {
    const instanceId = `${reward.chosenCardId}#reward${run.masterDeck.length}`;
    run.masterDeck.push({ instanceId, cardId: reward.chosenCardId });
    events.push({ type: 'CARD_REWARD_CLAIMED', cardId: reward.chosenCardId });
  } else if (reward.chosenUpgradeInstanceId) {
    const idx = run.masterDeck.findIndex((c) => c.instanceId === reward.chosenUpgradeInstanceId);
    if (idx >= 0) {
      const card = run.masterDeck[idx]!;
      const upgradedId = CARD_UPGRADES[card.cardId];
      if (upgradedId) {
        events.push({ type: 'CARD_UPGRADED', instanceId: card.instanceId, fromCardId: card.cardId, toCardId: upgradedId });
        run.masterDeck[idx] = { ...card, cardId: upgradedId };
      }
    }
  }

  if (!reward.chosenRelicId && !reward.chosenCardId && !reward.chosenUpgradeInstanceId) {
    events.push({ type: 'REWARD_SKIPPED' });
  }

  run.pendingReward = null;
  if (run.finalBattle) {
    run.phase = 'run_complete';
    events.push({ type: 'RUN_COMPLETE' });
  } else {
    run.phase = 'on_map';
  }
  return { run, events };
}

function pickUnownedRelicId(run: RunState): string | undefined {
  const ownedIds = new Set(run.relics.map((r) => r.id));
  const available = Object.keys(RELIC_DEFINITIONS).filter((id) => !ownedIds.has(id));
  return shuffle(run.rng, available)[0];
}

function chooseEventOption(run: RunState, optionId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'event' || !run.pendingEvent) {
    reject(events, 'No event pending.');
    return { run, events };
  }
  const def = EVENT_DEFINITIONS[run.pendingEvent.eventId];
  const option = def?.options.find((o) => o.id === optionId);
  if (!def || !option) {
    reject(events, 'Unknown event option.');
    return { run, events };
  }

  let outcome = option.id;
  switch (option.effect.kind) {
    case 'GOLD_DELTA':
      run.gold = Math.max(0, run.gold + option.effect.amount);
      break;
    case 'FOOD_DELTA':
      run.food = Math.max(0, run.food + option.effect.amount);
      break;
    case 'HERO_HEAL_PERCENT':
      run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + Math.round((run.hero.maxHp * option.effect.percent) / 100));
      break;
    case 'RISKY_SEARCH': {
      const roll = nextInt(run.rng, 100);
      if (roll < Math.round(option.effect.successChance * 100)) {
        const relicId = pickUnownedRelicId(run);
        if (relicId) {
          grantRelic(run, RELIC_DEFINITIONS[relicId]!, events);
          outcome = 'search_relic';
        } else {
          run.gold += 30; // nothing left to find — modest consolation Gold
          outcome = 'search_nothing_left';
        }
      } else {
        run.gold = Math.max(0, run.gold - option.effect.trapGoldLoss);
        outcome = 'search_trap';
      }
      break;
    }
  }

  events.push({ type: 'EVENT_RESOLVED', eventId: def.id, optionId, outcome });
  run.pendingEvent = null;
  run.phase = 'on_map';
  return { run, events };
}

function buyCard(run: RunState, cardId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'merchant' || !run.pendingMerchant) {
    reject(events, 'Not at a merchant.');
    return { run, events };
  }
  const offerIdx = run.pendingMerchant.cardOffers.findIndex((o) => o.cardId === cardId);
  if (offerIdx === -1) {
    reject(events, 'That card is not for sale here.');
    return { run, events };
  }
  const offer = run.pendingMerchant.cardOffers[offerIdx]!;
  if (run.gold < offer.price) {
    reject(events, 'Not enough Gold.');
    return { run, events };
  }
  run.gold -= offer.price;
  const instanceId = `${cardId}#shop${run.masterDeck.length}`;
  run.masterDeck.push({ instanceId, cardId });
  run.pendingMerchant.cardOffers.splice(offerIdx, 1);
  events.push({ type: 'ITEM_PURCHASED', itemId: cardId, price: offer.price });
  return { run, events };
}

function buyRelic(run: RunState, relicId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'merchant' || !run.pendingMerchant || !run.pendingMerchant.relicOffer) {
    reject(events, 'No relic for sale here.');
    return { run, events };
  }
  if (run.pendingMerchant.relicOffer.relicId !== relicId) {
    reject(events, 'That relic is not for sale here.');
    return { run, events };
  }
  const offer = run.pendingMerchant.relicOffer;
  if (run.gold < offer.price) {
    reject(events, 'Not enough Gold.');
    return { run, events };
  }
  const def = RELIC_DEFINITIONS[relicId];
  if (!def) {
    reject(events, 'Unknown relic.');
    return { run, events };
  }
  run.gold -= offer.price;
  grantRelic(run, def, events);
  run.pendingMerchant.relicOffer = null;
  events.push({ type: 'ITEM_PURCHASED', itemId: relicId, price: offer.price });
  return { run, events };
}

function leaveMerchant(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'merchant') {
    reject(events, 'Not at a merchant.');
    return { run, events };
  }
  run.pendingMerchant = null;
  run.phase = 'on_map';
  return { run, events };
}

function recruit(run: RunState, unitId: UnitId, count: number, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  if (count <= 0) {
    reject(events, 'Invalid recruit count.');
    return { run, events };
  }
  if (!canRecruitUnit(run.city, unitId)) {
    reject(events, 'That unit cannot be recruited yet (missing building).');
    return { run, events };
  }
  const cost = recruitCost(run.city, unitId, count);
  if (!cost) {
    reject(events, 'Unknown recruitable unit.');
    return { run, events };
  }
  if (run.gold < cost.gold || run.food < cost.food) {
    reject(events, 'Not enough Gold/Food to recruit that many.');
    return { run, events };
  }

  const updatedArmy = addUnitsToArmy(run.army, unitId, count);
  if (!updatedArmy) {
    reject(events, 'Field army is full (6 stacks) and has no matching stack to merge into.');
    return { run, events };
  }
  run.gold -= cost.gold;
  run.food -= cost.food;
  run.army = updatedArmy;
  events.push({ type: 'UNITS_RECRUITED', unitId, count });
  return { run, events };
}

function splitStackAction(run: RunState, stackId: string, splitCount: number, events: RunEvent[]): RunApplyResult {
  const updatedArmy = splitArmyStack(run.army, stackId, splitCount);
  if (!updatedArmy) {
    reject(events, 'Cannot split that stack (invalid amount or army already has 6 stacks).');
    return { run, events };
  }
  run.army = updatedArmy;
  return { run, events };
}

function mergeStacksAction(run: RunState, stackIdA: string, stackIdB: string, events: RunEvent[]): RunApplyResult {
  const updatedArmy = mergeArmyStacks(run.army, stackIdA, stackIdB);
  if (!updatedArmy) {
    reject(events, 'Cannot merge those stacks (must be the same unit type).');
    return { run, events };
  }
  run.army = updatedArmy;
  return { run, events };
}

function buildBuilding(run: RunState, buildingId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  const def = BUILDING_DEFINITIONS[buildingId];
  if (!def) {
    reject(events, 'Unknown building.');
    return { run, events };
  }
  if (run.city.buildings.includes(buildingId)) {
    reject(events, 'Already built.');
    return { run, events };
  }
  if (run.city.buildings.length >= LEVEL_SLOTS[run.city.level]) {
    reject(events, 'No free building slots at this city level.');
    return { run, events };
  }
  if (run.gold < def.cost) {
    reject(events, 'Not enough Gold.');
    return { run, events };
  }

  run.gold -= def.cost;
  run.city.buildings.push(buildingId);

  if (buildingId === 'gold_mine') run.gold += 100;
  if (buildingId === 'training_hall' || buildingId === 'forge') {
    run.hero.maxMana += 2;
    run.hero.mana += 2;
  }

  events.push({ type: 'BUILDING_BUILT', buildingId });
  return { run, events };
}

function upgradeCity(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  if (run.city.level >= 3) {
    reject(events, 'City is already at max level.');
    return { run, events };
  }
  const nextLevel = (run.city.level + 1) as 2 | 3;
  const cost = LEVEL_UP_COST[nextLevel];
  if (run.gold < cost) {
    reject(events, 'Not enough Gold.');
    return { run, events };
  }
  run.gold -= cost;
  run.city.level = nextLevel;
  events.push({ type: 'CITY_LEVELED_UP', level: nextLevel });
  return { run, events };
}

function chooseDoctrine(run: RunState, doctrineId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  if (run.city.doctrine) {
    reject(events, 'A Doctrine has already been chosen for this city.');
    return { run, events };
  }
  if (!DOCTRINE_DEFINITIONS[doctrineId]) {
    reject(events, 'Unknown doctrine.');
    return { run, events };
  }
  run.city.doctrine = doctrineId;
  events.push({ type: 'DOCTRINE_CHOSEN', doctrineId });
  return { run, events };
}

function leaveCity(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  run.phase = 'on_map';
  return { run, events };
}

export function applyRunAction(run: RunState, action: RunAction): RunApplyResult {
  const working = cloneRun(run);
  // Wiped stacks (battle, starvation) are dropped so a later recruit/split can't reuse their `<unit>_<position>` stackId.
  working.army = working.army.filter((s) => s.count > 0);
  const events: RunEvent[] = [];

  let result: RunApplyResult;
  switch (action.type) {
    case 'CHOOSE_STARTING_RELIC':
      result = chooseStartingRelic(working, action.relicId, events);
      break;
    case 'MOVE_TO':
      result = moveTo(working, action.nodeId, events);
      break;
    case 'COMBAT_ACTION':
      result = forwardCombatAction(working, action.action, events);
      break;
    case 'CLAIM_RELIC':
      result = claimRelic(working, action.relicId, events);
      break;
    case 'CLAIM_CARD':
      result = claimCard(working, action.cardId, events);
      break;
    case 'CLAIM_UPGRADE':
      result = claimUpgrade(working, action.instanceId, events);
      break;
    case 'CONFIRM_REWARD':
      result = confirmReward(working, events);
      break;
    case 'CHOOSE_EVENT_OPTION':
      result = chooseEventOption(working, action.optionId, events);
      break;
    case 'BUY_CARD':
      result = buyCard(working, action.cardId, events);
      break;
    case 'BUY_RELIC':
      result = buyRelic(working, action.relicId, events);
      break;
    case 'LEAVE_MERCHANT':
      result = leaveMerchant(working, events);
      break;
    case 'ENTER_CITY':
      result = enterCity(working, events);
      break;
    case 'RECRUIT':
      result = recruit(working, action.unitId, action.count, events);
      break;
    case 'BUILD_BUILDING':
      result = buildBuilding(working, action.buildingId, events);
      break;
    case 'UPGRADE_CITY':
      result = upgradeCity(working, events);
      break;
    case 'CHOOSE_DOCTRINE':
      result = chooseDoctrine(working, action.doctrineId, events);
      break;
    case 'LEAVE_CITY':
      result = leaveCity(working, events);
      break;
    case 'SPLIT_STACK':
      result = splitStackAction(working, action.stackId, action.splitCount, events);
      break;
    case 'MERGE_STACKS':
      result = mergeStacksAction(working, action.stackIdA, action.stackIdB, events);
      break;
  }

  result.run.log = [...result.run.log, ...result.events];
  return result;
}
