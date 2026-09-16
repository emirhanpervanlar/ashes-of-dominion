import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { ArmyStack } from '../engine/index.js';
import type { RunState } from '../engine/run/index.js';
import type { MapNode } from '../engine/run/index.js';
import { HistoryPanel } from './HistoryPanel.js';
import { describeRunEvent } from './runEventText.js';
import { relicIcon } from './relicIcons.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UnitPopup } from './UnitPopup.js';

interface Props {
  run: RunState;
  onMoveTo: (nodeId: string) => void;
  onEnterCity: () => void;
  onNewRun: () => void;
}

const NODE_LABELS: Record<MapNode['type'], string> = {
  road: 'Road',
  battle: 'Battle',
  elite_battle: 'Elite Battle',
  resource: 'Resource',
  merchant: 'Merchant',
  event: 'Event',
  city: 'City',
  boss: 'Boss',
};

const NODE_ICONS: Record<MapNode['type'], string> = {
  road: '·',
  battle: '⚔️',
  elite_battle: '☠️',
  resource: '💰',
  merchant: '🛒',
  event: '❓',
  city: '🏰',
  boss: '👑',
};

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onNewRun }: Props) {
  const [popupStack, setPopupStack] = useState<ArmyStack | null>(null);
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layerCount = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;
  const layers = Array.from({ length: layerCount }, (_, layer) => run.worldMap.nodes.filter((n) => n.layer === layer));
  const historyLines = run.log.map(describeRunEvent).filter((line): line is string => line !== null);
  const hpPct = Math.max(0, Math.min(100, (run.hero.hp / run.hero.maxHp) * 100));

  return (
    <div>
      <h1>Ashes of Dominion — World Map</h1>

      <div className="toolbar">
        <button onClick={onNewRun}>New Run</button>
        {current.type === 'city' && (
          <button className="primary" onClick={onEnterCity}>
            Enter City
          </button>
        )}
      </div>

      <div className="road-layout">
        <div className="road-sidebar-left">
          <div className="side-block">
            <div className="side-hero-row">
              <div className="hero-portrait">🤴</div>
              <div>
                <strong>{run.hero.name}</strong>
                <div className="bar" style={{ width: 120, marginTop: 4 }}>
                  <div className={`bar-fill-hp${hpPct < 30 ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
                </div>
                <div className="subtitle" style={{ margin: 0 }}>
                  HP {run.hero.hp}/{run.hero.maxHp}
                </div>
              </div>
            </div>
          </div>

          <div className="side-block">
            <h4>Army</h4>
            {run.army
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.stackId} className="army-unit-card" onClick={() => setPopupStack(s)}>
                  <span className="army-unit-icon">{UNIT_ICONS[s.unitId]}</span>
                  <span className="army-unit-name">{UNIT_DEFINITIONS[s.unitId].name}</span>
                  <span className="army-unit-count">{s.count}</span>
                </div>
              ))}
          </div>

          <div className="side-block">
            <h4>Relics</h4>
            {run.relics.length === 0 && <div className="subtitle" style={{ margin: 0 }}>None yet.</div>}
            {run.relics.map((r) => (
              <div key={r.id} className="side-relic-line">
                <span className="relic-icon">{relicIcon(r.id)}</span>
                <div className="side-relic-text">
                  <span>{r.name}</span>
                  <span className="relic-desc">{r.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="side-block">
            <h4>Resources</h4>
            <div className="resource-card-row">
              <div className="resource-card">
                <span className="resource-card-icon">💰</span>
                <span className="resource-card-value">{run.gold}</span>
                <span className="resource-card-label">Gold</span>
              </div>
              <div className="resource-card">
                <span className="resource-card-icon">🌾</span>
                <span className="resource-card-value">{run.food}</span>
                <span className="resource-card-label">Food</span>
              </div>
            </div>
          </div>

          <div className="day-block">
            <span className="resource-card-icon">⏳</span>
            <span className="resource-card-value">Day {run.day}</span>
          </div>
        </div>

        <div className="road-main">
          <div className="map-column">
            {layers.map((nodes, layer) => (
              <div key={layer}>
                <div className="map-layer">
                  {nodes.map((node) => {
                    const isCurrent = node.id === current.id;
                    const isSelectable = !isCurrent && current.connectsTo.includes(node.id) && node.visibility !== 'unknown';
                    const classes = ['stack-tile'];
                    if (isCurrent) classes.push('selected', 'player');
                    else if (isSelectable) classes.push('selectable', 'player');
                    else classes.push('empty');
                    const known = node.visibility !== 'unknown';
                    return (
                      <div key={node.id} className={classes.join(' ')} onClick={isSelectable ? () => onMoveTo(node.id) : undefined}>
                        <div className="stack-name">
                          <span>
                            {known ? NODE_ICONS[node.type] : '?'} {known ? NODE_LABELS[node.type] : 'Unknown'}
                          </span>
                        </div>
                        <div className="badges">
                          <span className="badge">layer {node.layer}</span>
                          {isCurrent && <span className="badge">you are here</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {layer < layers.length - 1 && <div className="map-connector">│</div>}
              </div>
            ))}
          </div>
        </div>

        <HistoryPanel title="History" lines={historyLines} />
      </div>

      {popupStack && <UnitPopup stack={popupStack} onClose={() => setPopupStack(null)} />}
    </div>
  );
}
