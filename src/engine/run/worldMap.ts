import { nextInt } from '../rng.js';
import type { RngState } from '../rng.js';
import { ELITE_FREE_STEPS, bossDay } from './chapters.js';

export type NodeType = 'start' | 'battle' | 'elite_battle' | 'resource' | 'merchant' | 'event' | 'boss';
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

/** Nodes per layer between the start node and the boss. Fully connected to the next layer so nothing is ever orphaned. */
const CHOICES_PER_LAYER = 3;

/** AO-D045: every step is a real encounter or stop; the city is not a node (AO-D047). */
const STEP_TYPE_POOL: NodeType[] = [
  'battle',
  'battle',
  'battle',
  'battle',
  'event',
  'event',
  'resource',
  'merchant',
  'elite_battle',
];
const ELITE_FREE_POOL = STEP_TYPE_POOL.filter((t) => t !== 'elite_battle');

/**
 * One 30-day chapter (AO-D046). The start node is the current position on `startDay`;
 * each layer is one day, so the boss layer lands on the chapter's boss day (30/60/90).
 * The first ELITE_FREE_STEPS steps of the whole run (chapter 1 only) never hold an elite (AO-D049).
 */
export function generateWorldMap(rng: RngState, chapter = 1, startDay = 1): WorldMapState {
  const bossLayer = Math.max(1, bossDay(chapter) - startDay);
  const layers: MapNode[][] = [];

  for (let layer = 0; layer <= bossLayer; layer++) {
    const size = layer === 0 || layer === bossLayer ? 1 : CHOICES_PER_LAYER;
    const eliteFree = chapter === 1 && layer <= ELITE_FREE_STEPS;
    const pool = eliteFree ? ELITE_FREE_POOL : STEP_TYPE_POOL;
    const nodes: MapNode[] = [];
    for (let i = 0; i < size; i++) {
      const type: NodeType = layer === 0 ? 'start' : layer === bossLayer ? 'boss' : pool[nextInt(rng, pool.length)]!;
      nodes.push({ id: `c${chapter}n${layer}_${i}`, type, layer, visibility: 'unknown', connectsTo: [] });
    }
    layers.push(nodes);
  }

  for (let layer = 0; layer < layers.length - 1; layer++) {
    const to = layers[layer + 1]!;
    for (const node of layers[layer]!) node.connectsTo = to.map((n) => n.id);
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
