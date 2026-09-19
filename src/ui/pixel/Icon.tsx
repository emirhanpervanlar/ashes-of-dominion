import { ICONS } from './icons.js';
import type { IconName } from './icons.js';
import { gridToUrl } from './render.js';

export type IconScale = 1 | 2 | 3 | 4;

interface IconProps {
  name: IconName;
  /** Integer scale of the 16x16 grid: 1 = 16px, 2 = 32px, 3 = 48px, 4 = 64px. */
  size?: IconScale;
  className?: string;
}

export function Icon({ name, size = 1, className }: IconProps) {
  const px = 16 * size;
  return (
    <img
      className={className ? `px-icon ${className}` : 'px-icon'}
      src={gridToUrl(`icon:${name}`, ICONS[name])}
      width={px}
      height={px}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
