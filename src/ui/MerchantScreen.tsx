import { CARD_DEFINITIONS } from '../engine/index.js';
import type { CardInstance } from '../engine/index.js';
import { RELIC_DEFINITIONS } from '../engine/run/index.js';
import type { CardRemovalQuote, MerchantInventory } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardVisual } from './cardVisuals.js';
import { relicIcon } from './relicIcons.js';
import { CardRemovalPicker } from './CardRemovalPicker.js';

interface Props {
  gold: number;
  inventory: MerchantInventory;
  deck: CardInstance[];
  removalQuote: CardRemovalQuote;
  onBuyCard: (cardId: string) => void;
  onBuyRelic: (relicId: string) => void;
  onRemoveCard: (instanceId: string) => void;
  onLeave: () => void;
}

export function MerchantScreen({ gold, inventory, deck, removalQuote, onBuyCard, onBuyRelic, onRemoveCard, onLeave }: Props) {
  return (
    <div className="screen merchant-overlay" data-screen="vault">
      <div className="merchant-topbar">
        <div className="plaque plaque--ribbon">Merchant</div>
        <div className="pill pill--gold">
          <span>💰</span> {gold}
        </div>
      </div>

      <div className="merchant-shelf">
        {inventory.cardOffers.map((offer) => {
          const cardDef = CARD_DEFINITIONS[offer.cardId];
          if (!cardDef) return null;
          const visual = cardVisual(offer.cardId);
          const affordable = gold >= offer.price;
          return (
            <div
              key={offer.cardId}
              className={`reward-card merchant-card polarity-${visual.polarity}${affordable ? '' : ' disabled'}`}
              onClick={affordable ? () => onBuyCard(offer.cardId) : undefined}
            >
              <div className="reward-card-cost">{cardDef.manaCost}</div>
              <div className="reward-card-icon">{visual.icon}</div>
              <div className="reward-card-name">{cardDef.name}</div>
              <div className="reward-card-desc">{CARD_DESCRIPTIONS[offer.cardId] ?? offer.cardId}</div>
              <div className="merchant-price">{offer.price}g</div>
            </div>
          );
        })}

        {inventory.relicOffer &&
          (() => {
            const relic = RELIC_DEFINITIONS[inventory.relicOffer.relicId];
            if (!relic) return null;
            const affordable = gold >= inventory.relicOffer.price;
            return (
              <div
                className={`reward-card merchant-card merchant-relic${affordable ? '' : ' disabled'}`}
                onClick={affordable ? () => onBuyRelic(inventory.relicOffer!.relicId) : undefined}
              >
                <div className="reward-card-tag">Relic</div>
                <div className="reward-card-icon">{relicIcon(inventory.relicOffer.relicId)}</div>
                <div className="reward-card-name">{relic.name}</div>
                <div className="reward-card-desc">{relic.description}</div>
                <div className="merchant-price">{inventory.relicOffer.price}g</div>
              </div>
            );
          })()}
      </div>

      <div className="merchant-removal">
        <CardRemovalPicker deck={deck} quote={removalQuote} onRemove={onRemoveCard} />
      </div>

      <button className="btn btn--danger btn--l merchant-leave" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}
