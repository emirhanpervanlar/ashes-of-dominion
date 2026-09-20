import type { CardInstance } from '../engine/index.js';
import type { CardRemovalQuote, MerchantInventory } from '../engine/run/index.js';
import { LargeCard } from './LargeCard.js';
import { Icon } from './pixel/Icon.js';
import { RelicOfferCard } from './RelicOfferCard.js';
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
          <Icon name="gold" /> {gold}
        </div>
      </div>

      <div className="merchant-shelf">
        {inventory.cardOffers.map((offer) => {
          return (
            <LargeCard
              key={offer.cardId}
              cardId={offer.cardId}
              className="merchant-card"
              price={offer.price}
              disabled={gold < offer.price}
              onClick={() => onBuyCard(offer.cardId)}
            />
          );
        })}

        {inventory.relicOffer && (
          <RelicOfferCard
            relicId={inventory.relicOffer.relicId}
            price={inventory.relicOffer.price}
            disabled={gold < inventory.relicOffer.price}
            onClick={() => onBuyRelic(inventory.relicOffer!.relicId)}
          />
        )}
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
