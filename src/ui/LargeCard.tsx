import { cardRequirement } from '../engine/index.js';
import { useCardInfo } from './cardInfoContext.js';
import { cardView } from './cardView.js';
import { cardVisual } from './cardVisuals.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';
import { manaCostTip } from './tipContent.js';

interface Props {
  cardId: string;
  upgraded?: boolean;
  /** An upgrade offer: the "+" card is shown with a line under the text saying what the card does now. */
  showBase?: boolean;
  /** Small gold label under the name ("Upgrade"). */
  tag?: string;
  /** Copies behind this card (a picker groups duplicates): shows an "x3" chip. */
  count?: number;
  /** Merchant price plate. */
  price?: number;
  disabled?: boolean;
  onClick?: () => void;
  /** Right-click opens the card info popup (default). The popup's own card turns this off. */
  inspectable?: boolean;
  /** The condition line ("Needs a living Knight") under the text; the info popup shows it in its own block instead. */
  showRequirement?: boolean;
  className?: string;
}

/** The large card (reward, merchant, removal picker, info popup): cost gem with its tooltip, art, name, rules text, condition. */
export function LargeCard({ cardId, upgraded, showBase, tag, count, price, disabled, onClick, inspectable = true, showRequirement = true, className }: Props) {
  const cardInfo = useCardInfo();
  const view = cardView(cardId, upgraded);
  if (!view) return null;
  const base = showBase && view.upgraded ? cardView(cardId) : undefined;
  const visual = cardVisual(cardId);
  const requirement = showRequirement ? cardRequirement(cardId) : null;
  const classes = ['reward-card', `polarity-${visual.polarity}`, className, disabled && 'disabled'].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onClick={disabled ? undefined : onClick}
      onContextMenu={
        inspectable
          ? (e) => {
              e.preventDefault();
              cardInfo.open(cardId, { upgraded });
            }
          : undefined
      }
    >
      <Tip tip={manaCostTip(view.manaCost)}>
        <div className="reward-card-cost">{view.manaCost}</div>
      </Tip>
      <div className="reward-card-icon">
        <Icon name={visual.icon} size={3} />
      </div>
      <div className={`reward-card-name${view.upgraded ? ' upgraded' : ''}`}>{view.name}</div>
      {tag && <div className="reward-card-tag">{tag}</div>}
      <div className="reward-card-desc">{view.description}</div>
      {base && (
        <div className="reward-card-was">
          Now{base.manaCost !== view.manaCost ? ` (${base.manaCost} Mana)` : ''}: {base.description}
        </div>
      )}
      {requirement && (
        <div className="reward-card-req">
          <Icon name="ui_warn" />
          <span>{requirement}</span>
        </div>
      )}
      {count !== undefined && count > 1 && <span className="action-card-count">×{count}</span>}
      {price !== undefined && <div className="merchant-price">{price}g</div>}
    </div>
  );
}
