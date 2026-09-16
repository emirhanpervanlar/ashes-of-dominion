import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_DESCRIPTIONS } from './unitText.js';

interface Props {
  stack: ArmyStack;
  onClose: () => void;
}

export function UnitPopup({ stack, onClose }: Props) {
  const def = UNIT_DEFINITIONS[stack.unitId];
  const totalHp = stack.count * def.hpPerUnit;

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
      </div>
    </>
  );
}
