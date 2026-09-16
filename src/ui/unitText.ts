import type { UnitId } from '../engine/index.js';

/** Short flavor line per unit — UI-only, no engine meaning. */
export const UNIT_DESCRIPTIONS: Record<UnitId, string> = {
  swordsman: 'Disciplined frontline infantry.',
  archer: 'Ranged skirmisher, weak in melee.',
  knight: 'Heavily armored shock infantry.',
  priest: 'Battlefield healer and support.',
  mage: 'Fragile but hard-hitting spellcaster.',
  cavalier: 'Fast cavalry — the only unit that can Charge.',
  skeleton: 'Expendable undead, raised from the fallen.',
  goblin: 'Cheap, disposable raider.',
  orc: 'Brutal frontline raider.',
  shaman: 'Buffs its allies from the back line.',
  wolf: 'Fast beast that hunts the back line.',
  warlord: 'A dread warlord who grows stronger against large armies.',
};
