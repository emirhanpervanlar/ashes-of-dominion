import { useState } from 'react';
import { CARD_DEFINITIONS, UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, CardInstance, UnitId } from '../engine/index.js';
import { stackUpkeep } from '../engine/run/index.js';
import type { EventView, PendingEvent } from '../engine/run/index.js';
import { CARD_DESCRIPTIONS } from './cardText.js';
import { cardVisual } from './cardVisuals.js';
import { Icon } from './pixel/Icon.js';
import { UnitArt } from './UnitArt.js';
import { UnitPopup } from './UnitPopup.js';
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
        <>
          <div className="modal-backdrop" />
          <div className="popup panel panel--stone step-8 card-removal-popup">
            <h3>{CARD_ACTION_TITLES[choice.action]}</h3>
            <div className="card-removal-grid">
              {choice.instanceIds.map((instanceId) => {
                const instance = deck.find((c) => c.instanceId === instanceId);
                const def = instance ? CARD_DEFINITIONS[instance.cardId] : undefined;
                if (!instance || !def) return null;
                const visual = cardVisual(instance.cardId);
                return (
                  <div key={instanceId} className={`reward-card polarity-${visual.polarity}`} onClick={() => onChooseCard(instanceId)}>
                    <div className="reward-card-cost">{def.manaCost}</div>
                    <div className="reward-card-icon">
                      <Icon name={visual.icon} size={3} />
                    </div>
                    <div className="reward-card-name">{def.name}</div>
                    <div className="reward-card-desc">{CARD_DESCRIPTIONS[instance.cardId] ?? instance.cardId}</div>
                  </div>
                );
              })}
            </div>
            <div className="toolbar">
              <button className="btn" onClick={onCancelChoice}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {choice?.kind === 'unit' && (
        <>
          <div className="modal-backdrop" />
          <div className="popup panel panel--stone step-8 event-unit-popup">
            <h3>Choose a unit to hire</h3>
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
            <div className="toolbar">
              <button className="btn" onClick={onCancelChoice}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {newcomer && (
        <>
          <div className="modal-backdrop" />
          <div className="popup panel panel--stone step-8 unit-gain-popup">
            <h3>Your army is full</h3>
            {resolved && <p className="subtitle">{resolved.text}</p>}
            <p className="subtitle">
              {newcomer.count} {UNIT_DEFINITIONS[newcomer.unitId].name} want to join, but an army holds 6 unit types. Dismiss any unit, or turn the newcomers away.
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
            <div className="toolbar">
              <button className="btn" onClick={onDeclineGain}>
                Turn the {UNIT_DEFINITIONS[newcomer.unitId].name} away
              </button>
            </div>
          </div>
          {inspected && <UnitPopup stack={inspected} army={gainArmy} onClose={() => setInspectId(null)} onDismiss={onDismissStack} />}
        </>
      )}
    </div>
  );
}
