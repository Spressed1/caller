import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { easeOutCubic, pips, rand, rgba, text } from '../core/draw';
import { toLocal, toWorld, withZone } from '../core/zones';
import { DANGER, INK, PAPER, PLAYER_COLORS, inkA } from '../theme';
import { edgeTag } from './hud';
import { eliminationRanking, type GameContext, type GameModule } from './types';

const TAPS = 3;
const FLIGHT = 0.35;

/**
 * Hot potato. The bomb sits in one player's area and jumps around after every
 * tap; three taps throw it to someone else. The fuse is hidden, only the
 * ticking gives it away. Whoever holds it when it blows is out.
 */
export function createBomb(): GameModule {
  let c: GameContext;
  let alive: boolean[] = [];
  let outOrder: number[] = [];
  let holder = 0;
  let fuse = 0;
  let fuseMax = 1;
  let taps = 0;
  let lx = 0;
  let ly = 0;
  let tick = 0;
  let wobble = 0;
  let flight: { from: { x: number; y: number }; to: number; t: number } | null = null;
  let respawn = 0;
  let done: number[] | null = null;
  let R = 0;

  const placeIn = (p: number, centre = false) => {
    const z = c.zones[p];
    lx = centre ? 0 : rand(-(z.w / 2 - R - 14), z.w / 2 - R - 14);
    ly = centre ? 0 : rand(-(z.h / 2 - R - 60), z.h / 2 - R - 60);
  };

  const others = (p: number) => alive.map((a, i) => (a && i !== p ? i : -1)).filter((i) => i >= 0);

  const newBomb = () => {
    const pool = others(-1);
    holder = pool[(Math.random() * pool.length) | 0];
    fuseMax = fuse = rand(6, 13);
    taps = 0;
    placeIn(holder, true);
  };

  const bombWorld = () => toWorld(c.zones[holder], lx, ly);

  return {
    init(ctx) {
      c = ctx;
      R = ctx.S * 0.1;
      alive = new Array(ctx.n).fill(true);
      newBomb();
    },
    onDown(p, _id, x, y) {
      if (done || flight || respawn > 0 || p !== holder) return;
      const l = toLocal(c.zones[p], x, y);
      if (Math.hypot(l.x - lx, l.y - ly) > R + 18) return;
      taps++;
      wobble = 1;
      sfx.tap(p);
      buzz(10);
      c.fx.burst(x, y, PLAYER_COLORS[p], 12, 260, 0.4, 3);
      if (taps >= TAPS) {
        const pool = others(p);
        flight = { from: bombWorld(), to: pool[(Math.random() * pool.length) | 0], t: 0 };
        sfx.shoot();
      } else placeIn(p);
    },
    update(dt) {
      if (done) return;
      wobble = Math.max(0, wobble - dt * 5);
      if (respawn > 0) {
        respawn -= dt;
        if (respawn <= 0) newBomb();
        return;
      }
      if (flight) {
        flight.t += dt / FLIGHT;
        if (flight.t >= 1) {
          holder = flight.to;
          taps = 0;
          placeIn(holder, true);
          flight = null;
          buzz(15);
        }
        return; // fuse pauses mid-air
      }
      fuse -= dt;
      tick -= dt;
      if (tick <= 0) {
        tick = 0.12 + 0.6 * Math.max(0, fuse / fuseMax);
        sfx.tick();
      }
      if (Math.random() < dt * 30) {
        const w = bombWorld();
        c.fx.burst(w.x + R * 0.5, w.y - R * 0.95, '#FDBA74', 1, 90, 0.3, 2);
      }
      if (fuse <= 0) {
        const w = bombWorld();
        c.fx.burst(w.x, w.y, '#F97316', 80, 620, 1.1, 6);
        c.fx.burst(w.x, w.y, '#FDE68A', 40, 380, 0.8, 4);
        c.fx.ring(w.x, w.y, DANGER, c.S * 0.7, 0.6);
        c.fx.shake(22);
        sfx.boom();
        buzz([80, 40, 80]);
        alive[holder] = false;
        outOrder.push(holder);
        if (alive.filter(Boolean).length <= 1) done = eliminationRanking(c.n, outOrder);
        else respawn = 1.3;
      }
    },
    render(g) {
      const danger = 1 - fuse / fuseMax;
      for (const z of c.zones) {
        const p = z.player;
        const holding = p === holder && !flight && respawn <= 0;
        g.fillStyle = !alive[p] ? '#E4D6C0' : PAPER;
        g.fillRect(z.x, z.y, z.w, z.h);
        if (holding) {
          g.fillStyle = `rgba(255,59,92,${0.18 + danger * 0.45})`;
          g.fillRect(z.x, z.y, z.w, z.h);
        }
        withZone(g, z, () => {
          const m = Math.min(z.w, z.h);
          if (!alive[p]) {
            text(g, 'BOOM', 0, -m * 0.05, m * 0.2, rgba(DANGER, 0.5), { weight: 900 });
          } else if (holding) {
            text(g, 'TAP THE BOMB!', 0, -z.h / 2 + 40, m * 0.075, '#fff', { weight: 900, maxWidth: z.w * 0.9 });
            pips(g, 0, -z.h / 2 + 66, TAPS, taps, '#fff', 6);
          } else {
            text(g, 'safe… for now', 0, 0, m * 0.07, inkA(0.55), { weight: 700, maxWidth: z.w * 0.9 });
          }
        });
        edgeTag(g, z, { out: !alive[p], mood: holding ? 'worried' : undefined });
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (const z of c.zones) g.strokeRect(z.x, z.y, z.w, z.h);

      if (respawn > 0 || done) return;
      let pos: { x: number; y: number };
      let scale = 1;
      if (flight) {
        const to = toWorld(c.zones[flight.to], 0, 0);
        const k = easeOutCubic(flight.t);
        pos = { x: flight.from.x + (to.x - flight.from.x) * k, y: flight.from.y + (to.y - flight.from.y) * k };
        scale = 1 + Math.sin(flight.t * Math.PI) * 0.4;
      } else pos = bombWorld();
      const pulse = 1 + Math.sin(performance.now() / (60 + (1 - danger) * 140)) * 0.05 * (1 + danger) + wobble * 0.15;
      drawBomb(g, pos.x, pos.y, R * scale * pulse, danger);
    },
    result: () => done,
  };
}

function drawBomb(g: CanvasRenderingContext2D, x: number, y: number, r: number, danger: number): void {
  g.save();
  g.translate(x, y);
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#5b5b73');
  grad.addColorStop(0.5, '#23232f');
  grad.addColorStop(1, '#1a1a24');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#3a3a4a';
  g.fillRect(-r * 0.22, -r * 1.12, r * 0.44, r * 0.26);
  g.strokeStyle = '#d6b88a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, -r * 1.1);
  g.quadraticCurveTo(r * 0.2, -r * 1.45, r * 0.5, -r * 0.95);
  g.stroke();
  g.fillStyle = '#FDE68A';
  g.beginPath();
  g.arc(r * 0.5, -r * 0.95, 4 + Math.random() * 3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
