import { useState } from 'react';
import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, LEVEL_SLOTS, LEVEL_UP_COST, canRecruitUnit, recruitCost } from '../engine/run/index.js';
import type { CityState } from '../engine/run/index.js';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, UnitId } from '../engine/index.js';
import { UNIT_ICONS } from './unitIcons.js';

interface Props {
  city: CityState;
  gold: number;
  food: number;
  hero: { name: string; hp: number; maxHp: number };
  army: ArmyStack[];
  onRecruit: (unitId: UnitId, count: number, destination: 'army' | 'garrison') => void;
  onBuild: (buildingId: string) => void;
  onUpgradeCity: () => void;
  onChooseDoctrine: (doctrineId: string) => void;
  onTransferToArmy: (stackId: string) => void;
  onLeave: () => void;
}

const RECRUITABLE: UnitId[] = ['swordsman', 'archer', 'knight', 'priest', 'mage', 'cavalier'];

type Panel = 'townhall' | 'barracks' | 'garrison' | 'temple' | string | null;

export function CityScreen({
  city,
  gold,
  food,
  hero,
  army,
  onRecruit,
  onBuild,
  onUpgradeCity,
  onChooseDoctrine,
  onTransferToArmy,
  onLeave,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const armyFull = army.filter((s) => s.count > 0).length >= 6;
  const nextLevel = city.level < 3 ? ((city.level + 1) as 2 | 3) : null;
  const slotsUsed = city.buildings.length;
  const slotsMax = LEVEL_SLOTS[city.level];
  const garrisonAlive = city.garrison.filter((s) => s.count > 0);

  function togglePanel(id: Panel) {
    setPanel((p) => (p === id ? null : id));
  }

  return (
    <div>
      <h1>Ironhold</h1>

      <div className="city-resource-bar">
        <div className="resource-chip">
          <span className="resource-chip-icon">💰</span> {gold} Gold
        </div>
        <div className="resource-chip">
          <span className="resource-chip-icon">🌾</span> {food} Food
        </div>
        <div className="resource-chip">
          <span className="resource-chip-icon">🏗️</span> {slotsUsed}/{slotsMax} Slots
        </div>
        <div className="resource-chip">
          <span className="resource-chip-icon">👑</span> Level {city.level}
        </div>
      </div>

      <div className="town-view">
        <div className={`building-tile${panel === 'townhall' ? ' active' : ''}`} onClick={() => togglePanel('townhall')}>
          <span className="building-tile-icon">🏛️</span>
          <span className="building-tile-name">Town Hall</span>
          <span className="building-tile-sub">Level up</span>
        </div>
        <div className={`building-tile${panel === 'barracks' ? ' active' : ''}`} onClick={() => togglePanel('barracks')}>
          <span className="building-tile-icon">⚔️</span>
          <span className="building-tile-name">Barracks</span>
          <span className="building-tile-sub">Recruit</span>
        </div>
        <div className={`building-tile${panel === 'garrison' ? ' active' : ''}`} onClick={() => togglePanel('garrison')}>
          <span className="building-tile-icon">🏯</span>
          <span className="building-tile-name">Fort</span>
          <span className="building-tile-sub">Garrison ({garrisonAlive.length})</span>
        </div>
        <div className={`building-tile${panel === 'temple' ? ' active' : ''}`} onClick={() => togglePanel('temple')}>
          <span className="building-tile-icon">⛩️</span>
          <span className="building-tile-name">Temple</span>
          <span className="building-tile-sub">{city.doctrine ? DOCTRINE_DEFINITIONS[city.doctrine]?.name : 'Doctrine'}</span>
        </div>

        {Object.values(BUILDING_DEFINITIONS).map((building) => {
          const built = city.buildings.includes(building.id);
          return (
            <div
              key={building.id}
              className={`building-tile${panel === building.id ? ' active' : ''}${built ? '' : ' locked'}`}
              onClick={() => togglePanel(building.id)}
            >
              <span className="building-tile-icon">{BUILDING_ICONS[building.id] ?? '🏚️'}</span>
              <span className="building-tile-name">{building.name}</span>
              <span className="building-tile-sub">{built ? 'Built' : `${building.cost}g`}</span>
            </div>
          );
        })}
      </div>

      {panel === 'townhall' && (
        <div className="city-panel">
          <div className="city-panel-header">
            <h3>🏛️ Town Hall</h3>
            <button onClick={() => setPanel(null)}>Close</button>
          </div>
          <p className="subtitle">City Level {city.level} — {slotsMax} building slots.</p>
          {nextLevel ? (
            <button onClick={onUpgradeCity} disabled={gold < LEVEL_UP_COST[nextLevel]}>
              Upgrade to Level {nextLevel} ({LEVEL_UP_COST[nextLevel]}g)
            </button>
          ) : (
            <p className="subtitle">Already at maximum level.</p>
          )}
        </div>
      )}

      {panel === 'barracks' && (
        <div className="city-panel">
          <div className="city-panel-header">
            <h3>⚔️ Barracks — Recruit</h3>
            <button onClick={() => setPanel(null)}>Close</button>
          </div>
          <div className="hand" style={{ flexWrap: 'wrap' }}>
            {RECRUITABLE.map((unitId) => {
              const unlocked = canRecruitUnit(city, unitId);
              const count = counts[unitId] ?? 5;
              const cost = unlocked ? recruitCost(city, unitId, count) : null;
              const affordable = !!cost && gold >= cost.gold && food >= cost.food;
              return (
                <div key={unitId} className="card-tile" style={{ minWidth: 170 }}>
                  <div className="card-name">
                    <span>
                      {UNIT_ICONS[unitId]} {UNIT_DEFINITIONS[unitId].name}
                    </span>
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
        </div>
      )}

      {panel === 'garrison' && (
        <div className="city-panel">
          <div className="city-panel-header">
            <h3>🏯 Fort — Garrison</h3>
            <button onClick={() => setPanel(null)}>Close</button>
          </div>
          <div className="hand" style={{ flexWrap: 'wrap' }}>
            {garrisonAlive.length === 0 && <div className="subtitle">Empty.</div>}
            {garrisonAlive.map((stack) => (
              <div key={stack.stackId} className="card-tile" style={{ minWidth: 160 }}>
                <div className="card-name">
                  <span>
                    {UNIT_ICONS[stack.unitId]} {UNIT_DEFINITIONS[stack.unitId].name} ×{stack.count}
                  </span>
                </div>
                <button disabled={armyFull} onClick={() => onTransferToArmy(stack.stackId)}>
                  Move to Army
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {panel === 'temple' && (
        <div className="city-panel">
          <div className="city-panel-header">
            <h3>⛩️ Temple — Doctrine</h3>
            <button onClick={() => setPanel(null)}>Close</button>
          </div>
          <div className="hand" style={{ flexWrap: 'wrap' }}>
            {Object.values(DOCTRINE_DEFINITIONS).map((doctrine) => {
              const chosen = city.doctrine === doctrine.id;
              const disabled = !!city.doctrine && !chosen;
              return (
                <div
                  key={doctrine.id}
                  className={`card-tile${chosen ? ' pending' : ''}${disabled ? ' disabled' : ''}`}
                  onClick={!city.doctrine ? () => onChooseDoctrine(doctrine.id) : undefined}
                >
                  <div className="card-name">
                    <span>{doctrine.name}</span>
                    {chosen && <span className="card-cost">chosen</span>}
                  </div>
                  <div className="card-text">{doctrine.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.values(BUILDING_DEFINITIONS).map((building) => {
        if (panel !== building.id) return null;
        const built = city.buildings.includes(building.id);
        const slotsFull = slotsUsed >= slotsMax;
        const affordable = gold >= building.cost;
        return (
          <div className="city-panel" key={building.id}>
            <div className="city-panel-header">
              <h3>
                {BUILDING_ICONS[building.id] ?? '🏚️'} {building.name}
              </h3>
              <button onClick={() => setPanel(null)}>Close</button>
            </div>
            <p className="subtitle">{building.description}</p>
            {built ? (
              <p className="subtitle">Already built.</p>
            ) : (
              <button disabled={slotsFull || !affordable} onClick={() => onBuild(building.id)}>
                Build ({building.cost}g){slotsFull ? ' — no free slots' : ''}
              </button>
            )}
          </div>
        );
      })}

      <div className="city-bottom-bar">
        <div className="side-hero-row">
          <div className="hero-portrait">🤴</div>
          <div>
            <strong>{hero.name}</strong>
            <div className="subtitle" style={{ margin: 0 }}>
              HP {hero.hp}/{hero.maxHp}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {garrisonAlive.length === 0 && <span className="subtitle">Garrison empty.</span>}
          {garrisonAlive.map((s) => (
            <span key={s.stackId} className="garrison-chip">
              {UNIT_ICONS[s.unitId]} {UNIT_DEFINITIONS[s.unitId].name} ×{s.count}
            </span>
          ))}
        </div>
      </div>

      <div className="city-gate-button" onClick={onLeave}>
        🚪 Leave City (through the Gate)
      </div>
    </div>
  );
}

const BUILDING_ICONS: Record<string, string> = {
  market: '🏪',
  gold_mine: '⛏️',
  mage_tower: '🗼',
  stable: '🐴',
  training_hall: '🥋',
  forge: '🔨',
  shrine: '⛲',
};
