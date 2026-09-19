import { ICONS } from './pixel/icons.js';
import type { IconName } from './pixel/icons.js';

/** Relic art is named `rel_<relicId>`; the generic chalice only shows for an id that has no art yet (the icon test forbids that). */
export function relicIcon(relicId: string): IconName {
  const name = `rel_${relicId}`;
  return name in ICONS ? (name as IconName) : 'relic';
}
