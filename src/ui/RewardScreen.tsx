import { CARD_DEFINITIONS } from '../engine/index.js';
import type { CardInstance } from '../engine/index.js';
import type { CardRemovalQuote, PendingReward } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardVisual } from './cardVisuals.js';
import { CardRemovalPicker } from './CardRemovalPicker.js';

interface Props {
  reward: PendingReward;
  deck: CardInstance[];
  removalQuote: CardRemovalQuote;
  onClaimCard: (cardId: string) => void;
  onClaimUpgrade: (instanceId: string) => void;
  onRemoveCard: (instanceId: string) => void;
  onSkip: () => void;
}

type RewardSlot =
  | { kind: 'card'; key: string; cardId: string }
  | { kind: 'upgrade'; key: string; instanceId: string; cardId: string; upgradedCardId: string };

export function RewardScreen({ reward, deck, removalQuote, onClaimCard, onClaimUpgrade, onRemoveCard, onSkip }: Props) {
  const slots: RewardSlot[] = [
    ...reward.cardOptions.map((cardId): RewardSlot => ({ kind: 'card', key: cardId, cardId })),
    ...reward.upgradeOptions.map(
      (o): RewardSlot => ({ kind: 'upgrade', key: o.instanceId, instanceId: o.instanceId, cardId: o.cardId, upgradedCardId: o.upgradedCardId })
    ),
  ];

  return (
    <div className="reward-overlay">
      <div className="reward-banner">Victory! Choose One</div>

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
            <div key={slot.key} className="reward-card" onClick={onClick}>
              <div className="reward-card-cost">{def.manaCost}</div>
              <div className={`reward-card-icon polarity-${visual.polarity}`}>{visual.icon}</div>
              <div className="reward-card-name">{def.name}</div>
              {isUpgrade && <div className="reward-card-tag">Upgrade</div>}
              <div className="reward-card-desc">{CARD_DESCRIPTIONS[displayCardId] ?? displayCardId}</div>
            </div>
          );
        })}
      </div>

      <div className="reward-actions">
        <CardRemovalPicker deck={deck} quote={removalQuote} onRemove={onRemoveCard} className="reward-skip-btn" />
        <button className="reward-skip-btn" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
