import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import { stackUpkeep } from '../engine/run/index.js';
import { Icon } from './pixel/Icon.js';
import { UnitArt } from './UnitArt.js';
import { UNIT_DESCRIPTIONS } from './unitText.js';
import { STATUS_ICONS } from './stackStatus.js';

interface Props {
  stack: ArmyStack;
  army: ArmyStack[];
  onClose: () => void;
  /** Shows live battle state (statuses, morale, veterancy, block). */
  inBattle?: boolean;
  onSplit?: (stackId: string, splitCount: number) => void;
  onMerge?: (stackIdA: string, stackIdB: string) => void;
  /** Outside battle only; the popup closes after a dismissal. count omitted = the whole stack. */
  onDismiss?: (stackId: string, count?: number) => void;
}

export function UnitPopup({ stack, army, onClose, inBattle, onSplit, onMerge, onDismiss }: Props) {
  const def = UNIT_DEFINITIONS[stack.unitId];
  const totalHp = stack.count * def.hpPerUnit;
  const [splitCount, setSplitCount] = useState(Math.max(1, Math.floor(stack.count / 2)));
  const [dismissCount, setDismissCount] = useState(1);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const aliveStacks = army.filter((s) => s.count > 0);
  const armyFull = aliveStacks.length >= 6;
  const canSplit = !!onSplit && stack.count > 1 && !armyFull;
  const isLastStack = aliveStacks.every((s) => s.stackId === stack.stackId);
  const maxDismiss = isLastStack ? stack.count - 1 : stack.count;
  const dismissAmount = Math.min(Math.max(1, dismissCount), Math.max(1, maxDismiss));
  const otherMatchingStacks = onMerge ? aliveStacks.filter((s) => s.unitId === stack.unitId && s.stackId !== stack.stackId) : [];

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="popup panel panel--stone step-8 unit-popup-card">
        <button className="btn modal-close" onClick={onClose}>
          <Icon name="ui_close" />
        </button>
        <div className="unit-popup-icon">
          <UnitArt unitId={stack.unitId} size={4} />
        </div>
        <div className="unit-popup-name">{def.name}</div>
        <div className="unit-popup-desc">{UNIT_DESCRIPTIONS[stack.unitId]}</div>

        <div className="unit-popup-stats-row">
          <div className="unit-popup-stats">
            <div>
              <Icon name="hp" /> HP {def.hpPerUnit}
            </div>
            <div>
              <Icon name="role_melee" /> Attack {def.attack}
            </div>
            <div>
              <Icon name="shield" /> Defense {def.defense}
            </div>
          </div>
          <div className="unit-popup-count-block">
            <div className="unit-popup-count">×{stack.count}</div>
            <div className="unit-popup-total">Total HP {totalHp}</div>
            {!inBattle && (
              <div className="unit-popup-total" title="Food this stack eats every day">
                <Icon name="food" /> {stackUpkeep(stack).toFixed(1)}/day
              </div>
            )}
          </div>
        </div>

        {inBattle && (
          <div className="unit-popup-battle">
            <div>Morale {stack.morale}</div>
            <div>Veterancy {stack.veterancy}</div>
            <div>Block {stack.block}</div>
            {stack.statuses.length === 0 ? (
              <div className="unit-popup-hint">No active statuses.</div>
            ) : (
              stack.statuses.map((st) => (
                <div key={st.type}>
                  <Icon name={STATUS_ICONS[st.type]} /> {st.type} {st.amount} ({st.duration} {st.duration === 1 ? 'turn' : 'turns'})
                </div>
              ))
            )}
          </div>
        )}

        {onDismiss && !inBattle && (
          <div className="unit-popup-actions">
            {maxDismiss < 1 ? (
              <div className="unit-popup-hint">The last unit cannot be dismissed.</div>
            ) : (
              <div className="unit-popup-action-row">
                <input
                  className="input count-input"
                  type="number"
                  min={1}
                  max={maxDismiss}
                  value={dismissAmount}
                  onChange={(e) => {
                    setDismissCount(Math.max(1, Math.min(maxDismiss, Number(e.target.value) || 1)));
                    setConfirmDismiss(false);
                  }}
                />
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    if (!confirmDismiss) {
                      setConfirmDismiss(true);
                      return;
                    }
                    onDismiss(stack.stackId, dismissAmount === stack.count ? undefined : dismissAmount);
                    onClose();
                  }}
                >
                  {confirmDismiss ? `Confirm: release ${dismissAmount}` : 'Dismiss'}
                </button>
                {maxDismiss === stack.count && stack.count > 1 && (
                  <button className="btn" onClick={() => setDismissCount(stack.count)}>
                    All
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {(canSplit || otherMatchingStacks.length > 0) && (
          <div className="unit-popup-actions">
            {canSplit && (
              <div className="unit-popup-action-row">
                <input
                  className="input count-input"
                  type="number"
                  min={1}
                  max={stack.count - 1}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Math.max(1, Math.min(stack.count - 1, Number(e.target.value) || 1)))}
                />
                <button className="btn" onClick={() => onSplit!(stack.stackId, splitCount)}>
                  Split Off
                </button>
              </div>
            )}
            {otherMatchingStacks.map((other) => (
              <button key={other.stackId} className="btn unit-popup-merge-btn" onClick={() => onMerge!(stack.stackId, other.stackId)}>
                Merge with other {def.name} (×{other.count})
              </button>
            ))}
            {!canSplit && stack.count > 1 && armyFull && <div className="unit-popup-hint">Army full — no free slot to split into.</div>}
          </div>
        )}
      </div>
    </>
  );
}
