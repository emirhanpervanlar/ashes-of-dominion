import { CARD_DEFINITIONS, cardRequirement } from '../engine/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { useCardInfo } from './cardInfoContext.js';
import { cardVisual } from './cardVisuals.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';
import { manaCostTip } from './tipContent.js';

interface Props {
  cardId: string;
  upgraded?: boolean;
  /** Icon and polarity come from this card when it differs (a reward upgrade shows the upgraded card with the base card's art). */
  visualId?: string;
  /** Small gold label under the name ("Upgrade"). */
  tag?: string;
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
export function LargeCard({ cardId, upgraded, visualId, tag, price, disabled, onClick, inspectable = true, showRequirement = true, className }: Props) {
  const cardInfo = useCardInfo();
  const def = CARD_DEFINITIONS[cardId];
  if (!def) return null;
  const visual = cardVisual(visualId ?? cardId);
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
      <Tip tip={manaCostTip(def.manaCost)}>
        <div className="reward-card-cost">{def.manaCost}</div>
      </Tip>
      <div className="reward-card-icon">
        <Icon name={visual.icon} size={3} />
      </div>
      <div className={`reward-card-name${upgraded ? ' upgraded' : ''}`}>
        {def.name}
        {upgraded ? '+' : ''}
      </div>
      {tag && <div className="reward-card-tag">{tag}</div>}
      <div className="reward-card-desc">{CARD_DESCRIPTIONS[cardId] ?? cardId}</div>
      {requirement && (
        <div className="reward-card-req">
          <Icon name="ui_warn" />
          <span>{requirement}</span>
        </div>
      )}
      {price !== undefined && <div className="merchant-price">{price}g</div>}
    </div>
  );
}
