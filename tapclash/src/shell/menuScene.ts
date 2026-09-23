import type { Scene } from '../core/engine';
import { INK, PINK, PLAYER_COLORS } from '../theme';

type Doodle = { x: number; y: number; r: number; rot: number; spin: number; vy: number; kind: number; color: string };

const COLORS = [...PLAYER_COLORS, PINK, '#8B7CF6'];

/** Paper with a halftone dot grid and slowly drifting doodles. */
export class MenuScene implements Scene {
  private t = 0;
  private doodles: Doodle[] = Array.from({ length: 16 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    r: 8 + Math.random() * 14,
    rot: Math.random() * 6.28,
    spin: (Math.random() - 0.5) * 0.6,
    vy: 0.006 + Math.random() * 0.01,
    kind: i % 4,
    color: COLORS[i % COLORS.length],
  }));

  update(dt: number): void {
    this.t += dt;
    for (const d of this.doodles) {
      d.y -= d.vy * dt;
      d.rot += d.spin * dt;
      if (d.y < -0.08) {
        d.y = 1.08;
        d.x = Math.random();
      }
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    g.save();
    g.fillStyle = 'rgba(34,25,43,0.07)';
    const step = 22;
    for (let y = step / 2; y < H; y += step) {
      for (let x = ((y / step) % 2) * (step / 2) + step / 2; x < W; x += step) {
        g.beginPath();
        g.arc(x, y, 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const d of this.doodles) {
      g.save();
      g.translate(d.x * W, d.y * H);
      g.rotate(d.rot);
      g.fillStyle = d.color;
      g.strokeStyle = INK;
      g.lineWidth = 3;
      const r = d.r;
      g.beginPath();
      if (d.kind === 0) {
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? r * 0.45 : r;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.stroke();
      } else if (d.kind === 1) {
        g.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else if (d.kind === 2) {
        g.moveTo(-r, 0);
        g.bezierCurveTo(-r / 2, -r, 0, r, r / 2, -r * 0.2);
        g.lineTo(r, 0);
        g.strokeStyle = d.color;
        g.lineWidth = 6;
        g.stroke();
      } else {
        g.moveTo(0, -r);
        g.lineTo(r * 0.87, r * 0.5);
        g.lineTo(-r * 0.87, r * 0.5);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.restore();
    }
    g.restore();
  }
}
