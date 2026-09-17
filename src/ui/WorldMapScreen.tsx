import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
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
  onSplitStack: (stackId: string, splitCount: number) => void;
  onMergeStacks: (stackIdA: string, stackIdB: string) => void;
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

const NODE_ACCENTS: Record<MapNode['type'], string> = {
  road: '#6b7280',
  battle: '#c85c5c',
  elite_battle: '#8b2f2f',
  resource: '#d4af37',
  merchant: '#4a90d9',
  event: '#a05cd9',
  city: '#e0b34c',
  boss: '#e0503c',
};

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onNewRun, onSplitStack, onMergeStacks }: Props) {
  const [popupStackId, setPopupStackId] = useState<string | null>(null);
  const popupStack = popupStackId ? run.army.find((s) => s.stackId === popupStackId && s.count > 0) ?? null : null;
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layerCount = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;
  const nextChoices = current.connectsTo
    .map((id) => run.worldMap.nodes.find((n) => n.id === id))
    .filter((n): n is MapNode => !!n && n.visibility !== 'unknown');
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
                <div key={s.stackId} className="army-unit-card" onClick={() => setPopupStackId(s.stackId)}>
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
          <div className="path-progress">
            Layer {current.layer + 1} / {layerCount}
          </div>
          <div className="current-location-badge" style={{ '--pc-color': NODE_ACCENTS[current.type] } as React.CSSProperties}>
            <span className="current-location-icon">{NODE_ICONS[current.type]}</span>
            <span>
              You are here — {NODE_LABELS[current.type]}
            </span>
          </div>

          <div className="path-choice-heading">Choose Your Path</div>
          <div className="path-choice-row">
            {nextChoices.length === 0 && <div className="subtitle">This is the end of the road.</div>}
            {nextChoices.map((node) => {
              const known = node.visibility !== 'unknown';
              return (
                <div
                  key={node.id}
                  className="path-choice-card"
                  style={{ '--pc-color': NODE_ACCENTS[node.type] } as React.CSSProperties}
                  onClick={() => onMoveTo(node.id)}
                >
                  <div className="path-choice-icon">{known ? NODE_ICONS[node.type] : '?'}</div>
                  <div className="path-choice-name">{known ? NODE_LABELS[node.type] : 'Unknown'}</div>
                </div>
              );
            })}
          </div>
        </div>

        <HistoryPanel title="History" lines={historyLines} />
      </div>

      {popupStack && (
        <UnitPopup
          stack={popupStack}
          army={run.army}
          onClose={() => setPopupStackId(null)}
          onSplit={onSplitStack}
          onMerge={onMergeStacks}
        />
      )}
    </div>
  );
}
