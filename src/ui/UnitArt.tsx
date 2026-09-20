import type { UnitId } from '../engine/index.js';
import { PixelSprite } from './pixel/PixelSprite.js';
import type { SpriteScale } from './pixel/PixelSprite.js';
import type { Team } from './pixel/sprite.js';
import { UNIT_SPRITES } from './pixel/sprites/units.js';

interface UnitArtProps {
  unitId: UnitId;
  /** Integer scale of the 32x32 sprite: 2 = 64px is the battle tile and army slot size. */
  size?: SpriteScale;
  /** Enemy sprites are cold-tinted and face the player. */
  team?: Team;
  /** Any stable string (a stack id): neighbouring stacks then idle out of step. */
  seed?: string;
}

/** The single place that draws a unit's picture. */
export function UnitArt({ unitId, size = 2, team = 'player', seed }: UnitArtProps) {
  return <PixelSprite id={unitId} sprite={UNIT_SPRITES[unitId]} scale={size} team={team} mirror={team === 'enemy'} phase={seed ? [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) : 0} />;
}
