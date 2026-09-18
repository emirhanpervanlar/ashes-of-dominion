import { CARD_DEFINITIONS } from '../engine/index.js';
import { RELIC_DEFINITIONS } from '../engine/run/index.js';
import type { PendingReward } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { relicIcon } from './relicIcons.js';

interface Props {
  reward: PendingReward;
  onClaimRelic: (relicId: string) => void;
  onClaimCard: (cardId: string) => void;
  onClaimUpgrade: (instanceId: string) => void;
  onConfirm: () => void;
}

export function RewardScreen({ reward, onClaimRelic, onClaimCard, onClaimUpgrade, onConfirm }: Props) {
  return (
    <div>
      <h1>Victory!</h1>
      <div className="subtitle">Pick up to one relic and up to one card/upgrade, then confirm. Either can be skipped.</div>

      {reward.relicOptions.length > 0 && (
        <>
          <h2 style={{ fontSize: 14 }}>Relic (optional)</h2>
          <div className="hand" style={{ flexWrap: 'wrap' }}>
            {reward.relicOptions.map((relicId) => {
              const relic = RELIC_DEFINITIONS[relicId];
              if (!relic) return null;
              const selected = reward.chosenRelicId === relicId;
              return (
                <div
                  key={relicId}
                  className={`card-tile${selected ? ' pending' : ''}`}
                  style={{ minWidth: 200 }}
                  onClick={() => onClaimRelic(relicId)}
                >
                  <div className="card-name">
                    <span>
                      {relicIcon(relicId)} {relic.name}
                    </span>
                  </div>
                  <div className="card-text">{relic.description}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 14 }}>Card or Upgrade (optional)</h2>
      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {reward.cardOptions.map((cardId) => {
          const cardDef = CARD_DEFINITIONS[cardId];
          if (!cardDef) return null;
          const selected = reward.chosenCardId === cardId;
          return (
            <div
              key={cardId}
              className={`card-tile${selected ? ' pending' : ''}`}
              style={{ minWidth: 160 }}
              onClick={() => onClaimCard(cardId)}
            >
              <div className="card-name">
                <span>{cardDef.name}</span>
                <span className="card-cost">{cardDef.manaCost} Mana</span>
              </div>
              <div className="card-text">{CARD_DESCRIPTIONS[cardId] ?? cardId}</div>
            </div>
          );
        })}
        {reward.upgradeOptions.map((opt) => {
          const upgradedDef = CARD_DEFINITIONS[opt.upgradedCardId];
          const selected = reward.chosenUpgradeInstanceId === opt.instanceId;
          return (
            <div
              key={opt.instanceId}
              className={`card-tile${selected ? ' pending' : ''}`}
              style={{ minWidth: 160, borderStyle: 'dashed' }}
              onClick={() => onClaimUpgrade(opt.instanceId)}
            >
              <div className="card-name">
                <span>Upgrade: {upgradedDef?.name ?? opt.upgradedCardId}</span>
              </div>
              <div className="card-text">{CARD_DESCRIPTIONS[opt.upgradedCardId] ?? opt.upgradedCardId}</div>
            </div>
          );
        })}
      </div>

      <div className="toolbar">
        <button className="primary" onClick={onConfirm}>
          Confirm &amp; Continue
        </button>
      </div>
    </div>
  );
}
