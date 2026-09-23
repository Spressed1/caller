import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { critter } from '../core/assets';
import { rgba, text } from '../core/draw';
import { withZone } from '../core/zones';
import { INK, PLAYER_COLORS } from '../theme';
import { edgeTag } from './hud';
import type { GameContext, GameModule } from './types';

const TIME_LIMIT = 40;

/**
 * Tug of war with one rope per player. Every tap yanks the knot towards your
 * goal; everyone else is pulling the other way. Drag it into your goal to win.
 */
export function createTug(): GameModule {
  let c: GameContext;
  let kx = 0;
  let ky = 0;
  let vx = 0;
  let vy = 0;
  let goals: { x: number; y: number }[] = [];
  let goalR = 0;
  let yank: number[] = [];
  let t = 0;
  let done: number[] | null = null;

  const byDistance = () =>
    goals
      .map((gl, p) => ({ p, d: Math.hypot(gl.x - kx, gl.y - ky) }))
      .sort((a, b) => a.d - b.d)
      .map((e) => e.p);

  return {
    init(ctx) {
      c = ctx;
      kx = ctx.W / 2;
      ky = ctx.H / 2;
      goalR = ctx.S * 0.1;
      // Goals sit the same distance from the knot so no seat has an advantage.
      const D = Math.min(ctx.S * 0.8, ctx.H * 0.4);
      goals = ctx.zones.map((z) => {
        const dx = z.cx - kx;
        const dy = z.cy - ky;
        const d = Math.hypot(dx, dy);
        return { x: kx + (dx / d) * D, y: ky + (dy / d) * D };
      });
      yank = new Array(ctx.n).fill(0);
    },
    onDown(p) {
      if (done) return;
      const gl = goals[p];
      const dx = gl.x - kx;
      const dy = gl.y - ky;
      const d = Math.hypot(dx, dy) || 1;
      const imp = c.S * 0.055;
      vx += (dx / d) * imp;
      vy += (dy / d) * imp;
      yank[p] = 1;
      sfx.tap(p);
      buzz(5);
      c.fx.burst(kx, ky, PLAYER_COLORS[p], 5, 200, 0.3, 2.5);
    },
    update(dt) {
      if (done) return;
      t += dt;
      for (let p = 0; p < c.n; p++) yank[p] = Math.max(0, yank[p] - dt * 6);
      const f = Math.exp(-2.8 * dt);
      vx *= f;
      vy *= f;
      kx += vx * dt;
      ky += vy * dt;
      for (let p = 0; p < c.n; p++) {
        if (Math.hypot(goals[p].x - kx, goals[p].y - ky) < goalR) {
          const gl = goals[p];
          c.fx.burst(gl.x, gl.y, PLAYER_COLORS[p], 80, 560, 1, 5);
          c.fx.ring(gl.x, gl.y, PLAYER_COLORS[p], c.S * 0.4, 0.6);
          c.fx.shake(16);
          sfx.boom();
          done = [p, ...byDistance().filter((q) => q !== p)];
          return;
        }
      }
      if (t >= TIME_LIMIT) done = byDistance();
    },
    render(g) {
      const near = byDistance()[0];
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        const grad = g.createRadialGradient(goals[p].x, goals[p].y, 0, goals[p].x, goals[p].y, Math.max(z.w, z.h) * 0.8);
        grad.addColorStop(0, rgba(col, 0.18));
        grad.addColorStop(1, rgba(col, 0.02));
        g.fillStyle = grad;
        g.fillRect(z.x, z.y, z.w, z.h);
      }
      // Ropes: ink outline under a dashed coloured core that crawls as you pull.
      g.save();
      g.lineCap = 'round';
      goals.forEach((gl, p) => {
        const col = PLAYER_COLORS[p];
        const d = Math.hypot(gl.x - kx, gl.y - ky);
        const sag = (1 - Math.min(1, d / (c.S * 0.8))) * 14 + yank[p] * -6;
        const mx = (gl.x + kx) / 2;
        const my = (gl.y + ky) / 2;
        const nx = -(gl.y - ky) / (d || 1);
        const ny = (gl.x - kx) / (d || 1);
        g.beginPath();
        g.moveTo(kx, ky);
        g.quadraticCurveTo(mx + nx * sag, my + ny * sag, gl.x, gl.y);
        g.strokeStyle = INK;
        g.lineWidth = 11 + yank[p] * 3;
        g.stroke();
        g.strokeStyle = col;
        g.lineWidth = 6 + yank[p] * 3;
        g.setLineDash([10, 6]);
        g.lineDashOffset = -t * 30;
        g.stroke();
        g.setLineDash([]);
      });
      g.restore();
      // Goals, each guarded by its critter leaning back on the rope.
      goals.forEach((gl, p) => {
        const col = PLAYER_COLORS[p];
        const pulse = 1 + Math.sin(t * 4 + p) * 0.05;
        g.save();
        g.beginPath();
        g.arc(gl.x, gl.y, goalR * pulse, 0, Math.PI * 2);
        g.fillStyle = rgba(col, 0.3);
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.setLineDash([7, 6]);
        g.stroke();
        g.restore();
        const dist = Math.hypot(gl.x - kx, gl.y - ky) || 1;
        const bx = gl.x + ((gl.x - kx) / dist) * goalR * 0.7;
        const by = gl.y + ((gl.y - ky) / dist) * goalR * 0.7;
        const mood = dist < c.S * 0.3 ? 'happy' : p !== near ? 'worried' : 'idle';
        critter(g, p, bx, by, goalR * 1.9, mood, c.zones[p].angle + yank[p] * 0.2, 1 + yank[p] * 0.2);
      });
      // Knot
      g.save();
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(kx, ky, c.S * 0.045, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();

      for (const z of c.zones) {
        withZone(g, z, () => {
          const left = Math.max(0, Math.ceil(TIME_LIMIT - t));
          if (t < 3) text(g, 'TAP TO PULL!', 0, -z.h * 0.22, 20, '#FFFFFF', { weight: 900, glow: 1, alpha: Math.min(1, 3 - t) });
          text(g, `${left}s`, z.w / 2 - 24, -z.h / 2 + 22, 14, 'rgba(34,25,43,0.55)', { weight: 900 });
        });
        edgeTag(g, z);
      }
    },
    result: () => done,
  };
}
