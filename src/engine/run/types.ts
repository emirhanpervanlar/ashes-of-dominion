import type { RngState } from '../rng.js';
import type { ArmyStack, CardInstance, CombatState, Hero, PlayerAction, RelicDefinition } from '../types.js';

export type RunPhase = 'choosing_starting_relic' | 'in_battle' | 'reward' | 'run_complete' | 'defeat';

export interface PendingReward {
  relicOptions: string[];
  cardOptions: string[];
  upgradeOptions: { instanceId: string; cardId: string; upgradedCardId: string }[];
  chosenRelicId: string | null;
  chosenCardId: string | null;
  chosenUpgradeInstanceId: string | null;
}

export type RunEvent =
  | { type: 'RUN_STARTED' }
  | { type: 'STARTING_RELIC_CHOSEN'; relicId: string }
  | { type: 'BATTLE_WON' }
  | { type: 'BATTLE_LOST' }
  | { type: 'RELIC_CLAIMED'; relicId: string }
  | { type: 'CARD_REWARD_CLAIMED'; cardId: string }
  | { type: 'CARD_UPGRADED'; instanceId: string; fromCardId: string; toCardId: string }
  | { type: 'REWARD_SKIPPED' }
  | { type: 'RUN_COMPLETE' }
  | { type: 'ACTION_REJECTED'; reason: string };

export interface RunState {
  seed: number;
  rng: RngState;
  hero: Hero;
  /** Authoritative army (with persistent casualties) between battles; combat.playerArmy is authoritative during a battle. */
  army: ArmyStack[];
  /** All owned cards — the pool combat decks are built from at the start of each battle. */
  masterDeck: CardInstance[];
  relics: RelicDefinition[];
  battlesWon: number;
  phase: RunPhase;
  combat: CombatState | null;
  pendingReward: PendingReward | null;
  log: RunEvent[];
}

export type RunAction =
  | { type: 'CHOOSE_STARTING_RELIC'; relicId: string }
  | { type: 'COMBAT_ACTION'; action: PlayerAction }
  | { type: 'CLAIM_RELIC'; relicId: string }
  | { type: 'CLAIM_CARD'; cardId: string }
  | { type: 'CLAIM_UPGRADE'; instanceId: string }
  | { type: 'CONFIRM_REWARD' };

export interface RunApplyResult {
  run: RunState;
  events: RunEvent[];
}
