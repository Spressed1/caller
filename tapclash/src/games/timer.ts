import { critter, type Mood } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pips, shuffle, text, tint } from '../core/draw';
import { withZone } from '../core/zones';
import { DANGER, INK, PLAYER_COLORS, inkA } from '../theme';
import { edgeTag } from './hud';
import type { GameContext, GameModule } from './types';

const ROUNDS = 3;
const VISIBLE = 1.5; // seconds the clock is shown before it goes dark
const POINTS = [3, 2, 1, 0];
type Phase = 'ready' | 'run' | 'reveal';

/**
 * Stop the clock on the target time, in your head. The clock hides after 1.5s.
 * Closest gets 3, next 2, then 1. Three rounds.
 */
export function createTimer(): GameModule {
  let c: GameContext;
  let targets: number[] = [];
  let round = 0;
  let phase: Phase = 'ready';
  let t = 0;
  let stopped: (number | null)[] = [];
  let gained: number[] = [];
  let total: number[] = [];
  let errSum: number[] = [];
  let done: number[] | null = null;

  const reveal = () => {
    phase = 'reveal';
    t = 0;
    const T = targets[round];
    const err = stopped.map((s) => (s === null ? Infinity : Math.abs(s - T)));
    const order = err.map((_, i) => i).sort((a, b) => err[a] - err[b]);
    gained = new Array(c.n).fill(0);
    order.forEach((p, place) => {
      if (err[p] === Infinity) return;
      gained[p] = POINTS[place];
      total[p] += POINTS[place];
      errSum[p] += err[p];
    });
    errSum.forEach((_, p) => err[p] === Infinity && (errSum[p] += 10));
    sfx.bell();
    const best = order[0];
    if (err[best] !== Infinity) {
      const z = c.zones[best];
      c.fx.burst(z.cx, z.cy, PLAYER_COLORS[best], 40, 400, 0.8, 4);
    }
  };

  return {
    init(ctx) {
      c = ctx;
      targets = shuffle([3, 4, 5, 6, 7]).slice(0, ROUNDS);
      stopped = new Array(ctx.n).fill(null);
      total = new Array(ctx.n).fill(0);
      errSum = new Array(ctx.n).fill(0);
    },
    onDown(p) {
      if (phase !== 'run' || stopped[p] !== null || done) return;
      stopped[p] = t;
      sfx.tick();
      buzz(15);
      if (stopped.every((s) => s !== null)) reveal();
    },
    update(dt) {
      if (done) return;
      t += dt;
      if (phase === 'ready' && t > 1.6) {
        phase = 'run';
        t = 0;
        stopped.fill(null);
        sfx.go();
      } else if (phase === 'run' && t > targets[round] + 3) {
        reveal();
      } else if (phase === 'reveal' && t > 3) {
        round++;
        if (round >= ROUNDS) {
          done = total
            .map((_, i) => i)
            .sort((a, b) => total[b] - total[a] || errSum[a] - errSum[b]);
        } else {
          phase = 'ready';
          t = 0;
        }
      }
    },
    render(g) {
      const T = targets[Math.min(round, ROUNDS - 1)];
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        g.fillStyle = tint(col, phase === 'reveal' && gained[p] === 3 ? 0.5 : 0.84);
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const m = Math.min(z.w, z.h);
          pips(g, 0, -z.h / 2 + 22, ROUNDS, round, INK, 5);
          text(g, `STOP AT ${T.toFixed(2)}s`, 0, -z.h / 2 + 56, Math.max(14, m * 0.07), INK, { weight: 900, maxWidth: z.w * 0.9 });
          // Clock face
          const R = Math.min(m * 0.3, 110);
          const cy = -z.h * 0.06;
          g.beginPath();
          g.arc(0, cy, R, 0, Math.PI * 2);
          g.fillStyle = '#FFFFFF';
          g.fill();
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.stroke();
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            g.beginPath();
            g.moveTo(Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82);
            g.lineTo(Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
            g.lineWidth = 3;
            g.stroke();
          }
          const shown = phase === 'run' && t < VISIBLE;
          let label = '';
          let mood: Mood = 'idle';
          if (phase === 'ready') {
            label = 'get ready…';
          } else if (phase === 'run') {
            if (shown) {
              label = t.toFixed(2);
              // Visible sweep hand: one lap per second.
              const a = t * Math.PI * 2 - Math.PI / 2;
              g.strokeStyle = DANGER;
              g.lineWidth = 4;
              g.lineCap = 'round';
              g.beginPath();
              g.moveTo(0, cy);
              g.lineTo(Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75);
              g.stroke();
            } else label = stopped[p] !== null ? 'LOCKED IN' : '? ? ?';
            mood = stopped[p] !== null ? 'happy' : 'worried';
          } else {
            const s = stopped[p];
            label = s === null ? 'too late!' : `${s.toFixed(2)}s`;
            mood = gained[p] === 3 ? 'win' : gained[p] > 0 ? 'happy' : 'ko';
          }
          text(g, label, 0, cy, label.length > 6 ? m * 0.08 : m * 0.13, INK, { weight: 900, maxWidth: R * 1.6 });
          if (phase === 'reveal') {
            const s = stopped[p];
            if (s !== null) {
              const d = s - T;
              text(g, `${d >= 0 ? '+' : ''}${d.toFixed(2)}`, 0, cy + R * 0.45, m * 0.06, inkA(0.7), { weight: 700 });
            }
            text(g, `+${gained[p]}`, R * 0.95, cy - R * 0.85, m * 0.12, gained[p] ? col : '#FFFFFF', { weight: 900, glow: 1 });
          }
          critter(g, p, 0, cy + R + m * 0.13, Math.min(m * 0.2, 70), mood);
        });
        edgeTag(g, z, { label: `${total[p]} pts` });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}
