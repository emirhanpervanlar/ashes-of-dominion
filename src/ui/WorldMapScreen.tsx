import { useEffect, useState } from 'react';
import type { Position } from '../engine/index.js';
import { CITY_VISIT_WARNING, THREAT_PER_CITY_VISIT, bossWarning, dailyFoodNet, daysUntilBoss, enemyStrengthAfterCityVisits, foodDaysLeft, foodWarning, starvationForecast } from '../engine/run/index.js';
import type { MapNode, RunState } from '../engine/run/index.js';
import { GarrisonBar } from './GarrisonBar.js';
import { StarvationLines } from './FoodPopup.js';
import { NODE_ICONS } from './mapIcons.js';
import { Modal } from './Modal.js';
import { Icon } from './pixel/Icon.js';
import { Tip } from './Tip.js';

interface Props {
  run: RunState;
  onMoveTo: (nodeId: string) => void;
  onEnterCity: () => void;
  onOpenMenu: () => void;
  onSplitStack: (stackId: string, splitCount: number, toPosition: Position) => void;
  onMergeStacks: (keepStackId: string, absorbStackId: string) => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
  onDismissStack: (stackId: string, count?: number) => void;
}

const NODE_LABELS: Record<MapNode['type'], string> = {
  start: 'Start',
  battle: 'Battle',
  elite_battle: 'Elite Battle',
  resource: 'Resource',
  merchant: 'Merchant',
  event: 'Event',
  boss: 'Boss',
};

/** Chapters whose boss-warning banner was already shown this session ("once when entering the window"). */
const announcedChapters = new Set<number>();

const strengthText = (multiplier: number): string => `x${multiplier.toFixed(2)}`;

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onOpenMenu, onSplitStack, onMergeStacks, onMoveStack, onDismissStack }: Props) {
  const [confirmCity, setConfirmCity] = useState(false);
  const warning = bossWarning(run);
  const [bannerOpen, setBannerOpen] = useState(() => warning && !announcedChapters.has(run.chapter));

  useEffect(() => {
    if (!bannerOpen) return;
    announcedChapters.add(run.chapter);
    const t = setTimeout(() => setBannerOpen(false), 6000);
    return () => clearTimeout(t);
  }, [bannerOpen, run.chapter]);

  const revealedUntil = run.worldMap.revealedUntilStep ?? -1;
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const lastLayer = Math.max(...run.worldMap.nodes.map((n) => n.layer));
  const nextChoices = current.connectsTo
    .map((id) => run.worldMap.nodes.find((n) => n.id === id))
    .filter((n): n is MapNode => !!n && (n.visibility !== 'unknown' || n.layer <= revealedUntil));
  const scouted = Array.from({ length: Math.max(0, revealedUntil - current.layer - 1) }, (_, i) => current.layer + 2 + i)
    .filter((layer) => layer <= lastLayer)
    .map((layer) => ({ layer, nodes: run.worldMap.nodes.filter((n) => n.layer === layer) }));

  const forecast = starvationForecast(run);
  const daysLeft = foodDaysLeft(run);

  return (
    <div className="screen garrison-frame" data-screen="map">
      <div className="garrison-scene">
        {bannerOpen && (
          <div className="boss-banner" onClick={() => setBannerOpen(false)}>
            <Icon name="node_boss" size={2} />
            <span>The boss draws near: {daysUntilBoss(run)} {daysUntilBoss(run) === 1 ? 'day' : 'days'} left.</span>
          </div>
        )}

        <div className="path-progress">
          Chapter {run.chapter} — Step {current.layer} / {lastLayer}
        </div>
        <div className="current-location-row">
          <div className={`current-location-badge node-${current.type}`}>
            <span className="current-location-icon">
              <Icon name={NODE_ICONS[current.type]} size={2} />
            </span>
            <span>You are here — {NODE_LABELS[current.type]}</span>
          </div>
          <button className="btn btn--primary" onClick={() => setConfirmCity(true)}>
            <Icon name="node_city" /> Enter City
          </button>
        </div>

        {foodWarning(run) && (
          <div className="food-alert">
            <Icon name="ui_warn" />
            {forecast.willStarve || forecast.consecutiveDays > 0 ? (
              <StarvationLines forecast={forecast} />
            ) : (
              <span>
                Food is running low: {run.food} left, {dailyFoodNet(run)} per day, about {daysLeft} {daysLeft === 1 ? 'day' : 'days'} until the army starves.
              </span>
            )}
          </div>
        )}

        <div className="path-choice-heading">Choose Your Path</div>
        <div className="path-choice-row">
          {nextChoices.length === 0 && <div className="subtitle">This is the end of the road.</div>}
          {nextChoices.map((node) => (
            <div key={node.id} className={`path-choice-card node-${node.type}`} onClick={() => onMoveTo(node.id)}>
              <span className="path-choice-badge">
                <Icon name={NODE_ICONS[node.type]} size={3} />
              </span>
              <div className="path-choice-name">{NODE_LABELS[node.type]}</div>
            </div>
          ))}
        </div>

        {scouted.length > 0 && (
          <div className="scout-strip">
            <span className="scout-strip-label">Scouted ahead</span>
            {scouted.map(({ layer, nodes }) => (
              <Tip key={layer} tip={`Step ${layer}`}>
                <div className="scout-strip-layer">
                  {nodes.map((n) => (
                    <Tip key={n.id} tip={NODE_LABELS[n.type]}>
                      <span className={`scout-strip-node node-${n.type}`}>
                        <Icon name={NODE_ICONS[n.type]} />
                      </span>
                    </Tip>
                  ))}
                </div>
              </Tip>
            ))}
          </div>
        )}
      </div>

      <GarrisonBar
        run={run}
        onOpenMenu={onOpenMenu}
        onMoveStack={onMoveStack}
        onSplitStack={onSplitStack}
        onMergeStacks={onMergeStacks}
        onDismissStack={onDismissStack}
      />

      {confirmCity && (
        <Modal
          heading="Enter the City?"
          onClose={() => setConfirmCity(false)}
          width={600}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmCity(false)}>
                Stay on the Road
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setConfirmCity(false);
                  onEnterCity();
                }}
              >
                Enter City
              </button>
            </>
          }
        >
          <p className="city-confirm-warning">
            <Icon name="threat" /> {CITY_VISIT_WARNING}
          </p>
          <div className="city-confirm-rows">
            <div className="food-popup-row">
              <span>Enemy strength now (Threat {run.threat})</span>
              <span>{strengthText(enemyStrengthAfterCityVisits(run))}</span>
            </div>
            <div className="food-popup-row food-popup-net negative">
              <span>After this visit (Threat {run.threat + THREAT_PER_CITY_VISIT})</span>
              <span>{strengthText(enemyStrengthAfterCityVisits(run, 1))}</span>
            </div>
          </div>
          <p className="subtitle">The visit costs no days or Food.</p>
        </Modal>
      )}
    </div>
  );
}
