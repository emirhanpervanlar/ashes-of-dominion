import { mergeArmyStacks, splitArmyStack } from '../army.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { HERO_DEFINITIONS } from '../data/heroes.js';
import { RELIC_DEFINITIONS, STARTING_RELIC_DEFINITIONS } from '../data/relics.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { applyPlayerAction, startBattle } from '../combat.js';
import { maxManaFromWisdom } from '../heroStats.js';
import { buildHeroStartingArmy, createHero } from '../scenario.js';
import { createRng, nextInt, shuffle } from '../rng.js';
import type { ArmyStack, CardInstance, CombatState, Hero, HeroId, PlayerAction, Position, RelicDefinition, RelicEffect, UnitId } from '../types.js';
import { cardRemovalQuote, createCardRemovalState, type CardRemovalState } from './cardRemoval.js';
import { isUpgradable } from '../cardUpgrades.js';
import {
  BUILDING_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  FARM_TIERS,
  GOLD_MINE_DAILY_GOLD,
  LEVEL_SLOTS,
  LEVEL_UP_COST,
  MAGE_TOWER_TIERS,
  RECRUIT_COSTS,
  addUnitsToArmy,
  canRecruitUnit,
  createInitialCityState,
  recruitCost,
  settleArmyAfterVictory,
} from './city.js';
import { THREAT_PER_CITY_VISIT, TOTAL_CHAPTERS } from './chapters.js';
import { generateBattleEncounter, generateBossEncounter } from './encounters.js';
import {
  EVENT_TUNING,
  optionAvailability,
  optionCardAction,
  optionNeedsUnitChoice,
  pickEventId,
  resolveEventOptions,
  scaleEffects,
  upgradableCardIds,
  type EventEffect,
  type EventOption,
} from './events.js';
import { dailyProduction, dailyUpkeep, moveFoodCost, removeUnits, starvationMoraleMalus, starveArmy, totalArmyCount } from './food.js';
import { rollBattleLoot } from './loot.js';
import { generateMerchantInventory } from './merchant.js';
import { pickRelicByRarity, pickRelicId } from './relicSources.js';
import { buildPendingReward, generateCardOptions } from './rewards.js';
import { createRunStats, tallyCombatEvents } from './stats.js';
import type { RunAction, RunApplyResult, RunEvent, RunState, UnitCount } from './types.js';
import { findNode, generateWorldMap, visitNode } from './worldMap.js';

const STARTING_GOLD = 100;
const STARTING_FOOD = 50;
/** Relic granted when an old save is still waiting on the removed relic choice. */
export const DEFAULT_STARTING_RELIC_ID = 'royal_banner';

function cloneRun(run: RunState): RunState {
  return JSON.parse(JSON.stringify(run)) as RunState;
}

/**
 * Fills in fields that runs saved by older versions do not have (stats,
 * card-removal counters). Call it on anything loaded from storage; the
 * reducer also applies it, so an old run keeps working on its first action.
 */
export function migrateRun(run: RunState): RunState {
  const legacy = run as RunState & { finalBattle?: boolean };
  const legacyRemoval = run.cardRemoval as (CardRemovalState & { lastCityDay?: number | null }) | undefined;
  const migrated: RunState = {
    ...run,
    stats: { ...createRunStats(), ...run.stats },
    // Saves from before AO-D052 tracked the day of the last City removal; that removal counts as one use.
    cardRemoval: legacyRemoval ? { merchantUses: legacyRemoval.merchantUses, cityUses: legacyRemoval.cityUses ?? (legacyRemoval.lastCityDay != null ? 1 : 0) } : createCardRemovalState(),
    chapter: run.chapter ?? 1,
    threat: run.threat ?? 0,
    starvationDays: run.starvationDays ?? 0,
    seenEventIds: run.seenEventIds ?? [],
    lastCasualties: run.lastCasualties ?? [],
    pendingUnitChoice: run.pendingUnitChoice ?? null,
    pendingEvent: run.pendingEvent && { ...run.pendingEvent, choice: run.pendingEvent.choice ?? null, resolved: run.pendingEvent.resolved ?? null },
    bossBattle: run.bossBattle ?? legacy.finalBattle ?? false,
    pendingReward: run.pendingReward && { ...run.pendingReward, relicChoices: run.pendingReward.relicChoices ?? [] },
  };
  delete (migrated as { finalBattle?: boolean }).finalBattle;
  if ((run.phase as string) === 'choosing_starting_relic') {
    // Saves from before AO-D029: the relic was picked in a separate phase. Grant the default one and move on.
    migrated.phase = 'on_map';
    migrated.army = run.army.map((s) => ({ ...s }));
    migrated.hero = { ...run.hero };
    migrated.relics = [...run.relics];
    grantRelic(migrated, STARTING_RELIC_DEFINITIONS[DEFAULT_STARTING_RELIC_ID]!, []);
  }
  if (run.chapter === undefined) {
    // Saves from before AO-D045/D046: the old 7-layer map (road and city nodes) is replaced by a fresh chapter-1 map from today's day.
    migrated.worldMap = generateWorldMap(createRng(run.seed + run.day), 1, run.day);
  }
  if (run.city.mageTowerTier === undefined) {
    // Saves from before AO-D036: a built Mage Tower is tier I. It used to add Wisdom +2 (and the Mana that was worth); undo that, grant tier I.
    const hasTower = run.city.buildings.includes('mage_tower');
    migrated.city = { ...run.city, mageTowerTier: hasTower ? 1 : 0 };
    if (hasTower) {
      const stats = { ...run.hero.stats, wisdom: run.hero.stats.wisdom - 2 };
      const manaDelta = maxManaFromWisdom(run.hero.baseMana, stats.wisdom) - maxManaFromWisdom(run.hero.baseMana, run.hero.stats.wisdom) + MAGE_TOWER_TIERS[0]!.maxMana;
      migrated.hero = { ...run.hero, stats, maxMana: run.hero.maxMana + manaDelta, mana: Math.max(0, run.hero.mana + manaDelta) };
    }
  }
  if (run.city.farmTier === undefined) migrated.city = { ...migrated.city, farmTier: 0 };
  return migrated;
}

function changeGold(run: RunState, delta: number): void {
  const next = Math.max(0, run.gold + delta);
  const actual = next - run.gold;
  run.gold = next;
  if (actual > 0) run.stats.goldGathered += actual;
  else run.stats.goldSpent -= actual;
}

function changeFood(run: RunState, delta: number): void {
  const next = Math.max(0, run.food + delta);
  if (next > run.food) run.stats.foodGathered += next - run.food;
  run.food = next;
}

/** Instance ids must stay unique now that cards can leave the deck (deck length is no longer a safe counter). */
function newInstanceId(deck: CardInstance[], cardId: string, tag: string): string {
  const taken = new Set(deck.map((c) => c.instanceId));
  let n = deck.length;
  while (taken.has(`${cardId}#${tag}${n}`)) n += 1;
  return `${cardId}#${tag}${n}`;
}

function noteLargestStack(run: RunState): void {
  const armies = run.combat ? [run.army, run.combat.playerArmy] : [run.army];
  for (const army of armies) {
    for (const s of army) run.stats.largestStack = Math.max(run.stats.largestStack, s.count);
  }
}

function buildStartingDeck(heroId: HeroId): CardInstance[] {
  return HERO_DEFINITIONS[heroId].startingDeck.map((cardId, i) => ({ instanceId: `${cardId}#${i}`, cardId }));
}

/**
 * AO-D029: hero and starting relic are one choice, so a run is created in one step: the relic's
 * one-time effects are applied and the run lands on the map. Applying the relic draws no RNG,
 * so a seed still yields the same map whatever the relic.
 */
export function createRun(seed: number, heroId: HeroId = 'warlord', heroName?: string, relicId: string = DEFAULT_STARTING_RELIC_ID): RunState {
  const rng = createRng(seed);
  const hero: Hero = createHero(heroId, heroName);
  const relic = STARTING_RELIC_DEFINITIONS[relicId];
  if (!relic) throw new Error(`Unknown starting relic: ${relicId}`);

  const run: RunState = {
    seed,
    rng,
    hero,
    army: buildHeroStartingArmy(heroId),
    masterDeck: buildStartingDeck(heroId),
    relics: [],
    gold: STARTING_GOLD,
    food: STARTING_FOOD,
    starvationDays: 0,
    day: 1,
    battlesWon: 0,
    stats: createRunStats(),
    cardRemoval: createCardRemovalState(),
    worldMap: generateWorldMap(rng),
    city: createInitialCityState(),
    chapter: 1,
    threat: 0,
    seenEventIds: [],
    lastCasualties: [],
    bossBattle: false,
    phase: 'on_map',
    combat: null,
    pendingReward: null,
    pendingEvent: null,
    pendingUnitChoice: null,
    pendingMerchant: null,
    log: [{ type: 'RUN_STARTED' }],
  };
  grantRelic(run, relic, []);
  noteLargestStack(run);
  run.log.push({ type: 'STARTING_RELIC_CHOSEN', relicId });
  return run;
}

const MIN_HERO_MAX_MANA = 1;

/** A living stack never drops below 1 unit and keeps its wounds (HP is only capped at the new maximum). */
function rescaleStack(stack: ArmyStack, multiplier: number): ArmyStack {
  if (stack.count <= 0) return stack;
  const def = UNIT_DEFINITIONS[stack.unitId];
  const newCount = Math.max(1, Math.floor(stack.count * multiplier));
  const newMaxHp = newCount * def.hpPerUnit;
  return { ...stack, count: newCount, currentHp: Math.min(stack.currentHp, newMaxHp), maxHp: newMaxHp, startingCount: newCount, preBattleMaxCount: newCount };
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
 * ARMY_SIZE_MULT can also arrive mid-run (a found relic): stacks are floored to at
 * least 1 unit and wounded stacks stay wounded, so it never empties or heals the army.
 */
function applyRelicStatEffectsOnce(run: RunState, def: RelicDefinition): void {
  for (const effect of def.effects) {
    switch (effect.kind) {
      case 'HERO_MAX_MANA':
        // A negative amount is a drawback: the hero always keeps at least 1 max Mana.
        run.hero.maxMana = Math.max(MIN_HERO_MAX_MANA, run.hero.maxMana + effect.amount);
        run.hero.mana = Math.min(run.hero.maxMana, Math.max(0, run.hero.mana + effect.amount));
        break;
      case 'ARMY_SIZE_MULT':
        run.army = run.army.map((s) => rescaleStack(s, effect.multiplier));
        break;
      case 'ARMY_SIZE_FLAT_LARGEST':
        run.army = addFlatToLargestStack(run.army, effect.amount);
        break;
      case 'GOLD_FLAT':
        run.gold += effect.amount; // a one-time gift, not income: skips changeGold so goldGathered stays honest
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
  const buildingEffects = run.city.buildings.flatMap((id) => BUILDING_DEFINITIONS[id]?.combatEffects ?? []);
  const relicEffects: RelicEffect[] = [...run.relics.flatMap((r) => r.effects), ...(doctrine?.combatEffects ?? []), ...buildingEffects];
  const malus = starvationMoraleMalus(run.starvationDays); // AO-D057: hungry armies fight demoralised; the run army keeps its own Morale
  run.stats.turnsPlayed += 1; // the first player turn starts inside startBattle
  const { state } = startBattle({
    seed: run.seed,
    rng: run.rng,
    hero: run.hero,
    playerArmy: run.army.map((s) => ({ ...s, morale: s.morale - malus })),
    enemyArmy: encounterArmy,
    deck: run.masterDeck,
    activeRelicEffects: relicEffects,
  });
  return state;
}

function reject(events: RunEvent[], reason: string): void {
  events.push({ type: 'ACTION_REJECTED', reason });
}

/** A modest, deterministic one-time pickup — see AGENT.md §35 (ongoing per-day production is future work). */
function resolveResourceNode(run: RunState, events: RunEvent[]): void {
  const econMult = run.city.doctrine === 'economic' ? 1.3 : 1;
  const gold = Math.round((20 + nextInt(run.rng, 21)) * econMult); // 20-40, +30% under Economic Doctrine
  const food = Math.round((10 + nextInt(run.rng, 11)) * econMult); // 10-20
  changeGold(run, gold);
  changeFood(run, food);
  events.push({ type: 'RESOURCE_FOUND', gold, food });
}

/** One world day: Farm production, per-unit food upkeep, Gold Mine income, starvation. Returns the food the day cost. */
function advanceDay(run: RunState, events: RunEvent[]): number {
  const foodCost = moveFoodCost(run.army, run.city);
  const farmFood = dailyProduction(run);
  const mineGold = run.city.buildings.includes('gold_mine') ? GOLD_MINE_DAILY_GOLD : 0;
  changeFood(run, farmFood); // produced before the army eats, so a Farm can prevent this day's starvation
  run.day += 1;
  run.stats.daysElapsed += 1;

  if (mineGold > 0) changeGold(run, mineGold);
  if (mineGold > 0 || farmFood > 0) events.push({ type: 'DAILY_INCOME', gold: mineGold, food: farmFood });

  if (payUpkeep(run, foodCost, events) === 'fed') run.starvationDays = 0;
  return foodCost;
}

/**
 * Eats `need` Food. Enough in the stockpile: paid. Otherwise the stockpile empties (the army is NOT cut down to what it can feed)
 * and units starve by the shortage share (AO-D057), one more consecutive starving day.
 */
function payUpkeep(run: RunState, need: number, events: RunEvent[]): 'fed' | 'starved' {
  if (run.food >= need) {
    run.food -= need;
    run.stats.foodEaten += need;
    return 'fed';
  }
  const shortageRatio = (need - run.food) / need;
  run.stats.foodEaten += run.food;
  run.food = 0;
  run.starvationDays += 1;
  const result = starveArmy(run.army, run.rng, shortageRatio, run.starvationDays);
  run.army = result.army;
  const starved = result.deaths.reduce((n, d) => n + d.count, 0);
  run.stats.unitsLost += starved;
  run.stats.unitsStarved += starved;
  events.push({ type: 'STARVED', deaths: result.deaths, day: run.day, consecutiveDays: run.starvationDays });
  return 'starved';
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

  const foodCost = advanceDay(run, events);
  run.stats.nodesVisited += 1;
  events.push({ type: 'MOVED', nodeId, foodCost });

  visitNode(run.worldMap, nodeId);
  events.push({ type: 'ARRIVED_AT_NODE', nodeId, nodeType: destination.type });

  switch (destination.type) {
    case 'start':
      break;
    case 'boss':
      run.bossBattle = true;
      run.phase = 'in_battle';
      run.combat = startBattleForRun(run, generateBossEncounter(run.chapter, run.threat));
      break;
    case 'battle':
    case 'elite_battle': {
      const encounter = generateBattleEncounter(destination.layer, destination.type === 'elite_battle', run.chapter, run.threat);
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
      run.pendingEvent = { eventId: pickEventId(run), choice: null, resolved: null };
      run.phase = 'event';
      break;
    }
  }

  return { run, events };
}

/**
 * The city is reachable from the map at any time (AO-D047, GDD "Teleport to Town"); each visit
 * raises Threat. It costs no days (AO-D051), and leaving returns to the same map node.
 */
function travelToCity(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'on_map') {
    reject(events, 'The city can only be reached from the map.');
    return { run, events };
  }
  run.threat += THREAT_PER_CITY_VISIT;
  run.phase = 'city';
  events.push({ type: 'CITY_VISITED', threat: run.threat });
  return { run, events };
}

function forwardCombatAction(run: RunState, action: PlayerAction, events: RunEvent[]): RunApplyResult {
  const previous = run.combat;
  if (run.phase !== 'in_battle' || !previous) {
    reject(events, 'No battle in progress.');
    return { run, events };
  }

  const result = applyPlayerAction(previous, action);
  run.combat = result.state;
  const playerStackIds = new Set([...previous.playerArmy, ...result.state.playerArmy].map((s) => s.stackId));
  tallyCombatEvents(run.stats, result.events, playerStackIds);

  if (result.state.result === 'victory') {
    const settled = settleArmyAfterVictory(result.state.playerArmy, run.city);
    run.hero = result.state.hero;
    run.army = settled.army.map((s) => ({ ...s, morale: run.army.find((p) => p.stackId === s.stackId)?.morale ?? 100 }));
    run.rng = { seed: result.state.rng.seed };
    run.battlesWon += 1;
    run.stats.battlesWon += 1;
    run.stats.unitsRevived += settled.revived;
    const arrivedAt = findNode(run.worldMap, run.worldMap.currentNodeId);
    if (run.bossBattle) run.stats.bossesDefeated += 1;
    else if (arrivedAt?.type === 'elite_battle') run.stats.elitesDefeated += 1;
    run.lastCasualties = tallyCasualties(result.state.playerArmy, settled.army);
    events.push({ type: 'BATTLE_WON' });
    if (settled.revived > 0) events.push({ type: 'UNITS_REVIVED', count: settled.revived });
    const loot = rollBattleLoot(run.rng, { chapter: run.chapter, day: run.day, elite: run.bossBattle || arrivedAt?.type === 'elite_battle', threat: run.threat });
    changeGold(run, loot.gold);
    changeFood(run, loot.food);
    events.push({ type: 'BATTLE_LOOT', gold: loot.gold, food: loot.food });
    run.pendingReward = buildPendingReward(run.rng, run.relics, run.masterDeck, arrivedAt?.type === 'elite_battle', run.bossBattle && run.chapter < TOTAL_CHAPTERS);
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

/** What the battle cost, per unit type, after Shrine revival; the source for event revivals. */
function tallyCasualties(before: ArmyStack[], after: ArmyStack[]): UnitCount[] {
  const lost = new Map<UnitId, number>();
  before.forEach((stack, i) => lost.set(stack.unitId, (lost.get(stack.unitId) ?? 0) + Math.max(0, stack.preBattleMaxCount - after[i]!.count)));
  return [...lost].filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count }));
}

/** Every reward pick (card, upgrade, removal, skip) ends the reward screen at once (AO-D026). */
function finishReward(run: RunState, events: RunEvent[]): void {
  run.pendingReward = null;
  if (!run.bossBattle) {
    run.phase = 'on_map';
    return;
  }
  run.bossBattle = false;
  events.push({ type: 'BOSS_DEFEATED', chapter: run.chapter });
  if (run.chapter >= TOTAL_CHAPTERS) {
    run.phase = 'run_complete';
    events.push({ type: 'RUN_COMPLETE' });
    return;
  }
  run.chapter += 1;
  run.worldMap = generateWorldMap(run.rng, run.chapter, run.day);
  run.phase = 'on_map';
  events.push({ type: 'CHAPTER_STARTED', chapter: run.chapter });
}

function claimCard(run: RunState, cardId: string, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  if (!run.pendingReward.cardOptions.includes(cardId) || !CARD_DEFINITIONS[cardId]) {
    reject(events, 'That card is not one of the current options.');
    return { run, events };
  }
  run.masterDeck.push({ instanceId: newInstanceId(run.masterDeck, cardId, 'reward'), cardId });
  events.push({ type: 'CARD_REWARD_CLAIMED', cardId });
  finishReward(run, events);
  return { run, events };
}

/** The elite relic / boss relic choice is an extra on top of the one card/upgrade/skip pick, so claiming it keeps the screen open. */
function claimRelic(run: RunState, relicId: string, events: RunEvent[]): RunApplyResult {
  const reward = run.pendingReward;
  const onOffer = reward && (reward.relicOffer === relicId || reward.relicChoices.includes(relicId));
  if (run.phase !== 'reward' || !reward || !onOffer) {
    reject(events, 'That relic is not on offer.');
    return { run, events };
  }
  grantRelic(run, RELIC_DEFINITIONS[relicId]!, events);
  reward.relicOffer = null;
  reward.relicChoices = [];
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
  const idx = run.masterDeck.findIndex((c) => c.instanceId === instanceId);
  const card = run.masterDeck[idx];
  if (!card || !isUpgradable(card)) {
    reject(events, 'That card can no longer be upgraded.');
    return { run, events };
  }
  events.push({ type: 'CARD_UPGRADED', instanceId, cardId: card.cardId });
  run.masterDeck[idx] = { ...card, upgraded: true };
  finishReward(run, events);
  return { run, events };
}

function skipReward(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'reward' || !run.pendingReward) {
    reject(events, 'No reward pending.');
    return { run, events };
  }
  events.push({ type: 'REWARD_SKIPPED' });
  finishReward(run, events);
  return { run, events };
}

/** Card removal (AO-D026) at a reward, merchant or city; where it is allowed and what it costs lives in cardRemoval.ts. */
function removeCard(run: RunState, instanceId: string, events: RunEvent[]): RunApplyResult {
  const quote = cardRemovalQuote(run);
  if (!quote.allowed) {
    reject(events, quote.reason);
    return { run, events };
  }
  const idx = run.masterDeck.findIndex((c) => c.instanceId === instanceId);
  if (idx === -1) {
    reject(events, 'That card is not in your deck.');
    return { run, events };
  }
  const card = run.masterDeck[idx]!;
  run.masterDeck.splice(idx, 1);
  changeGold(run, -quote.gold);
  run.stats.cardsRemoved += 1;
  events.push({ type: 'CARD_REMOVED', instanceId, cardId: card.cardId, goldPaid: quote.gold });

  if (run.phase === 'merchant') run.cardRemoval.merchantUses += 1;
  else if (run.phase === 'city') run.cardRemoval.cityUses += 1;
  else finishReward(run, events);
  return { run, events };
}

// ---- Events (AO-D050, D054, D055, D056) ----

/** What the player picked in a sub-step, if the option needed one. */
interface EventPick {
  instanceId?: string;
  unitId?: UnitId;
}

interface EventTally {
  outcome: string;
  texts: string[];
  nothingLeft: boolean;
  ambush: boolean;
}

/** Losing units never wipes the army: at least one unit always survives. */
function loseUnits(run: RunState, effect: Extract<EventEffect, { kind: 'UNIT_LOSS' }>, events: RunEvent[]): void {
  const alive = run.army.filter((s) => s.count > 0);
  if (alive.length === 0) return;
  const target = effect.target === 'largest_stack' ? alive.reduce((a, b) => (b.count > a.count ? b : a)) : alive[nextInt(run.rng, alive.length)]!;
  const wanted = effect.count ?? Math.max(1, Math.floor((target.count * (effect.percent ?? 0)) / 100));
  const lost = Math.min(wanted, target.count, totalArmyCount(alive) - 1);
  if (lost <= 0) return;
  run.army = run.army.map((s) => (s.stackId === target.stackId ? removeUnits(s, lost) : s)).filter((s) => s.count > 0);
  run.stats.unitsLost += lost;
  events.push({ type: 'UNITS_LOST', unitId: target.unitId, count: lost });
}

function gainUnits(run: RunState, unitId: UnitId, count: number, events: RunEvent[]): void {
  const updated = addUnitsToArmy(run.army, unitId, count);
  if (updated) {
    run.army = updated;
    events.push({ type: 'UNITS_GAINED', unitId, count });
    return;
  }
  // AO-D054: no room; the newcomer waits as a temporary 7th entry until the player dismisses a stack or declines.
  const newcomer = addUnitsToArmy([], unitId, count)![0]!;
  run.pendingUnitChoice = { newcomer: { ...newcomer, stackId: `player_${unitId}_pending`, position: 6 } };
}

function reviveCasualties(run: RunState, percent: number, events: RunEvent[]): void {
  const remaining: UnitCount[] = [];
  let revived = 0;
  for (const fallen of run.lastCasualties) {
    const count = Math.min(fallen.count, Math.ceil((fallen.count * percent) / 100));
    const updated = addUnitsToArmy(run.army, fallen.unitId, count);
    if (!updated) {
      remaining.push(fallen);
      continue;
    }
    run.army = updated;
    revived += count;
    if (fallen.count > count) remaining.push({ unitId: fallen.unitId, count: fallen.count - count });
  }
  run.lastCasualties = remaining;
  if (revived > 0) {
    run.stats.unitsRevived += revived;
    events.push({ type: 'UNITS_REVIVED', count: revived });
  }
}

function applyEventEffect(run: RunState, effect: EventEffect, pick: EventPick, tally: EventTally, events: RunEvent[]): void {
  switch (effect.kind) {
    case 'GOLD_DELTA':
      changeGold(run, effect.amount);
      break;
    case 'FOOD_DELTA':
      changeFood(run, effect.amount);
      break;
    case 'THREAT_DELTA': {
      const next = Math.max(0, run.threat + effect.amount); // AO-D055: never below 0
      if (next !== run.threat) events.push({ type: 'THREAT_CHANGED', threat: next, delta: next - run.threat });
      run.threat = next;
      break;
    }
    case 'UPKEEP_DAYS':
      payUpkeep(run, effect.days * dailyUpkeep(run), events);
      break;
    case 'MAX_MANA_DELTA':
      run.hero.maxMana = Math.max(MIN_HERO_MAX_MANA, run.hero.maxMana + effect.amount);
      run.hero.mana = Math.min(run.hero.maxMana, Math.max(0, run.hero.mana + effect.amount));
      break;
    case 'UNIT_GAIN':
      gainUnits(run, effect.unitId === 'chosen' ? pick.unitId! : effect.unitId, effect.count, events);
      break;
    case 'UNIT_GAIN_ALL_STACKS':
      run.army = run.army.map((s) => {
        if (s.count === 0) return s;
        const hp = effect.count * UNIT_DEFINITIONS[s.unitId].hpPerUnit;
        events.push({ type: 'UNITS_GAINED', unitId: s.unitId, count: effect.count });
        return { ...s, count: s.count + effect.count, currentHp: s.currentHp + hp, maxHp: s.maxHp + hp, startingCount: s.startingCount + effect.count, preBattleMaxCount: s.preBattleMaxCount + effect.count };
      });
      break;
    case 'UNIT_LOSS':
      loseUnits(run, effect, events);
      break;
    case 'REVIVE_LAST_CASUALTIES':
      reviveCasualties(run, effect.percent, events);
      break;
    case 'UPGRADE_CARD': {
      const idx = run.masterDeck.findIndex((c) => c.instanceId === pick.instanceId);
      const card = run.masterDeck[idx]!;
      run.masterDeck[idx] = { ...card, upgraded: true };
      events.push({ type: 'CARD_UPGRADED', instanceId: card.instanceId, cardId: card.cardId });
      break;
    }
    case 'REMOVE_CARD':
    case 'GIVE_CARD': {
      const idx = run.masterDeck.findIndex((c) => c.instanceId === pick.instanceId);
      const card = run.masterDeck[idx]!;
      run.masterDeck.splice(idx, 1);
      if (effect.kind === 'REMOVE_CARD') run.stats.cardsRemoved += 1;
      events.push({ type: 'CARD_REMOVED', instanceId: card.instanceId, cardId: card.cardId, goldPaid: 0 });
      break;
    }
    case 'GAIN_CARD': {
      const cardId = generateCardOptions(run.rng, 1)[0]!;
      run.masterDeck.push({ instanceId: newInstanceId(run.masterDeck, cardId, 'event'), cardId });
      events.push({ type: 'CARD_REWARD_CLAIMED', cardId });
      break;
    }
    case 'RELIC': {
      const relicId = typeof effect.source === 'string' ? pickRelicId(run.rng, effect.source, run.relics) : pickRelicByRarity(run.rng, effect.source, run.relics);
      if (relicId) {
        grantRelic(run, RELIC_DEFINITIONS[relicId]!, events);
      } else {
        changeGold(run, EVENT_TUNING.relicFallbackGold); // nothing left to find: consolation Gold
        tally.nothingLeft = true;
      }
      break;
    }
    case 'REVEAL_MAP': {
      const layer = findNode(run.worldMap, run.worldMap.currentNodeId)?.layer ?? 0;
      run.worldMap.revealedUntilStep = layer + effect.steps;
      break;
    }
  }
}

function executeEventOption(run: RunState, option: EventOption, pick: EventPick, events: RunEvent[]): EventTally {
  const tally: EventTally = { outcome: option.id, texts: [option.result], nothingLeft: false, ambush: false };
  const apply = (effects: EventEffect[]) => scaleEffects(effects, run.chapter).forEach((e) => applyEventEffect(run, e, pick, tally, events));
  apply(option.effects);

  const gamble = option.gamble;
  if (gamble) {
    const won = nextInt(run.rng, 100) < Math.round(gamble.successChance * 100);
    tally.texts.push(won ? gamble.successText : gamble.failureText);
    if (won) {
      apply(gamble.success);
      tally.outcome = gamble.successOutcome ?? `${option.id}_success`;
    } else if (gamble.failure === 'ambush') {
      tally.ambush = true; // AO-D056
      tally.outcome = gamble.failureOutcome ?? `${option.id}_ambush`;
    } else {
      apply(gamble.failure);
      tally.outcome = gamble.failureOutcome ?? `${option.id}_failure`;
    }
  }
  if (tally.nothingLeft) {
    tally.outcome = `${option.id}_nothing_left`;
    tally.texts.push(`Nothing was left to find; you take ${EVENT_TUNING.relicFallbackGold} Gold instead.`);
  }
  return tally;
}

function closeEvent(run: RunState, resolved: { optionId: string; outcome: string; text: string }, events: RunEvent[]): void {
  events.push({ type: 'EVENT_RESOLVED', eventId: run.pendingEvent!.eventId, ...resolved });
  run.stats.eventsResolved += 1;
  run.pendingEvent = null;
  run.phase = 'on_map';
}

/** AO-D056: a failed gamble starts a normal battle of the current chapter; the usual reward flow follows it. */
function startAmbush(run: RunState): void {
  const layer = findNode(run.worldMap, run.worldMap.currentNodeId)?.layer ?? 1;
  run.phase = 'in_battle';
  run.combat = startBattleForRun(run, generateBattleEncounter(layer, false, run.chapter, run.threat));
}

function concludeEventOption(run: RunState, option: EventOption, pick: EventPick, events: RunEvent[]): void {
  const tally = executeEventOption(run, option, pick, events);
  const resolved = { optionId: option.id, outcome: tally.outcome, text: tally.texts.filter(Boolean).join(' ') };
  run.pendingEvent!.choice = null;
  if (run.pendingUnitChoice) {
    run.pendingEvent!.resolved = resolved; // the event closes when the unit gain is settled
    return;
  }
  closeEvent(run, resolved, events);
  if (tally.ambush) startAmbush(run);
}

/** Closes an event whose option was applied earlier and only waited for a unit gain to settle. */
function closeEventIfSettled(run: RunState, events: RunEvent[]): void {
  const resolved = run.pendingEvent?.resolved;
  if (resolved && !run.pendingUnitChoice) closeEvent(run, resolved, events);
}

/** The waiting newcomer joins the army as soon as a slot is free (after a dismissal or a merge). */
function placePendingUnit(run: RunState, events: RunEvent[]): void {
  const pending = run.pendingUnitChoice;
  if (!pending) return;
  const updated = addUnitsToArmy(run.army, pending.newcomer.unitId, pending.newcomer.count);
  if (!updated) return;
  run.army = updated;
  run.pendingUnitChoice = null;
  events.push({ type: 'UNITS_GAINED', unitId: pending.newcomer.unitId, count: pending.newcomer.count });
  closeEventIfSettled(run, events);
}

function pendingOption(run: RunState, optionId: string): EventOption | undefined {
  return resolveEventOptions(run.pendingEvent!.eventId, run.chapter).find((o) => o.id === optionId);
}

function chooseEventOption(run: RunState, optionId: string, events: RunEvent[]): RunApplyResult {
  const pending = run.pendingEvent;
  if (run.phase !== 'event' || !pending) {
    reject(events, 'No event pending.');
    return { run, events };
  }
  if (pending.choice || pending.resolved) {
    reject(events, 'Finish the current choice first.');
    return { run, events };
  }
  const option = pendingOption(run, optionId);
  if (!option) {
    reject(events, 'Unknown event option.');
    return { run, events };
  }
  const availability = optionAvailability(run, option);
  if (!availability.available) {
    reject(events, availability.reason!);
    return { run, events };
  }

  const cardAction = optionCardAction(option);
  if (cardAction) {
    const instanceIds = cardAction === 'upgrade' ? upgradableCardIds(run) : run.masterDeck.map((c) => c.instanceId);
    pending.choice = { kind: 'card', optionId, action: cardAction, instanceIds };
  } else if (optionNeedsUnitChoice(option)) {
    const unitIds = shuffle(run.rng, Object.keys(RECRUIT_COSTS) as UnitId[]).slice(0, EVENT_TUNING.mercenary_camp.offers);
    pending.choice = { kind: 'unit', optionId, unitIds };
  } else {
    concludeEventOption(run, option, {}, events);
  }
  return { run, events };
}

function chooseEventCard(run: RunState, instanceId: string, events: RunEvent[]): RunApplyResult {
  const choice = run.pendingEvent?.choice;
  if (run.phase !== 'event' || choice?.kind !== 'card' || !choice.instanceIds.includes(instanceId)) {
    reject(events, 'That card is not one of the current options.');
    return { run, events };
  }
  concludeEventOption(run, pendingOption(run, choice.optionId)!, { instanceId }, events);
  return { run, events };
}

function chooseEventUnit(run: RunState, unitId: UnitId, events: RunEvent[]): RunApplyResult {
  const choice = run.pendingEvent?.choice;
  if (run.phase !== 'event' || choice?.kind !== 'unit' || !choice.unitIds.includes(unitId)) {
    reject(events, 'That unit is not on offer.');
    return { run, events };
  }
  concludeEventOption(run, pendingOption(run, choice.optionId)!, { unitId }, events);
  return { run, events };
}

function cancelEventChoice(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'event' || !run.pendingEvent?.choice) {
    reject(events, 'Nothing to cancel.');
    return { run, events };
  }
  run.pendingEvent.choice = null;
  return { run, events };
}

const DISMISS_PHASES: ReadonlySet<string> = new Set(['on_map', 'city', 'merchant', 'reward', 'event']);

/** AO-D054: release units outside battle. The waiting newcomer (if any) can be dismissed too; the last unit type can never go. */
function dismissStack(run: RunState, stackId: string, count: number | undefined, events: RunEvent[]): RunApplyResult {
  if (!DISMISS_PHASES.has(run.phase)) {
    reject(events, 'Units can only be dismissed outside battle.');
    return { run, events };
  }
  const newcomer = run.pendingUnitChoice?.newcomer;
  const isNewcomer = newcomer?.stackId === stackId;
  const target = isNewcomer ? newcomer : run.army.find((s) => s.stackId === stackId);
  if (!target || target.count <= 0) {
    reject(events, 'Unknown stack.');
    return { run, events };
  }
  const amount = count ?? target.count;
  if (!Number.isInteger(amount) || amount < 1 || amount > target.count) {
    reject(events, 'Invalid dismiss amount.');
    return { run, events };
  }
  const whole = amount === target.count;
  const others = [...run.army, ...(newcomer ? [newcomer] : [])].filter((s) => s.stackId !== stackId && s.count > 0);
  if (whole && others.length === 0) {
    reject(events, 'At least one unit type must remain in the army.');
    return { run, events };
  }

  events.push({ type: 'UNITS_DISMISSED', unitId: target.unitId, count: amount });
  if (isNewcomer) {
    run.pendingUnitChoice = whole ? null : { newcomer: removeUnits(target, amount) };
    closeEventIfSettled(run, events);
  } else {
    run.army = whole ? run.army.filter((s) => s.stackId !== stackId) : run.army.map((s) => (s.stackId === stackId ? removeUnits(s, amount) : s));
    placePendingUnit(run, events);
  }
  return { run, events };
}

function declineUnitGain(run: RunState, events: RunEvent[]): RunApplyResult {
  const pending = run.pendingUnitChoice;
  if (!pending) {
    reject(events, 'No unit gain is waiting.');
    return { run, events };
  }
  events.push({ type: 'UNIT_GAIN_DECLINED', unitId: pending.newcomer.unitId, count: pending.newcomer.count });
  run.pendingUnitChoice = null;
  closeEventIfSettled(run, events);
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
  changeGold(run, -offer.price);
  run.masterDeck.push({ instanceId: newInstanceId(run.masterDeck, cardId, 'shop'), cardId });
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
  changeGold(run, -offer.price);
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
  changeGold(run, -cost.gold);
  run.food -= cost.food;
  run.army = updatedArmy;
  run.stats.unitsRecruited += count;
  events.push({ type: 'UNITS_RECRUITED', unitId, count });
  return { run, events };
}

function splitStackAction(run: RunState, stackId: string, splitCount: number, events: RunEvent[]): RunApplyResult {
  const updatedArmy = splitArmyStack(run.army, stackId, splitCount);
  if (!updatedArmy) {
    reject(events, 'Cannot split that stack (invalid amount or army already has 6 stacks).');
    return { run, events };
  }
  // splitArmyStack derives the id from the free position, which can collide with a stack created there and later moved away.
  const created = updatedArmy[updatedArmy.length - 1]!;
  const taken = new Set(updatedArmy.slice(0, -1).map((s) => s.stackId));
  let uniqueId = created.stackId;
  for (let n = 2; taken.has(uniqueId); n++) uniqueId = `${created.stackId}_${n}`;
  run.army = updatedArmy.map((s) => (s === created ? { ...s, stackId: uniqueId } : s));
  return { run, events };
}

function moveStackAction(run: RunState, stackId: string, toPosition: Position, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'on_map' && run.phase !== 'city') {
    reject(events, 'Stacks can only be repositioned on the map or in the city.');
    return { run, events };
  }
  const stack = run.army.find((s) => s.stackId === stackId);
  if (!stack) {
    reject(events, 'Unknown stack.');
    return { run, events };
  }
  if (!Number.isInteger(toPosition) || toPosition < 1 || toPosition > 6) {
    reject(events, 'Position must be 1-6.');
    return { run, events };
  }
  if (stack.position === toPosition) return { run, events };
  const from = stack.position;
  // Ids stay stable: they are opaque and never re-derived from the position.
  run.army = run.army.map((s) => (s.stackId === stackId ? { ...s, position: toPosition } : s.position === toPosition ? { ...s, position: from } : s));
  return { run, events };
}

function mergeStacksAction(run: RunState, stackIdA: string, stackIdB: string, events: RunEvent[]): RunApplyResult {
  const updatedArmy = mergeArmyStacks(run.army, stackIdA, stackIdB);
  if (!updatedArmy) {
    reject(events, 'Cannot merge those stacks (must be the same unit type).');
    return { run, events };
  }
  run.army = updatedArmy;
  placePendingUnit(run, events);
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

  changeGold(run, -def.cost);
  run.city.buildings.push(buildingId);

  if (buildingId === 'training_hall') {
    run.hero.maxMana += 2;
    run.hero.mana += 2;
  }
  if (buildingId === 'mage_tower') {
    run.city.mageTowerTier = 1;
    run.hero.maxMana += MAGE_TOWER_TIERS[0]!.maxMana;
    run.hero.mana += MAGE_TOWER_TIERS[0]!.maxMana;
  }

  if (buildingId === 'farm') run.city.farmTier = 1;

  events.push({ type: 'BUILDING_BUILT', buildingId });
  return { run, events };
}

function upgradeFarm(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  const tier = run.city.farmTier;
  if (tier === 0) {
    reject(events, 'Build the Farm first.');
    return { run, events };
  }
  const next = FARM_TIERS[tier];
  if (!next) {
    reject(events, 'Farm is already at max tier.');
    return { run, events };
  }
  if (run.gold < next.cost) {
    reject(events, 'Not enough Gold.');
    return { run, events };
  }
  changeGold(run, -next.cost);
  run.city.farmTier = (tier + 1) as 2 | 3 | 4 | 5;
  events.push({ type: 'FARM_UPGRADED', tier: tier + 1 });
  return { run, events };
}

function upgradeMageTower(run: RunState, events: RunEvent[]): RunApplyResult {
  if (run.phase !== 'city') {
    reject(events, 'Not at the city.');
    return { run, events };
  }
  const tier = run.city.mageTowerTier;
  if (tier === 0) {
    reject(events, 'Build the Mage Tower first.');
    return { run, events };
  }
  const next = MAGE_TOWER_TIERS[tier];
  if (!next) {
    reject(events, 'Mage Tower is already at max tier.');
    return { run, events };
  }
  if (run.gold < next.cost) {
    reject(events, 'Not enough Gold.');
    return { run, events };
  }
  const gained = next.maxMana - MAGE_TOWER_TIERS[tier - 1]!.maxMana;
  changeGold(run, -next.cost);
  run.city.mageTowerTier = (tier + 1) as 2 | 3;
  run.hero.maxMana += gained;
  run.hero.mana += gained;
  events.push({ type: 'MAGE_TOWER_UPGRADED', tier: tier + 1 });
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
  changeGold(run, -cost);
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
  const working = migrateRun(cloneRun(run));
  // Wiped stacks (battle, starvation) are dropped so a later recruit/split can't reuse their stackId.
  working.army = working.army.filter((s) => s.count > 0);
  const events: RunEvent[] = [];

  let result: RunApplyResult;
  switch (action.type) {
    case 'MOVE_TO':
      result = moveTo(working, action.nodeId, events);
      break;
    case 'COMBAT_ACTION':
      result = forwardCombatAction(working, action.action, events);
      break;
    case 'CLAIM_CARD':
      result = claimCard(working, action.cardId, events);
      break;
    case 'CLAIM_UPGRADE':
      result = claimUpgrade(working, action.instanceId, events);
      break;
    case 'SKIP_REWARD':
      result = skipReward(working, events);
      break;
    case 'REMOVE_CARD':
      result = removeCard(working, action.instanceId, events);
      break;
    case 'CHOOSE_EVENT_OPTION':
      result = chooseEventOption(working, action.optionId, events);
      break;
    case 'CHOOSE_EVENT_CARD':
      result = chooseEventCard(working, action.instanceId, events);
      break;
    case 'CHOOSE_EVENT_UNIT':
      result = chooseEventUnit(working, action.unitId, events);
      break;
    case 'CANCEL_EVENT_CHOICE':
      result = cancelEventChoice(working, events);
      break;
    case 'DISMISS_STACK':
      result = dismissStack(working, action.stackId, action.count, events);
      break;
    case 'DECLINE_UNIT_GAIN':
      result = declineUnitGain(working, events);
      break;
    case 'BUY_CARD':
      result = buyCard(working, action.cardId, events);
      break;
    case 'CLAIM_RELIC':
      result = claimRelic(working, action.relicId, events);
      break;
    case 'BUY_RELIC':
      result = buyRelic(working, action.relicId, events);
      break;
    case 'LEAVE_MERCHANT':
      result = leaveMerchant(working, events);
      break;
    case 'TRAVEL_TO_CITY':
      result = travelToCity(working, events);
      break;
    case 'RECRUIT':
      result = recruit(working, action.unitId, action.count, events);
      break;
    case 'BUILD_BUILDING':
      result = buildBuilding(working, action.buildingId, events);
      break;
    case 'UPGRADE_MAGE_TOWER':
      result = upgradeMageTower(working, events);
      break;
    case 'UPGRADE_FARM':
      result = upgradeFarm(working, events);
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
    case 'MOVE_STACK':
      result = moveStackAction(working, action.stackId, action.toPosition, events);
      break;
  }

  noteLargestStack(result.run);
  result.run.log = [...result.run.log, ...result.events];
  return result;
}
