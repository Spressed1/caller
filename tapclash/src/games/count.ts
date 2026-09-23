import { rand, shuffle, text } from '../core/draw';
import { COLORS, createQuiz } from './quiz';
import type { GameModule } from './types';

const SHOW = 2.2;

/** Dots flash up for two seconds; count one colour before they vanish. */
export function createQuickCount(): GameModule {
  return createQuiz((round) => {
    const palette = shuffle([0, 1, 2, 3, 4]).slice(0, 3);
    const target = palette[0];
    const want = Math.floor(rand(3, 8 + Math.min(4, round)));
    const extra = Math.floor(rand(5, 12));
    const kinds = [...Array(want).fill(target), ...Array.from({ length: extra }, () => palette[1 + ((Math.random() * 2) | 0)])];
    // Scatter with a minimum spacing so dots never overlap.
    const pts: { x: number; y: number; k: number }[] = [];
    for (const k of kinds) {
      for (let tries = 0; tries < 60; tries++) {
        const x = rand(-1, 1);
        const y = rand(-1, 1);
        if (pts.every((p) => (p.x - x) ** 2 + ((p.y - y) * 0.6) ** 2 > 0.045)) {
          pts.push({ x, y, k });
          break;
        }
      }
    }
    const ans = pts.filter((p) => p.k === target).length;
    const set = new Set([ans]);
    for (const d of shuffle([-2, -1, 1, 2, 3])) {
      if (set.size >= 4) break;
      if (ans + d >= 0) set.add(ans + d);
    }
    const col = COLORS[target][1];
    return {
      prompt(g, w, h, t) {
        const m = Math.min(w, h);
        if (t < SHOW) {
          const bw = w * 0.42;
          const bh = h * 0.11;
          const r = Math.max(5, m * 0.028);
          text(g, 'COUNT', -m * 0.04, -bh - 18, 13, 'rgba(255,255,255,0.75)', { weight: 900 });
          g.fillStyle = col;
          g.beginPath();
          g.arc(m * 0.1, -bh - 18, 7, 0, Math.PI * 2);
          g.fill();
          for (const p of pts) {
            g.fillStyle = COLORS[p.k][1];
            g.beginPath();
            g.arc(p.x * bw, p.y * bh, r, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = 'rgba(255,255,255,0.5)';
          g.fillRect(-bw, bh + 14, bw * 2 * (1 - t / SHOW), 3);
        } else {
          text(g, 'HOW MANY', -m * 0.07, 0, m * 0.09, '#fff', { weight: 900 });
          g.save();
          g.fillStyle = col;
          g.shadowColor = col;
          g.shadowBlur = 16;
          g.beginPath();
          g.arc(m * 0.26, 0, m * 0.05, 0, Math.PI * 2);
          g.fill();
          g.restore();
          text(g, '?', m * 0.37, 0, m * 0.09, '#fff', { weight: 900 });
        }
      },
      options: [...set].map(String),
      correct: 0,
    };
  }, 'text');
}
