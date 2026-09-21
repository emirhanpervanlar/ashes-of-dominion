import type { PendingReward } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';
import { LargeCard } from './LargeCard.js';
import { RelicOfferCard } from './RelicOfferCard.js';

interface Props {
  reward: PendingReward;
  /** Gold and Food from the last BATTLE_LOOT, or null when nothing dropped. */
  loot: { gold: number; food: number } | null;
  isBoss: boolean;
  /** A fort was assaulted (not the boss): it always grants a relic while its simple pool lasts. */
  isFort: boolean;
  onClaimRelic: (relicId: string) => void;
  onClaimCard: (cardId: string) => void;
  onClaimUpgrade: (instanceId: string) => void;
}

type RewardSlot =
  | { kind: 'card'; key: string; cardId: string }
  | { kind: 'upgrade'; key: string; instanceId: string; cardId: string };

/** AO-D068: the player must take one card or the upgrade slot (no Skip, no card removal here); a fort's relic is already theirs (or the camp held none), a boss offers up to three. */
export function RewardScreen({ reward, loot, isBoss, isFort, onClaimRelic, onClaimCard, onClaimUpgrade }: Props) {
  const slots: RewardSlot[] = [
    ...reward.cardOptions.map((cardId): RewardSlot => ({ kind: 'card', key: cardId, cardId })),
    ...reward.upgradeOptions.map((o): RewardSlot => ({ kind: 'upgrade', key: o.instanceId, instanceId: o.instanceId, cardId: o.cardId })),
  ];

  return (
    <div className="screen reward-overlay" data-screen="vault">
      <div className="plaque plaque--ribbon">{isBoss ? 'The Boss Has Fallen!' : isFort ? 'Fort Taken! Choose One' : 'Victory! Choose One'}</div>
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

      {reward.relicGained && (
        <div className="reward-relic-block" data-relic-gained>
          <div className="reward-relic-heading">Relic gained</div>
          <RelicOfferCard relicId={reward.relicGained} compact gained />
        </div>
      )}

      {isFort && !reward.relicGained && (
        <div className="reward-relic-block" data-no-relic>
          <div className="reward-relic-heading">The camp held no relic</div>
        </div>
      )}

      {reward.relicChoices.length > 0 && (
        <div className="reward-relic-block">
          <div className="reward-relic-heading">
            {reward.relicChoices.length === 1 ? 'Boss spoils: take the relic' : 'Boss spoils: take one relic'}
          </div>
          <div className="reward-relic-row">
            {reward.relicChoices.map((relicId) => (
              <RelicOfferCard key={relicId} relicId={relicId} compact onClick={() => onClaimRelic(relicId)} />
            ))}
          </div>
          <div className="reward-relic-warn">
            <Icon name="ui_warn" /> Picking a card forfeits the unclaimed relics.
          </div>
        </div>
      )}

      <div className="reward-card-row">
        {slots.length === 0 && <div className="reward-empty">No cards available.</div>}
        {slots.map((slot) => {
          const isUpgrade = slot.kind === 'upgrade';
          return (
            <LargeCard
              key={slot.key}
              cardId={slot.cardId}
              upgraded={isUpgrade}
              showBase={isUpgrade}
              tag={isUpgrade ? 'Upgrade' : undefined}
              onClick={isUpgrade ? () => onClaimUpgrade(slot.instanceId) : () => onClaimCard(slot.cardId)}
            />
          );
        })}
      </div>
    </div>
  );
}
