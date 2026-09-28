import { critter } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, rand, rgba, text, tint } from '../core/draw';
import { toLocal, withZone, type Zone } from '../core/zones';
import { DANGER, INK, PLAYER_COLORS, inkA } from '../theme';
import { edgeTag } from './hud';
import { scoreRanking, type GameContext, type GameModule } from './types';

const DURATION = 25;

/**
 * Keep a finger on your critter while it wanders around your patch. Everyone's
 * critter follows the exact same path; it gets faster and smaller over time.
 */
export function createSteady(): GameModule {
  let c: GameContext;
  let t = 0;
  let phase = 0;
  let a1 = 0;
  let a2 = 0;
  let p1 = 0;
  let p2 = 0;
  let fingers: ({ id: number; x: number; y: number } | null)[] = [];
  let score: number[] = [];
  let inside: boolean[] = [];
  let lastSec = DURATION;
  let done: number[] | null = null;

  const m = (z: Zone) => Math.min(z.w, z.h);
  const radius = (z: Zone) => Math.max(m(z) * 0.075, m(z) * 0.16 - t * m(z) * 0.0035);
  const target = (z: Zone) => ({
    x: Math.sin(phase * a1 + p1) * z.w * 0.3,
    y: Math.sin(phase * a2 + p2) * z.h * 0.24 - z.h * 0.04,
  });

  const setFinger = (p: number, id: number, x: number, y: number) => {
    const l = toLocal(c.zones[p], x, y);
    fingers[p] = { id, x: l.x, y: l.y };
  };

  return {
    init(ctx) {
      c = ctx;
      a1 = rand(0.9, 1.3);
      a2 = rand(1.4, 1.9);
      p1 = rand(0, 6.28);
      p2 = rand(0, 6.28);
      fingers = new Array(ctx.n).fill(null);
      score = new Array(ctx.n).fill(0);
      inside = new Array(ctx.n).fill(false);
    },
    onDown(p, id, x, y) {
      if (!fingers[p]) setFinger(p, id, x, y);
    },
    onMove(p, id, x, y) {
      if (fingers[p]?.id === id) setFinger(p, id, x, y);
    },
    onUp(p, id) {
      if (fingers[p]?.id === id) fingers[p] = null;
    },
    update(dt) {
      if (done) return;
      t += dt;
      phase += dt * (1 + t / 18);
      const sec = Math.ceil(DURATION - t);
      if (sec !== lastSec) {
        lastSec = sec;
        if (sec <= 3 && sec > 0) sfx.beep();
      }
      c.zones.forEach((z, p) => {
        const f = fingers[p];
        const tg = target(z);
        const now = !!f && Math.hypot(f.x - tg.x, f.y - tg.y) <= radius(z) * 1.1;
        if (now) score[p] += dt;
        if (inside[p] && !now) {
          sfx.wrong();
          buzz(12);
        }
        inside[p] = now;
      });
      if (t >= DURATION) done = scoreRanking(score);
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        const col = PLAYER_COLORS[p];
        g.fillStyle = tint(col, inside[p] ? 0.7 : 0.86);
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          // Ghost of the upcoming path
          g.fillStyle = rgba(col, 0.35);
          for (let k = 1; k <= 8; k++) {
            const ph = phase + k * 0.12 * (1 + t / 18);
            const x = Math.sin(ph * a1 + p1) * z.w * 0.3;
            const y = Math.sin(ph * a2 + p2) * z.h * 0.24 - z.h * 0.04;
            g.beginPath();
            g.arc(x, y, 4, 0, Math.PI * 2);
            g.fill();
          }
          const tg = target(z);
          const r = radius(z);
          g.save();
          g.beginPath();
          g.arc(tg.x, tg.y, r * 1.1, 0, Math.PI * 2);
          g.fillStyle = inside[p] ? rgba(col, 0.45) : 'rgba(255,255,255,0.7)';
          g.fill();
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.setLineDash(inside[p] ? [] : [7, 6]);
          g.stroke();
          g.restore();
          critter(g, p, tg.x, tg.y, r * 1.5, inside[p] ? 'happy' : fingers[p] ? 'worried' : 'idle');
          const f = fingers[p];
          if (f) {
            g.beginPath();
            g.arc(f.x, f.y, 8, 0, Math.PI * 2);
            g.fillStyle = inside[p] ? INK : DANGER;
            g.fill();
          }
          pill(g, `${score[p].toFixed(1)}s`, 0, -z.h / 2 + 22, '#FFFFFF', 13);
          const secs = Math.max(0, Math.ceil(DURATION - t));
          text(g, `${secs}`, z.w / 2 - 22, -z.h / 2 + 22, 16, secs <= 3 ? DANGER : inkA(0.6), { weight: 900 });
          if (t < 3) text(g, 'keep your finger on me!', 0, z.h * 0.3, 14, inkA(0.75), { weight: 600, maxWidth: z.w * 0.88 });
        });
        edgeTag(g, z);
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}
