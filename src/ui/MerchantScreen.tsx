import { CARD_DEFINITIONS } from '../engine/index.js';
import { RELIC_DEFINITIONS } from '../engine/run/index.js';
import type { MerchantInventory } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { relicIcon } from './relicIcons.js';

interface Props {
  gold: number;
  inventory: MerchantInventory;
  onBuyCard: (cardId: string) => void;
  onBuyRelic: (relicId: string) => void;
  onLeave: () => void;
}

export function MerchantScreen({ gold, inventory, onBuyCard, onBuyRelic, onLeave }: Props) {
  return (
    <div>
      <h1>Merchant</h1>
      <div className="subtitle">Gold: {gold}</div>

      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {inventory.cardOffers.map((offer) => {
          const cardDef = CARD_DEFINITIONS[offer.cardId];
          if (!cardDef) return null;
          const affordable = gold >= offer.price;
          return (
            <div
              key={offer.cardId}
              className={`card-tile${affordable ? '' : ' disabled'}`}
              onClick={affordable ? () => onBuyCard(offer.cardId) : undefined}
            >
              <div className="card-name">
                <span>{cardDef.name}</span>
                <span className="card-cost">{offer.price}g</span>
              </div>
              <div className="card-text">{CARD_DESCRIPTIONS[offer.cardId] ?? offer.cardId}</div>
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
                className={`card-tile${affordable ? '' : ' disabled'}`}
                onClick={affordable ? () => onBuyRelic(inventory.relicOffer!.relicId) : undefined}
              >
                <div className="card-name">
                  <span>
                    {relicIcon(inventory.relicOffer.relicId)} {relic.name}
                  </span>
                  <span className="card-cost">{inventory.relicOffer.price}g</span>
                </div>
                <div className="card-text">{relic.description}</div>
              </div>
            );
          })()}
      </div>

      <div className="toolbar">
        <button className="primary" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}
