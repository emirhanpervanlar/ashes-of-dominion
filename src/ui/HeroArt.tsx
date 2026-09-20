import type { HeroId } from '../engine/index.js';
import { PixelSprite } from './pixel/PixelSprite.js';
import type { SpriteScale } from './pixel/PixelSprite.js';
import { HERO_SPRITES } from './pixel/sprites/heroes.js';

/** Hero bust: the plaque uses it at 1x (32px), the popup at 3x, hero setup at 2x. */
export function HeroArt({ heroId, size = 1 }: { heroId: HeroId; size?: SpriteScale }) {
  return <PixelSprite id={heroId} sprite={HERO_SPRITES[heroId]} scale={size} />;
}
