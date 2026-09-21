import { useEffect, useState } from 'react';
import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, LEVEL_SLOTS, MAGE_TOWER_TIERS, THREAT_PER_CITY_VISIT, farmDescription, farmProduction, garrisonUnits, mageTowerDescription, threatMultiplier } from '../engine/run/index.js';
import type { RunEvent, RunState } from '../engine/run/index.js';
import type { Position, UnitId } from '../engine/index.js';
import { Icon } from './pixel/Icon.js';
import type { IconName } from './pixel/icons.js';
import { FoodPopup } from './FoodPopup.js';
import { GarrisonBar } from './GarrisonBar.js';
import { GoldPopup } from './GoldPopup.js';
import { ScrollArea } from './ScrollArea.js';
import { Tip } from './Tip.js';
import { TitleSkyline } from './TitleSkyline.js';
import { buildingTip } from './tipContent.js';
import type { TipContent } from './tipContent.js';
import { BarracksPanel } from './city/BarracksPanel.js';
import { BuildingPanel } from './city/BuildingPanel.js';
import { EffectsPanel } from './city/EffectsPanel.js';
import { MarketplacePanel } from './city/MarketplacePanel.js';
import { TemplePanel } from './city/TemplePanel.js';
import { TierLadderPanel } from './city/TierLadderPanel.js';
import { TownHallPanel } from './city/TownHallPanel.js';
import { FIXED_BUILDINGS, FIXED_BUILDING_INFO, SCENE_BUILDINGS, buildBlocker, buildingArt, buildingLevel, levelLabel, plotState } from './city/cityView.js';
import type { BuildingLevel, FixedBuildingId, PlotState } from './city/cityView.js';

interface Props {
  run: RunState;
  onRecruit: (unitId: UnitId, count: number) => void;
  onBuild: (buildingId: string) => void;
  onUpgradeBarracks: () => void;
  onCollectGarrison: (unitId: UnitId) => void;
  onBuyFood: (packs: number) => void;
  onUpgradeCity: () => void;
  onUpgradeMageTower: () => void;
  onUpgradeFarm: () => void;
  onRemoveCard: (instanceId: string) => void;
  onChooseDoctrine: (doctrineId: string) => void;
  onOpenMenu: () => void;
  onLeave: () => void;
  onSplitStack: (stackId: string, splitCount: number, toPosition: Position) => void;
  onSplitMerge: (stackId: string, splitCount: number, targetStackId: string) => void;
  onMergeStacks: (keepStackId: string, absorbStackId: string) => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onDismissStack: (stackId: string, count?: number) => void;
}

const CITY_NAME = 'Ironhold';

/** The visit that brought the player here (AO-D070 free visits do not raise Threat), or null when the log no longer holds it. */
function lastCityVisit(log: RunEvent[]): Extract<RunEvent, { type: 'CITY_VISITED' }> | null {
  return [...log].reverse().find((e): e is Extract<RunEvent, { type: 'CITY_VISITED' }> => e.type === 'CITY_VISITED') ?? null;
}

/** The description a plot's tip shows: the Mage Tower and Farm describe their tier, the rest their engine text. */
function buildingText(id: string, city: RunState['city']): string {
  if (id === 'mage_tower') return mageTowerDescription(city.mageTowerTier);
  if (id === 'farm') return farmDescription(city.farmTier);
  return BUILDING_DEFINITIONS[id]!.description;
}

interface PlotProps {
  id: string;
  name: string;
  icon: IconName;
  /** Shown in the corner of the art: "Lv 2", or "Max" at the top level; null while not built. */
  level: BuildingLevel | null;
  state: PlotState | 'open';
  status: string;
  active: boolean;
  tip: TipContent;
  onOpen: () => void;
}

function Plot({ id, name, icon, level, state, status, active, tip, onOpen }: PlotProps) {
  return (
    <Tip tip={tip}>
      <button className={`city-plot city-plot--${state}${active ? ' active' : ''}`} data-building={id} onClick={onOpen}>
        <span className="city-plot-art">
          <Icon name={icon} size={4} />
          {level && <span className={`city-plot-level${level.level >= level.max ? ' city-plot-level--max' : ''}`}>{levelLabel(level)}</span>}
          {state === 'locked' && (
            <span className="city-plot-badge city-plot-badge--locked">
              <Icon name="ui_blocked" />
            </span>
          )}
        </span>
        <span className="city-plot-sign">
          <span className="city-plot-name">{name}</span>
          <span className="city-plot-status">{status}</span>
        </span>
      </button>
    </Tip>
  );
}

export function CityScreen({ run, onRecruit, onBuild, onUpgradeBarracks, onCollectGarrison, onBuyFood, onUpgradeCity, onUpgradeMageTower, onUpgradeFarm, onRemoveCard, onChooseDoctrine, onOpenMenu, onLeave, onSplitStack, onSplitMerge, onMergeStacks, onMoveStack, onDismissStack }: Props) {
  const { city } = run;
  const visit = lastCityVisit(run.log);
  const [panel, setPanel] = useState<string | null>(null);
  const [popup, setPopup] = useState<'gold' | 'food' | null>(null);
  const [recentRecruit, setRecentRecruit] = useState<{ unitId: UnitId; amount: number } | null>(null);

  useEffect(() => {
    if (!recentRecruit) return;
    const t = setTimeout(() => setRecentRecruit(null), 2200);
    return () => clearTimeout(t);
  }, [recentRecruit]);

  function recruit(unitId: UnitId, count: number) {
    onRecruit(unitId, count);
    setRecentRecruit({ unitId, amount: count });
  }

  const waiting = garrisonUnits(run.garrison).reduce((sum, u) => sum + u.count, 0);
  const fixedStatus: Record<FixedBuildingId, string> = {
    townhall: `${city.buildings.length}/${LEVEL_SLOTS[city.level]} slots`,
    barracks: waiting > 0 ? `${waiting} waiting` : 'Recruit',
    marketplace: 'Buy Food',
    temple: city.doctrine ? (DOCTRINE_DEFINITIONS[city.doctrine]?.name ?? 'Chosen') : 'Choose',
  };

  function optionalStatus(id: string, state: PlotState): string {
    if (state === 'built') return id === 'mage_tower' ? `Mana +${MAGE_TOWER_TIERS[city.mageTowerTier - 1]!.maxMana}` : id === 'farm' ? `+${farmProduction(city)} Food/day` : 'Built';
    if (state === 'locked') return 'No free slot';
    return `${state === 'unaffordable' ? 'Need' : 'Build'} ${BUILDING_DEFINITIONS[id]!.cost}g`;
  }

  return (
    <div className="screen city-frame" data-screen="city">
      <div className="city-scene">
        <ScrollArea wrapClassName="city-scroll" className="city-content">
          <div className="city-town">
            <header className="city-header">
              <TitleSkyline fit="contain" />
              <div className="plaque plaque--wood city-name">{CITY_NAME}</div>
              <div className="city-header-stats">
                <span className="pill">Level {city.level}</span>
                <span className="pill">
                  <Icon name="slots" /> {city.buildings.length}/{LEVEL_SLOTS[city.level]}
                </span>
                <span className="pill pill--gold">
                  <Icon name="gold" /> {run.gold}
                </span>
              </div>
            </header>
            <div className={`city-threat${visit?.free ? ' city-threat--free' : ''}`}>
              <Icon name="threat" />
              <span>
                {visit?.free
                  ? `No Threat increase: the first visit of the chapter is free. Threat stays at ${run.threat}: enemy armies are x${threatMultiplier(run.threat).toFixed(2)} their normal size. Later visits make the enemies stronger (Threat +${THREAT_PER_CITY_VISIT}).`
                  : `Each visit to the city makes the enemies stronger (Threat +${THREAT_PER_CITY_VISIT}). Threat is ${run.threat}: enemy armies are x${threatMultiplier(run.threat).toFixed(2)} their normal size.`}
              </span>
            </div>

            <div className="city-plots">
              {FIXED_BUILDINGS.map((id) => {
                const level = buildingLevel(city, id);
                return (
                  <Plot
                    key={id}
                    id={id}
                    name={FIXED_BUILDING_INFO[id].name}
                    icon={buildingArt(id, level)}
                    level={level}
                    state={id === 'barracks' ? 'built' : 'open'}
                    status={fixedStatus[id]}
                    active={panel === id}
                    tip={{ title: FIXED_BUILDING_INFO[id].name, body: FIXED_BUILDING_INFO[id].hint }}
                    onOpen={() => setPanel(id)}
                  />
                );
              })}
              {SCENE_BUILDINGS.map((id) => {
                const state = plotState(run, id);
                const def = BUILDING_DEFINITIONS[id]!;
                const level = buildingLevel(city, id);
                return (
                  <Plot
                    key={id}
                    id={id}
                    name={def.name}
                    icon={buildingArt(id, level)}
                    level={level}
                    state={state}
                    status={optionalStatus(id, state)}
                    active={panel === id}
                    tip={buildingTip(def, state === 'built', buildingText(id, city), buildBlocker(run, id))}
                    onOpen={() => setPanel(id)}
                  />
                );
              })}
            </div>
          </div>
          <EffectsPanel run={run} onOpenGold={() => setPopup('gold')} onOpenFood={() => setPopup('food')} />
        </ScrollArea>
      </div>

      {panel === 'townhall' && <TownHallPanel run={run} onUpgradeCity={onUpgradeCity} onRemoveCard={onRemoveCard} onClose={() => setPanel(null)} />}
      {panel === 'barracks' && (
        <BarracksPanel run={run} recent={recentRecruit} onRecruit={recruit} onUpgrade={onUpgradeBarracks} onClose={() => setPanel(null)} />
      )}
      {panel === 'marketplace' && <MarketplacePanel run={run} onBuy={onBuyFood} onClose={() => setPanel(null)} />}
      {panel === 'temple' && <TemplePanel run={run} onChoose={onChooseDoctrine} onClose={() => setPanel(null)} />}
      {(panel === 'mage_tower' || panel === 'farm') && (
        <TierLadderPanel kind={panel} run={run} onBuild={onBuild} onUpgrade={panel === 'farm' ? onUpgradeFarm : onUpgradeMageTower} onClose={() => setPanel(null)} />
      )}
      {panel && SCENE_BUILDINGS.includes(panel) && panel !== 'mage_tower' && panel !== 'farm' && (
        <BuildingPanel run={run} buildingId={panel} onBuild={onBuild} onClose={() => setPanel(null)} />
      )}

      {popup === 'gold' && <GoldPopup run={run} onClose={() => setPopup(null)} />}
      {popup === 'food' && <FoodPopup run={run} onClose={() => setPopup(null)} />}

      <GarrisonBar
        run={run}
        onLeave={onLeave}
        onCollectGarrison={onCollectGarrison}
        onOpenCardRemoval={() => setPanel('townhall')}
        recentRecruit={recentRecruit}
        onOpenMenu={onOpenMenu}
        onMoveStack={onMoveStack}
        onSplitStack={onSplitStack}
        onSplitMerge={onSplitMerge}
        onMergeStacks={onMergeStacks}
        onDismissStack={onDismissStack}
      />
    </div>
  );
}
