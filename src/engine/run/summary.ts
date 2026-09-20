import type { RunState } from './types.js';

export type CauseOfDeath = 'army_wiped' | 'hero_fell' | 'starvation';

export interface RunSummaryRow {
  id: string;
  label: string;
  value: number;
}

export interface RunSummary {
  /** Null unless the run ended in defeat. */
  causeOfDeath: CauseOfDeath | null;
  causeLabel: string | null;
  /** Ordered for display (AO-D027). */
  rows: RunSummaryRow[];
  /** Names of the relics the run collected, starting relic first. */
  relics: string[];
}

const CAUSE_LABELS: Record<CauseOfDeath, string> = {
  army_wiped: 'Your army was wiped out',
  hero_fell: 'Your hero fell',
  starvation: 'Your starving army broke',
};

/** A lost battle is blamed on hunger only while the army is starving and the hero still stood. */
export function causeOfDeath(run: RunState): CauseOfDeath | null {
  if (run.phase !== 'defeat') return null;
  if (run.hero.hp <= 0) return 'hero_fell';
  return run.starvationDays > 0 ? 'starvation' : 'army_wiped';
}

/** Whole-run statistics for the Defeat and Victory screens (AO-D027). */
export function runSummary(run: RunState): RunSummary {
  const s = run.stats;
  const cause = causeOfDeath(run);
  const rows: RunSummaryRow[] = [
    { id: 'chapter', label: 'Chapter reached', value: run.chapter },
    { id: 'days', label: 'Days elapsed', value: s.daysElapsed },
    { id: 'battlesWon', label: 'Battles won', value: s.battlesWon },
    { id: 'bossesDefeated', label: 'Bosses defeated', value: s.bossesDefeated },
    { id: 'elitesDefeated', label: 'Elites defeated', value: s.elitesDefeated },
    { id: 'eventsResolved', label: 'Events resolved', value: s.eventsResolved },
    { id: 'enemiesKilled', label: 'Enemies killed', value: s.enemiesKilled },
    { id: 'unitsLost', label: 'Units lost', value: s.unitsLost },
    { id: 'unitsStarved', label: 'Units starved', value: s.unitsStarved },
    { id: 'unitsRevived', label: 'Units revived', value: s.unitsRevived },
    { id: 'largestStack', label: 'Largest stack', value: s.largestStack },
    { id: 'damageDealt', label: 'Damage dealt', value: s.damageDealt },
    { id: 'damageTaken', label: 'Damage taken', value: s.damageTaken },
    { id: 'turnsPlayed', label: 'Turns played', value: s.turnsPlayed },
    { id: 'cardsPlayed', label: 'Cards played', value: s.cardsPlayed },
    { id: 'goldGathered', label: 'Gold gathered', value: s.goldGathered },
    { id: 'foodGathered', label: 'Food gathered', value: s.foodGathered },
    { id: 'foodEaten', label: 'Food eaten', value: s.foodEaten },
    { id: 'relics', label: 'Relics collected', value: run.relics.length },
    { id: 'threat', label: 'Threat', value: run.threat },
  ];
  return { causeOfDeath: cause, causeLabel: cause && CAUSE_LABELS[cause], rows, relics: run.relics.map((r) => r.name) };
}
