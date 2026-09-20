import { ARMOR_MAX, ATTACK_ADVANTAGE_PER_POINT, FEAR_MAX_PERCENT } from '../damage.js';
import type { StatusType } from '../types.js';

export interface StatusInfo {
  id: StatusType;
  name: string;
  /** Short effect line; `{n}` stands for the status amount on the stack. Numbers come from the combat constants. */
  effect: string;
  kind: 'buff' | 'debuff';
}

const attackPercentPerPoint = Math.round(ATTACK_ADVANTAGE_PER_POINT * 100);

export const STATUS_INFO: Record<StatusType, StatusInfo> = {
  strength: { id: 'strength', name: 'Strength', kind: 'buff', effect: `+{n} Attack (about +${attackPercentPerPoint}% damage per point above the target's Defense).` },
  armor: { id: 'armor', name: 'Armor', kind: 'buff', effect: `Counts as +{n} Defense against attacks (armor from all sources counts up to +${ARMOR_MAX}).` },
  taunt: { id: 'taunt', name: 'Taunt', kind: 'buff', effect: 'Enemies must target this stack.' },
  weak: { id: 'weak', name: 'Weak', kind: 'debuff', effect: 'Deals {n}% less damage.' },
  fear: { id: 'fear', name: 'Fear', kind: 'debuff', effect: `Deals {n}% less damage (max ${FEAR_MAX_PERCENT}%).` },
  freeze: { id: 'freeze', name: 'Freeze', kind: 'debuff', effect: 'Cannot act.' },
  poison: { id: 'poison', name: 'Poison', kind: 'debuff', effect: 'Takes {n} damage at the start of its turn.' },
  bleed: { id: 'bleed', name: 'Bleed', kind: 'debuff', effect: 'Takes {n} damage at the start of its turn.' },
  burn: { id: 'burn', name: 'Burn', kind: 'debuff', effect: 'Takes {n} damage at the start of its turn.' },
};

/** Effect line with the stack's actual amount filled in. */
export function statusEffectText(id: StatusType, amount: number): string {
  return STATUS_INFO[id].effect.replace(/{n}/g, String(amount));
}
