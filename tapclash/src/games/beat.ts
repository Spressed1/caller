import { critter, type Mood } from '../core/assets';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, roundRect, text, tint } from '../core/draw';
import { toLocal, withZone, type Zone } from '../core/zones';
import { DANGER, INK, PLAYER_COLORS, inkA } from '../theme';
import { edgeTag } from './hud';
import { scoreRanking, type GameContext, type GameModule } from './types';

const BPM = 112;
const BEAT = 60 / BPM;
const BARS = 12;
const LEAD = 2; // seconds of count-in before the first note
const TRAVEL = 1.5; // seconds a note takes to fall to the line
const LANES = 3;
const LANE_COLORS = ['#FF7EB6', '#FFC933', '#2F7BFF'];
const WINDOWS: [number, string, number][] = [
  [0.05, 'PERFECT', 100],
  [0.1, 'GOOD', 60],
  [0.16, 'OK', 30],
];

interface Note {
  t: number;
  lane: number;
}

interface Player {
  score: number;
  combo: number;
  best: number;
  done: Set<number>; // note indices resolved (hit or missed)
  judge: string;
  judgeT: number;
  press: number[];
}

/**
 * Rhythm game. One chart, one soundtrack, everyone plays the same notes:
 * tap the lane as each note crosses the line. Timing is the only thing that counts.
 */
export function createBeat(): GameModule {
  let c: GameContext;
  let notes: Note[] = [];
  let players: Player[] = [];
  let songT = -LEAD;
  let lastEighth = -1;
  let endT = 0;
  let done: number[] | null = null;

  const lanesW = (z: Zone) => z.w * 0.84;
  const hitY = (z: Zone) => z.h / 2 - 96;
  const topY = (z: Zone) => -z.h / 2 + 46;

  return {
    init(ctx) {
      c = ctx;
      let prevLane = 1;
      const pick = () => {
        let l = (Math.random() * LANES) | 0;
        if (l === prevLane && Math.random() < 0.6) l = (l + 1 + ((Math.random() * 2) | 0)) % LANES;
        prevLane = l;
        return l;
      };
      for (let b = 0; b < BARS; b++) {
        const level = b < 2 ? 0 : b < 5 ? 1 : b < 9 ? 2 : 3;
        for (let e = 0; e < 8; e++) {
          const onBeat = e % 2 === 0;
          const t = (b * 8 + e) * (BEAT / 2);
          let play = false;
          if (level === 0) play = onBeat;
          else if (level === 1) play = onBeat || ((e === 3 || e === 7) && Math.random() < 0.5);
          else play = onBeat ? Math.random() < 0.9 : Math.random() < (level === 2 ? 0.55 : 0.75);
          if (!play) continue;
          const lane = pick();
          notes.push({ t, lane });
          if (level === 3 && onBeat && Math.random() < 0.25) notes.push({ t, lane: (lane + 1 + ((Math.random() * 2) | 0)) % LANES });
        }
      }
      players = ctx.zones.map(() => ({ score: 0, combo: 0, best: 0, done: new Set<number>(), judge: '', judgeT: 0, press: [0, 0, 0] }));
    },
    onDown(p, _id, x, y) {
      if (done) return;
      const z = c.zones[p];
      const l = toLocal(z, x, y);
      const w = lanesW(z);
      const lane = Math.floor((l.x + w / 2) / (w / LANES));
      if (lane < 0 || lane >= LANES) return;
      const pl = players[p];
      pl.press[lane] = 0.12;
      let best = -1;
      let bestD = Infinity;
      notes.forEach((n, i) => {
        if (n.lane !== lane || pl.done.has(i)) return;
        const d = Math.abs(n.t - songT);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const hit = WINDOWS.find(([w]) => bestD <= w);
      if (best < 0 || !hit) return; // stray taps are free: no penalty, no reward
      pl.done.add(best);
      pl.combo++;
      pl.best = Math.max(pl.best, pl.combo);
      pl.score += hit[2] + Math.min(50, pl.combo * 2);
      pl.judge = hit[1];
      pl.judgeT = 0.5;
      sfx.tap(lane);
      if (hit[1] === 'PERFECT') buzz(8);
    },
    update(dt) {
      if (done) return;
      songT += dt;
      // Soundtrack: kick on beats, snare on 2 & 4, hats on eighths, bass walks.
      const eighth = Math.floor(songT / (BEAT / 2));
      if (eighth !== lastEighth && songT >= -BEAT * 4) {
        lastEighth = eighth;
        const e = ((eighth % 8) + 8) % 8;
        if (songT < 0) {
          if (e % 2 === 0) sfx.beep();
        } else if (eighth < BARS * 8 + 2) {
          if (e % 2 === 0) sfx.kick();
          if (e === 2 || e === 6) sfx.snare();
          sfx.hat();
          if (e % 4 === 0) sfx.bass(Math.floor(eighth / 8));
        }
      }
      for (const pl of players) {
        pl.judgeT = Math.max(0, pl.judgeT - dt);
        for (let l = 0; l < LANES; l++) pl.press[l] = Math.max(0, pl.press[l] - dt);
        notes.forEach((n, i) => {
          if (pl.done.has(i) || songT - n.t <= WINDOWS[2][0]) return;
          pl.done.add(i);
          pl.combo = 0;
          pl.judge = 'MISS';
          pl.judgeT = 0.5;
        });
      }
      if (songT > notes[notes.length - 1].t + 1) {
        endT += dt;
        if (endT > 0.5) done = scoreRanking(players.map((pl) => pl.score));
      }
    },
    render(g) {
      const beatPhase = songT >= 0 ? (songT / BEAT) % 1 : 0;
      for (const z of c.zones) {
        const p = z.player;
        const pl = players[p];
        const col = PLAYER_COLORS[p];
        g.fillStyle = tint(col, 0.84);
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const w = lanesW(z);
          const lw = w / LANES;
          const hy = hitY(z);
          const ty = topY(z);
          // Lanes
          for (let l = 0; l < LANES; l++) {
            const x = -w / 2 + l * lw;
            g.fillStyle = pl.press[l] > 0 ? tint(LANE_COLORS[l], 0.55) : 'rgba(255,255,255,0.65)';
            g.fillRect(x, ty, lw, hy - ty + 30);
          }
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.strokeRect(-w / 2, ty, w, hy - ty + 30);
          g.lineWidth = 1.5;
          for (let l = 1; l < LANES; l++) {
            g.beginPath();
            g.moveTo(-w / 2 + l * lw, ty);
            g.lineTo(-w / 2 + l * lw, hy + 30);
            g.stroke();
          }
          // Hit line + targets
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(-w / 2, hy);
          g.lineTo(w / 2, hy);
          g.stroke();
          for (let l = 0; l < LANES; l++) {
            roundRect(g, -w / 2 + l * lw + 6, hy - 11, lw - 12, 22, 11);
            g.strokeStyle = INK;
            g.lineWidth = 3;
            g.fillStyle = pl.press[l] > 0 ? LANE_COLORS[l] : 'rgba(255,255,255,0.9)';
            g.fill();
            g.stroke();
          }
          // Notes
          g.save();
          g.beginPath();
          g.rect(-w / 2, ty, w, hy - ty + 30);
          g.clip();
          notes.forEach((n, i) => {
            if (pl.done.has(i)) return;
            const k = (n.t - songT) / TRAVEL;
            if (k > 1.05 || k < -0.2) return;
            const y = hy - k * (hy - ty);
            roundRect(g, -w / 2 + n.lane * lw + 8, y - 10, lw - 16, 20, 10);
            g.fillStyle = LANE_COLORS[n.lane];
            g.fill();
            g.strokeStyle = INK;
            g.lineWidth = 3;
            g.stroke();
          });
          g.restore();
          // Judgement + combo
          if (pl.judgeT > 0) {
            const miss = pl.judge === 'MISS';
            text(g, pl.judge, 0, hy - 56 - (0.5 - pl.judgeT) * 20, 22, miss ? DANGER : '#FFFFFF', { weight: 900, glow: 1, alpha: pl.judgeT * 2 });
          }
          if (pl.combo >= 5) text(g, `${pl.combo} combo`, 0, hy + 50, 14, inkA(0.7), { weight: 700 });
          // Header: dancing critter + score
          const mood: Mood = pl.judge === 'MISS' && pl.judgeT > 0 ? 'worried' : pl.combo >= 10 ? 'win' : pl.combo >= 3 ? 'happy' : 'idle';
          const bounce = Math.abs(Math.sin(beatPhase * Math.PI)) * 5;
          critter(g, p, -z.w / 2 + 24, -z.h / 2 + 22 - bounce, 38, mood, Math.sin(beatPhase * Math.PI * 2) * 0.1);
          pill(g, `${pl.score}`, z.w / 2 - 44, -z.h / 2 + 22, '#FFFFFF', 13);
          if (songT < 0) text(g, `${Math.ceil(-songT / BEAT)}`, 0, (ty + hy) / 2, 60, col, { weight: 900, glow: 1 });
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
