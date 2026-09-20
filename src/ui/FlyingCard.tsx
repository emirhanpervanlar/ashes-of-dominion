import type { CSSProperties } from 'react';
import { ActionCardTile } from './ActionCardTile.js';

export interface FlyingCardState {
  cardId: string;
  upgraded?: boolean;
  /** Viewport rect of the hand slot the card left, and the viewport point it travels to. */
  from: { left: number; top: number; width: number; height: number };
  to: { x: number; y: number };
}

/** Fixed-position layer so the played card is never clipped by the hand bar's overflow. */
export function FlyingCard({ card }: { card: FlyingCardState }) {
  const style = {
    left: card.from.left,
    top: card.from.top,
    width: card.from.width,
    height: card.from.height,
    '--fly-dx': `${card.to.x - (card.from.left + card.from.width / 2)}px`,
    '--fly-dy': `${card.to.y - (card.from.top + card.from.height / 2)}px`,
  } as CSSProperties;
  return (
    <div className="flying-card" style={style}>
      <ActionCardTile id={card.cardId} upgraded={card.upgraded} affordable />
    </div>
  );
}
