import type { RunState } from './types.js';

/** AO-D046: a boss every 30 days, the run is won after the 3rd boss (day 90). */
export const DAYS_PER_CHAPTER = 30;
export const TOTAL_CHAPTERS = 3;
/** AO-D046: the "Boss in N days" warning shows from day 23, i.e. when 7 days or fewer remain. */
export const BOSS_WARNING_DAYS = 7;
/** AO-D049: no Elite Battle in the first 5 steps of the run. */
export const ELITE_FREE_STEPS = 5;

/** AO-D047 defaults (tuned later by qa-playtest); a city visit costs no days (AO-D051). */
export const THREAT_PER_CITY_VISIT = 1;
export const THREAT_ENEMY_COUNT_PER_POINT = 0.06;

/** Encounter difficulty depth: one step deeper every N map layers, plus a flat bonus per chapter after the first. */
export const LAYERS_PER_DEPTH = 4;
export const CHAPTER_DEPTH_BONUS = 4;
/** Boss formation size multiplier by chapter (index 0 = chapter 1). */
export const BOSS_CHAPTER_MULTIPLIER: readonly number[] = [1, 1.6, 2.4];

export function bossDay(chapter: number): number {
  return chapter * DAYS_PER_CHAPTER;
}

export function daysUntilBoss(run: Pick<RunState, 'chapter' | 'day'>): number {
  return Math.max(0, bossDay(run.chapter) - run.day);
}

export function bossWarning(run: Pick<RunState, 'chapter' | 'day'>): boolean {
  return daysUntilBoss(run) <= BOSS_WARNING_DAYS;
}

/** Enemy unit counts grow with Threat (AO-D047): x(1 + 0.06 x Threat). */
export function threatMultiplier(threat: number): number {
  return 1 + THREAT_ENEMY_COUNT_PER_POINT * threat;
}

/** Enemy strength multiplier after `visits` more city visits than the run has made so far (0 = the current strength). */
export function enemyStrengthAfterCityVisits(run: Pick<RunState, 'threat'>, visits = 0): number {
  return threatMultiplier(run.threat + visits * THREAT_PER_CITY_VISIT);
}

/** AO-D051: shown before travelling to the city; the UI adds the numbers from enemyStrengthAfterCityVisits. */
export const CITY_VISIT_WARNING = 'Every visit to the city makes enemies stronger for the rest of the run.';
