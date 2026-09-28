import { critter, type Mood } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, rand, roundRect, sticker, text, tint } from '../core/draw';
import { toLocal, toWorld, withZone, type Zone } from '../core/zones';
import { DANGER, INK, PLAYER_COLORS, PLAYER_DARK, PLAYER_NAMES, inkA } from '../theme';
import type { GameContext, GameModule } from './types';

const LENGTH = 1500; // track length in world units
const MAX_V = 62;
const ACCEL = 60;
const COAST = 20;
const HEAT_UP = 0.3;
const HEAT_DOWN = 0.45;
const COOLED = 0.35;
const GRAVITY = 1500;
const JUMP_V = 480;
const CRASH_TIME = 0.9;
const TIME_LIMIT = 70;
const GRACE_AFTER_WINNER = 8;

type Kind = 'log' | 'puddle' | 'ramp';

interface Obstacle {
  pos: number;
  kind: Kind;
}

interface Rider {
  dist: number;
  v: number;
  heat: number;
  over: boolean;
  air: number;
  vy: number;
  crash: number;
  pedals: Set<number>;
  finish: number | null;
  wheel: number;
  flash: string;
  flashT: number;
}

/**
 * Side-view bike race. Everyone rides an identical track in their own lane:
 * hold PEDAL to speed up (but your legs overheat), tap JUMP to clear logs and
 * puddles, and hit ramps fast for a boost. Pacing beats mashing.
 */
export function createBike(): GameModule {
  let c: GameContext;
  let track: Obstacle[] = [];
  let riders: Rider[] = [];
  let t = 0;
  let firstFinish = -1;
  let done: number[] | null = null;

  const scale = (z: Zone) => z.w / 120;
  const groundY = (z: Zone) => z.h * 0.16;
  const bikeX = (z: Zone) => -z.w * 0.26;

  const flash = (r: Rider, s: string) => {
    r.flash = s;
    r.flashT = 0.9;
  };

  const ranking = () =>
    riders
      .map((r, p) => ({ p, f: r.finish ?? Infinity, d: r.dist }))
      .sort((a, b) => a.f - b.f || b.d - a.d)
      .map((e) => e.p);

  return {
    init(ctx) {
      c = ctx;
      // One track for everyone.
      let pos = 110;
      while (pos < LENGTH - 70) {
        const r = Math.random();
        track.push({ pos, kind: r < 0.55 ? 'log' : r < 0.8 ? 'puddle' : 'ramp' });
        pos += rand(85, 150);
      }
      riders = ctx.zones.map(() => ({
        dist: 0,
        v: 0,
        heat: 0,
        over: false,
        air: 0,
        vy: 0,
        crash: 0,
        pedals: new Set<number>(),
        finish: null,
        wheel: 0,
        flash: '',
        flashT: 0,
      }));
    },
    onDown(p, id, x, y) {
      const r = riders[p];
      if (r.finish !== null) return;
      const l = toLocal(c.zones[p], x, y);
      if (l.x < 0) r.pedals.add(id);
      else if (r.air === 0 && r.crash <= 0) {
        r.vy = JUMP_V;
        r.air = 0.01;
        sfx.tap(p);
        buzz(8);
      }
    },
    onUp(p, id) {
      riders[p].pedals.delete(id);
    },
    update(dt) {
      if (done) return;
      t += dt;
      riders.forEach((r, p) => {
        const z = c.zones[p];
        r.flashT = Math.max(0, r.flashT - dt);
        if (r.finish !== null) {
          r.v = Math.max(0, r.v - 40 * dt);
          r.dist += r.v * dt;
          return;
        }
        const pedaling = r.pedals.size > 0 && !r.over && r.crash <= 0;
        if (r.crash > 0) {
          r.crash -= dt;
          r.v = 0;
        } else if (pedaling) {
          r.v = Math.min(MAX_V, r.v + ACCEL * dt);
          r.heat += HEAT_UP * dt;
          if (r.heat >= 1) {
            r.heat = 1;
            r.over = true;
            flash(r, 'LEGS BURNING!');
            sfx.wrong();
          }
        } else {
          r.v = Math.max(0, r.v - COAST * dt);
        }
        if (!pedaling) {
          r.heat = Math.max(0, r.heat - HEAT_DOWN * dt);
          if (r.over && r.heat < COOLED) r.over = false;
        }
        if (r.air > 0) {
          r.air += r.vy * dt;
          r.vy -= GRAVITY * dt;
          if (r.air <= 0) {
            r.air = 0;
            r.vy = 0;
            sfx.bump(0.5);
          }
        }
        const prev = r.dist;
        r.dist += r.v * dt;
        r.wheel += (r.v * dt * scale(z)) / 13;
        for (const o of track) {
          if (o.pos <= prev || o.pos > r.dist) continue;
          const at = toWorld(z, bikeX(z), groundY(z) - 10);
          if (o.kind === 'log') {
            if (r.air < 14) {
              r.crash = CRASH_TIME;
              r.v = 0;
              r.dist = o.pos - 4;
              flash(r, 'OOF!');
              sfx.boom();
              buzz([40, 30, 40]);
              c.fx.burst(at.x, at.y, '#B08968', 18, 260, 0.5, 3);
              c.fx.shake(6);
              break;
            }
            flash(r, 'NICE!');
          } else if (o.kind === 'puddle') {
            if (r.air < 8) {
              r.v *= 0.45;
              flash(r, 'SPLASH');
              sfx.hit();
              c.fx.burst(at.x, at.y, '#7CC7FF', 16, 220, 0.5, 3);
            }
          } else if (r.air < 8) {
            const fast = r.v > 40;
            r.vy = JUMP_V + r.v * (fast ? 5 : 2);
            r.air = 0.01;
            if (fast) {
              r.v = Math.min(MAX_V + 12, r.v + 10);
              flash(r, 'AIR TIME!');
              sfx.point();
              buzz(20);
            }
          }
        }
        if (r.dist >= LENGTH) {
          r.finish = t;
          r.pedals.clear();
          if (firstFinish < 0) firstFinish = t;
          const place = riders.filter((q) => q.finish !== null).length;
          flash(r, place === 1 ? 'WINNER!' : `${place}${['ST', 'ND', 'RD', 'TH'][place - 1]}`);
          sfx.win();
          const w = toWorld(z, 0, 0);
          c.fx.confetti(w.x, w.y, 40, 1);
        }
      });
      const allIn = riders.every((r) => r.finish !== null);
      if (allIn || t >= TIME_LIMIT || (firstFinish >= 0 && t - firstFinish >= GRACE_AFTER_WINNER)) done = ranking();
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        const r = riders[p];
        const col = PLAYER_COLORS[p];
        const k = scale(z);
        const gy = groundY(z);
        const bx = bikeX(z);
        withZone(g, z, () => {
          const hw = z.w / 2;
          const hh = z.h / 2;
          g.save();
          g.beginPath();
          g.rect(-hw, -hh, z.w, z.h);
          g.clip();
          // Sky and parallax hills
          g.fillStyle = tint(col, 0.86);
          g.fillRect(-hw, -hh, z.w, z.h);
          g.strokeStyle = INK;
          g.lineWidth = 3;
          for (let i = 0; i < 4; i++) {
            const span = 220;
            const hx = ((((i * span - r.dist * k * 0.3) % (span * 4)) + span * 4) % (span * 4)) - hw - 60;
            g.fillStyle = tint(PLAYER_DARK[p], 0.55);
            g.beginPath();
            g.arc(hx, gy + 10, 70, Math.PI, 0);
            g.fill();
            g.stroke();
          }
          // Ground
          g.fillStyle = '#9BD77F';
          g.fillRect(-hw, gy, z.w, hh - gy);
          g.fillStyle = '#C9A27A';
          g.fillRect(-hw, gy + 12, z.w, 14);
          g.beginPath();
          g.moveTo(-hw, gy);
          g.lineTo(hw, gy);
          g.moveTo(-hw, gy + 12);
          g.lineTo(hw, gy + 12);
          g.moveTo(-hw, gy + 26);
          g.lineTo(hw, gy + 26);
          g.stroke();
          // Distance ticks on the road
          for (let d = Math.floor((r.dist - 40) / 20) * 20; d < r.dist + 120; d += 20) {
            const x = bx + (d - r.dist) * k;
            g.fillStyle = 'rgba(34,25,43,0.25)';
            g.fillRect(x, gy + 17, 8, 3);
          }
          // Obstacles
          for (const o of track) {
            const x = bx + (o.pos - r.dist) * k;
            if (x < -hw - 40 || x > hw + 40) continue;
            drawObstacle(g, o.kind, x, gy);
          }
          // Finish line
          const fx = bx + (LENGTH - r.dist) * k;
          if (fx > -hw - 20 && fx < hw + 20) drawFinish(g, fx, gy);
          // Bike + rider
          const mood: Mood = r.finish !== null ? 'win' : r.crash > 0 ? 'ko' : r.over ? 'worried' : r.air > 20 ? 'happy' : 'idle';
          drawBike(g, p, bx, gy - r.air, r.wheel, mood, r.crash > 0 ? 0.5 : r.air > 0 ? -Math.min(0.3, r.vy / 2000) : 0);
          g.restore();

          // Minimap with everyone's progress
          const my = -hh + 26;
          const mx0 = -hw * 0.78;
          const mx1 = hw * 0.78;
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(mx0, my);
          g.lineTo(mx1, my);
          g.stroke();
          g.fillStyle = INK;
          g.fillRect(mx1 - 2, my - 10, 4, 20);
          riders.forEach((q, i) => {
            if (i === p) return;
            critter(g, i, mx0 + (mx1 - mx0) * Math.min(1, q.dist / LENGTH), my - 2, 22, q.crash > 0 ? 'ko' : 'idle');
          });
          critter(g, p, mx0 + (mx1 - mx0) * Math.min(1, r.dist / LENGTH), my - 3, 30, 'happy');

          // Speed + flash text
          text(g, `${Math.round(r.v * 1.2)} km/h`, hw - 50, -hh + 58, 13, inkA(0.7), { weight: 700 });
          if (r.flashT > 0) {
            text(g, r.flash, 0, gy - 90 - (0.9 - r.flashT) * 30, 22, r.flash === 'OOF!' || r.flash === 'LEGS BURNING!' ? DANGER : '#FFFFFF', {
              weight: 900,
              glow: 1,
              alpha: Math.min(1, r.flashT * 2),
              maxWidth: z.w * 0.9,
            });
          }

          // Controls
          const bw = z.w * 0.44;
          const bh = 54;
          const by = hh - 34 - bh / 2;
          const pedalDown = r.pedals.size > 0;
          sticker(g, -hw + z.w * 0.04, by - bh / 2 + (pedalDown ? 3 : 0), bw, bh, 16, r.over ? '#E4D6C0' : pedalDown ? col : '#FFFFFF', pedalDown ? 1 : 4);
          text(g, r.over ? 'PUFF…' : 'PEDAL', -hw + z.w * 0.04 + bw / 2, by + (pedalDown ? 3 : 0), 18, INK, { weight: 900 });
          sticker(g, hw - z.w * 0.04 - bw, by - bh / 2, bw, bh, 16, '#FFFFFF', 4);
          text(g, 'JUMP', hw - z.w * 0.04 - bw / 2, by, 18, INK, { weight: 900 });
          // Heat bar
          const hx = -hw + z.w * 0.04;
          const hy = by - bh / 2 - 14;
          roundRect(g, hx, hy, bw, 8, 4);
          g.fillStyle = '#FFFFFF';
          g.fill();
          roundRect(g, hx, hy, Math.max(8, bw * r.heat), 8, 4);
          g.fillStyle = r.over ? DANGER : r.heat > 0.7 ? '#FF9A3C' : '#2DBE7E';
          g.fill();
          roundRect(g, hx, hy, bw, 8, 4);
          g.strokeStyle = INK;
          g.lineWidth = 2;
          g.stroke();
          if (r.finish !== null) pill(g, `${PLAYER_NAMES[p]} FINISHED`, 0, -hh * 0.3, col, 14);
        });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}

function drawObstacle(g: CanvasRenderingContext2D, kind: Kind, x: number, gy: number): void {
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  if (kind === 'log') {
    roundRect(g, x - 12, gy - 16, 24, 16, 6);
    g.fillStyle = '#A0703F';
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(x + 8, gy - 8, 3.5, 5, 0, 0, Math.PI * 2);
    g.fillStyle = '#E3C08D';
    g.fill();
    g.stroke();
  } else if (kind === 'puddle') {
    g.beginPath();
    g.ellipse(x, gy + 2, 22, 6, 0, 0, Math.PI * 2);
    g.fillStyle = '#7CC7FF';
    g.fill();
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(x - 24, gy);
    g.lineTo(x + 14, gy - 22);
    g.lineTo(x + 14, gy);
    g.closePath();
    g.fillStyle = '#FFC933';
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawFinish(g: CanvasRenderingContext2D, x: number, gy: number): void {
  g.save();
  g.fillStyle = INK;
  g.fillRect(x - 2, gy - 90, 4, 90);
  const s = 9;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      g.fillStyle = (i + j) % 2 ? INK : '#FFFFFF';
      g.fillRect(x + 2 + i * s, gy - 90 + j * s, s, s);
    }
  }
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.strokeRect(x + 2, gy - 90, s * 4, s * 3);
  g.restore();
}

function drawBike(g: CanvasRenderingContext2D, p: number, x: number, ground: number, wheel: number, mood: Mood, tilt: number): void {
  const wr = 13;
  g.save();
  g.translate(x, ground - wr);
  g.rotate(tilt);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const wx of [-18, 18]) {
    g.beginPath();
    g.arc(wx, 0, wr, 0, Math.PI * 2);
    g.fillStyle = '#FFFFFF';
    g.fill();
    g.stroke();
    g.save();
    g.translate(wx, 0);
    g.rotate(wheel);
    g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath();
      g.moveTo(-wr + 3, 0);
      g.lineTo(wr - 3, 0);
      g.stroke();
    }
    g.restore();
  }
  // frame: ink outline under the colour
  const frame = () => {
    g.beginPath();
    g.moveTo(-18, 0);
    g.lineTo(-4, -16);
    g.lineTo(12, -16);
    g.lineTo(18, 0);
    g.moveTo(-4, -16);
    g.lineTo(2, 0);
    g.lineTo(12, -16);
    g.moveTo(12, -16);
    g.lineTo(10, -24);
    g.lineTo(16, -24);
    g.stroke();
  };
  g.lineWidth = 7;
  frame();
  g.strokeStyle = PLAYER_COLORS[p];
  g.lineWidth = 3.5;
  frame();
  g.restore();
  critter(g, p, x - 4 + Math.sin(tilt) * 10, ground - wr - 34, 40, mood, tilt);
}
