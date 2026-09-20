import { useEffect, useState } from 'react';
import { BUILDING_DEFINITIONS, DOCTRINE_DEFINITIONS, LEVEL_SLOTS, THREAT_PER_CITY_VISIT, farmDescription, mageTowerDescription, threatMultiplier } from '../engine/run/index.js';
import type { RunState } from '../engine/run/index.js';
import type { Position, UnitId } from '../engine/index.js';
import { BUILDING_ICONS } from './mapIcons.js';
import { Icon } from './pixel/Icon.js';
import type { IconName } from './pixel/icons.js';
import { GarrisonBar } from './GarrisonBar.js';
import { Tip } from './Tip.js';
import { TitleSkyline } from './TitleSkyline.js';
import { buildingTip } from './tipContent.js';
import type { TipContent } from './tipContent.js';
import { BarracksPanel } from './city/BarracksPanel.js';
import { BuildingPanel } from './city/BuildingPanel.js';
import { EffectsPanel } from './city/EffectsPanel.js';
import { TemplePanel } from './city/TemplePanel.js';
import { TierLadderPanel } from './city/TierLadderPanel.js';
import { TownHallPanel } from './city/TownHallPanel.js';
import { FIXED_BUILDINGS, FIXED_BUILDING_INFO, ROMAN, SCENE_BUILDINGS, buildBlocker, plotState } from './city/cityView.js';
import type { FixedBuildingId, PlotState } from './city/cityView.js';

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
  onSplitStack: (stackId: string, splitCount: number, toPosition: Position) => void;
  onMergeStacks: (keepStackId: string, absorbStackId: string) => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onDismissStack: (stackId: string, count?: number) => void;
}

const CITY_NAME = 'Ironhold';

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
  state: PlotState | 'open';
  status: string;
  wide?: boolean;
  active: boolean;
  tip: TipContent;
  onOpen: () => void;
}

function Plot({ id, name, icon, state, status, wide, active, tip, onOpen }: PlotProps) {
  return (
    <Tip tip={tip}>
      <button className={`city-plot city-plot--${state}${wide ? ' city-plot--wide' : ''}${active ? ' active' : ''}`} data-building={id} onClick={onOpen}>
        <span className="city-plot-art">
          <Icon name={icon} size={4} />
          {state === 'built' && (
            <span className="city-plot-badge city-plot-badge--built">
              <Icon name="ui_check" />
            </span>
          )}
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

export function CityScreen({ run, onRecruit, onBuild, onUpgradeCity, onUpgradeMageTower, onUpgradeFarm, onRemoveCard, onChooseDoctrine, onOpenMenu, onLeave, onSplitStack, onMergeStacks, onMoveStack, onDismissStack }: Props) {
  const { city } = run;
  const [panel, setPanel] = useState<string | null>(null);
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

  const fixedStatus: Record<FixedBuildingId, string> = {
    townhall: `Level ${city.level}`,
    barracks: 'Recruit',
    temple: city.doctrine ? (DOCTRINE_DEFINITIONS[city.doctrine]?.name ?? 'Chosen') : 'Choose',
  };

  function optionalStatus(id: string, state: PlotState): string {
    if (state === 'built') return id === 'mage_tower' ? `Tier ${ROMAN[city.mageTowerTier - 1]}` : id === 'farm' ? `Tier ${ROMAN[city.farmTier - 1]}` : 'Built';
    if (state === 'locked') return 'No free slot';
    return `${state === 'unaffordable' ? 'Need' : 'Build'} ${BUILDING_DEFINITIONS[id]!.cost}g`;
  }

  return (
    <div className="screen city-frame" data-screen="city">
      <div className="city-scene">
        <div className="city-content">
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
            <div className="city-threat">
              <Icon name="threat" />
              <span>
                Each visit to the city makes the enemies stronger (Threat +{THREAT_PER_CITY_VISIT}). Threat is {run.threat}: enemy armies are x{threatMultiplier(run.threat).toFixed(2)} their normal size.
              </span>
            </div>

            <div className="city-plots">
              {FIXED_BUILDINGS.map((id) => (
                <Plot
                  key={id}
                  id={id}
                  name={FIXED_BUILDING_INFO[id].name}
                  icon={BUILDING_ICONS[id]!}
                  state="open"
                  status={fixedStatus[id]}
                  wide={id === 'townhall'}
                  active={panel === id}
                  tip={{ title: FIXED_BUILDING_INFO[id].name, body: FIXED_BUILDING_INFO[id].hint }}
                  onOpen={() => setPanel(id)}
                />
              ))}
              {SCENE_BUILDINGS.map((id) => {
                const state = plotState(run, id);
                const def = BUILDING_DEFINITIONS[id]!;
                return (
                  <Plot
                    key={id}
                    id={id}
                    name={def.name}
                    icon={BUILDING_ICONS[id]!}
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
          <EffectsPanel run={run} />
        </div>
      </div>

      {panel === 'townhall' && <TownHallPanel run={run} onUpgradeCity={onUpgradeCity} onRemoveCard={onRemoveCard} onClose={() => setPanel(null)} />}
      {panel === 'barracks' && <BarracksPanel run={run} recent={recentRecruit} onRecruit={recruit} onClose={() => setPanel(null)} />}
      {panel === 'temple' && <TemplePanel run={run} onChoose={onChooseDoctrine} onClose={() => setPanel(null)} />}
      {(panel === 'mage_tower' || panel === 'farm') && (
        <TierLadderPanel kind={panel} run={run} onBuild={onBuild} onUpgrade={panel === 'farm' ? onUpgradeFarm : onUpgradeMageTower} onClose={() => setPanel(null)} />
      )}
      {panel && SCENE_BUILDINGS.includes(panel) && panel !== 'mage_tower' && panel !== 'farm' && (
        <BuildingPanel run={run} buildingId={panel} onBuild={onBuild} onClose={() => setPanel(null)} />
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
