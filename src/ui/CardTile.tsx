import type { CardDefinition, CardInstance } from '../engine/index.js';
import { CARD_COST_LABEL, CARD_DESCRIPTIONS } from './cardText.js';

interface CardTileProps {
  instance: CardInstance;
  cardDef: CardDefinition;
  affordable: boolean;
  pending: boolean;
  onClick: () => void;
}

export function CardTile({ instance, cardDef, affordable, pending, onClick }: CardTileProps) {
  const classes = ['card-tile'];
  if (!affordable) classes.push('disabled');
  if (pending) classes.push('pending');

  return (
    <div className={classes.join(' ')} onClick={affordable ? onClick : undefined} title={instance.instanceId}>
      <div className="card-name">
        <span>{cardDef.name}</span>
        <span className="card-cost">
          {cardDef.cost.amount} {CARD_COST_LABEL[cardDef.cost.type]}
        </span>
      </div>
      <div className="card-text">{CARD_DESCRIPTIONS[cardDef.id] ?? cardDef.id}</div>
    </div>
  );
}
