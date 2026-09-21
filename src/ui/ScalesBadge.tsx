import type { HeroCastStat } from '../engine/index.js';

const STAT_NAMES: Record<HeroCastStat, string> = { strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence' };

export function statName(stat: HeroCastStat): string {
  return STAT_NAMES[stat];
}

/** Small "Scales with <stat>" label of a hero-cast card (AO-D064): its damage grows with that hero stat. */
export function ScalesBadge({ stat }: { stat: HeroCastStat }) {
  return <div className="scales-badge">Scales with {STAT_NAMES[stat]}</div>;
}
