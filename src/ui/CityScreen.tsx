import { useEffect, useState } from 'react';
import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, LEVEL_SLOTS, LEVEL_UP_COST, canRecruitUnit, recruitCost } from '../engine/run/index.js';
import type { CityState } from '../engine/run/index.js';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack, UnitId } from '../engine/index.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS } from './unitShapes.js';

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

const RECRUITABLE: UnitId[] = ['swordsman', 'archer', 'knight', 'priest'];

type Panel = 'townhall' | 'barracks' | 'garrison' | 'temple' | string | null;

/** Hand-placed scatter coordinates for the town-scene hotspots. */
const HOTSPOTS: Record<string, { top: string; left: string }> = {
  townhall: { top: '18%', left: '50%' },
  barracks: { top: '38%', left: '18%' },
  garrison: { top: '34%', left: '80%' },
  temple: { top: '55%', left: '50%' },
  market: { top: '58%', left: '15%' },
  gold_mine: { top: '60%', left: '85%' },
  mage_tower: { top: '68%', left: '33%' },
  stable: { top: '68%', left: '67%' },
  training_hall: { top: '44%', left: '42%' },
  forge: { top: '46%', left: '62%' },
  shrine: { top: '72%', left: '50%' },
};

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
  const [recentRecruit, setRecentRecruit] = useState<{ unitId: UnitId; amount: number } | null>(null);
  const armyFull = army.filter((s) => s.count > 0).length >= 6;
  const nextLevel = city.level < 3 ? ((city.level + 1) as 2 | 3) : null;
  const slotsUsed = city.buildings.length;
  const slotsMax = LEVEL_SLOTS[city.level];
  const garrisonAlive = city.garrison.filter((s) => s.count > 0);

  useEffect(() => {
    if (!recentRecruit) return;
    const t = setTimeout(() => setRecentRecruit(null), 2200);
    return () => clearTimeout(t);
  }, [recentRecruit]);

  function togglePanel(id: Panel) {
    setPanel((p) => (p === id ? null : id));
  }

  function recruitToArmy(unitId: UnitId, count: number) {
    onRecruit(unitId, count, 'army');
    setRecentRecruit({ unitId, amount: count });
  }

  return (
    <div className="th-frame">
      <div className="th-scene">
        <div className="th-skyline" />
        <div className="th-scene-label">Ironhold</div>

        {(['townhall', 'barracks', 'garrison', 'temple'] as const).map((id) => (
          <div
            key={id}
            className={`th-hotspot${panel === id ? ' active' : ''}`}
            style={HOTSPOTS[id]}
            onClick={() => togglePanel(id)}
          >
            <span className="th-hotspot-icon">{id === 'townhall' ? '🏛️' : id === 'barracks' ? '⚔️' : id === 'garrison' ? '🏯' : '⛩️'}</span>
            <span className="th-hotspot-name">{id === 'townhall' ? 'Town Hall' : id === 'barracks' ? 'Barracks' : id === 'garrison' ? 'Fort' : 'Temple'}</span>
            <span className="th-hotspot-sub">
              {id === 'townhall' && 'Level up'}
              {id === 'barracks' && 'Recruit'}
              {id === 'garrison' && `Garrison (${garrisonAlive.length})`}
              {id === 'temple' && (city.doctrine ? DOCTRINE_DEFINITIONS[city.doctrine]?.name : 'Doctrine')}
            </span>
          </div>
        ))}

        {Object.values(BUILDING_DEFINITIONS).map((building) => {
          const built = city.buildings.includes(building.id);
          const pos = HOTSPOTS[building.id] ?? { top: '50%', left: '50%' };
          return (
            <div
              key={building.id}
              className={`th-hotspot${panel === building.id ? ' active' : ''}${built ? '' : ' locked'}`}
              style={pos}
              onClick={() => togglePanel(building.id)}
            >
              <span className="th-hotspot-icon">{BUILDING_ICONS[building.id] ?? '🏚️'}</span>
              <span className="th-hotspot-name">{building.name}</span>
              <span className="th-hotspot-sub">{built ? 'Built' : `${building.cost}g`}</span>
            </div>
          );
        })}
      </div>

      {panel && (
        <>
          <div className="modal-backdrop" onClick={() => setPanel(null)} />
          <div className="city-building-popup">
            <button className="modal-close" onClick={() => setPanel(null)}>
              ✕
            </button>

            {panel === 'townhall' && (
              <>
                <h3>🏛️ Town Hall</h3>
                <p className="subtitle">
                  City Level {city.level} — {slotsMax} building slots.
                </p>
                {nextLevel ? (
                  <button onClick={onUpgradeCity} disabled={gold < LEVEL_UP_COST[nextLevel]}>
                    Upgrade to Level {nextLevel} ({LEVEL_UP_COST[nextLevel]}g)
                  </button>
                ) : (
                  <p className="subtitle">Already at maximum level.</p>
                )}
              </>
            )}

            {panel === 'barracks' && (
              <>
                <h3>⚔️ Barracks — Recruit</h3>
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
                          <div className="card-text">Not recruitable yet.</div>
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
                              <button disabled={!affordable || armyFull} onClick={() => recruitToArmy(unitId, count)}>
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
              </>
            )}

            {panel === 'garrison' && (
              <>
                <h3>🏯 Fort — Garrison</h3>
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
              </>
            )}

            {panel === 'temple' && (
              <>
                <h3>⛩️ Temple — Doctrine</h3>
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
              </>
            )}

            {Object.values(BUILDING_DEFINITIONS).map((building) => {
              if (panel !== building.id) return null;
              const built = city.buildings.includes(building.id);
              const slotsFull = slotsUsed >= slotsMax;
              const affordable = gold >= building.cost;
              return (
                <div key={building.id}>
                  <h3>
                    {BUILDING_ICONS[building.id] ?? '🏚️'} {building.name}
                  </h3>
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
          </div>
        </>
      )}

      <div className="th-infobar">
        <div className="th-hero-block">
          <div className="hero-portrait">🤴</div>
          <div className="garrison-hero-info">
            <strong>{hero.name}</strong>
            <div className="subtitle" style={{ margin: 0 }}>
              HP {hero.hp}/{hero.maxHp}
            </div>
          </div>
        </div>

        <div className="th-army-row">
          {army
            .filter((s) => s.count > 0)
            .map((s) => (
              <div key={s.stackId} className="garrison-slot" title={UNIT_DEFINITIONS[s.unitId].name}>
                <span className="garrison-slot-icon">{UNIT_ICONS[s.unitId]}</span>
                <span className="garrison-slot-role">{UNIT_ROLE_ICONS[s.unitId]}</span>
                <span className="garrison-slot-count">{s.count}</span>
                {recentRecruit?.unitId === s.unitId && <span className="recruit-flourish">+{recentRecruit.amount}</span>}
              </div>
            ))}
        </div>

        <div className="th-resource-row">
          <div className="garrison-resource-chip">
            <span>💰</span> {gold}
          </div>
          <div className="garrison-resource-chip">
            <span>🌾</span> {food}
          </div>
          <div className="garrison-resource-chip">
            <span>🏗️</span> {slotsUsed}/{slotsMax}
          </div>
          <div className="garrison-resource-chip">
            <span>👑</span> Lvl {city.level}
          </div>
        </div>
      </div>

      <div className="merchant-leave-ribbon" onClick={onLeave}>
        Leave
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
