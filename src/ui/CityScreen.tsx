import { useEffect, useState } from 'react';
import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, FARM_TIERS, LEVEL_SLOTS, LEVEL_UP_COST, MAGE_TOWER_TIERS, canRecruitUnit, cardRemovalQuote, cityRemovalPrice, farmDescription, mageTowerDescription, recruitCost } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { Position, UnitId } from '../engine/index.js';
import { BUILDING_ICONS } from './mapIcons.js';
import { Icon } from './pixel/Icon.js';
import { UnitArt } from './UnitArt.js';
import { GarrisonBar } from './GarrisonBar.js';
import { CardRemovalPicker } from './CardRemovalPicker.js';
import { Modal } from './Modal.js';
import { Tip } from './Tip.js';
import { buildingTip } from './tipContent.js';

interface Props {
  run: RunState;
  onRecruit: (unitId: UnitId, count: number) => void;
  onBuild: (buildingId: string) => void;
  onUpgradeCity: () => void;
  onUpgradeMageTower: () => void;
  onUpgradeFarm: () => void;
  onRemoveCard: (instanceId: string) => void;
  onChooseDoctrine: (doctrineId: string) => void;
  onOpenMenu: () => void;
  onLeave: () => void;
  onSplitStack: (stackId: string, splitCount: number) => void;
  onMergeStacks: (stackIdA: string, stackIdB: string) => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onDismissStack: (stackId: string, count?: number) => void;
}

const FIXED_NAMES = { townhall: 'Town Hall', barracks: 'Barracks', temple: 'Temple' } as const;
const FIXED_HINTS = {
  townhall: 'Upgrade the city for more building slots, and remove cards from your deck.',
  barracks: 'Recruit units into your army.',
  temple: 'Choose one permanent doctrine.',
} as const;

const RECRUITABLE: UnitId[] = ['swordsman', 'archer', 'knight', 'priest'];

type Panel = 'townhall' | 'barracks' | 'temple' | string | null;

/** Hand-placed scatter coordinates for the town-scene hotspots. */
const HOTSPOTS: Record<string, { top: string; left: string }> = {
  townhall: { top: '18%', left: '50%' },
  barracks: { top: '38%', left: '18%' },
  temple: { top: '55%', left: '50%' },
  market: { top: '58%', left: '15%' },
  gold_mine: { top: '60%', left: '85%' },
  mage_tower: { top: '68%', left: '33%' },
  farm: { top: '80%', left: '80%' },
  stable: { top: '68%', left: '67%' },
  training_hall: { top: '44%', left: '42%' },
  forge: { top: '46%', left: '62%' },
  shrine: { top: '72%', left: '50%' },
};

export function CityScreen({ run, onRecruit, onBuild, onUpgradeCity, onUpgradeMageTower, onUpgradeFarm, onRemoveCard, onChooseDoctrine, onOpenMenu, onLeave, onSplitStack, onMergeStacks, onMoveStack, onDismissStack }: Props) {
  const { city, gold, food, army, masterDeck: deck } = run;
  const removalQuote = cardRemovalQuote(run);
  const removalUses = run.cardRemoval.cityUses;
  const [panel, setPanel] = useState<Panel>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentRecruit, setRecentRecruit] = useState<{ unitId: UnitId; amount: number } | null>(null);
  const armyFull = army.filter((s) => s.count > 0).length >= 6;
  const nextLevel = city.level < 3 ? ((city.level + 1) as 2 | 3) : null;
  const slotsUsed = city.buildings.length;
  const slotsMax = LEVEL_SLOTS[city.level];

  useEffect(() => {
    if (!recentRecruit) return;
    const t = setTimeout(() => setRecentRecruit(null), 2200);
    return () => clearTimeout(t);
  }, [recentRecruit]);

  function togglePanel(id: Panel) {
    setPanel((p) => (p === id ? null : id));
  }

  function recruit(unitId: UnitId, count: number) {
    onRecruit(unitId, count);
    setRecentRecruit({ unitId, amount: count });
  }

  return (
    <div className="screen th-frame" data-screen="city">
      <div className="th-scene">
        <div className="th-skyline" />
        <div className="th-scene-label">Ironhold</div>

        {(['townhall', 'barracks', 'temple'] as const).map((id) => (
          <Tip key={id} tip={{ title: FIXED_NAMES[id], body: FIXED_HINTS[id] }}>
            <div className={`th-hotspot${panel === id ? ' active' : ''}`} style={HOTSPOTS[id]} onClick={() => togglePanel(id)}>
              <span className="th-hotspot-icon">
                <Icon name={BUILDING_ICONS[id]!} size={2} />
              </span>
              <span className="th-hotspot-name">{FIXED_NAMES[id]}</span>
              <span className="th-hotspot-sub">
                {id === 'townhall' && 'Level up'}
                {id === 'barracks' && 'Recruit'}
                {id === 'temple' && (city.doctrine ? DOCTRINE_DEFINITIONS[city.doctrine]?.name : 'Doctrine')}
              </span>
            </div>
          </Tip>
        ))}

        {Object.values(BUILDING_DEFINITIONS).map((building) => {
          const built = city.buildings.includes(building.id);
          const pos = HOTSPOTS[building.id] ?? { top: '50%', left: '50%' };
          return (
            <Tip key={building.id} tip={buildingTip(building, built, buildingText(building, city))}>
              <div className={`th-hotspot${panel === building.id ? ' active' : ''}${built ? '' : ' locked'}`} style={pos} onClick={() => togglePanel(building.id)}>
                <span className="th-hotspot-icon">
                  <Icon name={BUILDING_ICONS[building.id]!} size={2} />
                </span>
                <span className="th-hotspot-name">{building.name}</span>
                <span className="th-hotspot-sub">{built ? (building.id === 'mage_tower' ? `Tier ${ROMAN[city.mageTowerTier - 1]}` : building.id === 'farm' ? `Tier ${ROMAN[city.farmTier - 1]}` : 'Built') : `${building.cost}g`}</span>
              </div>
            </Tip>
          );
        })}
      </div>

      {panel && (
        <Modal heading={panelTitle(panel)} material="wood" onClose={() => setPanel(null)} width={560}>
          <div className="city-building-popup">
            {panel === 'townhall' && (
              <>
                <p className="subtitle">
                  City Level {city.level} — {slotsMax} building slots.
                </p>
                {nextLevel ? (
                  <button className="btn" onClick={onUpgradeCity} disabled={gold < LEVEL_UP_COST[nextLevel]}>
                    Upgrade to Level {nextLevel} ({LEVEL_UP_COST[nextLevel]}g)
                  </button>
                ) : (
                  <p className="subtitle">Already at maximum level.</p>
                )}
                <div className="divider" />
                <h3>Deck</h3>
                <p className="subtitle">
                  {removalUses === 0
                    ? `Card removal: the first is free, then ${cityRemovalPrice(1)}g, ${cityRemovalPrice(2)}g, ${cityRemovalPrice(3)}g and so on.`
                    : `Card removal now costs ${cityRemovalPrice(removalUses)}g, then ${cityRemovalPrice(removalUses + 1)}g, ${cityRemovalPrice(removalUses + 2)}g and so on.`}
                </p>
                <CardRemovalPicker deck={deck} quote={removalQuote} onRemove={onRemoveCard} />
              </>
            )}

            {panel === 'barracks' && (
              <>
                <div className="option-row">
                  {RECRUITABLE.map((unitId) => {
                    const unlocked = canRecruitUnit(city, unitId);
                    const count = counts[unitId] ?? 5;
                    const cost = unlocked ? recruitCost(city, unitId, count) : null;
                    const affordable = !!cost && gold >= cost.gold && food >= cost.food;
                    return (
                      <div key={unitId} className="option-tile">
                        <div className="option-name">
                          <span>
                            <UnitArt unitId={unitId} size={1} /> {UNIT_DEFINITIONS[unitId].name}
                          </span>
                        </div>
                        {!unlocked ? (
                          <div className="option-text">Not recruitable yet.</div>
                        ) : (
                          <>
                            <div className="option-text">
                              {cost!.gold}g / {cost!.food}f for {count}
                            </div>
                            <input
                              className="input count-input"
                              type="number"
                              min={1}
                              max={99}
                              value={count}
                              onChange={(e) => setCounts({ ...counts, [unitId]: Math.max(1, Number(e.target.value) || 1) })}
                            />
                            <div className="toolbar">
                              <button className="btn btn--s" disabled={!affordable || armyFull} onClick={() => recruit(unitId, count)}>
                                Recruit
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

            {panel === 'temple' && (
              <>
                <div className="option-row">
                  {Object.values(DOCTRINE_DEFINITIONS).map((doctrine) => {
                    const chosen = city.doctrine === doctrine.id;
                    const disabled = !!city.doctrine && !chosen;
                    return (
                      <div
                        key={doctrine.id}
                        className={`option-tile${chosen ? ' chosen' : ''}${disabled ? ' disabled' : ''}`}
                        onClick={!city.doctrine ? () => onChooseDoctrine(doctrine.id) : undefined}
                      >
                        <div className="option-name">
                          <span>{doctrine.name}</span>
                          {chosen && <span className="option-tag">chosen</span>}
                        </div>
                        <div className="option-text">{doctrine.description}</div>
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
                  <p className="subtitle">{buildingText(building, city)}</p>
                  {built && building.id === 'mage_tower' ? (
                    <MageTowerUpgrade tier={city.mageTowerTier} gold={gold} onUpgrade={onUpgradeMageTower} />
                  ) : built && building.id === 'farm' ? (
                    <FarmUpgrade tier={city.farmTier} gold={gold} onUpgrade={onUpgradeFarm} />
                  ) : built ? (
                    <p className="subtitle">Already built.</p>
                  ) : (
                    <button className="btn" disabled={slotsFull || !affordable} onClick={() => onBuild(building.id)}>
                      Build ({building.cost}g){slotsFull ? ' — no free slots' : ''}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      <GarrisonBar
        run={run}
        onLeave={onLeave}
        onOpenCardRemoval={() => setPanel('townhall')}
        recentRecruit={recentRecruit}
        onOpenMenu={onOpenMenu}
        onMoveStack={onMoveStack}
        onSplitStack={onSplitStack}
        onMergeStacks={onMergeStacks}
        onDismissStack={onDismissStack}
      />
    </div>
  );
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function buildingText(building: (typeof BUILDING_DEFINITIONS)[string], city: RunState['city']): string {
  if (building.id === 'mage_tower') return mageTowerDescription(city.mageTowerTier);
  if (building.id === 'farm') return farmDescription(city.farmTier);
  return building.description;
}

function panelTitle(panel: Panel): string {
  if (panel === 'townhall' || panel === 'barracks' || panel === 'temple') return FIXED_NAMES[panel];
  return (panel && BUILDING_DEFINITIONS[panel]?.name) || '';
}

function MageTowerUpgrade({ tier, gold, onUpgrade }: { tier: 0 | 1 | 2 | 3; gold: number; onUpgrade: () => void }) {
  const next = MAGE_TOWER_TIERS[tier];
  return (
    <>
      <p className="mage-tower-tier">Tier {ROMAN[tier - 1]}</p>
      {next ? (
        <button className="btn" disabled={gold < next.cost} onClick={onUpgrade}>
          Upgrade to Tier {ROMAN[tier]} - {next.cost} Gold
        </button>
      ) : (
        <p className="subtitle">Max tier</p>
      )}
    </>
  );
}

function FarmUpgrade({ tier, gold, onUpgrade }: { tier: number; gold: number; onUpgrade: () => void }) {
  const next = FARM_TIERS[tier];
  return (
    <>
      <p className="mage-tower-tier">
        Tier {ROMAN[tier - 1]}: +{FARM_TIERS[tier - 1]!.food} Food per day
      </p>
      {next ? (
        <button className="btn" disabled={gold < next.cost} onClick={onUpgrade}>
          Upgrade to Tier {ROMAN[tier]} - {next.cost} Gold
        </button>
      ) : (
        <p className="subtitle">Max tier</p>
      )}
    </>
  );
}
