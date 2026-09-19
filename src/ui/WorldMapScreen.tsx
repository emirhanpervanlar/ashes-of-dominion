import type { Position } from '../engine/index.js';
import type { RunState } from '../engine/run/index.js';
import type { MapNode } from '../engine/run/index.js';
import { GarrisonBar } from './GarrisonBar.js';

interface Props {
  run: RunState;
  onMoveTo: (nodeId: string) => void;
  onEnterCity: () => void;
  onOpenMenu: () => void;
  onSplitStack: (stackId: string, splitCount: number) => void;
  onMergeStacks: (stackIdA: string, stackIdB: string) => void;
  onMoveStack: (stackId: string, toPosition: Position) => void;
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

export function WorldMapScreen({ run, onMoveTo, onEnterCity, onOpenMenu, onSplitStack, onMergeStacks, onMoveStack }: Props) {
  const current = run.worldMap.nodes.find((n) => n.id === run.worldMap.currentNodeId)!;
  const layerCount = Math.max(...run.worldMap.nodes.map((n) => n.layer)) + 1;
  const nextChoices = current.connectsTo
    .map((id) => run.worldMap.nodes.find((n) => n.id === id))
    .filter((n): n is MapNode => !!n && n.visibility !== 'unknown');

  return (
    <div className="garrison-frame">
      <div className="garrison-scene">
        <div className="path-progress">
          Layer {current.layer + 1} / {layerCount}
        </div>
        <div className="current-location-badge" style={{ '--pc-color': NODE_ACCENTS[current.type] } as React.CSSProperties}>
          <span className="current-location-icon">{NODE_BADGES[current.type]}</span>
          <span>You are here — {NODE_LABELS[current.type]}</span>
        </div>
        {current.type === 'city' && (
          <button className="primary" style={{ marginTop: 10 }} onClick={onEnterCity}>
            Enter City
          </button>
        )}

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

      <GarrisonBar
        stats={[
          { icon: '💰', text: String(run.gold) },
          { icon: '🌾', text: String(run.food) },
          { icon: '⏳', text: `Day ${run.day}` },
        ]}
        hero={run.hero}
        relics={run.relics}
        army={run.army}
        log={run.log}
        onOpenMenu={onOpenMenu}
        onMoveStack={onMoveStack}
        onSplitStack={onSplitStack}
        onMergeStacks={onMergeStacks}
      />
    </div>
  );
}
