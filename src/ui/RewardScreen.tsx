import { CARD_DEFINITIONS } from '../engine/index.js';
import type { PendingReward } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardVisual } from './cardVisuals.js';

interface Props {
  reward: PendingReward;
  onClaimCard: (cardId: string) => void;
  onClaimUpgrade: (instanceId: string) => void;
  onConfirm: () => void;
}

type RewardSlot =
  | { kind: 'card'; key: string; cardId: string }
  | { kind: 'upgrade'; key: string; instanceId: string; cardId: string; upgradedCardId: string };

export function RewardScreen({ reward, onClaimCard, onClaimUpgrade, onConfirm }: Props) {
  const slots: RewardSlot[] = [
    ...reward.cardOptions.map((cardId): RewardSlot => ({ kind: 'card', key: cardId, cardId })),
    ...reward.upgradeOptions.map(
      (o): RewardSlot => ({ kind: 'upgrade', key: o.instanceId, instanceId: o.instanceId, cardId: o.cardId, upgradedCardId: o.upgradedCardId })
    ),
  ];
  const hasChoice = !!reward.chosenCardId || !!reward.chosenUpgradeInstanceId;

  return (
    <div className="reward-overlay">
      <div className="reward-banner">Victory! Choose a Card</div>

      <div className="reward-card-row">
        {slots.length === 0 && <div className="reward-empty">No cards available.</div>}
        {slots.map((slot) => {
          const isUpgrade = slot.kind === 'upgrade';
          const displayCardId = isUpgrade ? slot.upgradedCardId : slot.cardId;
          const def = CARD_DEFINITIONS[displayCardId];
          if (!def) return null;
          const visual = cardVisual(slot.cardId);
          const selected = isUpgrade ? reward.chosenUpgradeInstanceId === slot.instanceId : reward.chosenCardId === slot.cardId;
          const onClick = isUpgrade ? () => onClaimUpgrade(slot.instanceId) : () => onClaimCard(slot.cardId);
          return (
            <div key={slot.key} className={`reward-card${selected ? ' selected' : ''}`} onClick={onClick}>
              <div className="reward-card-cost">{def.manaCost}</div>
              <div className={`reward-card-icon polarity-${visual.polarity}`}>{visual.icon}</div>
              <div className="reward-card-name">{def.name}</div>
              {isUpgrade && <div className="reward-card-tag">Upgrade</div>}
              <div className="reward-card-desc">{CARD_DESCRIPTIONS[displayCardId] ?? displayCardId}</div>
            </div>
          );
        })}
      </div>

      <button className="reward-skip-btn" onClick={onConfirm}>
        {hasChoice ? 'Confirm & Continue' : 'Skip'}
      </button>
    </div>
  );
}
