import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { critter } from '../core/assets';
import { pips, rand, text, tint } from '../core/draw';
import { withZone } from '../core/zones';
import { DANGER, INK, PAPER_DEEP, PLAYER_COLORS, PLAYER_NAMES } from '../theme';
import { scoreRanking, type GameContext, type GameModule } from './types';

const TARGET = 3;
type State = 'wait' | 'go' | 'reveal';

export function createReflex(): GameModule {
  let c: GameContext;
  let state: State = 'wait';
  let timer = 0;
  let t = 0;
  let score: number[] = [];
  let foul: boolean[] = [];
  let winner = -1;
  let ms = 0;
  let done: number[] | null = null;

  const newRound = () => {
    state = 'wait';
    timer = rand(1.4, 3.8);
    t = 0;
    foul.fill(false);
    winner = -1;
  };

  const reveal = (w: number) => {
    state = 'reveal';
    winner = w;
    t = 0;
  };

  return {
    init(ctx) {
      c = ctx;
      score = new Array(ctx.n).fill(0);
      foul = new Array(ctx.n).fill(false);
      newRound();
    },
    onDown(p) {
      if (done || foul[p]) return;
      if (state === 'wait') {
        foul[p] = true;
        sfx.wrong();
        buzz([20, 40, 20]);
        const z = c.zones[p];
        c.fx.ring(z.cx, z.cy, DANGER, Math.min(z.w, z.h) * 0.5);
        if (foul.every(Boolean)) reveal(-1);
      } else if (state === 'go') {
        ms = Math.round(t * 1000);
        score[p]++;
        sfx.point();
        buzz(30);
        const z = c.zones[p];
        c.fx.burst(z.cx, z.cy, PLAYER_COLORS[p], 40, 420, 0.8, 4);
        c.fx.shake(6);
        reveal(p);
      }
    },
    update(dt) {
      t += dt;
      if (state === 'wait' && t >= timer) {
        state = 'go';
        t = 0;
        sfx.go();
      } else if (state === 'go' && t > 3) {
        reveal(-1);
      } else if (state === 'reveal' && t > 1.4) {
        if (score.some((s) => s >= TARGET)) done = scoreRanking(score);
        else newRound();
      }
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        const m = Math.min(z.w, z.h);
        let bg = PAPER_DEEP;
        if (state === 'wait') bg = foul[p] ? '#E4D6C0' : `rgb(255,${Math.round(196 + Math.sin(t * 6) * 12)},${Math.round(180 + Math.sin(t * 6) * 12)})`;
        else if (state === 'go') bg = foul[p] ? '#E4D6C0' : '#5BE38E';
        else bg = winner === p ? tint(col, 0.45) : PAPER_DEEP;
        g.fillStyle = bg;
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const mood = foul[p] ? 'ko' : state === 'go' ? 'happy' : state === 'reveal' ? (winner === p ? 'win' : 'worried') : 'worried';
          const shake = state === 'wait' && !foul[p] ? Math.sin(t * 40) * 0.03 : 0;
          critter(g, p, 0, -m * 0.3, Math.min(m * 0.3, 110), mood, shake);
          if (state === 'wait') {
            if (foul[p]) text(g, 'TOO SOON!', 0, 0, m * 0.14, DANGER, { weight: 900, glow: 16, maxWidth: z.w * 0.85 });
            else text(g, 'WAIT…', 0, 0, m * 0.18, 'rgba(34,25,43,0.85)', { weight: 900 });
            text(g, 'tap when it turns green', 0, m * 0.15, m * 0.05, 'rgba(34,25,43,0.45)', { weight: 600 });
          } else if (state === 'go') {
            if (foul[p]) text(g, 'TOO SOON!', 0, 0, m * 0.14, DANGER, { weight: 900, maxWidth: z.w * 0.85 });
            else text(g, 'TAP!', 0, 0, m * 0.3, '#fff', { weight: 900, glow: 30 });
          } else if (winner === p) {
            text(g, '+1', 0, -m * 0.08, m * 0.3, '#fff', { weight: 900, glow: 30 });
            text(g, `${ms} ms`, 0, m * 0.14, m * 0.08, '#fff', { weight: 700 });
          } else if (winner >= 0) {
            text(g, `${PLAYER_NAMES[winner]} was faster`, 0, 0, m * 0.07, PLAYER_COLORS[winner], { weight: 800, maxWidth: z.w * 0.85 });
          } else {
            text(g, 'NO POINT', 0, 0, m * 0.1, 'rgba(34,25,43,0.6)', { weight: 900 });
          }
          pips(g, 0, z.h / 2 - 26, TARGET, score[p], col, 7);
        });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}
