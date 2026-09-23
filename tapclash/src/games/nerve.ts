import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { clamp, text, tint } from '../core/draw';
import { withZone } from '../core/zones';
import { DANGER, INK, PAPER, PLAYER_COLORS } from '../theme';
import { edgeTag } from './hud';
import { scoreRanking, type GameContext, type GameModule } from './types';

const ROUNDS = 3;
type Phase = 'arm' | 'climb' | 'show';
type Status = 'in' | 'banked' | 'bust' | 'sat';

/**
 * Push your luck. Everyone holds a finger down while a multiplier climbs.
 * Let go to bank it; still holding when it crashes means zero. Three rounds.
 */
export function createNerve(): GameModule {
  let c: GameContext;
  let phase: Phase = 'arm';
  let round = 0;
  let t = 0;
  let armT = -1;
  let mult = 1;
  let crash = 2;
  let held: number[] = [];
  let status: Status[] = [];
  let banked: number[] = [];
  let total: number[] = [];
  let pumpT = 0;
  let done: number[] | null = null;

  const startRound = () => {
    phase = 'arm';
    armT = -1;
    t = 0;
    mult = 1;
    // Exponential crash point: never below 1.4x, median about 3.6x, rare big runs.
    crash = clamp(1.4 - Math.log(1 - Math.random()) * 3.2, 1.4, 18);
    banked.fill(0);
  };

  const bank = (p: number) => {
    status[p] = 'banked';
    banked[p] = mult;
    sfx.point();
    buzz(25);
    const z = c.zones[p];
    c.fx.burst(z.cx, z.cy, PLAYER_COLORS[p], 30, 360, 0.7, 4);
  };

  return {
    init(ctx) {
      c = ctx;
      held = new Array(ctx.n).fill(0);
      status = new Array(ctx.n).fill('in');
      banked = new Array(ctx.n).fill(0);
      total = new Array(ctx.n).fill(0);
      startRound();
    },
    onDown(p) {
      held[p]++;
      if (phase === 'arm') {
        sfx.tap(p);
        if (armT < 0) armT = 0;
      }
    },
    onUp(p) {
      held[p] = Math.max(0, held[p] - 1);
      if (phase === 'climb' && held[p] === 0 && status[p] === 'in') bank(p);
    },
    update(dt) {
      if (done) return;
      t += dt;
      if (phase === 'arm') {
        if (armT >= 0) armT += dt;
        const all = held.every((h) => h > 0);
        if ((all && t > 0.4) || armT > 3) {
          phase = 'climb';
          t = 0;
          for (let p = 0; p < c.n; p++) status[p] = held[p] > 0 ? 'in' : 'sat';
          sfx.go();
        }
      } else if (phase === 'climb') {
        const anyIn = status.includes('in');
        // Nobody left to bust: fast-forward to the reveal.
        t += anyIn ? 0 : dt * 5;
        mult = Math.exp(0.2 * t);
        pumpT -= dt;
        if (pumpT <= 0) {
          pumpT = Math.max(0.08, 0.5 / mult);
          if (anyIn) sfx.pump(Math.min(12, mult));
        }
        if (mult >= crash) {
          mult = crash;
          for (let p = 0; p < c.n; p++) {
            if (status[p] === 'in') {
              status[p] = 'bust';
              const z = c.zones[p];
              c.fx.burst(z.cx, z.cy, DANGER, 50, 480, 0.9, 5);
            }
          }
          sfx.boom();
          buzz([60, 40, 60]);
          c.fx.shake(18);
          for (let p = 0; p < c.n; p++) total[p] += banked[p];
          phase = 'show';
          t = 0;
        }
      } else if (t > 2.4) {
        round++;
        if (round >= ROUNDS) done = scoreRanking(total);
        else startRound();
      }
    },
    render(g) {
      const heat = clamp((mult - 1) / 8, 0, 1);
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        const st = status[p];
        const grad = g.createLinearGradient(z.cx, z.cy - (Math.cos(z.angle) * z.h) / 2, z.cx, z.cy + (Math.cos(z.angle) * z.h) / 2);
        grad.addColorStop(0, PAPER);
        const hot = phase === 'climb' && st === 'in';
        grad.addColorStop(1, hot ? `rgb(255,${Math.round(214 - heat * 130)},${Math.round(190 - heat * 120)})` : tint(col, 0.72));
        g.fillStyle = grad;
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const m = Math.min(z.w, z.h);
          text(g, `ROUND ${Math.min(round + 1, ROUNDS)}/${ROUNDS}  ·  ${total[p].toFixed(2)} pts`, 0, -z.h / 2 + 26, 12, 'rgba(34,25,43,0.55)', { weight: 700 });
          if (phase === 'arm') {
            const h = held[p] > 0;
            text(g, h ? 'HOLDING' : 'HOLD', 0, -m * 0.06, m * 0.2, h ? col : '#fff', { weight: 900, glow: h ? 24 : 0 });
            text(g, h ? 'keep holding… let go to bank' : 'put a finger down and keep it there', 0, m * 0.12, Math.max(11, m * 0.045), 'rgba(34,25,43,0.6)', { weight: 600, maxWidth: z.w * 0.9 });
          } else {
            const label = `${mult.toFixed(2)}x`;
            if (st === 'in') {
              const s = 1 + Math.sin(t * 20) * 0.02 * heat;
              g.save();
              g.scale(s, s);
              text(g, label, 0, 0, m * 0.25, '#fff', { weight: 900, glow: 20 + heat * 30, maxWidth: z.w * 0.9 });
              g.restore();
              text(g, 'LET GO TO BANK', 0, m * 0.2, Math.max(11, m * 0.05), 'rgba(34,25,43,0.7)', { weight: 800 });
            } else if (st === 'banked') {
              text(g, `+${banked[p].toFixed(2)}`, 0, -m * 0.04, m * 0.2, col, { weight: 900, glow: 20, maxWidth: z.w * 0.9 });
              text(g, phase === 'climb' ? `still climbing: ${label}` : `crashed at ${crash.toFixed(2)}x`, 0, m * 0.14, Math.max(11, m * 0.05), 'rgba(34,25,43,0.6)', { weight: 700 });
            } else if (st === 'bust') {
              text(g, 'BUST!', 0, -m * 0.04, m * 0.24, DANGER, { weight: 900, glow: 24 });
              text(g, `crashed at ${crash.toFixed(2)}x`, 0, m * 0.14, Math.max(11, m * 0.05), 'rgba(34,25,43,0.6)', { weight: 700 });
            } else {
              text(g, 'SITTING OUT', 0, 0, m * 0.09, 'rgba(34,25,43,0.4)', { weight: 900 });
            }
          }
        });
        edgeTag(g, z, {
          mood:
            phase === 'arm' ? (held[p] > 0 ? 'happy' : 'idle') : st === 'in' ? (heat > 0.25 ? 'worried' : 'idle') : st === 'banked' ? 'happy' : st === 'bust' ? 'ko' : 'idle',
        });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}
