import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pips, rand, roundRect, shuffle, text, tint } from '../core/draw';
import { toLocal, withZone, type Zone } from '../core/zones';
import { critter } from '../core/assets';
import { DANGER, INK, PAPER, PLAYER_COLORS } from '../theme';
import { scoreRanking, type GameContext, type GameModule } from './types';

const TARGET = 5;

export interface Question {
  /** Draws the prompt centred at (0, 0) in zone-local space; t = seconds since the question appeared. */
  prompt(g: CanvasRenderingContext2D, w: number, h: number, t: number): void;
  options: string[];
  correct: number;
}

type OptionStyle = 'color' | 'text';

/**
 * Shared "first correct answer scores" round logic. Every player gets the same
 * question but with their own shuffled buttons, so no one can copy.
 */
export function createQuiz(make: (round: number) => Question, style: OptionStyle): GameModule {
  let c: GameContext;
  let q: Question;
  let order: number[][] = [];
  let locked: boolean[] = [];
  let score: number[] = [];
  let winner = -1;
  let reveal = 0;
  let round = 0;
  let pop = 0;
  let qt = 0;
  let done: number[] | null = null;

  const next = () => {
    q = make(round++);
    order = c.zones.map(() => shuffle(q.options.map((_, i) => i)));
    locked.fill(false);
    winner = -1;
    reveal = 0;
    pop = 0;
    qt = 0;
  };

  const layout = (z: Zone) => {
    const bw = z.w * 0.42;
    const bh = Math.min(z.h * 0.2, bw * 0.75);
    const gap = z.w * 0.04;
    const top = z.h * 0.02;
    return { bw, bh, gap, top };
  };

  const hit = (z: Zone, x: number, y: number): number => {
    const l = toLocal(z, x, y);
    const { bw, bh, gap, top } = layout(z);
    for (let i = 0; i < 4; i++) {
      const x0 = i % 2 === 0 ? -bw - gap / 2 : gap / 2;
      const by = top + ((i / 2) | 0) * (bh + gap);
      if (l.x >= x0 && l.x <= x0 + bw && l.y >= by && l.y <= by + bh) return i;
    }
    return -1;
  };

  return {
    init(ctx) {
      c = ctx;
      locked = new Array(ctx.n).fill(false);
      score = new Array(ctx.n).fill(0);
      next();
    },
    onDown(p, _id, x, y) {
      if (done || winner >= 0 || reveal > 0 || locked[p]) return;
      const z = c.zones[p];
      const slot = hit(z, x, y);
      if (slot < 0) return;
      const choice = order[p][slot];
      if (choice === q.correct) {
        winner = p;
        score[p]++;
        reveal = 1e-3;
        sfx.point();
        buzz(25);
        c.fx.burst(x, y, PLAYER_COLORS[p], 30, 380, 0.7, 4);
        c.fx.ring(x, y, PLAYER_COLORS[p], 70);
      } else {
        locked[p] = true;
        sfx.wrong();
        buzz([20, 40, 20]);
        c.fx.shake(4);
        if (locked.every(Boolean)) reveal = 1e-3;
      }
    },
    update(dt) {
      pop = Math.min(1, pop + dt * 5);
      qt += dt;
      if (reveal > 0) {
        reveal += dt;
        if (reveal > 1.1) {
          if (score.some((s) => s >= TARGET)) done = scoreRanking(score);
          else next();
        }
      }
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        const grad = g.createLinearGradient(z.cx, z.cy, z.cx, z.cy + (Math.cos(z.angle) * z.h) / 2);
        grad.addColorStop(0, PAPER);
        grad.addColorStop(1, tint(col, winner === p ? 0.45 : 0.72));
        g.fillStyle = grad;
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const hh = z.h / 2;
          pips(g, 0, -hh + 22, TARGET, score[p], col, 5);
          const mood = reveal > 0 ? (winner === p ? 'win' : 'worried') : locked[p] ? 'ko' : 'idle';
          critter(g, p, -z.w / 2 + 26, -hh + 26, 40, mood);
          g.save();
          g.translate(0, -z.h * 0.2);
          const s = 0.7 + 0.3 * pop;
          g.scale(s, s);
          q.prompt(g, z.w, z.h, qt);
          g.restore();

          const { bw, bh, gap, top } = layout(z);
          for (let i = 0; i < 4; i++) {
            const opt = order[p][i];
            const x0 = i % 2 === 0 ? -bw - gap / 2 : gap / 2;
            const y0 = top + ((i / 2) | 0) * (bh + gap);
            const isCorrect = opt === q.correct;
            const dim = locked[p] || (reveal > 0 && !isCorrect);
            g.save();
            g.globalAlpha = dim ? 0.3 : 1;
            roundRect(g, x0, y0, bw, bh, 16);
            g.strokeStyle = INK;
            g.lineWidth = 3;
            if (style === 'color') {
              g.fillStyle = q.options[opt];
              g.fill();
              g.stroke();
            } else {
              g.fillStyle = '#FFFFFF';
              g.fill();
              g.stroke();
              text(g, q.options[opt], x0 + bw / 2, y0 + bh / 2 + 1, bh * 0.46, INK, { weight: 900, maxWidth: bw * 0.85 });
            }
            if (reveal > 0 && isCorrect) {
              g.globalAlpha = 1;
              g.strokeStyle = INK;
              g.lineWidth = 7;
              g.stroke();
            }
            g.restore();
          }
          if (locked[p] && reveal === 0) {
            text(g, '✕  LOCKED', 0, top + bh + gap / 2, Math.min(z.w, z.h) * 0.07, DANGER, { weight: 900, glow: 12 });
          }
          if (reveal > 0 && winner === p) {
            text(g, '+1', 0, -z.h * 0.2, Math.min(z.w, z.h) * 0.25, '#fff', { weight: 900, glow: 30, alpha: Math.max(0, 1 - reveal) });
          }
        });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}

export const COLORS: [string, string][] = [
  ['RED', '#EF4444'],
  ['BLUE', '#3B82F6'],
  ['GREEN', '#22C55E'],
  ['YELLOW', '#FACC15'],
  ['PURPLE', '#A855F7'],
  ['ORANGE', '#F97316'],
];

export function createColorCall(): GameModule {
  return createQuiz(() => {
    const pool = shuffle(COLORS.map((_, i) => i));
    const word = pool[0];
    const ink = pool[1];
    const opts = [word, ink, pool[2], pool[3]];
    return {
      prompt(g, w, h) {
        text(g, COLORS[word][0], 0, 0, Math.min(w, h) * 0.2, COLORS[ink][1], { weight: 900, glow: 14, maxWidth: w * 0.88 });
        text(g, 'tap the WORD, not the ink', 0, Math.min(w, h) * 0.16, Math.max(11, Math.min(w, h) * 0.045), 'rgba(34,25,43,0.45)', { weight: 600, maxWidth: w * 0.9 });
      },
      options: opts.map((i) => COLORS[i][1]),
      correct: 0,
    };
  }, 'color');
}

export function createMathDuel(): GameModule {
  return createQuiz((round) => {
    const level = Math.min(3, Math.floor(round / 3));
    const op = ['+', '−', '×'][Math.floor(rand(0, level >= 1 ? 3 : 2))];
    let a: number;
    let b: number;
    let ans: number;
    if (op === '×') {
      a = Math.floor(rand(2, 6 + level * 2));
      b = Math.floor(rand(2, 10));
      ans = a * b;
    } else {
      const max = 10 + level * 15;
      a = Math.floor(rand(3, max));
      b = Math.floor(rand(2, max));
      if (op === '−' && b > a) [a, b] = [b, a];
      ans = op === '+' ? a + b : a - b;
    }
    const set = new Set([ans]);
    while (set.size < 4) {
      const d = Math.floor(rand(1, 11)) * (Math.random() < 0.5 ? -1 : 1);
      if (ans + d >= 0) set.add(ans + d);
    }
    const opts = [...set].map(String);
    return {
      prompt(g, w, h) {
        text(g, `${a} ${op} ${b}`, 0, 0, Math.min(w, h) * 0.2, '#fff', { weight: 900, glow: 14, maxWidth: w * 0.88 });
      },
      options: opts,
      correct: 0,
    };
  }, 'text');
}
