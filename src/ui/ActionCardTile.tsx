import type { CardPlayability } from '../engine/index.js';
import { useCardInfo } from './cardInfoContext.js';
import { cardView } from './cardView.js';
import { cardVisual } from './cardVisuals.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';
import type { TipContent } from './tipContent.js';

interface ActionCardTileProps {
  id: string;
  upgraded?: boolean;
  /** Copies in the deck or pile (deck viewer). */
  count?: number;
  /** Shown at full brightness and clickable when true. */
  affordable: boolean;
  pending?: boolean;
  /** A play condition is not met (AO-D040): shows the warning mark; the reason lives in `tip` and the info popup. */
  conditionBlocked?: boolean;
  playability?: CardPlayability;
  tip?: TipContent | null;
  onClick?: () => void;
}

/** Hand-size card: hand, deck and pile viewers, the card in flight. Right-click opens the card info popup. */
export function ActionCardTile({ id, upgraded, count, affordable, pending, conditionBlocked, playability, tip, onClick }: ActionCardTileProps) {
  const cardInfo = useCardInfo();
  const view = cardView(id, upgraded);
  if (!view) return null;
  const visual = cardVisual(id);
  const classes = ['action-card', `polarity-${visual.polarity}`];
  if (!affordable) classes.push('disabled');
  if (pending) classes.push('pending');

  return (
    <Tip tip={tip}>
      <div
        className={classes.join(' ')}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          cardInfo.open(id, { upgraded, playability });
        }}
      >
        <div className="action-card-cost">{view.manaCost}M</div>
        {conditionBlocked && (
          <span className="action-card-warn">
            <Icon name="ui_warn" />
          </span>
        )}
        {count !== undefined && <span className="action-card-count">×{count}</span>}
        <div className="action-card-icon">
          <Icon name={visual.icon} size={2} />
        </div>
        <div className={`action-card-name${view.upgraded ? ' upgraded' : ''}`}>{view.name}</div>
        <div className="action-card-desc">{view.description}</div>
      </div>
    </Tip>
  );
}
