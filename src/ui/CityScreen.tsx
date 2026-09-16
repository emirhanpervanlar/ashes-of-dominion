import { useState } from 'react';
import { BUILDING_DEFINITIONS, LEVEL_SLOTS, LEVEL_UP_COST, canRecruitUnit, recruitCost } from '../engine/run/index.js';
import type { CityState } from '../engine/run/index.js';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, UnitId } from '../engine/index.js';

interface Props {
  city: CityState;
  gold: number;
  food: number;
  army: ArmyStack[];
  onRecruit: (unitId: UnitId, count: number, destination: 'army' | 'garrison') => void;
  onBuild: (buildingId: string) => void;
  onUpgradeCity: () => void;
  onTransferToArmy: (stackId: string) => void;
  onLeave: () => void;
}

const RECRUITABLE: UnitId[] = ['swordsman', 'archer', 'knight', 'priest', 'mage', 'cavalier'];

export function CityScreen({ city, gold, food, army, onRecruit, onBuild, onUpgradeCity, onTransferToArmy, onLeave }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const armyFull = army.filter((s) => s.count > 0).length >= 6;
  const nextLevel = city.level < 3 ? ((city.level + 1) as 2 | 3) : null;

  return (
    <div>
      <h1>City — Level {city.level}</h1>
      <div className="subtitle">
        Gold {gold} · Food {food} · Building slots {city.buildings.length}/{LEVEL_SLOTS[city.level]}
      </div>

      <div className="toolbar">
        <button className="primary" onClick={onLeave}>
          Leave City
        </button>
        {nextLevel && (
          <button onClick={onUpgradeCity} disabled={gold < LEVEL_UP_COST[nextLevel]}>
            Upgrade to Level {nextLevel} ({LEVEL_UP_COST[nextLevel]}g)
          </button>
        )}
      </div>

      <h2 style={{ fontSize: 14 }}>Recruit</h2>
      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {RECRUITABLE.map((unitId) => {
          const unlocked = canRecruitUnit(city, unitId);
          const count = counts[unitId] ?? 5;
          const cost = unlocked ? recruitCost(city, unitId, count) : null;
          const affordable = !!cost && gold >= cost.gold && food >= cost.food;
          return (
            <div key={unitId} className="card-tile" style={{ minWidth: 170 }}>
              <div className="card-name">
                <span>{UNIT_DEFINITIONS[unitId].name}</span>
              </div>
              {!unlocked ? (
                <div className="card-text">Requires {unitId === 'mage' ? 'Mage Tower' : 'Stable'}.</div>
              ) : (
                <>
                  <div className="card-text">
                    {cost!.gold}g / {cost!.food}f for {count}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={count}
                    onChange={(e) => setCounts({ ...counts, [unitId]: Math.max(1, Number(e.target.value) || 1) })}
                    style={{ width: 50, marginTop: 4 }}
                  />
                  <div className="toolbar" style={{ marginTop: 4, marginBottom: 0 }}>
                    <button disabled={!affordable || armyFull} onClick={() => onRecruit(unitId, count, 'army')}>
                      To Army
                    </button>
                    <button disabled={!affordable} onClick={() => onRecruit(unitId, count, 'garrison')}>
                      To Garrison
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 14 }}>Buildings</h2>
      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {Object.values(BUILDING_DEFINITIONS).map((building) => {
          const built = city.buildings.includes(building.id);
          const slotsFull = city.buildings.length >= LEVEL_SLOTS[city.level];
          const affordable = gold >= building.cost;
          const disabled = built || (slotsFull && !built) || !affordable;
          return (
            <div
              key={building.id}
              className={`card-tile${disabled ? ' disabled' : ''}`}
              onClick={!disabled ? () => onBuild(building.id) : undefined}
            >
              <div className="card-name">
                <span>{building.name}</span>
                <span className="card-cost">{built ? 'built' : `${building.cost}g`}</span>
              </div>
              <div className="card-text">{building.description}</div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 14 }}>Garrison</h2>
      <div className="hand" style={{ flexWrap: 'wrap' }}>
        {city.garrison.filter((s) => s.count > 0).length === 0 && <div className="subtitle">Empty.</div>}
        {city.garrison
          .filter((s) => s.count > 0)
          .map((stack) => (
            <div key={stack.stackId} className="card-tile" style={{ minWidth: 160 }}>
              <div className="card-name">
                <span>
                  {UNIT_DEFINITIONS[stack.unitId].name} ×{stack.count}
                </span>
              </div>
              <button disabled={armyFull} onClick={() => onTransferToArmy(stack.stackId)}>
                Move to Army
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
