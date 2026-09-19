import { cardVisual } from './cardVisuals.js';

interface ActionCardTileProps {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  affordable: boolean;
  pending: boolean;
  footer?: string;
  onClick: () => void;
}

export function ActionCardTile({ id, name, description, manaCost, affordable, pending, footer, onClick }: ActionCardTileProps) {
  const visual = cardVisual(id);
  const classes = ['action-card', `polarity-${visual.polarity}`];
  if (!affordable) classes.push('disabled');
  if (pending) classes.push('pending');

  return (
    <div className={classes.join(' ')} onClick={affordable ? onClick : undefined} title={description}>
      <div className="action-card-cost">{manaCost}M</div>
      <div className="action-card-icon">{visual.icon}</div>
      <div className="action-card-name">{name}</div>
      <div className="action-card-desc">{description}</div>
      {footer && <div className="action-card-footer">{footer}</div>}
    </div>
  );
}
