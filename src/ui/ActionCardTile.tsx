import { cardVisual } from './cardVisuals.js';
import type { CardCostType } from '../engine/index.js';

interface ActionCardTileProps {
  id: string;
  name: string;
  description: string;
  cost: { type: CardCostType; amount: number };
  affordable: boolean;
  pending: boolean;
  footer?: string;
  onClick: () => void;
}

const COST_CLASS: Record<CardCostType, string> = {
  ENERGY: 'cost-energy',
  MANA: 'cost-mana',
};

export function ActionCardTile({ id, name, description, cost, affordable, pending, footer, onClick }: ActionCardTileProps) {
  const visual = cardVisual(id);
  const classes = ['action-card', COST_CLASS[cost.type]];
  if (!affordable) classes.push('disabled');
  if (pending) classes.push('pending');

  return (
    <div className={classes.join(' ')} onClick={affordable ? onClick : undefined} title={description}>
      <div className="action-card-cost">
        {cost.amount}
        {cost.type === 'MANA' ? 'M' : 'E'}
      </div>
      <div className={`action-card-icon polarity-${visual.polarity}`}>{visual.icon}</div>
      <div className="action-card-name">{name}</div>
      <div className="action-card-desc">{description}</div>
      {footer && <div className="action-card-footer">{footer}</div>}
    </div>
  );
}
