import { useState } from 'react';
import { RELIC_DEFINITIONS } from '../engine/run/index.js';
import { Modal } from './Modal.js';
import { Icon } from './pixel/Icon.js';
import { RelicText } from './RelicText.js';
import { relicIcon } from './relicIcons.js';
import { Tip } from './Tip.js';
import { relicTip } from './tipContent.js';

interface Props {
  relicId: string;
  /** Merchant only. */
  price?: number;
  /** Reward screen: a slim horizontal tile (icon left, text right) so the relic row leaves room for the cards on a short viewport. */
  compact?: boolean;
  /** Already yours (a granted reward): shown for reading only, no hover lift and no click. */
  gained?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** A relic on offer (reward or merchant): rarity-framed card with icon, name, effect text and optional price. Hover shows the tooltip, right-click opens the relic info. */
export function RelicOfferCard({ relicId, price, compact, gained, disabled, onClick }: Props) {
  const [inspecting, setInspecting] = useState(false);
  const relic = RELIC_DEFINITIONS[relicId];
  if (!relic) return null;
  return (
    <>
      <Tip tip={relicTip(relic, relicIcon(relicId))}>
        <div
          className={`reward-card relic-offer rarity-${relic.rarity}${compact ? ' relic-offer--compact' : ''}${gained ? ' relic-offer--gained' : ''}${disabled ? ' disabled' : ''}`}
          onClick={disabled ? undefined : onClick}
          onContextMenu={(e) => {
            e.preventDefault();
            setInspecting(true);
          }}
        >
          {compact ? (
            <>
              <div className="reward-card-icon">
                <Icon name={relicIcon(relicId)} size={3} />
              </div>
              <div className="relic-offer-body">
                <div className="relic-offer-rarity">{relic.rarity} relic</div>
                <div className="relic-offer-name">{relic.name}</div>
                <RelicText relic={relic} />
              </div>
            </>
          ) : (
            <>
              <div className="reward-card-tag relic-offer-rarity">{relic.rarity} relic</div>
              <div className="reward-card-icon">
                <Icon name={relicIcon(relicId)} size={3} />
              </div>
              <div className="reward-card-name">{relic.name}</div>
              <div className="reward-card-desc">
                <RelicText relic={relic} />
              </div>
              {price !== undefined && <div className="merchant-price">{price}g</div>}
            </>
          )}
        </div>
      </Tip>
      {inspecting && (
        <Modal heading={relic.name} trim onClose={() => setInspecting(false)} width={420}>
          <div className={`relic-info rarity-${relic.rarity}`}>
            <span className="relic-info-frame">
              <Icon name={relicIcon(relicId)} size={4} />
            </span>
            <div className="relic-info-rarity">{relic.rarity} relic</div>
            <p className="relic-info-text">
              <RelicText relic={relic} />
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
