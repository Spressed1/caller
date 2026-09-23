import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { critter } from '../core/assets';
import { drawCrown, pill, rgba, text } from '../core/draw';
import { withZone } from '../core/zones';
import { INK, PLAYER_COLORS, PLAYER_NAMES } from '../theme';
import { scoreRanking, type GameContext, type GameModule } from './types';

const TARGET = 50;

export function createTapRush(): GameModule {
  let c: GameContext;
  let count: number[] = [];
  let pulse: number[] = [];
  let shown: number[] = [];
  let done: number[] | null = null;

  return {
    init(ctx) {
      c = ctx;
      count = new Array(ctx.n).fill(0);
      pulse = new Array(ctx.n).fill(0);
      shown = new Array(ctx.n).fill(0);
    },
    onDown(p, _id, x, y) {
      if (done) return;
      count[p]++;
      pulse[p] = 1;
      sfx.tap(p);
      buzz(6);
      c.fx.burst(x, y, PLAYER_COLORS[p], 8, 240, 0.4, 3);
      if (count[p] >= TARGET) {
        const z = c.zones[p];
        c.fx.ring(z.cx, z.cy, PLAYER_COLORS[p], Math.max(z.w, z.h) * 0.6, 0.6);
        c.fx.shake(10);
        done = scoreRanking(count);
      }
    },
    update(dt) {
      for (let p = 0; p < c.n; p++) {
        pulse[p] = Math.max(0, pulse[p] - dt * 6);
        shown[p] += (count[p] - shown[p]) * Math.min(1, dt * 18);
      }
    },
    render(g) {
      const lead = Math.max(...count);
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        const k = shown[p] / TARGET;
        withZone(g, z, () => {
          const hw = z.w / 2;
          const hh = z.h / 2;
          const top = hh - z.h * k;
          const grad = g.createLinearGradient(0, hh, 0, top);
          grad.addColorStop(0, rgba(col, 0.6));
          grad.addColorStop(1, rgba(col, 0.12));
          g.fillStyle = grad;
          g.fillRect(-hw, top, z.w, hh - top);
          // Leading edge of the fill.
          g.fillStyle = col;
          g.fillRect(-hw, top - 3, z.w, 6);
          g.fillStyle = INK;
          g.fillRect(-hw, top - 4, z.w, 2);
          // Finish line.
          g.setLineDash([8, 8]);
          g.strokeStyle = 'rgba(34,25,43,0.25)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(-hw + 10, -hh + 3);
          g.lineTo(hw - 10, -hh + 3);
          g.stroke();
          g.setLineDash([]);

          const m = Math.min(z.w, z.h);
          const s = 1 + pulse[p] * 0.18;
          g.save();
          g.scale(s, s);
          text(g, String(count[p]), 0, 0, m * 0.36, '#fff', { weight: 900, glow: 20 + pulse[p] * 20 });
          g.restore();
          text(g, `/ ${TARGET}`, 0, m * 0.25, m * 0.07, 'rgba(34,25,43,0.55)', { weight: 700 });
          if (count[p] === 0) {
            text(g, 'TAP TAP TAP!', 0, -m * 0.3, m * 0.08, rgba(col, 0.7 + Math.sin(performance.now() / 150) * 0.3), { weight: 900 });
          }
          const cs = Math.min(m * 0.26, 90);
          const cy = Math.max(-hh + cs * 0.55, top - cs * 0.42);
          const leading = lead > 0 && count[p] === lead;
          critter(g, p, -hw * 0.55, cy, cs, leading ? 'happy' : count[p] > 0 ? 'idle' : 'worried', 0, 1 + pulse[p] * 0.25);
          if (leading) drawCrown(g, -hw * 0.55, cy - cs * 0.5, cs * 0.18, '#FFC933');
          pill(g, PLAYER_NAMES[p], 0, hh - 24, col, 12);
        });
      }
    },
    result: () => done,
  };
}
