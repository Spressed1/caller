import { critter, type Mood } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, sticker, text, tint } from '../core/draw';
import { toWorld, withZone } from '../core/zones';
import { INK, PLAYER_COLORS, PLAYER_DARK, inkA } from '../theme';
import type { GameContext, GameModule } from './types';

const TIME_LIMIT = 45;
const PERFECT = 5;

interface Block {
  x: number;
  w: number;
}

interface Chunk {
  x: number;
  y: number;
  w: number;
  vy: number;
  rot: number;
  vr: number;
}

interface Tower {
  blocks: Block[];
  mx: number;
  mw: number;
  dir: number;
  done: boolean;
  cam: number;
  chunks: Chunk[];
  combo: number;
  perfectT: number;
}

/**
 * Per-player tower builder. The block slides back and forth; tap to drop it.
 * Overhang is chopped off, so the tower gets thinner unless you are precise.
 */
export function createStack(): GameModule {
  let c: GameContext;
  let towers: Tower[] = [];
  let bh = 0;
  let t = 0;
  let done: number[] | null = null;

  const baseY = (h: number) => h / 2 - 70;

  return {
    init(ctx) {
      c = ctx;
      bh = Math.min(30, ctx.zones[0].h * 0.07);
      towers = ctx.zones.map((z) => {
        const w = z.w * 0.55;
        return { blocks: [{ x: 0, w }], mx: -z.w / 2, mw: w, dir: 1, done: false, cam: 0, chunks: [], combo: 0, perfectT: 0 };
      });
    },
    onDown(p) {
      const tw = towers[p];
      if (done || tw.done) return;
      const z = c.zones[p];
      const top = tw.blocks[tw.blocks.length - 1];
      const lo = Math.max(tw.mx - tw.mw / 2, top.x - top.w / 2);
      const hi = Math.min(tw.mx + tw.mw / 2, top.x + top.w / 2);
      const y = baseY(z.h) - tw.blocks.length * bh;
      if (hi - lo <= 0) {
        tw.done = true;
        tw.chunks.push({ x: tw.mx, y, w: tw.mw, vy: 0, rot: 0, vr: tw.dir * 2 });
        sfx.wrong();
        buzz([30, 40, 30]);
        const wp = toWorld(z, tw.mx, y);
        c.fx.burst(wp.x, wp.y, PLAYER_COLORS[p], 20, 260, 0.5, 3);
        return;
      }
      let nx = (lo + hi) / 2;
      let nw = hi - lo;
      if (Math.abs(tw.mx - top.x) <= PERFECT) {
        nx = top.x;
        nw = top.w;
        tw.combo++;
        tw.perfectT = 0.8;
        if (tw.combo >= 3) nw = Math.min(z.w * 0.55, nw + 8); // streak regrows the tower
        sfx.point();
        buzz(20);
        const wp = toWorld(z, nx, y);
        c.fx.ring(wp.x, wp.y, '#FFFFFF', nw * 0.7, 0.4);
      } else {
        tw.combo = 0;
        const cutL = tw.mx - tw.mw / 2 < lo;
        const cw = tw.mw - nw;
        const cx = cutL ? lo - cw / 2 : hi + cw / 2;
        tw.chunks.push({ x: cx, y, w: cw, vy: 0, rot: 0, vr: cutL ? -3 : 3 });
        sfx.tap(p);
        buzz(10);
      }
      tw.blocks.push({ x: nx, w: nw });
      tw.mw = nw;
      tw.dir = Math.random() < 0.5 ? 1 : -1;
      tw.mx = tw.dir > 0 ? -z.w / 2 - nw / 2 : z.w / 2 + nw / 2;
    },
    update(dt) {
      if (done) return;
      t += dt;
      towers.forEach((tw, p) => {
        const z = c.zones[p];
        tw.perfectT = Math.max(0, tw.perfectT - dt);
        const topY = baseY(z.h) - tw.blocks.length * bh;
        const want = Math.max(0, -z.h * 0.12 - topY);
        tw.cam += (want - tw.cam) * Math.min(1, dt * 6);
        for (const ch of tw.chunks) {
          ch.vy += 1400 * dt;
          ch.y += ch.vy * dt;
          ch.rot += ch.vr * dt;
        }
        tw.chunks = tw.chunks.filter((ch) => ch.y < z.h + 200);
        if (tw.done) return;
        const speed = z.w * Math.min(1.5, 0.55 + tw.blocks.length * 0.045);
        tw.mx += tw.dir * speed * dt;
        const lim = z.w / 2 - 6;
        if (tw.mx > lim) {
          tw.mx = lim;
          tw.dir = -1;
        } else if (tw.mx < -lim) {
          tw.mx = -lim;
          tw.dir = 1;
        }
      });
      if (towers.every((tw) => tw.done) || t >= TIME_LIMIT) {
        const h = towers.map((tw) => tw.blocks.length);
        done = h.map((_, i) => i).sort((a, b) => h[b] - h[a]);
      }
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        const tw = towers[p];
        const col = PLAYER_COLORS[p];
        g.fillStyle = tint(col, 0.84);
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          g.save();
          g.beginPath();
          g.rect(-z.w / 2, -z.h / 2, z.w, z.h);
          g.clip();
          g.translate(0, tw.cam);
          const by = baseY(z.h);
          // ground
          g.fillStyle = PLAYER_DARK[p];
          g.fillRect(-z.w / 2, by + bh / 2, z.w, 400);
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(-z.w / 2, by + bh / 2);
          g.lineTo(z.w / 2, by + bh / 2);
          g.stroke();
          tw.blocks.forEach((b, i) => {
            const y = by - i * bh;
            sticker(g, b.x - b.w / 2, y - bh / 2, b.w, bh, 6, i % 2 ? col : lighten(col), 0);
          });
          const topY = by - (tw.blocks.length - 1) * bh;
          const top = tw.blocks[tw.blocks.length - 1];
          const mood: Mood = tw.done ? 'ko' : tw.perfectT > 0 ? 'win' : top.w < z.w * 0.18 ? 'worried' : 'idle';
          const cs = Math.min(z.w * 0.2, 64);
          critter(g, p, top.x, topY - bh / 2 - cs * 0.42, cs, mood, tw.done ? 0.4 : 0);
          if (!tw.done) {
            const y = by - tw.blocks.length * bh;
            sticker(g, tw.mx - tw.mw / 2, y - bh / 2 - 26, tw.mw, bh, 6, col, 3);
          }
          for (const ch of tw.chunks) {
            g.save();
            g.translate(ch.x, ch.y);
            g.rotate(ch.rot);
            sticker(g, -ch.w / 2, -bh / 2, ch.w, bh, 6, col, 0);
            g.restore();
          }
          g.restore();
          text(g, `${tw.blocks.length - 1}`, 0, -z.h / 2 + 34, 34, '#FFFFFF', { weight: 900, glow: 1 });
          if (tw.combo >= 2) text(g, `PERFECT x${tw.combo}`, 0, -z.h / 2 + 64, 14, col, { weight: 900 });
          if (tw.done) pill(g, 'TOPPLED!', 0, 0, '#FFFFFF', 16);
          const secs = Math.max(0, Math.ceil(TIME_LIMIT - t));
          text(g, `${secs}s`, z.w / 2 - 26, -z.h / 2 + 22, 13, inkA(0.6), { weight: 700 });
        });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);
    },
    result: () => done,
  };
}

const lightCache = new Map<string, string>();
/** Mix a hex colour 45% towards white, for alternating block stripes. */
function lighten(hex: string): string {
  let v = lightCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (x: number) => Math.round(x + (255 - x) * 0.45);
    v = `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
    lightCache.set(hex, v);
  }
  return v;
}
