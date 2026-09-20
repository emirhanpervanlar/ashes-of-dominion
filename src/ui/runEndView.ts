import type { RunState, RunSummary } from '../engine/run/index.js';
import type { IconName } from './pixel/icons.js';

export interface StatRow {
  id: string;
  label: string;
  value: number;
  icon: IconName;
}

export interface StatGroup {
  label: string;
  rows: StatRow[];
}

/** Which `runSummary` rows each engine-ordered group shows, with the icon of each; a row the engine does not send is left out. */
const ENGINE_GROUPS: { label: string; rows: Record<string, IconName> }[] = [
  {
    label: 'Battle',
    rows: { battlesWon: 'node_battle', elitesDefeated: 'node_elite', bossesDefeated: 'node_boss', enemiesKilled: 'fx_skull', damageDealt: 'damage', damageTaken: 'hp', turnsPlayed: 'ui_swap', cardsPlayed: 'deck' },
  },
  { label: 'Journey', rows: { chapter: 'crest', days: 'day', eventsResolved: 'node_event', threat: 'threat' } },
  { label: 'Economy', rows: { goldGathered: 'gold', foodGathered: 'food', foodEaten: 'food', relics: 'relic' } },
];

const ARMY_ENGINE_ROWS: Record<string, IconName> = { largestStack: 'role_tank', unitsLost: 'fx_skull', unitsStarved: 'food', unitsRevived: 'heal' };

/** Vertical stat groups (Battle / Journey / Economy / Army), one row per stat, built from the engine's summary and stats. */
export function statGroups(run: RunState, summary: RunSummary): StatGroup[] {
  const byId = new Map(summary.rows.map((r) => [r.id, r]));
  const pick = (rows: Record<string, IconName>): StatRow[] =>
    Object.entries(rows).flatMap(([id, icon]) => {
      const row = byId.get(id);
      return row ? [{ id, label: row.label, value: row.value, icon }] : [];
    });
  const unitsNow = run.army.reduce((sum, s) => sum + Math.max(0, s.count), 0);
  const [largest, lost, starved, revived] = ['largestStack', 'unitsLost', 'unitsStarved', 'unitsRevived'].map((id) => pick({ [id]: ARMY_ENGINE_ROWS[id]! }));
  const army: StatRow[] = [
    { id: 'unitsNow', label: 'Units in the army', value: unitsNow, icon: 'crest' },
    ...(largest ?? []),
    { id: 'unitsRecruited', label: 'Units recruited', value: run.stats.unitsRecruited, icon: 'bld_barracks' },
    ...(lost ?? []),
    ...(starved ?? []),
    ...(revived ?? []),
  ];
  return [...ENGINE_GROUPS.map((g) => ({ label: g.label, rows: pick(g.rows) })), { label: 'Army', rows: army }];
}

/** The three big numbers on top of the screen. */
export function highlights(summary: RunSummary): StatRow[] {
  const byId = new Map(summary.rows.map((r) => [r.id, r]));
  const wanted: [string, string, IconName][] = [
    ['days', 'Days survived', 'day'],
    ['largestStack', 'Largest stack', 'role_tank'],
    ['enemiesKilled', 'Enemies killed', 'fx_skull'],
  ];
  return wanted.flatMap(([id, label, icon]) => {
    const row = byId.get(id);
    return row ? [{ id, label, value: row.value, icon }] : [];
  });
}

/** Share of `a` in `a + b` as a whole percent for a two-part bar; both zero splits evenly (an empty comparison). */
export function ratioShare(a: number, b: number): number {
  const total = a + b;
  if (total <= 0) return 50;
  return Math.round((a / total) * 100);
}
