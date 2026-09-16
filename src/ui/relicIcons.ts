/** Flavor-only glyphs for relics — no real art assets in the MVP. */
export const RELIC_ICONS: Record<string, string> = {
  royal_banner: '🚩',
  arcane_crystal: '🔮',
  kings_crown: '👑',
  blood_banner: '🩸',
  cursed_crown: '💀',
  hawks_eye: '🦅',
  crown_of_champions: '🏆',
  banner_of_the_horde: '🐗',
  bulwark_standard: '🛡️',
  grave_crown: '⚰️',
};

export function relicIcon(relicId: string): string {
  return RELIC_ICONS[relicId] ?? '★';
}
