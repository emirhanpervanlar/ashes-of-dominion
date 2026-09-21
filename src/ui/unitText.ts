import type { UnitId } from '../engine/index.js';

/** Short flavor line per unit — UI-only, no engine meaning. */
export const UNIT_DESCRIPTIONS: Record<UnitId, string> = {
  swordsman: 'Frontline anchor. Adjacent frontline allies gain +10% Defense.',
  archer: 'Ranged skirmisher. +25% Attack while in the backline.',
  knight: 'Elite melee. Absorbs ~25% of the damage aimed at adjacent allies.',
  priest: 'Support healer. Healing and support effects +10%.',
  skeleton: 'Raised from your fallen by the Necromantic Doctrine. Weak, needs no Food and cannot be recruited.',
  goblin: 'Cheap raider. Adjacent Goblins deal +10% damage.',
  orc: 'Brutal frontline raider. +20% damage vs targets below 50% count.',
  shaman: 'Gives the weakest allied stack +4 Strength at the start of each enemy turn.',
  wolf: 'Fast beast. +25% damage against backline targets.',
};
