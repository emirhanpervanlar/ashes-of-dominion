import { SPRITE_SIZE, spriteStripUrl } from './sprite.js';
import type { Sprite, Team } from './sprite.js';

export type SpriteScale = 1 | 2 | 3 | 4;

interface PixelSpriteProps {
  /** Cache key, unique per sprite (unit id or hero id). */
  id: string;
  sprite: Sprite;
  /** Integer scale of the 32x32 grid: 1 = 32px ... 4 = 128px. */
  scale?: SpriteScale;
  team?: Team;
  /** Enemies face the player, so their pictures are mirrored. */
  mirror?: boolean;
  /** Offsets the idle loop so neighbouring stacks do not bob in lockstep. */
  phase?: number;
  className?: string;
}

/** One sprite as a background strip whose two idle frames are stepped by CSS (.px-sprite). */
export function PixelSprite({ id, sprite, scale = 2, team = 'player', mirror = false, phase = 0, className }: PixelSpriteProps) {
  const px = SPRITE_SIZE * scale;
  const classes = ['px-sprite'];
  if (mirror) classes.push('mirrored');
  if (className) classes.push(className);
  return (
    <span
      className={classes.join(' ')}
      aria-hidden="true"
      style={{
        width: px,
        height: px,
        backgroundImage: `url(${spriteStripUrl(id, sprite, team)})`,
        backgroundSize: `${px * sprite.frames.length}px ${px}px`,
        ['--sprite-step' as string]: `-${px}px`,
        animationDelay: `-${(phase % 4) * 250}ms`,
      }}
    />
  );
}
