import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, CardInstance, UnitId } from '../engine/index.js';
import { stackUpkeep } from '../engine/run/index.js';
import type { EventView, PendingEvent } from '../engine/run/index.js';
import { groupCards } from './deckView.js';
import { LargeCard } from './LargeCard.js';
import { Modal } from './Modal.js';
import { Icon } from './pixel/Icon.js';
import { UnitArt } from './UnitArt.js';
import { UnitPopup } from './UnitPopup.js';
import { unitCountText } from './runEventText.js';
import { UNIT_DESCRIPTIONS } from './unitText.js';

interface Props {
  view: EventView;
  deck: CardInstance[];
  army: ArmyStack[];
  /** Set while a unit gain has no room in the army (AO-D054): the newcomer is shown as an extra army entry. */
  newcomer: ArmyStack | null;
  resolved: PendingEvent['resolved'];
  onChoose: (optionId: string) => void;
  onChooseCard: (instanceId: string) => void;
  onChooseUnit: (unitId: UnitId) => void;
  onCancelChoice: () => void;
  onDismissStack: (stackId: string, count?: number) => void;
  onDeclineGain: () => void;
}

const CARD_ACTION_TITLES = { upgrade: 'Choose a card to upgrade', remove: 'Choose a card to remove', give: 'Choose a card to give away' } as const;

export function EventScreen({ view, deck, army, newcomer, resolved, onChoose, onChooseCard, onChooseUnit, onCancelChoice, onDismissStack, onDeclineGain }: Props) {
  const [inspectId, setInspectId] = useState<string | null>(null);
  const choice = view.choice;
  const gainArmy = newcomer ? [...army.filter((s) => s.count > 0), newcomer] : [];
  const inspected = gainArmy.find((s) => s.stackId === inspectId) ?? null;

  return (
    <div className="screen event-overlay" data-screen="vault">
      <div className="event-badge">
        <Icon name="node_event" size={3} />
      </div>
      <div className="plaque plaque--ribbon">{view.title}</div>
      <div className="panel panel--parch step-8 event-description">{view.description}</div>

      <div className="event-options">
        {view.options.map((option) => (
          <div
            key={option.id}
            className={`event-option-card${option.available ? '' : ' disabled'}`}
            onClick={option.available && !choice && !resolved ? () => onChoose(option.id) : undefined}
          >
            <div className="event-option-label">{option.label}</div>
            <div className="event-option-desc">{option.description}</div>
            {!option.available && option.reason && <div className="event-option-reason">{option.reason}</div>}
          </div>
        ))}
      </div>

      {choice?.kind === 'card' && (
        <Modal heading={CARD_ACTION_TITLES[choice.action]} onClose={onCancelChoice} width={900}>
          <div className="card-removal-grid">
            {groupCards(deck.filter((c) => choice.instanceIds.includes(c.instanceId))).map((group) => {
              const preview = choice.action === 'upgrade';
              return (
                <LargeCard
                  key={group.key}
                  cardId={group.cardId}
                  upgraded={preview || group.upgraded}
                  showBase={preview}
                  tag={preview ? 'Upgrade' : undefined}
                  count={group.count}
                  onClick={() => onChooseCard(group.instanceId!)}
                />
              );
            })}
          </div>
        </Modal>
      )}

      {choice?.kind === 'unit' && (
        <Modal
          heading="Choose a unit to hire"
          onClose={onCancelChoice}
          width={480}
          footer={
            <button className="btn" onClick={onCancelChoice}>
              Cancel
            </button>
          }
        >
          <div className="event-unit-row">
            {choice.unitIds.map((unitId) => (
              <div key={unitId} className="option-tile" onClick={() => onChooseUnit(unitId)}>
                <div className="event-unit-art">
                  <UnitArt unitId={unitId} size={3} />
                </div>
                <div className="option-name">
                  <span>{UNIT_DEFINITIONS[unitId].name}</span>
                </div>
                <div className="option-text">{UNIT_DESCRIPTIONS[unitId]}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {newcomer && (
        <>
          <Modal
            heading="Your army is full"
            width={720}
            footer={
              <button className="btn" onClick={onDeclineGain}>
                Turn the {UNIT_DEFINITIONS[newcomer.unitId].name} away
              </button>
            }
          >
            {resolved && <p className="subtitle">{resolved.text}</p>}
            <p className="subtitle">
              {unitCountText(newcomer.unitId, newcomer.count)} want to join, but an army holds 6 unit types. Dismiss any unit, or turn the newcomers away.
            </p>
            <div className="unit-gain-row">
              {gainArmy.map((stack) => (
                <div
                  key={stack.stackId}
                  className={`unit-gain-tile${stack.stackId === newcomer.stackId ? ' newcomer' : ''}`}
                  onClick={() => setInspectId(stack.stackId)}
                >
                  {stack.stackId === newcomer.stackId && <span className="unit-gain-tag">New</span>}
                  <UnitArt unitId={stack.unitId} size={2} />
                  <div className="unit-gain-count">×{stack.count}</div>
                  <div className="unit-gain-name">{UNIT_DEFINITIONS[stack.unitId].name}</div>
                  <div className="unit-gain-food">
                    <Icon name="food" /> {stackUpkeep(stack).toFixed(1)}/day
                  </div>
                </div>
              ))}
            </div>
          </Modal>
          {inspected && <UnitPopup stack={inspected} army={gainArmy} onClose={() => setInspectId(null)} onDismiss={onDismissStack} />}
        </>
      )}
    </div>
  );
}
