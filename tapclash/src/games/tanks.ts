import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { rgba, roundRect } from '../core/draw';
import { PLAYER_COLORS } from '../theme';
import { drawStick, edgeTag, newStick, stickMove, zoneTints, type Stick } from './hud';
import { eliminationRanking, type GameContext, type GameModule } from './types';

const HP = 3;

interface Tank {
  x: number;
  y: number;
  a: number;
  hp: number;
  fire: number;
  flash: number;
  stick: Stick;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  life: number;
  bounces: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Top-down arena shooter: steer with the stick, cannons fire automatically. */
export function createTanks(): GameModule {
  let c: GameContext;
  let tanks: Tank[] = [];
  let bullets: Bullet[] = [];
  let walls: Rect[] = [];
  let tr = 0;
  let br = 0;
  let pad = 0;
  let t = 0;
  let outOrder: number[] = [];
  let done: number[] | null = null;

  const inRect = (r: Rect, x: number, y: number, m = 0) =>
    x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;

  const pushOut = (tk: Tank) => {
    for (const r of walls) {
      const nx = Math.max(r.x, Math.min(tk.x, r.x + r.w));
      const ny = Math.max(r.y, Math.min(tk.y, r.y + r.h));
      const dx = tk.x - nx;
      const dy = tk.y - ny;
      const d = Math.hypot(dx, dy);
      if (d < tr && d > 1e-4) {
        tk.x = nx + (dx / d) * tr;
        tk.y = ny + (dy / d) * tr;
      }
    }
    tk.x = Math.max(pad + tr, Math.min(c.W - pad - tr, tk.x));
    tk.y = Math.max(pad + tr, Math.min(c.H - pad - tr, tk.y));
  };

  return {
    init(ctx) {
      c = ctx;
      const S = ctx.S;
      tr = S * 0.045;
      br = S * 0.012;
      pad = 10;
      const cx = ctx.W / 2;
      const cy = ctx.H / 2;
      walls = [
        { x: cx - S * 0.08, y: cy - S * 0.08, w: S * 0.16, h: S * 0.16 },
        { x: S * 0.06, y: cy - S * 0.025, w: S * 0.2, h: S * 0.05 },
        { x: ctx.W - S * 0.26, y: cy - S * 0.025, w: S * 0.2, h: S * 0.05 },
        { x: cx - S * 0.025, y: ctx.H * 0.36 - S * 0.05, w: S * 0.05, h: S * 0.1 },
        { x: cx - S * 0.025, y: ctx.H * 0.64 - S * 0.05, w: S * 0.05, h: S * 0.1 },
      ];
      tanks = ctx.zones.map((z) => {
        const x = z.cx + (cx - z.cx) * 0.1;
        const y = z.cy + (cy - z.cy) * 0.1;
        return { x, y, a: Math.atan2(cy - y, cx - x), hp: HP, fire: 0.8, flash: 0, stick: newStick() };
      });
    },
    onDown(p, id, x, y) {
      const s = tanks[p].stick;
      if (s.id === null) Object.assign(s, { id, ox: x, oy: y, dx: 0, dy: 0 });
    },
    onMove(p, id, x, y) {
      const s = tanks[p].stick;
      if (s.id === id) stickMove(s, x, y);
    },
    onUp(p, id) {
      const s = tanks[p].stick;
      if (s.id === id) {
        s.id = null;
        s.dx = s.dy = 0;
      }
    },
    update(dt) {
      if (done) return;
      t += dt;
      const speed = c.S * 0.42;
      const rate = t > 40 ? 0.38 : 0.65; // sudden death: faster fire
      tanks.forEach((tk, p) => {
        if (tk.hp <= 0) return;
        tk.flash = Math.max(0, tk.flash - dt);
        const m = Math.hypot(tk.stick.dx, tk.stick.dy);
        if (m > 0.15) {
          tk.x += tk.stick.dx * speed * dt;
          tk.y += tk.stick.dy * speed * dt;
          const want = Math.atan2(tk.stick.dy, tk.stick.dx);
          let d = want - tk.a;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          tk.a += d * Math.min(1, dt * 12);
        }
        pushOut(tk);
        tk.fire -= dt;
        if (tk.fire <= 0) {
          tk.fire = rate;
          const bs = c.S * 1.05;
          const mx = tk.x + Math.cos(tk.a) * tr * 1.5;
          const my = tk.y + Math.sin(tk.a) * tr * 1.5;
          bullets.push({ x: mx, y: my, vx: Math.cos(tk.a) * bs, vy: Math.sin(tk.a) * bs, owner: p, life: 1.8, bounces: 1 });
          c.fx.burst(mx, my, PLAYER_COLORS[p], 4, 120, 0.2, 2);
          sfx.shoot();
        }
      });
      // Tank separation
      for (let i = 0; i < tanks.length; i++) {
        for (let j = i + 1; j < tanks.length; j++) {
          const a = tanks[i];
          const b = tanks[j];
          if (a.hp <= 0 || b.hp <= 0) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < tr * 2 && d > 1e-4) {
            const o = (tr * 2 - d) / 2;
            a.x -= (dx / d) * o;
            a.y -= (dy / d) * o;
            b.x += (dx / d) * o;
            b.y += (dy / d) * o;
          }
        }
      }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const px = b.x;
        const py = b.y;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        let dead = b.life <= 0;
        // Arena edges
        if (b.x < pad || b.x > c.W - pad) {
          b.vx = -b.vx;
          b.x = px;
          if (b.bounces-- <= 0) dead = true;
        }
        if (b.y < pad || b.y > c.H - pad) {
          b.vy = -b.vy;
          b.y = py;
          if (b.bounces-- <= 0) dead = true;
        }
        for (const r of walls) {
          if (!inRect(r, b.x, b.y, br)) continue;
          if (!inRect(r, px, b.y, br)) b.vx = -b.vx;
          else b.vy = -b.vy;
          b.x = px;
          b.y = py;
          if (b.bounces-- <= 0) dead = true;
          c.fx.burst(b.x, b.y, '#ffffff', 4, 120, 0.2, 1.5);
          break;
        }
        if (!dead) {
          for (let p = 0; p < tanks.length; p++) {
            const tk = tanks[p];
            if (tk.hp <= 0 || p === b.owner) continue;
            if (Math.hypot(tk.x - b.x, tk.y - b.y) < tr + br) {
              dead = true;
              tk.hp--;
              tk.flash = 0.25;
              tk.x += b.vx * 0.02;
              tk.y += b.vy * 0.02;
              pushOut(tk);
              c.fx.burst(b.x, b.y, PLAYER_COLORS[p], 20, 300, 0.5, 3);
              c.fx.shake(6);
              sfx.hit();
              buzz(20);
              if (tk.hp <= 0) {
                outOrder.push(p);
                c.fx.burst(tk.x, tk.y, PLAYER_COLORS[p], 70, 480, 1, 5);
                c.fx.ring(tk.x, tk.y, PLAYER_COLORS[p], tr * 5, 0.6);
                c.fx.shake(16);
                sfx.boom();
                buzz([50, 30, 50]);
              }
              break;
            }
          }
        }
        if (dead) bullets.splice(i, 1);
      }
      if (tanks.filter((tk) => tk.hp > 0).length <= 1) done = eliminationRanking(c.n, outOrder);
    },
    render(g) {
      zoneTints(g, c.zones, 0.04);
      g.strokeStyle = 'rgba(192,132,252,0.55)';
      g.lineWidth = 2;
      g.strokeRect(pad, pad, c.W - pad * 2, c.H - pad * 2);
      for (const r of walls) {
        g.save();
        roundRect(g, r.x, r.y, r.w, r.h, 6);
        g.fillStyle = '#1e1b3a';
        g.fill();
        g.strokeStyle = 'rgba(192,132,252,0.7)';
        g.shadowColor = '#C084FC';
        g.shadowBlur = 12;
        g.lineWidth = 2;
        g.stroke();
        g.restore();
      }
      for (const b of bullets) {
        const col = PLAYER_COLORS[b.owner];
        g.save();
        g.fillStyle = '#fff';
        g.shadowColor = col;
        g.shadowBlur = 12;
        g.beginPath();
        g.arc(b.x, b.y, br, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      tanks.forEach((tk, p) => {
        if (tk.hp <= 0) return;
        const col = PLAYER_COLORS[p];
        g.save();
        g.translate(tk.x, tk.y);
        g.rotate(tk.a);
        g.shadowColor = col;
        g.shadowBlur = 16;
        roundRect(g, -tr, -tr * 0.85, tr * 2, tr * 1.7, tr * 0.4);
        g.fillStyle = tk.flash > 0 ? '#fff' : rgba(col, 0.9);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(11,11,20,0.55)';
        g.fillRect(-tr, -tr * 0.85, tr * 2, tr * 0.3);
        g.fillRect(-tr, tr * 0.55, tr * 2, tr * 0.3);
        g.fillStyle = '#fff';
        g.fillRect(0, -tr * 0.18, tr * 1.6, tr * 0.36);
        g.beginPath();
        g.arc(0, 0, tr * 0.45, 0, Math.PI * 2);
        g.fillStyle = rgba(col, 1);
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.stroke();
        g.restore();
        drawStick(g, tk.stick, col);
      });
      for (const z of c.zones) {
        const tk = tanks[z.player];
        edgeTag(g, z, tk.hp > 0 ? { lives: tk.hp, max: HP } : { out: true });
      }
    },
    result: () => done,
  };
}
