import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pips, rgba, roundRect, text } from '../core/draw';
import { toLocal, withZone, type Zone } from '../core/zones';
import { DANGER, PLAYER_COLORS } from '../theme';
import { scoreRanking, type GameContext, type GameModule } from './types';

const TARGET = 3;
const PADS = ['#EF4444', '#3B82F6', '#22C55E', '#FACC15'];
const STEP = 0.55;
type State = 'show' | 'input' | 'reveal';

/**
 * Simon for a crowd. Watch the pads flash, then repeat the sequence.
 * First to finish it correctly scores, a mistake locks you out, and every
 * point makes the next sequence one step longer.
 */
export function createMemory(): GameModule {
  let c: GameContext;
  let state: State = 'show';
  let t = 0;
  let len = 3;
  let seq: number[] = [];
  let progress: number[] = [];
  let locked: boolean[] = [];
  let score: number[] = [];
  let flash: number[][] = [];
  let lastStep = -1;
  let winner = -1;
  let done: number[] | null = null;

  const newRound = () => {
    seq = Array.from({ length: len }, () => (Math.random() * 4) | 0);
    progress.fill(0);
    locked.fill(false);
    winner = -1;
    state = 'show';
    t = -0.4;
    lastStep = -1;
  };

  const layout = (z: Zone) => {
    const gap = z.w * 0.04;
    const areaTop = -z.h * 0.14;
    const areaH = z.h * 0.56;
    const pw = Math.min((z.w * 0.86 - gap) / 2, (areaH - gap) / 2 * 1.3);
    const ph = Math.min((areaH - gap) / 2, pw);
    return { pw, ph, gap, top: areaTop };
  };

  const padRect = (z: Zone, i: number) => {
    const { pw, ph, gap, top } = layout(z);
    const x = i % 2 === 0 ? -pw - gap / 2 : gap / 2;
    const y = top + ((i / 2) | 0) * (ph + gap);
    return { x, y, w: pw, h: ph };
  };

  return {
    init(ctx) {
      c = ctx;
      progress = new Array(ctx.n).fill(0);
      locked = new Array(ctx.n).fill(false);
      score = new Array(ctx.n).fill(0);
      flash = ctx.zones.map(() => [0, 0, 0, 0]);
      newRound();
    },
    onDown(p, _id, x, y) {
      if (state !== 'input' || locked[p] || done) return;
      const z = c.zones[p];
      const l = toLocal(z, x, y);
      let pad = -1;
      for (let i = 0; i < 4; i++) {
        const r = padRect(z, i);
        if (l.x >= r.x && l.x <= r.x + r.w && l.y >= r.y && l.y <= r.y + r.h) pad = i;
      }
      if (pad < 0) return;
      flash[p][pad] = 0.25;
      if (pad === seq[progress[p]]) {
        sfx.note(pad);
        buzz(8);
        progress[p]++;
        if (progress[p] >= seq.length) {
          winner = p;
          score[p]++;
          state = 'reveal';
          t = 0;
          sfx.point();
          buzz(30);
          c.fx.burst(z.cx, z.cy, PLAYER_COLORS[p], 50, 450, 0.8, 4);
          c.fx.shake(6);
        }
      } else {
        locked[p] = true;
        sfx.wrong();
        buzz([20, 40, 20]);
        if (locked.every(Boolean)) {
          state = 'reveal';
          t = 0;
        }
      }
    },
    update(dt) {
      if (done) return;
      t += dt;
      for (const f of flash) for (let i = 0; i < 4; i++) f[i] = Math.max(0, f[i] - dt);
      if (state === 'show') {
        const step = Math.floor(t / STEP);
        if (t >= 0 && step !== lastStep && step < seq.length) {
          lastStep = step;
          for (const f of flash) f[seq[step]] = STEP * 0.7;
          sfx.note(seq[step]);
        }
        if (t >= seq.length * STEP + 0.2) {
          state = 'input';
          t = 0;
        }
      } else if (state === 'input') {
        if (t > 6 + seq.length * 0.8) {
          state = 'reveal';
          t = 0;
        }
      } else if (t > 1.4) {
        if (score.some((s) => s >= TARGET)) done = scoreRanking(score);
        else {
          if (winner >= 0) len++;
          newRound();
        }
      }
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        g.fillStyle = winner === p && state === 'reveal' ? rgba(col, 0.3) : '#0f0f1b';
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const m = Math.min(z.w, z.h);
          pips(g, 0, -z.h / 2 + 22, TARGET, score[p], col, 5);
          const hy = -z.h * 0.3;
          if (state === 'show') text(g, 'WATCH…', 0, hy, m * 0.11, '#fff', { weight: 900 });
          else if (state === 'input') {
            if (locked[p]) text(g, '✕ WRONG', 0, hy, m * 0.1, DANGER, { weight: 900, glow: 12 });
            else {
              text(g, 'YOUR TURN', 0, hy - m * 0.03, m * 0.09, col, { weight: 900, glow: 14 });
              pips(g, 0, hy + m * 0.07, seq.length, progress[p], '#fff', 4);
            }
          } else if (winner === p) text(g, '+1', 0, hy, m * 0.16, '#fff', { weight: 900, glow: 24 });
          else if (winner >= 0) text(g, 'TOO SLOW', 0, hy, m * 0.08, 'rgba(255,255,255,0.5)', { weight: 900 });
          else text(g, 'NO POINT', 0, hy, m * 0.08, 'rgba(255,255,255,0.5)', { weight: 900 });

          for (let i = 0; i < 4; i++) {
            const r = padRect(z, i);
            const lit = flash[p][i] > 0;
            g.save();
            roundRect(g, r.x, r.y, r.w, r.h, 18);
            g.fillStyle = lit ? PADS[i] : rgba(PADS[i], locked[p] ? 0.1 : 0.22);
            if (lit) {
              g.shadowColor = PADS[i];
              g.shadowBlur = 30;
            }
            g.fill();
            g.strokeStyle = rgba(PADS[i], lit ? 1 : 0.5);
            g.lineWidth = 2;
            g.stroke();
            g.restore();
          }
          text(g, `${seq.length} steps`, 0, z.h / 2 - 20, 12, 'rgba(255,255,255,0.4)', { weight: 700 });
        });
      }
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}
