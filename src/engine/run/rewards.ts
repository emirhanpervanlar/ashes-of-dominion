import { CARD_DEFINITIONS } from '../data/cards.js';
import { shuffle } from '../rng.js';
import type { RngState } from '../rng.js';
import type { CardInstance, RelicDefinition } from '../types.js';
import { isUpgradable } from '../cardUpgrades.js';
import { pickBossRelicChoices, pickRelicId } from './relicSources.js';
import type { PendingReward } from './types.js';

/** Total number of new-card + upgrade choices shown on the post-battle reward screen. */
const REWARD_OPTION_COUNT = 3;

/** One of the three choices is an upgrade of a random deck card; the other two stay new cards (AO-D006: a Slay-the-Spire style screen). */
const REWARD_UPGRADE_COUNT = 1;

/** Every card in the pool can be offered as a fresh reward (always its base version; "+" only comes from upgrading). */
const REWARDABLE_CARD_IDS = Object.keys(CARD_DEFINITIONS);

export function generateCardOptions(rng: RngState, count: number): string[] {
  return shuffle(rng, REWARDABLE_CARD_IDS).slice(0, Math.max(0, count));
}

export function generateUpgradeOptions(rng: RngState, masterDeck: CardInstance[], count: number): { instanceId: string; cardId: string }[] {
  const upgradable = masterDeck.filter(isUpgradable).map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }));
  return shuffle(rng, upgradable).slice(0, Math.max(0, count));
}

/**
 * Normal battles reward no relics (AO-D006); only an elite victory adds one relic offer (AO-D037).
 * Card/upgrade choices are capped at REWARD_OPTION_COUNT total, split between fresh cards and in-deck upgrades.
 * The relic is drawn last so a normal battle's rng stream is untouched.
 */
export function buildPendingReward(rng: RngState, owned: RelicDefinition[], masterDeck: CardInstance[], elite: boolean, bossRelicChoices = false): PendingReward {
  const upgradeOptions = generateUpgradeOptions(rng, masterDeck, REWARD_UPGRADE_COUNT);
  const cardOptions = generateCardOptions(rng, REWARD_OPTION_COUNT - upgradeOptions.length);
  return {
    cardOptions,
    upgradeOptions,
    relicOffer: elite ? pickRelicId(rng, 'elite', owned) : null,
    relicChoices: bossRelicChoices ? pickBossRelicChoices(rng, owned) : [],
  };
}
