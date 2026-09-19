import { CARD_DEFINITIONS } from '../data/cards.js';
import { shuffle } from '../rng.js';
import type { RngState } from '../rng.js';
import type { CardInstance, RelicDefinition } from '../types.js';
import { CARD_UPGRADES } from './cardUpgrades.js';
import { pickRelicId } from './relicSources.js';
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
 * Normal battles reward no relics (AO-D006); only an elite victory adds one relic offer (AO-D037).
 * Card/upgrade choices are capped at REWARD_OPTION_COUNT total, split between fresh cards and in-deck upgrades.
 * The relic is drawn last so a normal battle's rng stream is untouched.
 */
export function buildPendingReward(rng: RngState, owned: RelicDefinition[], masterDeck: CardInstance[], elite: boolean): PendingReward {
  const upgradeOptions = generateUpgradeOptions(rng, masterDeck, REWARD_OPTION_COUNT);
  const cardOptions = generateCardOptions(rng, REWARD_OPTION_COUNT - upgradeOptions.length);
  return {
    cardOptions,
    upgradeOptions,
    relicOffer: elite ? pickRelicId(rng, 'elite', owned) : null,
  };
}
