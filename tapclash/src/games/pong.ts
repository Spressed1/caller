import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { clamp, rand, rgba } from '../core/draw';
import { toLocal } from '../core/zones';
import { INK, PLAYER_COLORS } from '../theme';
import { edgeTag, zoneTints } from './hud';
import { eliminationRanking, type GameContext, type GameModule } from './types';

const LIVES = 3;
const TAU = Math.PI * 2;

/** Normalise an angle into [-π, π). */
const wrapA = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

interface Arc {
  start: number;
  span: number;
  mid: number;
  paddle: number;
  target: number;
  lives: number;
}

/**
 * Circular pong: the ring is split into one arc per player, each defended by a
 * paddle. Miss the ball and you lose a life; knocked-out arcs become walls.
 */
export function createPong(): GameModule {
  let c: GameContext;
  let cx = 0;
  let cy = 0;
  let R = 0;
  let br = 0;
  let half = 0; // paddle half-length in radians
  let arcs: Arc[] = [];
  let bx = 0;
  let by = 0;
  let vx = 0;
  let vy = 0;
  let speed = 0;
  let serve = 0.6;
  let prevD = 0;
  const trail: { x: number; y: number }[] = [];
  let outOrder: number[] = [];
  let done: number[] | null = null;

  const ownerOf = (ang: number): number => {
    for (let p = 0; p < arcs.length; p++) {
      const d = wrapA(ang - arcs[p].start);
      const dd = d < 0 ? d + TAU : d;
      if (dd < arcs[p].span) return p;
    }
    return 0;
  };

  const launch = () => {
    const alive = arcs.map((a, p) => (a.lives > 0 ? p : -1)).filter((p) => p >= 0);
    const to = alive[(Math.random() * alive.length) | 0];
    const a = arcs[to].mid + rand(-0.35, 0.35);
    bx = cx;
    by = cy;
    speed = c.S * 0.6;
    vx = Math.cos(a) * speed;
    vy = Math.sin(a) * speed;
    trail.length = 0;
    prevD = 0;
  };

  return {
    init(ctx) {
      c = ctx;
      cx = ctx.W / 2;
      cy = ctx.H / 2;
      R = ctx.S * 0.46;
      br = ctx.S * 0.024;
      half = (ctx.S * 0.12) / R;
      const angles = ctx.zones.map((z) => Math.atan2(z.cy - cy, z.cx - cx));
      const order = angles.map((_, i) => i).sort((a, b) => angles[a] - angles[b]);
      arcs = new Array(ctx.n);
      const mod = (x: number) => ((x % TAU) + TAU) % TAU;
      order.forEach((p, k) => {
        const a = angles[p];
        const prev = angles[order[(k - 1 + order.length) % order.length]];
        const next = angles[order[(k + 1) % order.length]];
        const gapPrev = mod(a - prev) || TAU;
        const gapNext = mod(next - a) || TAU;
        const lo = a - gapPrev / 2;
        const span = gapPrev / 2 + gapNext / 2;
        const mid = wrapA(lo + span / 2);
        arcs[p] = { start: wrapA(lo), span, mid, paddle: mid, target: mid, lives: LIVES };
      });
      launch();
    },
    onDown(p, _id, x, y) {
      this.onMove?.(p, _id, x, y);
    },
    onMove(p, _id, x, y) {
      const a = arcs[p];
      if (a.lives <= 0) return;
      const z = c.zones[p];
      const l = toLocal(z, x, y);
      const tt = clamp(l.x / (z.w * 0.4), -1, 1);
      const room = a.span / 2 - half;
      a.target = wrapA(a.mid - tt * room);
    },
    update(dt) {
      for (const a of arcs) a.paddle = wrapA(a.paddle + wrapA(a.target - a.paddle) * Math.min(1, dt * 22));
      if (done) return;
      if (serve > 0) {
        serve -= dt;
        return;
      }
      bx += vx * dt;
      by += vy * dt;
      trail.push({ x: bx, y: by });
      if (trail.length > 12) trail.shift();

      const dx = bx - cx;
      const dy = by - cy;
      const d = Math.hypot(dx, dy);
      const nx = dx / d;
      const ny = dy / d;
      const outward = vx * nx + vy * ny;
      const ang = Math.atan2(dy, dx);
      const p = ownerOf(ang);
      const arc = arcs[p];
      const Rp = R - 10;

      if (outward > 0 && arc.lives <= 0 && d >= R - br) {
        // Dead arc = solid wall.
        vx -= 2 * outward * nx;
        vy -= 2 * outward * ny;
        sfx.bump(0.4);
        return;
      }
      const crossed = d >= Rp - br && prevD <= Rp + br;
      prevD = d;
      if (outward > 0 && arc.lives > 0 && crossed) {
        const off = wrapA(ang - arc.paddle);
        if (Math.abs(off) <= half + br / R) {
          speed = Math.min(c.S * 1.5, speed * 1.07);
          const defl = (off / half) * 1.0 + rand(-0.08, 0.08);
          const inA = Math.atan2(-ny, -nx) - defl;
          vx = Math.cos(inA) * speed;
          vy = Math.sin(inA) * speed;
          bx = cx + nx * (Rp - br);
          by = cy + ny * (Rp - br);
          sfx.hit();
          buzz(8);
          c.fx.burst(bx, by, PLAYER_COLORS[p], 14, 260, 0.4, 3);
          c.fx.ring(bx, by, PLAYER_COLORS[p], 40, 0.3);
          return;
        }
      }
      if (d > R + br * 3) {
        arc.lives--;
        sfx.boom();
        buzz([40, 30, 40]);
        c.fx.burst(cx + nx * R, cy + ny * R, PLAYER_COLORS[p], 50, 420, 0.8, 4);
        c.fx.shake(14);
        if (arc.lives <= 0) outOrder.push(p);
        if (arcs.filter((a) => a.lives > 0).length <= 1) {
          done = eliminationRanking(c.n, outOrder);
          return;
        }
        serve = 0.9;
        launch();
      }
    },
    render(g) {
      zoneTints(g, c.zones, 0.04);
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      bg.addColorStop(0, '#FFF8EC');
      bg.addColorStop(1, '#F2D7AE');
      g.fillStyle = bg;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = 'rgba(34,25,43,0.12)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, R * 0.5, 0, TAU);
      g.stroke();

      arcs.forEach((a, p) => {
        const col = PLAYER_COLORS[p];
        g.save();
        g.lineCap = 'round';
        // Goal arc
        g.strokeStyle = a.lives > 0 ? rgba(col, 0.55) : INK;
        g.lineWidth = a.lives > 0 ? 6 : 10;
        if (a.lives <= 0) g.setLineDash([10, 8]);
        g.beginPath();
        g.arc(cx, cy, R, a.start + 0.04, a.start + a.span - 0.04);
        g.stroke();
        g.setLineDash([]);
        if (a.lives > 0) {
          g.strokeStyle = INK;
          g.lineWidth = 16;
          g.beginPath();
          g.arc(cx, cy, R - 10, a.paddle - half, a.paddle + half);
          g.stroke();
          g.strokeStyle = col;
          g.lineWidth = 10;
          g.stroke();
        }
        g.restore();
      });

      // Ball + trail
      const blink = serve > 0 && Math.floor(serve * 10) % 2 === 0;
      if (!blink) {
        trail.forEach((pt, i) => {
          g.fillStyle = `rgba(34,25,43,${(i / trail.length) * 0.25})`;
          g.beginPath();
          g.arc(pt.x, pt.y, br * (i / trail.length), 0, TAU);
          g.fill();
        });
        g.save();
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(bx, by, br, 0, TAU);
        g.fill();
        g.stroke();
        g.restore();
      }
      for (const z of c.zones) {
        const a = arcs[z.player];
        edgeTag(g, z, a.lives > 0 ? { lives: a.lives, max: LIVES } : { out: true });
      }
    },
    result: () => done,
  };
}
