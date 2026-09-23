import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { critter } from '../core/assets';
import { rgba } from '../core/draw';
import { INK, PLAYER_COLORS } from '../theme';
import { edgeTag, zoneTints } from './hud';
import { eliminationRanking, type GameContext, type GameModule } from './types';

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]; // up, right, down, left

// Start positions per player count: [colFrac, rowFrac, dir].
const STARTS: Record<number, [number, number, number][]> = {
  2: [[0.3, 0.82, 0], [0.7, 0.18, 2]],
  3: [[0.5, 0.82, 0], [0.22, 0.18, 2], [0.78, 0.18, 2]],
  4: [[0.15, 0.85, 0], [0.62, 0.85, 0], [0.85, 0.15, 2], [0.38, 0.15, 2]],
};

interface Cycle {
  x: number;
  y: number;
  dir: number;
  queue: number[];
  alive: boolean;
  trail: number[];
  swipeX: number;
  swipeY: number;
  swipeId: number | null;
}

/** Light-cycle battle: swipe to steer, don't hit any trail or wall. */
export function createSnake(): GameModule {
  let c: GameContext;
  let cell = 0;
  let cols = 0;
  let rows = 0;
  let ox = 0;
  let oy = 0;
  let grid: Int8Array;
  let cycles: Cycle[] = [];
  let acc = 0;
  let t = 0;
  let outOrder: number[] = [];
  let done: number[] | null = null;

  const kill = (p: number) => {
    const cy = cycles[p];
    if (!cy.alive) return;
    cy.alive = false;
    outOrder.push(p);
    const px = ox + (cy.x + 0.5) * cell;
    const py = oy + (cy.y + 0.5) * cell;
    c.fx.burst(px, py, PLAYER_COLORS[p], 50, 420, 0.9, 4);
    c.fx.ring(px, py, PLAYER_COLORS[p], cell * 5, 0.5);
    c.fx.shake(12);
    sfx.boom();
    buzz([40, 30, 40]);
  };

  const step = () => {
    const heads = new Map<number, number[]>();
    for (let p = 0; p < cycles.length; p++) {
      const cy = cycles[p];
      if (!cy.alive) continue;
      const q = cy.queue.shift();
      if (q !== undefined) cy.dir = q;
      const [dx, dy] = DIRS[cy.dir];
      cy.x += dx;
      cy.y += dy;
      const k = cy.y * cols + cy.x;
      if (cy.x < 0 || cy.y < 0 || cy.x >= cols || cy.y >= rows || grid[k] >= 0) {
        kill(p);
        continue;
      }
      const same = heads.get(k);
      if (same) same.push(p);
      else heads.set(k, [p]);
    }
    for (const [k, ps] of heads) {
      if (ps.length > 1) {
        ps.forEach(kill);
        continue;
      }
      grid[k] = ps[0];
      cycles[ps[0]].trail.push(k);
    }
  };

  return {
    init(ctx) {
      c = ctx;
      cell = Math.floor(ctx.S / 20);
      cols = Math.floor((ctx.W - 16) / cell);
      rows = Math.floor((ctx.H - 16) / cell);
      ox = (ctx.W - cols * cell) / 2;
      oy = (ctx.H - rows * cell) / 2;
      grid = new Int8Array(cols * rows).fill(-1);
      cycles = STARTS[ctx.n].map(([fx, fy, dir], p) => {
        const x = Math.floor(fx * cols);
        const y = Math.floor(fy * rows);
        grid[y * cols + x] = p;
        return { x, y, dir, queue: [], alive: true, trail: [y * cols + x], swipeX: 0, swipeY: 0, swipeId: null };
      });
    },
    onDown(p, id, x, y) {
      const cy = cycles[p];
      cy.swipeId = id;
      cy.swipeX = x;
      cy.swipeY = y;
    },
    onMove(p, id, x, y) {
      const cy = cycles[p];
      if (cy.swipeId !== id || !cy.alive) return;
      const dx = x - cy.swipeX;
      const dy = y - cy.swipeY;
      if (Math.hypot(dx, dy) < 22) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      const last = cy.queue.length ? cy.queue[cy.queue.length - 1] : cy.dir;
      if (dir !== last && dir !== (last + 2) % 4 && cy.queue.length < 2) {
        cy.queue.push(dir);
        sfx.tap(p);
        buzz(5);
      }
      cy.swipeX = x;
      cy.swipeY = y;
    },
    onUp(p, id) {
      if (cycles[p].swipeId === id) cycles[p].swipeId = null;
    },
    update(dt) {
      if (done) return;
      t += dt;
      const rate = Math.min(15, 8.5 + t * 0.12); // cells per second
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        step();
      }
      if (cycles.filter((cy) => cy.alive).length <= 1) done = eliminationRanking(c.n, outOrder);
    },
    render(g) {
      zoneTints(g, c.zones, 0.035);
      g.fillStyle = '#FFF8EC';
      g.fillRect(ox, oy, cols * cell, rows * cell);
      g.strokeStyle = 'rgba(34,25,43,0.07)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= cols; i++) {
        g.moveTo(ox + i * cell, oy);
        g.lineTo(ox + i * cell, oy + rows * cell);
      }
      for (let j = 0; j <= rows; j++) {
        g.moveTo(ox, oy + j * cell);
        g.lineTo(ox + cols * cell, oy + j * cell);
      }
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.strokeRect(ox, oy, cols * cell, rows * cell);

      cycles.forEach((cy, p) => {
        const col = PLAYER_COLORS[p];
        g.fillStyle = cy.alive ? col : rgba(col, 0.25);
        const pad = cell * 0.12;
        for (const k of cy.trail) {
          const x = k % cols;
          const y = (k / cols) | 0;
          g.fillRect(ox + x * cell + pad, oy + y * cell + pad, cell - pad * 2, cell - pad * 2);
        }
        const hx = ox + (cy.x + 0.5) * cell;
        const hy = oy + (cy.y + 0.5) * cell;
        critter(g, p, hx, hy, cell * 2.2, cy.alive ? 'idle' : 'ko', cy.alive ? [0, Math.PI / 2, Math.PI, -Math.PI / 2][cy.dir] : 0.4);
      });
      for (const z of c.zones) edgeTag(g, z, { out: !cycles[z.player].alive });
    },
    result: () => done,
  };
}
