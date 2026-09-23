import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { critter, groundShadow, type Mood } from '../core/assets';
import { INK, PLAYER_COLORS } from '../theme';
import { drawStick, edgeTag, newStick, stickMove, zoneTints, type Stick } from './hud';
import { eliminationRanking, type GameContext, type GameModule } from './types';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fall: number; // 0 = on the ring, >0 = falling
  out: boolean;
  dashCd: number;
  stick: Stick;
}

const DASH_CD = 1.2;

export function createSumo(): GameModule {
  let c: GameContext;
  let balls: Ball[] = [];
  let cx = 0;
  let cy = 0;
  let R0 = 0;
  let R = 0;
  let r = 0;
  let t = 0;
  let outOrder: number[] = [];
  let done: number[] | null = null;

  const dash = (p: number) => {
    const b = balls[p];
    if (b.out || b.fall > 0 || b.dashCd > 0) return;
    let dx = b.stick.dx;
    let dy = b.stick.dy;
    if (Math.hypot(dx, dy) < 0.2) {
      dx = b.vx;
      dy = b.vy;
    }
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) return;
    const imp = c.S * 1.15;
    b.vx += (dx / d) * imp;
    b.vy += (dy / d) * imp;
    b.dashCd = DASH_CD;
    c.fx.ring(b.x, b.y, PLAYER_COLORS[p], r * 2.2, 0.35);
    sfx.shoot();
    buzz(15);
  };

  return {
    init(ctx) {
      c = ctx;
      cx = ctx.W / 2;
      cy = ctx.H / 2;
      R0 = R = ctx.S * 0.46;
      r = ctx.S * 0.06;
      balls = ctx.zones.map((z) => {
        const a = Math.atan2(z.cy - cy, z.cx - cx);
        return {
          x: cx + Math.cos(a) * R0 * 0.55,
          y: cy + Math.sin(a) * R0 * 0.55,
          vx: 0,
          vy: 0,
          fall: 0,
          out: false,
          dashCd: 0,
          stick: newStick(),
        };
      });
    },
    onDown(p, id, x, y) {
      const s = balls[p].stick;
      if (s.id === null) {
        Object.assign(s, { id, ox: x, oy: y, dx: 0, dy: 0, t0: t, moved: 0 });
      } else dash(p); // second finger = dash
    },
    onMove(p, id, x, y) {
      const s = balls[p].stick;
      if (s.id === id) stickMove(s, x, y);
    },
    onUp(p, id) {
      const s = balls[p].stick;
      if (s.id !== id) return;
      if (t - s.t0 < 0.2 && s.moved < 12) dash(p); // quick tap = dash
      s.id = null;
      s.dx = s.dy = 0;
    },
    update(dt) {
      t += dt;
      R = Math.max(c.S * 0.2, R0 - Math.max(0, t - 6) * c.S * 0.0065);
      const acc = c.S * 2.6;
      const maxV = c.S * 1.6;
      for (const b of balls) {
        if (b.out) continue;
        b.dashCd = Math.max(0, b.dashCd - dt);
        if (b.fall > 0) {
          b.fall += dt;
          b.x += b.vx * dt * 0.4;
          b.y += b.vy * dt * 0.4;
          continue;
        }
        b.vx += b.stick.dx * acc * dt;
        b.vy += b.stick.dy * acc * dt;
        const f = Math.exp(-1.7 * dt);
        b.vx *= f;
        b.vy *= f;
        const v = Math.hypot(b.vx, b.vy);
        if (v > maxV) {
          b.vx *= maxV / v;
          b.vy *= maxV / v;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      // Ball-ball collisions (equal mass, slightly bouncy).
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.out || a.fall > 0) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.out || b.fall > 0) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= r * 2 || d < 1e-4) continue;
          const nx = dx / d;
          const ny = dy / d;
          const overlap = r * 2 - d;
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          const jimp = rel * 1.05;
          a.vx -= jimp * nx;
          a.vy -= jimp * ny;
          b.vx += jimp * nx;
          b.vy += jimp * ny;
          const strength = Math.min(1, rel / (c.S * 1.2));
          sfx.bump(strength);
          if (strength > 0.25) {
            c.fx.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffffff', 10, 300, 0.35, 2.5);
            c.fx.shake(strength * 8);
            buzz(10);
          }
        }
      }
      // Falling off the ring.
      balls.forEach((b, p) => {
        if (b.out) return;
        if (b.fall === 0 && Math.hypot(b.x - cx, b.y - cy) > R) {
          b.fall = 1e-3;
          b.stick.id = null;
          sfx.boom();
          buzz([40, 30, 40]);
          c.fx.burst(b.x, b.y, PLAYER_COLORS[p], 40, 380, 0.8, 4);
          c.fx.shake(12);
        }
        if (b.fall > 0.5) {
          b.out = true;
          outOrder.push(p);
        }
      });
      const alive = balls.filter((b) => !b.out && b.fall === 0).length;
      const falling = balls.some((b) => !b.out && b.fall > 0);
      if (!done && alive <= 1 && !falling) done = eliminationRanking(c.n, outOrder);
    },
    render(g) {
      zoneTints(g, c.zones, 0.04);
      // Arena
      const shrinking = t > 6 && R > c.S * 0.2;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, '#FFF8EC');
      grad.addColorStop(1, '#F2D7AE');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(34,25,43,0.12)';
      g.lineWidth = 2;
      for (let k = 1; k <= 3; k++) {
        g.beginPath();
        g.arc(cx, cy, (R * k) / 4, 0, Math.PI * 2);
        g.stroke();
      }
      g.save();
      const edge = shrinking && Math.sin(t * 8) > 0 ? '#FF3B5C' : '#8B7CF6';
      g.strokeStyle = INK;
      g.lineWidth = 12;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = edge;
      g.lineWidth = 6;
      g.stroke();
      g.restore();

      balls.forEach((b, p) => {
        if (b.out) return;
        const col = PLAYER_COLORS[p];
        const s = b.fall > 0 ? Math.max(0, 1 - b.fall * 2) : 1;
        const rr = r * s;
        if (rr <= 0) return;
        const edgeDist = Math.hypot(b.x - cx, b.y - cy) / R;
        const mood: Mood = b.fall > 0 ? 'ko' : b.dashCd > DASH_CD - 0.3 ? 'happy' : edgeDist > 0.75 ? 'worried' : 'idle';
        if (b.fall === 0) groundShadow(g, b.x, b.y + rr * 0.85, rr * 1.8);
        critter(g, p, b.x, b.y, rr * 2.5, mood, b.fall * 6 + b.vx / (c.S * 8));
        if (b.fall === 0 && b.dashCd <= 0) {
          g.save();
          g.strokeStyle = col;
          g.lineWidth = 3;
          g.setLineDash([4, 5]);
          g.beginPath();
          g.arc(b.x, b.y, rr * 1.4, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        drawStick(g, b.stick, col);
      });
      for (const z of c.zones) edgeTag(g, z, { out: balls[z.player].out || balls[z.player].fall > 0 });
    },
    result: () => done,
  };
}
