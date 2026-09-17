import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_DESCRIPTIONS } from './unitText.js';

interface Props {
  stack: ArmyStack;
  army: ArmyStack[];
  onClose: () => void;
  onSplit?: (stackId: string, splitCount: number) => void;
  onMerge?: (stackIdA: string, stackIdB: string) => void;
}

export function UnitPopup({ stack, army, onClose, onSplit, onMerge }: Props) {
  const def = UNIT_DEFINITIONS[stack.unitId];
  const totalHp = stack.count * def.hpPerUnit;
  const [splitCount, setSplitCount] = useState(Math.max(1, Math.floor(stack.count / 2)));

  const aliveStacks = army.filter((s) => s.count > 0);
  const armyFull = aliveStacks.length >= 6;
  const canSplit = !!onSplit && stack.count > 1 && !armyFull;
  const otherMatchingStacks = onMerge ? aliveStacks.filter((s) => s.unitId === stack.unitId && s.stackId !== stack.stackId) : [];

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="unit-popup-card">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="unit-popup-icon">{UNIT_ICONS[stack.unitId]}</div>
        <div className="unit-popup-name">{def.name}</div>
        <div className="unit-popup-desc">{UNIT_DESCRIPTIONS[stack.unitId]}</div>

        <div className="unit-popup-stats-row">
          <div className="unit-popup-stats">
            <div>❤ HP {def.hpPerUnit}</div>
            <div>⚔ Attack {def.attack}</div>
            <div>🛡 Defense {def.defense}</div>
          </div>
          <div className="unit-popup-count-block">
            <div className="unit-popup-count">×{stack.count}</div>
            <div className="unit-popup-total">Total HP {totalHp}</div>
          </div>
        </div>

        {(canSplit || otherMatchingStacks.length > 0) && (
          <div className="unit-popup-actions">
            {canSplit && (
              <div className="unit-popup-action-row">
                <input
                  type="number"
                  min={1}
                  max={stack.count - 1}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Math.max(1, Math.min(stack.count - 1, Number(e.target.value) || 1)))}
                />
                <button onClick={() => onSplit!(stack.stackId, splitCount)}>Split Off</button>
              </div>
            )}
            {otherMatchingStacks.map((other) => (
              <button key={other.stackId} className="unit-popup-merge-btn" onClick={() => onMerge!(stack.stackId, other.stackId)}>
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
