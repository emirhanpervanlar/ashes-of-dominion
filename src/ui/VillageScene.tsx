/** A rectangle on the scene grid: x, y, width, height in grid cells. */
type Rect = readonly [number, number, number, number];

const WIDTH = 192;
const HEIGHT = 64;
const GROUND = 50;

interface Layers {
  hills: Rect[];
  walls: Rect[];
  roofs: Rect[];
  windows: Rect[];
  doors: Rect[];
  trunks: Rect[];
  leaves: Rect[];
  earth: Rect[];
  smoke: Rect[];
}

/** A cottage: walls, a stepped gable roof wider than the walls, one lit window and a door; a chimney with smoke when `smoke` is set. */
function house(layers: Layers, x: number, w: number, h: number, smoke = false): void {
  const top = GROUND - h;
  layers.walls.push([x, top, w, h]);
  for (let r = 0; r * 2 < w + 2; r++) layers.roofs.push([x - 1 + r, top - 1 - r, w + 2 - 2 * r, 1]);
  layers.windows.push([x + 2, top + 3, 2, 2]);
  if (w >= 9) layers.windows.push([x + w - 4, top + 3, 2, 2]);
  layers.doors.push([x + Math.floor(w / 2) - 1, GROUND - 4, 2, 4]);
  if (smoke) {
    layers.walls.push([x + w - 3, top - 5, 2, 4]);
    layers.smoke.push([x + w - 3, top - 8, 2, 1], [x + w - 2, top - 11, 2, 1], [x + w - 3, top - 14, 1, 1]);
  }
}

/** A pine: trunk and a triangle of stacked leaf rows. */
function tree(layers: Layers, x: number, h: number): void {
  layers.trunks.push([x, GROUND - 3, 1, 3]);
  for (let r = 0; r < h; r++) layers.leaves.push([x - 1 - Math.floor(r / 2), GROUND - 4 - (h - 1 - r), 3 + 2 * Math.floor(r / 2), 1]);
}

function build(): Layers {
  const layers: Layers = { hills: [], walls: [], roofs: [], windows: [], doors: [], trunks: [], leaves: [], earth: [], smoke: [] };
  for (let x = 0; x < WIDTH; x++) {
    const ridge = 34 + Math.round(4 * Math.sin(x / 11) + 2 * Math.sin(x / 4.3));
    layers.hills.push([x, ridge, 1, GROUND - ridge]);
  }
  layers.earth.push([0, GROUND, WIDTH, HEIGHT - GROUND]);
  house(layers, 24, 11, 9, true);
  house(layers, 58, 9, 8);
  house(layers, 84, 13, 11, true);
  house(layers, 120, 9, 8, true);
  house(layers, 146, 11, 9);
  for (const [x, h] of [[8, 7], [16, 5], [46, 6], [74, 5], [108, 7], [136, 5], [168, 7], [178, 5]] as const) tree(layers, x, h);
  layers.earth.push([96, GROUND + 3, 6, 1]);
  return layers;
}

const SCENE = build();

function Layer({ rects, className }: { rects: readonly Rect[]; className: string }) {
  return (
    <g className={className}>
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
    </g>
  );
}

/** Code-drawn pixel village at dusk (Village screen backdrop): flat layers, no image files. */
export function VillageScene() {
  return (
    <svg className="village-scene" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" aria-hidden="true">
      <Layer rects={SCENE.hills} className="vs-hills" />
      <Layer rects={SCENE.smoke} className="vs-smoke" />
      <Layer rects={SCENE.trunks} className="vs-trunk" />
      <Layer rects={SCENE.leaves} className="vs-leaves" />
      <Layer rects={SCENE.walls} className="vs-wall" />
      <Layer rects={SCENE.roofs} className="vs-roof" />
      <Layer rects={SCENE.doors} className="vs-door" />
      <Layer rects={SCENE.windows} className="vs-window" />
      <Layer rects={SCENE.earth} className="vs-earth" />
    </svg>
  );
}
