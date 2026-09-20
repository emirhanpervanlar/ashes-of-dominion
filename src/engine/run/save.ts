import { MAX_ARMY_STACKS } from '../army.js';
import { CARD_DEFINITIONS } from '../data/cards.js';
import { UNIT_DEFINITIONS } from '../data/units.js';
import { EVENT_DEFINITIONS } from './events.js';
import { CURRENT_SAVE_VERSION, migrateRun } from './runEngine.js';
import type { RunPhase, RunState } from './types.js';

const PHASES: ReadonlySet<string> = new Set<RunPhase>(['on_map', 'in_battle', 'reward', 'event', 'merchant', 'city', 'run_complete', 'defeat']);

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isWhole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isStr = (v: unknown): v is string => typeof v === 'string';
const hasKey = (table: object, key: unknown): boolean => isStr(key) && Object.prototype.hasOwnProperty.call(table, key);
const allOf = (v: unknown, test: (item: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.every(test);

function isStack(v: unknown): boolean {
  return (
    isRec(v) && isStr(v.stackId) && hasKey(UNIT_DEFINITIONS, v.unitId) && (v.side === 'player' || v.side === 'enemy') && isWhole(v.count) &&
    isNum(v.currentHp) && v.currentHp >= 0 && isNum(v.maxHp) && v.maxHp >= 0 && isWhole(v.startingCount) && isWhole(v.preBattleMaxCount) &&
    isWhole(v.position) && v.position >= 1 && v.position <= MAX_ARMY_STACKS && isNum(v.morale) && Array.isArray(v.statuses) && isRec(v.flags)
  );
}

function isCombat(v: unknown): boolean {
  return (
    isRec(v) && isRec(v.rng) && isNum(v.rng.seed) && isRec(v.hero) && allOf(v.playerArmy, isStack) && allOf(v.enemyArmy, isStack) &&
    Array.isArray(v.deck) && Array.isArray(v.hand) && Array.isArray(v.discard) && Array.isArray(v.exhausted) && Array.isArray(v.enemyIntents) &&
    Array.isArray(v.activeRelicEffects) && Array.isArray(v.log) && isWhole(v.turnNumber)
  );
}

const isGarrison = (v: unknown): boolean => isRec(v) && Object.entries(v).every(([unitId, count]) => hasKey(UNIT_DEFINITIONS, unitId) && isWhole(count));
const isCard = (v: unknown): v is Rec => isRec(v) && isStr(v.instanceId) && hasKey(CARD_DEFINITIONS, v.cardId);
const isRelic = (v: unknown): v is Rec => isRec(v) && isStr(v.id) && isStr(v.name) && Array.isArray(v.effects);
const isNode = (v: unknown): v is Rec => isRec(v) && isStr(v.id) && isStr(v.type) && isWhole(v.layer) && allOf(v.connectsTo, isStr);

function isHero(v: unknown): boolean {
  if (!isRec(v)) return false;
  const stats = v.stats;
  return isNum(v.hp) && isNum(v.maxHp) && isWhole(v.mana) && isWhole(v.maxMana) && isRec(stats) && Object.values(stats).length === 5 && Object.values(stats).every(isNum);
}

function isCity(v: unknown): boolean {
  return isRec(v) && [1, 2, 3].includes(v.level as number) && allOf(v.buildings, isStr) && (v.doctrine === null || isStr(v.doctrine)) && isWhole(v.mageTowerTier) && v.mageTowerTier <= 3 && isWhole(v.farmTier) && v.farmTier <= 5 && isWhole(v.barracksTier) && v.barracksTier <= 4;
}

function isReward(v: unknown): boolean {
  return (
    isRec(v) && allOf(v.cardOptions, isStr) && Array.isArray(v.upgradeOptions) && v.upgradeOptions.every((o) => isRec(o) && isStr(o.instanceId) && isStr(o.cardId)) &&
    (v.relicGained === null || isStr(v.relicGained)) && allOf(v.relicChoices, isStr)
  );
}

function isMerchant(v: unknown): boolean {
  return isRec(v) && Array.isArray(v.cardOffers) && v.cardOffers.every((o) => isRec(o) && hasKey(CARD_DEFINITIONS, o.cardId) && isWhole(o.price)) && (v.relicOffer === null || (isRec(v.relicOffer) && isStr(v.relicOffer.relicId) && isWhole(v.relicOffer.price)));
}

function isEvent(v: unknown): boolean {
  return isRec(v) && hasKey(EVENT_DEFINITIONS, v.eventId) && (v.choice === null || isRec(v.choice)) && (v.resolved === null || isRec(v.resolved));
}

/** True when the object has the current RunState shape well enough that the reducer, the UI and the summary can read it without crashing. */
function isCurrentRun(r: Rec): boolean {
  if (!PHASES.has(r.phase as string) || !isRec(r.rng) || !isNum(r.rng.seed) || !isNum(r.seed)) return false;
  const counters = [r.gold, r.food, r.day, r.battlesWon, r.chapter, r.threat, r.cityVisitsThisChapter, r.foodPurchases, r.starvationDays];
  if (!counters.every(isWhole) || (r.chapter as number) < 1 || (r.day as number) < 1) return false;
  if (!isHero(r.hero) || !allOf(r.army, isStack) || (r.army as unknown[]).length > MAX_ARMY_STACKS) return false;
  if (!allOf(r.masterDeck, isCard) || !allOf(r.relics, isRelic) || !isCity(r.city) || !isGarrison(r.garrison)) return false;
  if (!isRec(r.stats) || !Object.values(r.stats).every(isNum) || !isRec(r.cardRemoval) || !isWhole(r.cardRemoval.merchantUses) || !isWhole(r.cardRemoval.cityUses)) return false;
  if (!Array.isArray(r.log) || !allOf(r.seenEventIds, isStr) || !Array.isArray(r.lastCasualties) || typeof r.bossBattle !== 'boolean') return false;
  const map = r.worldMap;
  if (!isRec(map) || !allOf(map.nodes, isNode) || (map.nodes as Rec[]).length === 0 || !(map.nodes as Rec[]).some((n) => n.id === map.currentNodeId)) return false;
  const ids = new Set((map.nodes as Rec[]).map((n) => n.id));
  if (!(map.nodes as Rec[]).every((n) => (n.connectsTo as string[]).every((id) => ids.has(id)))) return false;
  if (r.pendingUnitChoice !== null && !(isRec(r.pendingUnitChoice) && isStack(r.pendingUnitChoice.newcomer))) return false;
  if (r.combat !== null && !isCombat(r.combat)) return false;
  if (r.pendingReward !== null && !isReward(r.pendingReward)) return false;
  if (r.pendingMerchant !== null && !isMerchant(r.pendingMerchant)) return false;
  if (r.pendingEvent !== null && !isEvent(r.pendingEvent)) return false;
  // The screen a phase shows must have the data it renders.
  return (
    (r.phase !== 'in_battle' || r.combat !== null) && (r.phase !== 'reward' || r.pendingReward !== null) &&
    (r.phase !== 'merchant' || r.pendingMerchant !== null) && (r.phase !== 'event' || r.pendingEvent !== null)
  );
}

/**
 * The gate for anything read from storage: returns the run migrated to the current format, or null when the value is not a usable run
 * (not an object, damaged or partial, or written by a newer build). The caller falls back to "no save" instead of crashing.
 */
export function validateSave(value: unknown): RunState | null {
  if (!isRec(value)) return null;
  const version = value.saveVersion === undefined ? 1 : value.saveVersion;
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > CURRENT_SAVE_VERSION) return null;
  try {
    const run = migrateRun(value as unknown as RunState);
    return isCurrentRun(run as unknown as Rec) ? run : null;
  } catch {
    return null; // a legacy object too damaged for the migration to read
  }
}
