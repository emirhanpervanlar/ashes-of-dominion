import { chainsUrl } from './pixel/chains.js';
import type { Cue, HitCue } from './battleCues.js';

/** Windup before contact (ms at speed 1): a lunge reaches the target in 80ms (+10 hold), a projectile flies 240ms. */
const LUNGE_MS = 90;
const PROJECTILE_MS = 240;
/** Impacts of one multi-target cue land this far apart. */
const HIT_STAGGER_MS = 100;
/** Portrait frame size (matches `.portrait-frame`), used for shards and chain halves. */
const CHAINS = chainsUrl(88, 76);

type AttackCue = Extract<Cue, { kind: 'attack' }>;

/**
 * Code-drawn battle effects (DESIGN_LANGUAGE 8). One controller owns an absolutely positioned layer over the battlefield:
 * overlay effects are DOM nodes appended to it, tile motion (lunge, shake, death) uses the Web Animations API so React
 * never has to know about it. Everything is a no-op under `prefers-reduced-motion`; the floaters stay.
 */
export interface Fx {
  attach(layer: HTMLElement | null): void;
  /** Starts a fresh sequence: clears the skipped flag. */
  begin(): void;
  /** Ends every pending wait and removes running effects (the enemy-turn skip control). */
  skip(): void;
  readonly skipped: boolean;
  /** Waits scaled by `--speed`; resolves early on skip. */
  wait(ms: number): Promise<void>;
  /** Like `wait`, but zero under reduced motion (windups are motion, beats are not). */
  motion(ms: number): Promise<void>;
  /** Starts the windup of an attack cue (lunge or projectile) and returns how long until contact. */
  windup(cue: AttackCue): number;
  /** Starts the contact/result effects of any cue. */
  impact(cue: Cue): void;
  glow(stackId: string): void;
  /** Snapshots a tile that is about to be wiped so it can play the death fade after React re-renders it. */
  ghost(stackId: string): void;
  shatter(stackId: string): void;
  chainBreak(stackId: string): void;
}

export function createFx(): Fx {
  let layer: HTMLElement | null = null;
  let skipped = false;
  const anims = new Set<Animation>();
  const timers = new Set<number>();
  const waiters = new Set<() => void>();

  const speed = () => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--speed'));
    return v > 0 ? v : 1;
  };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scaled = (ms: number) => ms / speed();

  function later(fn: () => void, ms: number): void {
    if (ms <= 0) {
      fn();
      return;
    }
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, scaled(ms));
    timers.add(t);
  }

  function wait(ms: number): Promise<void> {
    if (skipped || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        waiters.delete(done);
        window.clearTimeout(t);
        resolve();
      };
      const t = window.setTimeout(done, scaled(ms));
      waiters.add(done);
    });
  }

  const frame = (id: string) => layer?.parentElement?.querySelector<HTMLElement>(`[data-stack-id="${id}"] .portrait-frame`) ?? null;

  function rectOf(el: HTMLElement): { x: number; y: number; w: number; h: number } {
    const a = el.getBoundingClientRect();
    const b = layer!.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }

  function spawn(cls: string, x: number, y: number, ttl: number, css: Record<string, string> = {}): HTMLElement {
    const el = document.createElement('div');
    el.className = `fx ${cls}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    for (const [k, v] of Object.entries(css)) el.style.setProperty(k, v);
    layer?.appendChild(el);
    later(() => el.remove(), ttl);
    return el;
  }

  function animate(el: HTMLElement, keyframes: Keyframe[], duration: number, easing: string): void {
    const a = el.animate(keyframes, { duration: scaled(duration), easing });
    anims.add(a);
    const done = () => anims.delete(a);
    a.onfinish = done;
    a.oncancel = done;
  }

  function lunge(attackerId: string, targetId: string): number {
    const from = frame(attackerId);
    const to = frame(targetId);
    if (!from || !to) return 0;
    const dir = Math.sign(to.getBoundingClientRect().left - from.getBoundingClientRect().left) || 1;
    const shift = `translateX(${dir * 16}px)`;
    animate(from, [{ transform: 'translateX(0)', zIndex: 45 }, { transform: shift, zIndex: 45, offset: 0.29 }, { transform: shift, zIndex: 45, offset: 0.57 }, { transform: 'translateX(0)', zIndex: 45 }], 280, 'steps(2, end)');
    return LUNGE_MS;
  }

  function projectile(fromId: string, toId: string, kind: 'bolt' | 'orb'): void {
    const a = frame(fromId);
    const b = frame(toId);
    if (!a || !b) return;
    const from = rectOf(a);
    const to = rectOf(b);
    const x0 = from.x + from.w / 2;
    const y0 = from.y + from.h / 2;
    const x1 = to.x + to.w / 2;
    const y1 = to.y + to.h / 2;
    const el = spawn(kind === 'bolt' ? 'fx-bolt' : 'fx-orb', x0, y0, PROJECTILE_MS + 20);
    el.style.transform = `rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`;
    void el.offsetWidth;
    el.style.left = `${x1}px`;
    el.style.top = `${y1}px`;
  }

  function shake(id: string): void {
    const el = frame(id);
    if (!el) return;
    animate(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], 200, 'steps(4, end)');
    const r = rectOf(el);
    spawn('fx-flash', r.x, r.y, 80, { '--w': `${r.w}px`, '--h': `${r.h}px` });
  }

  function slash(id: string): void {
    const el = frame(id);
    if (!el) return;
    const r = rectOf(el);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    spawn('fx-slash', cx, cy, 700);
    for (const [sx, sy] of [[-40, -36], [36, -28], [30, 34]] as const) spawn('fx-spark', cx, cy, 500, { '--sx': `${sx}px`, '--sy': `${sy}px` });
  }

  function sparks(id: string, arcane: boolean): void {
    const el = frame(id);
    if (!el) return;
    const r = rectOf(el);
    for (const [sx, sy] of [[-32, -28], [30, -24], [26, 30], [-28, 26]] as const) {
      spawn(arcane ? 'fx-spark fx-spark--arcane' : 'fx-spark', r.x + r.w / 2, r.y + r.h / 2, 500, { '--sx': `${sx}px`, '--sy': `${sy}px` });
    }
  }

  function ring(id: string): void {
    const el = frame(id);
    if (!el) return;
    const r = rectOf(el);
    spawn('fx-ring', r.x + r.w / 2, r.y + r.h / 2, 400);
  }

  function particles(id: string, kind: 'heal' | 'buff' | 'debuff'): void {
    const el = frame(id);
    if (!el) return;
    const r = rectOf(el);
    const count = kind === 'heal' ? 6 : 4;
    const drift = [-8, 6, -4, 8, 0, -6];
    for (let i = 0; i < count; i++) {
      const x = r.x + r.w * ((i + 0.6) / (count + 0.2));
      const y = kind === 'heal' ? r.y + r.h - 12 : kind === 'buff' ? r.y + r.h * 0.7 : r.y + 12;
      spawn(`fx-part fx-part--${kind}`, x, y, kind === 'heal' ? 480 : 320, { '--dx': `${drift[i] ?? 0}px`, 'animation-delay': `${i * 30}ms` });
    }
  }

  /** Six frost diamonds around the tile edge. */
  function shardPositions(r: { x: number; y: number; w: number; h: number }): [number, number][] {
    return [[r.x + 4, r.y + 8], [r.x + r.w - 12, r.y + 4], [r.x - 2, r.y + r.h / 2], [r.x + r.w - 6, r.y + r.h / 2 + 8], [r.x + 12, r.y + r.h - 10], [r.x + r.w - 20, r.y + r.h - 6]];
  }

  function shards(id: string): void {
    const el = frame(id);
    if (!el) return;
    for (const [x, y] of shardPositions(rectOf(el))) spawn('fx-shard fx-shard--in', x, y, 600);
  }

  function statusFx(id: string, tone: 'buff' | 'debuff' | 'freeze'): void {
    if (tone === 'freeze') shards(id);
    else particles(id, tone);
  }

  function hitFx(attackerStyle: AttackCue['style'], hit: HitCue): void {
    if (hit.dodged) return;
    if (attackerStyle === 'melee') slash(hit.targetStackId);
    else sparks(hit.targetStackId, attackerStyle === 'orb');
    shake(hit.targetStackId);
    if (hit.blocked > 0) ring(hit.targetStackId);
  }

  const fx: Fx = {
    attach(el) {
      layer = el;
    },
    begin() {
      skipped = false;
    },
    skip() {
      skipped = true;
      for (const t of timers) window.clearTimeout(t);
      timers.clear();
      for (const a of [...anims]) a.cancel();
      anims.clear();
      for (const done of [...waiters]) done();
      layer?.replaceChildren();
    },
    get skipped() {
      return skipped;
    },
    wait,
    motion: (ms) => (reduced() ? Promise.resolve() : wait(ms)),
    windup(cue) {
      if (!layer || reduced() || skipped) return 0;
      if (cue.style === 'melee') return lunge(cue.attackerStackId, cue.hits[0]!.targetStackId);
      const targets = new Set(cue.hits.map((h) => h.targetStackId));
      targets.forEach((t) => projectile(cue.attackerStackId, t, cue.style === 'bolt' ? 'bolt' : 'orb'));
      return PROJECTILE_MS;
    },
    impact(cue) {
      if (!layer || reduced() || skipped) return;
      if (cue.kind === 'attack') cue.hits.forEach((h, i) => later(() => hitFx(cue.style, h), i * HIT_STAGGER_MS));
      else if (cue.kind === 'dot') {
        particles(cue.stackId, 'debuff');
        shake(cue.stackId);
      } else if (cue.kind === 'block') ring(cue.stackId);
      else if (cue.kind === 'heal') particles(cue.stackId, 'heal');
      else statusFx(cue.stackId, cue.tone);
    },
    glow(stackId) {
      const el = frame(stackId);
      if (!layer || !el || reduced() || skipped) return;
      const r = rectOf(el);
      spawn('fx-glow', r.x, r.y, 140, { '--w': `${r.w}px`, '--h': `${r.h}px` });
    },
    ghost(stackId) {
      const slot = layer?.parentElement?.querySelector<HTMLElement>(`[data-stack-id="${stackId}"]`);
      if (!layer || !slot || reduced() || skipped) return;
      const r = rectOf(slot);
      const clone = slot.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-stack-id');
      clone.querySelectorAll('.floater').forEach((n) => n.remove());
      const count = clone.querySelector('.portrait-count');
      if (count) count.textContent = '×0';
      clone.classList.add('fx', 'fx-ghost');
      clone.style.left = `${r.x}px`;
      clone.style.top = `${r.y}px`;
      clone.style.width = `${r.w}px`;
      layer.appendChild(clone);
      animate(
        clone,
        [
          { opacity: 1, transform: 'scaleY(1)', filter: 'saturate(1) brightness(1)' },
          { opacity: 0, transform: 'scaleY(0.6)', filter: 'saturate(0) brightness(0.6)' },
        ],
        400,
        'steps(6, end)',
      );
      later(() => clone.remove(), 420);
    },
    shatter(stackId) {
      const el = frame(stackId);
      if (!layer || !el || reduced() || skipped) return;
      const r = rectOf(el);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      for (const [x, y] of shardPositions(r)) spawn('fx-shard fx-shard--out', x, y, 220, { '--sx': `${(x - cx) * 0.9}px`, '--sy': `${(y - cy) * 0.9}px` });
    },
    chainBreak(stackId) {
      const el = frame(stackId);
      if (!layer || !el || reduced() || skipped) return;
      const r = rectOf(el);
      for (const side of ['l', 'r'] as const) {
        spawn(`fx-link fx-link--${side}`, r.x + 4, r.y + 8, 400, { '--w': `${r.w - 8}px`, '--h': `${r.h - 36}px`, 'background-image': CHAINS });
      }
    },
  };
  return fx;
}
