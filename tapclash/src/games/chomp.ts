import { critter, groundShadow } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, rand, text, tint } from '../core/draw';
import { toWorld, withZone } from '../core/zones';
import { INK, PLAYER_COLORS, PLAYER_DARK, inkA } from '../theme';
import { scoreRanking, type GameContext, type GameModule } from './types';

const POOL = 36;
const GOLD = 5;
const MAX_ON_TABLE = 10;
const LUNGE = 0.3;
const COOLDOWN = 0.38;
const TIME_LIMIT = 45;
const CANDY = ['#FF7EB6', '#8B7CF6', '#2F7BFF', '#2DBE7E', '#FF9A3C'];

interface Candy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gold: boolean;
  color: string;
}

interface Muncher {
  hx: number;
  hy: number;
  tx: number; // lunge target
  ty: number;
  t: number; // 0 idle, (0,1] lunging
  cd: number;
  score: number;
  gulp: number;
}

/**
 * Hungry-hungry critters. Candy rolls around the table; tap where you want
 * your critter to lunge and it stretches out and chomps whatever is there.
 */
export function createChomp(): GameModule {
  let c: GameContext;
  let candies: Candy[] = [];
  let left = POOL;
  let goldLeft = GOLD;
  let munchers: Muncher[] = [];
  let R = 0;
  let cr = 0;
  let reach = 0;
  let spawnT = 0;
  let t = 0;
  let done: number[] | null = null;

  const spawn = () => {
    const gold = goldLeft > 0 && Math.random() < goldLeft / Math.max(1, left);
    if (gold) goldLeft--;
    left--;
    const a = Math.random() * Math.PI * 2;
    const sp = c.S * rand(0.3, 0.5);
    candies.push({
      x: c.W / 2,
      y: c.H / 2,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      gold,
      color: CANDY[(Math.random() * CANDY.length) | 0],
    });
  };

  const pos = (m: Muncher) => {
    const k = Math.sin(Math.min(1, m.t) * Math.PI);
    return { x: m.hx + (m.tx - m.hx) * k, y: m.hy + (m.ty - m.hy) * k };
  };

  return {
    init(ctx) {
      c = ctx;
      R = ctx.S * 0.1;
      cr = ctx.S * 0.03;
      reach = ctx.S * 0.5;
      munchers = ctx.zones.map((z) => {
        const h = toWorld(z, 0, z.h / 2 - R - 12);
        return { hx: h.x, hy: h.y, tx: h.x, ty: h.y, t: 0, cd: 0, score: 0, gulp: 0 };
      });
      for (let i = 0; i < 4; i++) spawn();
    },
    onDown(p, _id, x, y) {
      const m = munchers[p];
      if (done || m.cd > 0) return;
      let dx = x - m.hx;
      let dy = y - m.hy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, reach / d);
      dx *= k;
      dy *= k;
      m.tx = m.hx + dx;
      m.ty = m.hy + dy;
      m.t = 1e-3;
      m.cd = COOLDOWN;
      sfx.shoot();
      buzz(6);
    },
    update(dt) {
      if (done) return;
      t += dt;
      spawnT -= dt;
      if (left > 0 && candies.length < MAX_ON_TABLE && spawnT <= 0) {
        spawn();
        spawnT = 0.45;
      }
      const pad = cr + 4;
      for (const cd of candies) {
        cd.x += cd.vx * dt;
        cd.y += cd.vy * dt;
        if (cd.x < pad || cd.x > c.W - pad) {
          cd.vx = -cd.vx;
          cd.x = Math.max(pad, Math.min(c.W - pad, cd.x));
        }
        if (cd.y < pad || cd.y > c.H - pad) {
          cd.vy = -cd.vy;
          cd.y = Math.max(pad, Math.min(c.H - pad, cd.y));
        }
      }
      munchers.forEach((m, p) => {
        m.cd = Math.max(0, m.cd - dt);
        m.gulp = Math.max(0, m.gulp - dt * 4);
        if (m.t > 0) {
          m.t += dt / LUNGE;
          if (m.t >= 1) m.t = 0;
        }
        if (m.t > 0.25 && m.t < 0.85) {
          const at = pos(m);
          for (let i = candies.length - 1; i >= 0; i--) {
            const cd = candies[i];
            if (Math.hypot(cd.x - at.x, cd.y - at.y) < R * 0.8 + cr) {
              candies.splice(i, 1);
              m.score += cd.gold ? 3 : 1;
              m.gulp = 1;
              c.fx.burst(cd.x, cd.y, cd.gold ? '#FFC933' : cd.color, cd.gold ? 24 : 10, 260, 0.45, 3);
              if (cd.gold) {
                sfx.point();
                c.fx.shake(5);
              } else sfx.tap(p);
              buzz(cd.gold ? 25 : 10);
            }
          }
        }
      });
      if ((left === 0 && candies.length === 0) || t >= TIME_LIMIT) done = scoreRanking(munchers.map((m) => m.score));
    },
    render(g) {
      for (const z of c.zones) {
        g.fillStyle = tint(PLAYER_COLORS[z.player], 0.86);
        g.fillRect(z.x, z.y, z.w, z.h);
      }
      // Candy bowl in the middle.
      g.save();
      g.fillStyle = '#FFFFFF';
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(c.W / 2, c.H / 2, c.S * 0.12, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.setLineDash([5, 7]);
      g.beginPath();
      g.arc(c.W / 2, c.H / 2, c.S * 0.08, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      text(g, `${left + candies.length}`, c.W / 2, c.H / 2, c.S * 0.07, INK, { weight: 900 });

      for (const cd of candies) {
        g.save();
        g.beginPath();
        g.arc(cd.x, cd.y, cr * (cd.gold ? 1.3 : 1), 0, Math.PI * 2);
        g.fillStyle = cd.gold ? '#FFC933' : cd.color;
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 2.5;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath();
        g.arc(cd.x - cr * 0.35, cd.y - cr * 0.35, cr * 0.28, 0, Math.PI * 2);
        g.fill();
        if (cd.gold) {
          g.strokeStyle = INK;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(cd.x, cd.y - cr * 0.6);
          g.lineTo(cd.x, cd.y + cr * 0.6);
          g.moveTo(cd.x - cr * 0.6, cd.y);
          g.lineTo(cd.x + cr * 0.6, cd.y);
          g.stroke();
        }
        g.restore();
      }

      munchers.forEach((m, p) => {
        const at = pos(m);
        const z = c.zones[p];
        // Stretchy neck back to the home spot.
        if (m.t > 0) {
          g.save();
          g.lineCap = 'round';
          g.strokeStyle = INK;
          g.lineWidth = R * 0.9 + 6;
          g.beginPath();
          g.moveTo(m.hx, m.hy);
          g.lineTo(at.x, at.y);
          g.stroke();
          g.strokeStyle = PLAYER_DARK[p];
          g.lineWidth = R * 0.9;
          g.stroke();
          g.restore();
        }
        groundShadow(g, m.hx, m.hy + R * 0.85 * Math.cos(z.angle), R * 1.6);
        const face = m.t > 0 ? 'happy' : m.gulp > 0 ? 'win' : 'idle';
        const facing = z.angle;
        critter(g, p, at.x, at.y, R * 2.2, face, facing, 1 + m.gulp * 0.15);
        withZone(g, z, () => {
          pill(g, `${m.score}`, R + 34, z.h / 2 - R - 12, PLAYER_COLORS[p], 16);
        });
      });
      if (t < 3) {
        for (const z of c.zones) {
          withZone(g, z, () => text(g, 'tap where you want to chomp!', 0, z.h * 0.12, 14, inkA(0.7), { weight: 600, maxWidth: z.w * 0.88 }));
        }
      }
    },
    result: () => done,
  };
}
