import { nextInt } from '../rng.js';
import type { RngState } from '../rng.js';

export type NodeType = 'road' | 'battle' | 'elite_battle' | 'resource' | 'merchant' | 'event' | 'end';
export type NodeVisibility = 'unknown' | 'revealed' | 'visited';

export interface MapNode {
  id: string;
  type: NodeType;
  layer: number;
  visibility: NodeVisibility;
  connectsTo: string[];
}

export interface WorldMapState {
  nodes: MapNode[];
  currentNodeId: string;
}

/**
 * PROTOTYPE topology (AGENT.md §19, node count is explicitly not locked —
 * §70): 7 layers, small layers fully bipartite-connected to the next so
 * every node is always reachable (no orphan nodes) while still giving the
 * player a real choice of node type at every step. AGENT.md's "~30 nodes"
 * MVP target grows once City (Phase 5) and Boss (Phase 6) nodes replace
 * the current 'end' placeholder.
 */
const LAYER_SIZES = [1, 3, 3, 3, 3, 3, 1];

const MIDDLE_LAYER_TYPE_POOL: NodeType[] = [
  'battle',
  'battle',
  'battle',
  'battle',
  'event',
  'event',
  'resource',
  'merchant',
  'elite_battle',
  'road',
];

export function generateWorldMap(rng: RngState): WorldMapState {
  const layers: MapNode[][] = [];

  for (let layer = 0; layer < LAYER_SIZES.length; layer++) {
    const size = LAYER_SIZES[layer]!;
    const isFirst = layer === 0;
    const isLast = layer === LAYER_SIZES.length - 1;
    const nodes: MapNode[] = [];
    for (let i = 0; i < size; i++) {
      const type: NodeType = isFirst ? 'road' : isLast ? 'end' : MIDDLE_LAYER_TYPE_POOL[nextInt(rng, MIDDLE_LAYER_TYPE_POOL.length)]!;
      nodes.push({
        id: `n${layer}_${i}`,
        type,
        layer,
        visibility: 'unknown',
        connectsTo: [],
      });
    }
    layers.push(nodes);
  }

  for (let layer = 0; layer < layers.length - 1; layer++) {
    const from = layers[layer]!;
    const to = layers[layer + 1]!;
    for (const node of from) {
      node.connectsTo = to.map((n) => n.id);
    }
  }

  const allNodes = layers.flat();
  const start = allNodes[0]!;
  start.visibility = 'visited';
  for (const id of start.connectsTo) {
    const n = allNodes.find((x) => x.id === id);
    if (n) n.visibility = 'revealed';
  }

  return { nodes: allNodes, currentNodeId: start.id };
}

export function findNode(map: WorldMapState, id: string): MapNode | undefined {
  return map.nodes.find((n) => n.id === id);
}

/** Mutates map: visits `nodeId` and reveals everything it connects to. */
export function visitNode(map: WorldMapState, nodeId: string): void {
  const node = findNode(map, nodeId);
  if (!node) return;
  node.visibility = 'visited';
  map.currentNodeId = nodeId;
  for (const id of node.connectsTo) {
    const n = findNode(map, id);
    if (n && n.visibility === 'unknown') n.visibility = 'revealed';
  }
}
