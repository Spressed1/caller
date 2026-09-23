import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, rand, rgba, text } from '../core/draw';
import { withZone } from '../core/zones';
import { PLAYER_COLORS, PLAYER_NAMES } from '../theme';
import { drawStick, newStick, stickMove, zoneTints, type Stick } from './hud';
import { scoreRanking, type GameContext, type GameModule } from './types';

const DURATION = 30;

interface Brush {
  x: number;
  y: number;
  kx: number; // knockback velocity
  ky: number;
  stick: Stick;
}

/** Roll your brush around and paint the floor. Most coverage after 30s wins. */
export function createPaint(): GameModule {
  let c: GameContext;
  let cell = 0;
  let cols = 0;
  let rows = 0;
  let owner: Int8Array;
  let counts: number[] = [];
  let brushes: Brush[] = [];
  let br = 0;
  let paintR = 0;
  let left = DURATION;
  let lastSec = DURATION;
  let star: { x: number; y: number } | null = null;
  let starT = 4;
  let done: number[] | null = null;

  const paint = (p: number, x: number, y: number, r: number) => {
    const c0 = Math.max(0, Math.floor((x - r) / cell));
    const c1 = Math.min(cols - 1, Math.floor((x + r) / cell));
    const r0 = Math.max(0, Math.floor((y - r) / cell));
    const r1 = Math.min(rows - 1, Math.floor((y + r) / cell));
    for (let j = r0; j <= r1; j++) {
      for (let i = c0; i <= c1; i++) {
        const cx = (i + 0.5) * cell;
        const cy = (j + 0.5) * cell;
        if ((cx - x) ** 2 + (cy - y) ** 2 > r * r) continue;
        const k = j * cols + i;
        const prev = owner[k];
        if (prev === p) continue;
        if (prev >= 0) counts[prev]--;
        owner[k] = p;
        counts[p]++;
      }
    }
  };

  const spawnStar = () => {
    star = { x: rand(c.W * 0.15, c.W * 0.85), y: rand(c.H * 0.2, c.H * 0.8) };
  };

  return {
    init(ctx) {
      c = ctx;
      cell = ctx.S / 16;
      cols = Math.ceil(ctx.W / cell);
      rows = Math.ceil(ctx.H / cell);
      owner = new Int8Array(cols * rows).fill(-1);
      counts = new Array(ctx.n).fill(0);
      br = ctx.S * 0.045;
      paintR = ctx.S * 0.075;
      brushes = ctx.zones.map((z) => ({
        x: z.cx + (ctx.W / 2 - z.cx) * 0.2,
        y: z.cy + (ctx.H / 2 - z.cy) * 0.2,
        kx: 0,
        ky: 0,
        stick: newStick(),
      }));
      brushes.forEach((b, p) => paint(p, b.x, b.y, paintR * 1.4));
    },
    onDown(p, id, x, y) {
      const s = brushes[p].stick;
      if (s.id === null) Object.assign(s, { id, ox: x, oy: y, dx: 0, dy: 0 });
    },
    onMove(p, id, x, y) {
      const s = brushes[p].stick;
      if (s.id === id) stickMove(s, x, y);
    },
    onUp(p, id) {
      const s = brushes[p].stick;
      if (s.id === id) {
        s.id = null;
        s.dx = s.dy = 0;
      }
    },
    update(dt) {
      if (done) return;
      left -= dt;
      const sec = Math.ceil(left);
      if (sec !== lastSec) {
        lastSec = sec;
        if (sec <= 5 && sec > 0) {
          sfx.beep();
          buzz(8);
        }
      }
      if (left <= 0) {
        done = scoreRanking(counts);
        return;
      }
      starT -= dt;
      if (!star && starT <= 0) spawnStar();

      const speed = c.S * 0.6;
      brushes.forEach((b, p) => {
        b.x += (b.stick.dx * speed + b.kx) * dt;
        b.y += (b.stick.dy * speed + b.ky) * dt;
        const f = Math.exp(-5 * dt);
        b.kx *= f;
        b.ky *= f;
        b.x = Math.max(br, Math.min(c.W - br, b.x));
        b.y = Math.max(br, Math.min(c.H - br, b.y));
        paint(p, b.x, b.y, paintR);
        if (star && Math.hypot(star.x - b.x, star.y - b.y) < br + 18) {
          paint(p, star.x, star.y, c.S * 0.24);
          c.fx.burst(star.x, star.y, PLAYER_COLORS[p], 60, 520, 0.9, 5);
          c.fx.ring(star.x, star.y, PLAYER_COLORS[p], c.S * 0.26, 0.5);
          c.fx.shake(10);
          sfx.point();
          buzz(30);
          star = null;
          starT = rand(4, 7);
        }
      });
      for (let i = 0; i < brushes.length; i++) {
        for (let j = i + 1; j < brushes.length; j++) {
          const a = brushes[i];
          const b = brushes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < br * 2 && d > 1e-4) {
            const nx = dx / d;
            const ny = dy / d;
            const push = c.S * 0.9;
            a.kx -= nx * push;
            a.ky -= ny * push;
            b.kx += nx * push;
            b.ky += ny * push;
            a.x -= (nx * (br * 2 - d)) / 2;
            a.y -= (ny * (br * 2 - d)) / 2;
            b.x += (nx * (br * 2 - d)) / 2;
            b.y += (ny * (br * 2 - d)) / 2;
            sfx.bump(0.6);
            c.fx.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#fff', 10, 260, 0.3, 2);
          }
        }
      }
    },
    render(g) {
      zoneTints(g, c.zones, 0.03);
      const pad = cell * 0.08;
      for (let p = 0; p < c.n; p++) {
        g.fillStyle = rgba(PLAYER_COLORS[p], 0.62);
        for (let k = 0; k < owner.length; k++) {
          if (owner[k] !== p) continue;
          const i = k % cols;
          const j = (k / cols) | 0;
          g.fillRect(i * cell + pad, j * cell + pad, cell - pad * 2, cell - pad * 2);
        }
      }
      if (star) {
        const s = 1 + Math.sin(performance.now() / 120) * 0.12;
        g.save();
        g.translate(star.x, star.y);
        g.scale(s, s);
        g.rotate(performance.now() / 600);
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 9 : 22;
          const a = (i * Math.PI) / 5;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.fillStyle = '#FDE68A';
        g.shadowColor = '#FDE68A';
        g.shadowBlur = 24;
        g.fill();
        g.restore();
      }
      brushes.forEach((b, p) => {
        const col = PLAYER_COLORS[p];
        g.save();
        g.fillStyle = '#fff';
        g.shadowColor = col;
        g.shadowBlur = 22;
        g.beginPath();
        g.arc(b.x, b.y, br, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = col;
        g.beginPath();
        g.arc(b.x, b.y, br * 0.6, 0, Math.PI * 2);
        g.fill();
        g.restore();
        drawStick(g, b.stick, col);
      });
      const totalCells = owner.length;
      const lead = Math.max(...counts);
      for (const z of c.zones) {
        const p = z.player;
        withZone(g, z, () => {
          const y = z.h / 2 - 24;
          const pct = Math.round((counts[p] / totalCells) * 100);
          pill(g, `${PLAYER_NAMES[p]} · ${pct}%${counts[p] === lead && lead > 0 ? ' ★' : ''}`, 0, y, PLAYER_COLORS[p], 12);
          const secs = Math.max(0, Math.ceil(left));
          const urgent = secs <= 5;
          text(g, `${secs}`, 0, y - 36, urgent ? 30 : 18, urgent ? '#FB7185' : 'rgba(255,255,255,0.7)', { weight: 900, glow: urgent ? 16 : 0 });
        });
      }
    },
    result: () => done,
  };
}
