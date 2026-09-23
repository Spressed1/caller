import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { pill, rand, text } from '../core/draw';
import { toLocal, toWorld, withZone, type Zone } from '../core/zones';
import { DANGER, INK, PLAYER_COLORS, inkA } from '../theme';
import { edgeTag } from './hud';
import { scoreRanking, type GameContext, type GameModule } from './types';

const DURATION = 30;
type Kind = 'mole' | 'gold' | 'bomb';

interface Spawn {
  at: number;
  hole: number;
  kind: Kind;
  life: number;
}

interface Mole {
  kind: Kind;
  t: number;
  life: number;
  hit: number; // >0 while showing the bonk
}

const VALUE: Record<Kind, number> = { mole: 1, gold: 3, bomb: -2 };

/**
 * Everyone gets the same patch of holes and the exact same moles at the same
 * moment, so it's pure speed: whack moles, grab gold, leave the bombs alone.
 */
export function createWhack(): GameModule {
  let c: GameContext;
  let cols = 3;
  let rows = 3;
  let schedule: Spawn[] = [];
  let next = 0;
  let holes: (Mole | null)[][] = [];
  let score: number[] = [];
  let flash: number[] = [];
  let t = 0;
  let done: number[] | null = null;

  const holeXY = (z: Zone, i: number) => {
    const col = i % cols;
    const row = (i / cols) | 0;
    const areaW = z.w * 0.84;
    const areaTop = -z.h * 0.3;
    const areaH = z.h * 0.6;
    return {
      x: -areaW / 2 + (areaW / cols) * (col + 0.5),
      y: areaTop + (areaH / rows) * (row + 0.5),
    };
  };
  const holeR = (z: Zone) => Math.min((z.w * 0.84) / cols, (z.h * 0.6) / rows) * 0.34;

  return {
    init(ctx) {
      c = ctx;
      const narrow = ctx.zones.some((z) => z.w < 260);
      cols = narrow ? 2 : 3;
      rows = narrow ? 4 : 3;
      const n = cols * rows;
      holes = ctx.zones.map(() => new Array(n).fill(null));
      score = new Array(ctx.n).fill(0);
      flash = new Array(ctx.n).fill(0);
      // One schedule for everyone: fair by construction.
      let at = 0.3;
      while (at < DURATION - 0.8) {
        const r = Math.random();
        const kind: Kind = r < 0.12 ? 'gold' : r < 0.32 ? 'bomb' : 'mole';
        const life = Math.max(0.6, 1.25 - (at / DURATION) * 0.5) * (kind === 'gold' ? 0.75 : 1);
        schedule.push({ at, hole: (Math.random() * n) | 0, kind, life });
        at += rand(0.28, 0.6) * (1 - (at / DURATION) * 0.35);
      }
    },
    onDown(p, _id, x, y) {
      if (done) return;
      const z = c.zones[p];
      const l = toLocal(z, x, y);
      const r = holeR(z);
      holes[p].forEach((m, i) => {
        if (!m || m.hit > 0) return;
        const h = holeXY(z, i);
        if (Math.hypot(l.x - h.x, l.y - (h.y - r * 0.6)) > r * 1.5) return;
        m.hit = 0.45;
        score[p] += VALUE[m.kind];
        const w = toWorld(z, h.x, h.y - r * 0.6);
        if (m.kind === 'bomb') {
          c.fx.burst(w.x, w.y, '#FF9A3C', 30, 380, 0.6, 4);
          c.fx.shake(10);
          sfx.boom();
          buzz([40, 30, 40]);
          flash[p] = 0.4;
        } else {
          c.fx.burst(w.x, w.y, m.kind === 'gold' ? '#FFC933' : PLAYER_COLORS[p], m.kind === 'gold' ? 28 : 12, 280, 0.45, 3);
          if (m.kind === 'gold') sfx.point();
          else sfx.hit();
          buzz(m.kind === 'gold' ? 25 : 12);
        }
      });
    },
    update(dt) {
      if (done) return;
      t += dt;
      while (next < schedule.length && schedule[next].at <= t) {
        const s = schedule[next++];
        for (const hs of holes) if (!hs[s.hole]) hs[s.hole] = { kind: s.kind, t: 0, life: s.life, hit: 0 };
      }
      holes.forEach((hs, p) => {
        flash[p] = Math.max(0, flash[p] - dt);
        for (let i = 0; i < hs.length; i++) {
          const m = hs[i];
          if (!m) continue;
          m.t += dt;
          if (m.hit > 0) {
            m.hit -= dt;
            if (m.hit <= 0) hs[i] = null;
          } else if (m.t > m.life) hs[i] = null;
        }
      });
      if (t >= DURATION) done = scoreRanking(score);
    },
    render(g) {
      for (const z of c.zones) {
        const p = z.player;
        g.fillStyle = flash[p] > 0 ? '#FFC2B0' : '#CDEBB0';
        g.fillRect(z.x, z.y, z.w, z.h);
        withZone(g, z, () => {
          const r = holeR(z);
          // grass tufts
          g.strokeStyle = 'rgba(30,143,92,0.35)';
          g.lineWidth = 2;
          for (let i = 0; i < 14; i++) {
            const gx = ((i * 97) % 100) / 100 * z.w - z.w / 2;
            const gy = ((i * 61) % 100) / 100 * z.h - z.h / 2;
            g.beginPath();
            g.moveTo(gx - 4, gy);
            g.lineTo(gx - 2, gy - 7);
            g.moveTo(gx + 1, gy);
            g.lineTo(gx + 3, gy - 8);
            g.stroke();
          }
          for (let i = 0; i < cols * rows; i++) {
            const h = holeXY(z, i);
            const m = holes[p][i];
            // hole back
            g.fillStyle = '#4A3222';
            g.strokeStyle = INK;
            g.lineWidth = 3;
            g.beginPath();
            g.ellipse(h.x, h.y, r * 1.15, r * 0.42, 0, 0, Math.PI * 2);
            g.fill();
            g.stroke();
            if (m) {
              const rise = m.hit > 0 ? 1 : Math.min(1, m.t / 0.12, (m.life - m.t) / 0.12);
              g.save();
              g.beginPath();
              g.rect(h.x - r * 1.4, h.y - r * 3, r * 2.8, r * 3);
              g.clip();
              drawMole(g, h.x, h.y + r * 1.9 * (1 - rise), r, m);
              g.restore();
            }
            // front lip of the hole
            g.strokeStyle = INK;
            g.lineWidth = 3;
            g.fillStyle = '#8A5A3B';
            g.beginPath();
            g.ellipse(h.x, h.y, r * 1.15, r * 0.42, 0, 0, Math.PI);
            g.fill();
            g.stroke();
          }
          pill(g, `${score[p]} pts`, 0, -z.h / 2 + 22, '#FFFFFF', 13);
          const secs = Math.max(0, Math.ceil(DURATION - t));
          text(g, `${secs}`, z.w / 2 - 22, -z.h / 2 + 22, 16, secs <= 5 ? DANGER : inkA(0.6), { weight: 900 });
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

function drawMole(g: CanvasRenderingContext2D, x: number, y: number, r: number, m: Mole): void {
  const bonked = m.hit > 0;
  const squash = bonked ? 1 + Math.max(0, m.hit - 0.25) * 1.2 : 1;
  const body = m.kind === 'gold' ? '#FFC933' : '#B08968';
  g.save();
  g.translate(x, y);
  g.scale(squash, 1 / squash);
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-r * 0.9, 0);
  g.lineTo(-r * 0.9, -r * 1.3);
  g.arc(0, -r * 1.3, r * 0.9, Math.PI, 0);
  g.lineTo(r * 0.9, 0);
  g.closePath();
  g.fill();
  g.stroke();
  // belly
  g.fillStyle = m.kind === 'gold' ? '#FFE69A' : '#D9B99B';
  g.beginPath();
  g.ellipse(0, -r * 0.7, r * 0.5, r * 0.55, 0, 0, Math.PI * 2);
  g.fill();
  // face
  const ey = -r * 1.5;
  g.fillStyle = INK;
  if (bonked) {
    g.lineWidth = 2.5;
    for (const ex of [-r * 0.35, r * 0.35]) {
      g.beginPath();
      g.moveTo(ex - 5, ey - 5);
      g.lineTo(ex + 5, ey + 5);
      g.moveTo(ex + 5, ey - 5);
      g.lineTo(ex - 5, ey + 5);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.arc(-r * 0.35, ey, r * 0.12, 0, Math.PI * 2);
    g.arc(r * 0.35, ey, r * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#FF8FAB';
  g.beginPath();
  g.ellipse(0, ey + r * 0.3, r * 0.2, r * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // teeth
  g.fillStyle = '#fff';
  g.lineWidth = 2;
  g.fillRect(-r * 0.12, ey + r * 0.44, r * 0.24, r * 0.2);
  g.strokeRect(-r * 0.12, ey + r * 0.44, r * 0.24, r * 0.2);
  if (m.kind === 'gold') {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(-r * 0.4, -r * 2.15);
    g.lineTo(-r * 0.4, -r * 2.5);
    g.lineTo(-r * 0.2, -r * 2.3);
    g.lineTo(0, -r * 2.6);
    g.lineTo(r * 0.2, -r * 2.3);
    g.lineTo(r * 0.4, -r * 2.5);
    g.lineTo(r * 0.4, -r * 2.15);
    g.closePath();
    g.fillStyle = '#FFC933';
    g.fill();
    g.lineWidth = 2.5;
    g.stroke();
  }
  if (m.kind === 'bomb') {
    const bx = r * 0.55;
    const by = -r * 0.55;
    g.fillStyle = '#3A3A4A';
    g.beginPath();
    g.arc(bx, by, r * 0.42, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 2.5;
    g.stroke();
    g.strokeStyle = '#D6B88A';
    g.beginPath();
    g.moveTo(bx + r * 0.2, by - r * 0.35);
    g.quadraticCurveTo(bx + r * 0.5, by - r * 0.7, bx + r * 0.7, by - r * 0.55);
    g.stroke();
    g.fillStyle = '#FF9A3C';
    g.beginPath();
    g.arc(bx + r * 0.7, by - r * 0.55, 3 + Math.random() * 2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  if (bonked) {
    // orbiting stars
    const a = performance.now() / 150;
    for (let i = 0; i < 3; i++) {
      const sx = x + Math.cos(a + (i * Math.PI * 2) / 3) * r * 0.8;
      const sy = y - r * 2.4 + Math.sin(a + (i * Math.PI * 2) / 3) * r * 0.25;
      g.fillStyle = '#FFC933';
      g.strokeStyle = INK;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 ? 2.5 : 6;
        const aa = (k * Math.PI) / 5 - Math.PI / 2;
        g.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
}
