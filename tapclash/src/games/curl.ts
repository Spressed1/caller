import { critter, groundShadow } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { rgba, text } from '../core/draw';
import { withZone } from '../core/zones';
import { INK, PLAYER_COLORS, PLAYER_NAMES, inkA } from '../theme';
import { edgeTag } from './hud';
import type { GameContext, GameModule } from './types';

const ENDS = 3;
const STONES = 2;
const IDLE_FORFEIT = 15;

interface Stone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  p: number;
  spin: number;
  out: boolean;
}

interface Flick {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
}

/**
 * Curling with critters. Everyone flicks from the same distance at the same
 * target; stones knock each other around. Inner ring 3, middle 2, outer 1.
 */
export function createCurl(): GameModule {
  let c: GameContext;
  let cx = 0;
  let cy = 0;
  let rings: number[] = [];
  let launch: { x: number; y: number }[] = [];
  let stones: Stone[] = [];
  let left: number[] = [];
  let total: number[] = [];
  let flicks: (Flick | null)[] = [];
  let end = 0;
  let phase: 'throw' | 'score' = 'throw';
  let t = 0;
  let endT = 0;
  let r = 0;
  let labels: { x: number; y: number; s: string; col: string }[] = [];
  let done: number[] | null = null;

  const power = (d: number) => Math.min(1, d / (c.S * 0.35));
  const moving = () => stones.some((s) => !s.out && Math.hypot(s.vx, s.vy) > 1);
  const points = (s: Stone) => {
    const d = Math.hypot(s.x - cx, s.y - cy) - r * 0.5;
    return d <= rings[0] ? 3 : d <= rings[1] ? 2 : d <= rings[2] ? 1 : 0;
  };

  const newEnd = () => {
    stones = [];
    left = new Array(c.n).fill(STONES);
    phase = 'throw';
    endT = 0;
    labels = [];
  };

  return {
    init(ctx) {
      c = ctx;
      cx = ctx.W / 2;
      cy = ctx.H / 2;
      rings = [ctx.S * 0.06, ctx.S * 0.13, ctx.S * 0.2];
      r = ctx.S * 0.04;
      // Launch spots sit the same distance from the target for every seat.
      const D = Math.min(ctx.S * 0.78, ctx.H * 0.4);
      launch = ctx.zones.map((z) => {
        const dx = z.cx - cx;
        const dy = z.cy - cy;
        const d = Math.hypot(dx, dy);
        return { x: cx + (dx / d) * D, y: cy + (dy / d) * D };
      });
      total = new Array(ctx.n).fill(0);
      flicks = new Array(ctx.n).fill(null);
      newEnd();
    },
    onDown(p, id, x, y) {
      if (phase !== 'throw' || left[p] <= 0 || done) return;
      flicks[p] = { id, x0: x, y0: y, t0: t, x, y };
    },
    onMove(p, id, x, y) {
      const f = flicks[p];
      if (f && f.id === id) {
        f.x = x;
        f.y = y;
      }
    },
    onUp(p, id, x, y) {
      const f = flicks[p];
      if (!f || f.id !== id) return;
      flicks[p] = null;
      const dx = x - f.x0;
      const dy = y - f.y0;
      const d = Math.hypot(dx, dy);
      if (d < 18 || left[p] <= 0) return;
      // Power comes from drag length, not flick speed: touch speed is noisy,
      // length is what the aim arrow shows, so what you see is what you throw.
      const speed = c.S * (0.35 + 1.1 * power(d));
      const l = launch[p];
      // Wait for the previous stone to clear the launch spot.
      if (stones.some((s) => !s.out && Math.hypot(s.x - l.x, s.y - l.y) < r * 2.2)) return;
      stones.push({ x: l.x, y: l.y, vx: (dx / d) * speed, vy: (dy / d) * speed, p, spin: 0, out: false });
      left[p]--;
      sfx.shoot();
      buzz(12);
    },
    update(dt) {
      if (done) return;
      t += dt;
      endT += dt;
      for (const s of stones) {
        if (s.out) continue;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > 0) {
          const nsp = Math.max(0, sp * Math.exp(-0.7 * dt) - c.S * 0.22 * dt);
          s.vx *= nsp / sp;
          s.vy *= nsp / sp;
          if (nsp < 2) s.vx = s.vy = 0;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.spin += (s.vx * dt) / (r * 3);
        if (s.x < -r || s.x > c.W + r || s.y < -r || s.y > c.H + r) {
          s.out = true;
          sfx.wrong();
        }
      }
      for (let i = 0; i < stones.length; i++) {
        const a = stones[i];
        if (a.out) continue;
        for (let j = i + 1; j < stones.length; j++) {
          const b = stones[j];
          if (b.out) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= r * 2 || d < 1e-4) continue;
          const nx = dx / d;
          const ny = dy / d;
          const o = (r * 2 - d) / 2;
          a.x -= nx * o;
          a.y -= ny * o;
          b.x += nx * o;
          b.y += ny * o;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          a.vx -= rel * nx * 0.95;
          a.vy -= rel * ny * 0.95;
          b.vx += rel * nx * 0.95;
          b.vy += rel * ny * 0.95;
          sfx.bump(Math.min(1, rel / (c.S * 0.8)));
          c.fx.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#FFFFFF', 8, 200, 0.3, 2.5);
          buzz(10);
        }
      }
      if (phase === 'throw') {
        if (endT > IDLE_FORFEIT && !moving()) left.fill(0);
        if (left.every((l) => l === 0) && !moving() && flicks.every((f) => !f)) {
          phase = 'score';
          endT = 0;
          for (const s of stones) {
            if (s.out) continue;
            const pts = points(s);
            if (!pts) continue;
            total[s.p] += pts;
            labels.push({ x: s.x, y: s.y - r * 1.6, s: `+${pts}`, col: PLAYER_COLORS[s.p] });
            c.fx.burst(s.x, s.y, PLAYER_COLORS[s.p], 14, 240, 0.5, 3);
          }
          if (labels.length) sfx.point();
        }
      } else if (endT > 2.2) {
        end++;
        if (end >= ENDS) {
          done = total
            .map((_, i) => i)
            .sort((a, b) => total[b] - total[a]);
        } else newEnd();
      }
    },
    render(g) {
      // Ice
      g.fillStyle = '#EAF6FF';
      g.fillRect(0, 0, c.W, c.H);
      g.strokeStyle = 'rgba(47,123,255,0.08)';
      g.lineWidth = 2;
      for (let i = -c.H; i < c.W; i += 36) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + c.H, c.H);
        g.stroke();
      }
      // House
      const ringCols = ['#FF5A3C', '#FFFFFF', '#2F7BFF'];
      for (let i = 2; i >= 0; i--) {
        g.beginPath();
        g.arc(cx, cy, rings[i], 0, Math.PI * 2);
        g.fillStyle = ringCols[i];
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.stroke();
      }
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(cx, cy, 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      // Launch spots + aim arrows
      launch.forEach((l, p) => {
        g.save();
        g.setLineDash([6, 6]);
        g.strokeStyle = INK;
        g.lineWidth = 2.5;
        g.fillStyle = rgba(PLAYER_COLORS[p], 0.25);
        g.beginPath();
        g.arc(l.x, l.y, r * 1.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.restore();
        const f = flicks[p];
        if (f) {
          const dx = f.x - f.x0;
          const dy = f.y - f.y0;
          const d = Math.hypot(dx, dy);
          if (d > 10) {
            const pw = power(d);
            const len = c.S * (0.08 + 0.3 * pw);
            const ex = l.x + (dx / d) * len;
            const ey = l.y + (dy / d) * len;
            g.save();
            g.lineCap = 'round';
            g.strokeStyle = INK;
            g.lineWidth = 9;
            g.beginPath();
            g.moveTo(l.x, l.y);
            g.lineTo(ex, ey);
            g.stroke();
            g.strokeStyle = PLAYER_COLORS[p];
            g.lineWidth = 4;
            g.stroke();
            g.restore();
            text(g, `${Math.round(pw * 100)}%`, ex, ey - 16, 14, '#FFFFFF', { weight: 900, glow: 1 });
          }
        }
        // Next stone waiting on the spot
        if (left[p] > 0 && !stones.some((s) => !s.out && Math.hypot(s.x - l.x, s.y - l.y) < r * 2.2)) {
          critter(g, p, l.x, l.y, r * 2.6, 'idle', c.zones[p].angle);
        }
      });
      // Stones
      for (const s of stones) {
        if (s.out) continue;
        groundShadow(g, s.x, s.y + r * 0.9, r * 2);
        const pts = points(s);
        critter(g, s.p, s.x, s.y, r * 2.6, Math.hypot(s.vx, s.vy) > 5 ? 'happy' : pts === 3 ? 'win' : pts ? 'idle' : 'worried', s.spin);
      }
      for (const l of labels) {
        text(g, l.s, l.x, l.y - Math.min(1, endT) * 16, 24, l.col, { weight: 900, glow: 1, alpha: Math.max(0, 1.6 - endT) });
      }
      for (const z of c.zones) {
        const p = z.player;
        edgeTag(g, z, { lives: left[p], max: STONES, label: `${PLAYER_NAMES[p]} · ${total[p]}` });
        withZone(g, z, () => {
          text(g, `END ${Math.min(end + 1, ENDS)}/${ENDS}`, z.w / 2 - 36, -z.h / 2 + 22, 12, inkA(0.6), { weight: 700 });
          if (t < 4 && phase === 'throw') text(g, 'drag to aim, let go to throw!', 0, z.h * 0.12, 14, inkA(0.75), { weight: 600, maxWidth: z.w * 0.88 });
        });
      }
    },
    result: () => done,
  };
}
