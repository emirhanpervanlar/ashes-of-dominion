/**
 * Base cardId -> upgraded cardId. v3 §15 describes upgrades as modifying the same
 * card's state via CardDefinition.upgrade rather than swapping to a new card ID —
 * this id-swap map is the old (pre-v3) mechanism and is empty until the v3 upgrade
 * system (Phase 3 "Deck / Build") is implemented. Kept as a stub so rewards.ts's
 * generateUpgradeOptions has something to filter against without erroring.
 */
export const CARD_UPGRADES: Record<string, string> = {};
