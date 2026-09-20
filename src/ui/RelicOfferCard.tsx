import { RELIC_DEFINITIONS } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';
import { relicIcon } from './relicIcons.js';

interface Props {
  relicId: string;
  /** Merchant only. */
  price?: number;
  disabled?: boolean;
  onClick?: () => void;
}

/** A relic on offer (reward or merchant): rarity-framed card with icon, name, effect text and optional price. */
export function RelicOfferCard({ relicId, price, disabled, onClick }: Props) {
  const relic = RELIC_DEFINITIONS[relicId];
  if (!relic) return null;
  return (
    <div className={`reward-card relic-offer rarity-${relic.rarity}${disabled ? ' disabled' : ''}`} onClick={disabled ? undefined : onClick}>
      <div className="reward-card-tag relic-offer-rarity">{relic.rarity} relic</div>
      <div className="reward-card-icon">
        <Icon name={relicIcon(relicId)} size={3} />
      </div>
      <div className="reward-card-name">{relic.name}</div>
      <div className="reward-card-desc">{relic.description}</div>
      {price !== undefined && <div className="merchant-price">{price}g</div>}
    </div>
  );
}
