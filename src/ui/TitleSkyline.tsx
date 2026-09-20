/** A rectangle on the skyline grid: x, y, width, height in grid cells. */
type Rect = readonly [number, number, number, number];

const WIDTH = 192;
const HEIGHT = 40;
const GROUND = HEIGHT;

/** A crenellated tower with a stepped cone roof; returns the body, teeth, roof and one lit window. */
function tower(x: number, w: number, top: number, roof: number): { body: Rect[]; roofs: Rect[]; windows: Rect[] } {
  const body: Rect[] = [[x, top, w, GROUND - top]];
  for (let i = 0; i < w; i += 2) body.push([x + i, top - 1, 1, 1]);
  const roofs: Rect[] = [];
  for (let r = 0; r < roof; r++) {
    const inset = r + 1;
    if (w - 2 * inset < 1) break;
    roofs.push([x + inset, top - 2 - r, w - 2 * inset, 1]);
  }
  const windows: Rect[] = [[x + Math.floor(w / 2), top + 4, 1, 3]];
  return { body, roofs, windows };
}

/** A curtain wall between towers, with battlements. */
function wall(x: number, w: number, top: number): Rect[] {
  const rects: Rect[] = [[x, top, w, GROUND - top]];
  for (let i = 0; i < w; i += 3) rects.push([x + i, top - 1, 2, 1]);
  return rects;
}

function buildNear(): { stone: Rect[]; roofs: Rect[]; windows: Rect[] } {
  const stone: Rect[] = [];
  const roofs: Rect[] = [];
  const windows: Rect[] = [];
  const add = (t: ReturnType<typeof tower>) => {
    stone.push(...t.body);
    roofs.push(...t.roofs);
    windows.push(...t.windows);
  };
  stone.push(...wall(56, 80, 28));
  add(tower(52, 9, 16, 4));
  add(tower(131, 9, 16, 4));
  add(tower(80, 32, 20, 0));
  add(tower(78, 6, 10, 3));
  add(tower(108, 6, 10, 3));
  add(tower(92, 8, 4, 6));
  windows.push([86, 30, 1, 3], [96, 26, 2, 4], [104, 30, 1, 3], [60, 32, 1, 3], [126, 32, 1, 3]);
  return { stone, roofs, windows };
}

/** Distant hills and lesser towers behind the castle, one column of stone per grid cell. */
function buildFar(): Rect[] {
  const rects: Rect[] = [];
  for (let x = 0; x < WIDTH; x++) {
    const ridge = 30 + Math.round(3 * Math.sin(x / 9) + 2 * Math.sin(x / 3.7));
    rects.push([x, ridge, 1, GROUND - ridge]);
  }
  for (const [x, w, top] of [
    [14, 7, 20],
    [34, 5, 24],
    [152, 6, 22],
    [172, 8, 18],
  ] as const) {
    rects.push([x, top, w, GROUND - top]);
    for (let i = 0; i < w; i += 2) rects.push([x + i, top - 1, 1, 1]);
  }
  return rects;
}

const NEAR = buildNear();
const FAR = buildFar();

function Layer({ rects, className }: { rects: readonly Rect[]; className: string }) {
  return (
    <g className={className}>
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
    </g>
  );
}

/** Code-drawn pixel castle silhouette for the title screen: three flat layers, no image files. */
export function TitleSkyline() {
  return (
    <svg className="title-skyline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" aria-hidden="true">
      <Layer rects={FAR} className="sk-far" />
      <Layer rects={NEAR.stone} className="sk-near" />
      <Layer rects={NEAR.roofs} className="sk-roof" />
      <Layer rects={NEAR.windows} className="sk-window" />
    </svg>
  );
}
