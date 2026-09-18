import { useState } from 'react';
import { UNIT_DEFINITIONS } from '../engine/index.js';
import type { RunState } from '../engine/run/index.js';
import type { MapNode } from '../engine/run/index.js';
import { HistoryDrawer } from './HistoryDrawer.js';
import { describeRunEvent } from './runEventText.js';
import { relicIcon } from './relicIcons.js';
import { UNIT_ICONS } from './unitIcons.js';
import { UNIT_ROLE_ICONS } from './unitShapes.js';
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

const NODE_BADGES: Record<MapNode['type'], string> = {
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const popupStack = popupStackId ? run.army.find((s) => s.stackId === popupStackId && s.count > 0) ?? null : null;
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layerCount = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;
  const nextChoices = current.connectsTo
    .map((id) => run.worldMap.nodes.find((n) => n.id === id))
    .filter((n): n is MapNode => !!n && n.visibility !== 'unknown');
  const historyLines = run.log.map(describeRunEvent).filter((line): line is string => line !== null);
  const hpPct = Math.max(0, Math.min(100, (run.hero.hp / run.hero.maxHp) * 100));

  return (
    <div className="garrison-frame">
      <div className="garrison-topbar">
        <div className="garrison-title">Ashes of Dominion — The Road</div>
        <div className="garrison-topbar-actions">
          <button onClick={onNewRun}>New Run</button>
          {current.type === 'city' && (
            <button className="primary" onClick={onEnterCity}>
              Enter City
            </button>
          )}
        </div>
      </div>

      <div className="garrison-body">
        <div className="garrison-panel">
          <div className="garrison-hero-row">
            <div className="hero-portrait">🤴</div>
            <div className="garrison-hero-info">
              <strong>{run.hero.name}</strong>
              <div className="bar" style={{ marginTop: 4 }}>
                <div className={`bar-fill-hp${hpPct < 30 ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
              </div>
              <div className="subtitle" style={{ margin: 0 }}>
                HP {run.hero.hp}/{run.hero.maxHp}
              </div>
            </div>
          </div>

          <div className="garrison-roster-label">Army</div>
          <div className="garrison-roster-row">
            {run.army
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.stackId} className="garrison-slot" onClick={() => setPopupStackId(s.stackId)} title={UNIT_DEFINITIONS[s.unitId].name}>
                  <span className="garrison-slot-icon">{UNIT_ICONS[s.unitId]}</span>
                  <span className="garrison-slot-role">{UNIT_ROLE_ICONS[s.unitId]}</span>
                  <span className="garrison-slot-count">{s.count}</span>
                </div>
              ))}
            {run.army.filter((s) => s.count > 0).length === 0 && <div className="subtitle" style={{ margin: 0 }}>No units.</div>}
          </div>

          {run.relics.length > 0 && (
            <>
              <div className="garrison-roster-label">Relics</div>
              <div className="garrison-relic-row">
                {run.relics.map((r) => (
                  <span key={r.id} className="relic-icon" title={`${r.name} — ${r.description}`}>
                    {relicIcon(r.id)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="garrison-main">
          <div className="path-progress">
            Layer {current.layer + 1} / {layerCount}
          </div>
          <div className="current-location-badge" style={{ '--pc-color': NODE_ACCENTS[current.type] } as React.CSSProperties}>
            <span className="current-location-icon">{NODE_BADGES[current.type]}</span>
            <span>You are here — {NODE_LABELS[current.type]}</span>
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
                  <span className="path-choice-badge">{known ? NODE_BADGES[node.type] : '?'}</span>
                  <div className="path-choice-name">{known ? NODE_LABELS[node.type] : 'Unknown'}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="garrison-resource-bar">
        <div className="garrison-resource-chip">
          <span>💰</span> {run.gold}
        </div>
        <div className="garrison-resource-chip">
          <span>🌾</span> {run.food}
        </div>
        <div className="garrison-resource-chip">
          <span>⏳</span> Day {run.day}
        </div>
      </div>

      <button className="round-btn garrison-history-btn" onClick={() => setHistoryOpen(true)} title="History">
        📜
      </button>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="History" lines={historyLines} />

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
