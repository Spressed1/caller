import type { Scene } from '../core/engine';
import { rgba } from '../core/draw';
import { PLAYER_COLORS } from '../theme';

/** Slow drifting neon orbs behind the menus. */
export class MenuScene implements Scene {
  private t = Math.random() * 100;
  private orbs = PLAYER_COLORS.map((c, i) => ({
    c,
    px: 0.2 + (i % 2) * 0.6,
    py: 0.2 + Math.floor(i / 2) * 0.6,
    fx: 0.13 + i * 0.03,
    fy: 0.1 + i * 0.025,
    r: 0.55 + (i % 2) * 0.1,
  }));

  update(dt: number): void {
    this.t += dt;
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const m = Math.max(W, H);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const o of this.orbs) {
      const x = W * (o.px + Math.sin(this.t * o.fx) * 0.25);
      const y = H * (o.py + Math.cos(this.t * o.fy) * 0.2);
      const r = m * o.r * 0.55;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(o.c, 0.2));
      grad.addColorStop(1, rgba(o.c, 0));
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
    // Perspective grid floor
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.045)';
    g.lineWidth = 1;
    const step = 36;
    const off = (this.t * 12) % step;
    g.beginPath();
    for (let x = -step; x < W + step; x += step) {
      g.moveTo(x, 0);
      g.lineTo(x, H);
    }
    for (let y = off - step; y < H + step; y += step) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
    g.restore();
  }
}
