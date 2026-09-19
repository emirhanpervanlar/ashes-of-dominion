import type { UnitId } from '../engine/index.js';
import { Icon } from './pixel/Icon.js';
import type { IconScale } from './pixel/Icon.js';
import { UNIT_ICONS } from './unitIcons.js';

/** The single place that draws a unit's picture. DL-10 replaces the icon with the 32x32 sprite here. */
export function UnitArt({ unitId, size = 3 }: { unitId: UnitId; size?: IconScale }) {
  return <Icon name={UNIT_ICONS[unitId]} size={size} />;
}
