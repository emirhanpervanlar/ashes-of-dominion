import type { CombatEvent } from '../types.js';

/** AO-D027: whole-run statistics shown on the defeat / victory screen. */
export interface RunStats {
  enemiesKilled: number;
  unitsLost: number;
  unitsRevived: number;
  unitsRecruited: number;
  /** HP damage the player's stacks dealt / took (overkill included, blocked damage excluded). */
  damageDealt: number;
  damageTaken: number;
  battlesWon: number;
  turnsPlayed: number;
  cardsPlayed: number;
  cardsRemoved: number;
  goldGathered: number;
  goldSpent: number;
  foodGathered: number;
  /** Food actually consumed by marching (starvation clamps at 0). */
  foodEaten: number;
  largestStack: number;
  daysElapsed: number;
  nodesVisited: number;
  /** Units that died of hunger (also counted in unitsLost). */
  unitsStarved: number;
  bossesDefeated: number;
  fortsTaken: number;
  eventsResolved: number;
  /** AO-D072 village choices. */
  villagesHelped: number;
  villagesRaided: number;
  /** AO-D076 mines captured (each pays Gold every day). */
  minesCaptured: number;
}

export function createRunStats(): RunStats {
  return {
    enemiesKilled: 0,
    unitsLost: 0,
    unitsRevived: 0,
    unitsRecruited: 0,
    damageDealt: 0,
    damageTaken: 0,
    battlesWon: 0,
    turnsPlayed: 0,
    cardsPlayed: 0,
    cardsRemoved: 0,
    goldGathered: 0,
    goldSpent: 0,
    foodGathered: 0,
    foodEaten: 0,
    largestStack: 0,
    daysElapsed: 0,
    nodesVisited: 0,
    unitsStarved: 0,
    bossesDefeated: 0,
    fortsTaken: 0,
    eventsResolved: 0,
    villagesHelped: 0,
    villagesRaided: 0,
    minesCaptured: 0,
  };
}

/** Folds one combat action's events into the run stats. `playerStackIds` tells which side a stack id belongs to. */
export function tallyCombatEvents(stats: RunStats, events: CombatEvent[], playerStackIds: ReadonlySet<string>): void {
  for (const e of events) {
    switch (e.type) {
      case 'STACK_ATTACKED':
        // Self-targeted attacks are damage-over-time ticks and count against their owner.
        if (playerStackIds.has(e.targetStackId)) stats.damageTaken += e.finalDamage;
        else stats.damageDealt += e.finalDamage;
        break;
      case 'UNITS_KILLED':
        if (playerStackIds.has(e.stackId)) stats.unitsLost += e.count;
        else stats.enemiesKilled += e.count;
        break;
      case 'CARD_PLAYED':
        stats.cardsPlayed += 1;
        break;
      case 'TURN_STARTED':
        if (e.side === 'player') stats.turnsPlayed += 1;
        break;
      default:
        break;
    }
  }
}
