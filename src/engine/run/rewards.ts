import { CARD_DEFINITIONS } from '../data/cards.js';
import { RELIC_DEFINITIONS } from '../data/relics.js';
import { shuffle } from '../rng.js';
import type { RngState } from '../rng.js';
import type { CardInstance, RelicDefinition } from '../types.js';
import { CARD_UPGRADES } from './cardUpgrades.js';
import type { PendingReward } from './types.js';

/** Base (non-upgraded) cards are the only ones offered as fresh rewards — "+" variants only come from upgrading. */
const REWARDABLE_CARD_IDS = Object.keys(CARD_DEFINITIONS).filter((id) => !id.endsWith('_plus'));

export function generateCardOptions(rng: RngState, count = 3): string[] {
  return shuffle(rng, REWARDABLE_CARD_IDS).slice(0, count);
}

export function generateRelicOptions(rng: RngState, owned: RelicDefinition[], count = 2): string[] {
  const ownedIds = new Set(owned.map((r) => r.id));
  const available = Object.keys(RELIC_DEFINITIONS).filter((id) => !ownedIds.has(id));
  return shuffle(rng, available).slice(0, count);
}

export function generateUpgradeOptions(
  masterDeck: CardInstance[]
): { instanceId: string; cardId: string; upgradedCardId: string }[] {
  return masterDeck
    .filter((c) => CARD_UPGRADES[c.cardId])
    .map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, upgradedCardId: CARD_UPGRADES[c.cardId]! }));
}

export function buildPendingReward(rng: RngState, owned: RelicDefinition[], masterDeck: CardInstance[]): PendingReward {
  return {
    relicOptions: generateRelicOptions(rng, owned),
    cardOptions: generateCardOptions(rng),
    upgradeOptions: generateUpgradeOptions(masterDeck),
    chosenRelicId: null,
    chosenCardId: null,
    chosenUpgradeInstanceId: null,
  };
}
