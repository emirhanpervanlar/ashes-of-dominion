import { CARD_DEFINITIONS } from '../data/cards.js';
import { shuffle } from '../rng.js';
import type { RngState } from '../rng.js';
import type { CardInstance, RelicDefinition } from '../types.js';
import { CARD_UPGRADES } from './cardUpgrades.js';
import type { PendingReward } from './types.js';

/** Total number of new-card + upgrade choices shown on the post-battle reward screen. */
const REWARD_OPTION_COUNT = 3;

/** Base (non-upgraded) cards are the only ones offered as fresh rewards — "+" variants only come from upgrading. */
const REWARDABLE_CARD_IDS = Object.keys(CARD_DEFINITIONS).filter((id) => !id.endsWith('_plus'));

export function generateCardOptions(rng: RngState, count: number): string[] {
  return shuffle(rng, REWARDABLE_CARD_IDS).slice(0, Math.max(0, count));
}

export function generateUpgradeOptions(
  rng: RngState,
  masterDeck: CardInstance[],
  count: number
): { instanceId: string; cardId: string; upgradedCardId: string }[] {
  const upgradable = masterDeck
    .filter((c) => CARD_UPGRADES[c.cardId])
    .map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, upgradedCardId: CARD_UPGRADES[c.cardId]! }));
  return shuffle(rng, upgradable).slice(0, Math.max(0, count));
}

/**
 * Reward relics were removed (v3 balance pass) — relics now only come from the run's
 * starting pick and merchant purchases. Card/upgrade choices are capped at
 * REWARD_OPTION_COUNT total, split between fresh cards and in-deck upgrades.
 */
export function buildPendingReward(rng: RngState, _owned: RelicDefinition[], masterDeck: CardInstance[]): PendingReward {
  const upgradeOptions = generateUpgradeOptions(rng, masterDeck, REWARD_OPTION_COUNT);
  const cardOptions = generateCardOptions(rng, REWARD_OPTION_COUNT - upgradeOptions.length);
  return {
    relicOptions: [],
    cardOptions,
    upgradeOptions,
    chosenRelicId: null,
    chosenCardId: null,
    chosenUpgradeInstanceId: null,
  };
}
