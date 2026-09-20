import { CARD_DEFINITIONS } from '../engine/index.js';
import type { CardInstance } from '../engine/index.js';
import type { CardRemovalQuote, PendingReward } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardVisual } from './cardVisuals.js';
import { CardRemovalPicker } from './CardRemovalPicker.js';
import { Icon } from './pixel/Icon.js';
import { RelicOfferCard } from './RelicOfferCard.js';

interface Props {
  reward: PendingReward;
  deck: CardInstance[];
  removalQuote: CardRemovalQuote;
  /** Gold and Food from the last BATTLE_LOOT, or null when nothing dropped. */
  loot: { gold: number; food: number } | null;
  isBoss: boolean;
  onClaimRelic: (relicId: string) => void;
  onClaimCard: (cardId: string) => void;
  onClaimUpgrade: (instanceId: string) => void;
  onRemoveCard: (instanceId: string) => void;
  onSkip: () => void;
}

type RewardSlot =
  | { kind: 'card'; key: string; cardId: string }
  | { kind: 'upgrade'; key: string; instanceId: string; cardId: string; upgradedCardId: string };

export function RewardScreen({ reward, deck, removalQuote, loot, isBoss, onClaimRelic, onClaimCard, onClaimUpgrade, onRemoveCard, onSkip }: Props) {
  const slots: RewardSlot[] = [
    ...reward.cardOptions.map((cardId): RewardSlot => ({ kind: 'card', key: cardId, cardId })),
    ...reward.upgradeOptions.map(
      (o): RewardSlot => ({ kind: 'upgrade', key: o.instanceId, instanceId: o.instanceId, cardId: o.cardId, upgradedCardId: o.upgradedCardId })
    ),
  ];

  const relics = reward.relicChoices.length > 0 ? reward.relicChoices : reward.relicOffer ? [reward.relicOffer] : [];

  return (
    <div className="screen reward-overlay" data-screen="vault">
      <div className="plaque plaque--ribbon">{isBoss ? 'The Boss Has Fallen!' : 'Victory! Choose One'}</div>
      {loot && (
        <div className="reward-loot">
          <span className="pill pill--gold">
            <Icon name="gold" /> +{loot.gold} Gold
          </span>
          {loot.food > 0 && (
            <span className="pill">
              <Icon name="food" /> +{loot.food} Food
            </span>
          )}
        </div>
      )}

      {relics.length > 0 && (
        <div className="reward-relic-block">
          <div className="reward-relic-heading">
            {reward.relicChoices.length > 0 ? 'Boss spoils: take one relic' : 'Elite spoils: take a relic'}
            <span className="reward-relic-note"> (leaving the reward forfeits it)</span>
          </div>
          <div className="reward-relic-row">
            {relics.map((relicId) => (
              <RelicOfferCard key={relicId} relicId={relicId} onClick={() => onClaimRelic(relicId)} />
            ))}
          </div>
        </div>
      )}

      <div className="reward-card-row">
        {slots.length === 0 && <div className="reward-empty">No cards available.</div>}
        {slots.map((slot) => {
          const isUpgrade = slot.kind === 'upgrade';
          const displayCardId = isUpgrade ? slot.upgradedCardId : slot.cardId;
          const def = CARD_DEFINITIONS[displayCardId];
          if (!def) return null;
          const visual = cardVisual(slot.cardId);
          const onClick = isUpgrade ? () => onClaimUpgrade(slot.instanceId) : () => onClaimCard(slot.cardId);
          return (
            <div key={slot.key} className={`reward-card polarity-${visual.polarity}`} onClick={onClick}>
              <div className="reward-card-cost">{def.manaCost}</div>
              <div className="reward-card-icon">
                <Icon name={visual.icon} size={3} />
              </div>
              <div className="reward-card-name">{def.name}</div>
              {isUpgrade && <div className="reward-card-tag">Upgrade</div>}
              <div className="reward-card-desc">{CARD_DESCRIPTIONS[displayCardId] ?? displayCardId}</div>
            </div>
          );
        })}
      </div>

      <div className="reward-actions">
        <CardRemovalPicker deck={deck} quote={removalQuote} onRemove={onRemoveCard} />
        <button className="btn" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
