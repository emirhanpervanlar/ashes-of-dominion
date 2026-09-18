import type { UnitId } from '../engine/index.js';

/** Flavor-only glyphs for the octagon tokens — no real art assets in the MVP. */
export const UNIT_ICONS: Record<UnitId, string> = {
  swordsman: '⚔️',
  archer: '🏹',
  knight: '🛡️',
  priest: '✚',
  goblin: '👺',
  orc: '👹',
  shaman: '🪄',
  wolf: '🐺',
};
