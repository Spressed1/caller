import { PLAYER_COLORS } from '../theme';

const MAX = 900;
const CONFETTI = [...PLAYER_COLORS, '#FFFFFF', '#FDE68A'];

/** Pooled particles, impact rings and screen shake. No per-frame allocation. */
export class Fx {
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private max = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private rot = new Float32Array(MAX);
  private kind = new Uint8Array(MAX); // 0 spark, 1 confetti
  private color: string[] = new Array(MAX).fill('#fff');
  private next = 0;

  private rings: { x: number; y: number; max: number; t: number; dur: number; color: string }[] = [];
  private shakeAmt = 0;
  private sx = 0;
  private sy = 0;

  private spawn(): number {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    return i;
  }

  burst(x: number, y: number, color: string, count = 14, speed = 260, life = 0.55, size = 3): void {
    for (let k = 0; k < count; k++) {
      const i = this.spawn();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = Math.cos(a) * s;
      this.vy[i] = Math.sin(a) * s;
      this.max[i] = this.life[i] = life * (0.6 + Math.random() * 0.4);
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.kind[i] = 0;
      this.color[i] = color;
    }
  }

  confetti(x: number, y: number, count = 80, spread = 1): void {
    for (let k = 0; k < count; k++) {
      const i = this.spawn();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
      const s = 250 + Math.random() * 450;
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = Math.cos(a) * s;
      this.vy[i] = Math.sin(a) * s;
      this.max[i] = this.life[i] = 1.6 + Math.random() * 1.2;
      this.size[i] = 4 + Math.random() * 5;
      this.rot[i] = Math.random() * 6.28;
      this.kind[i] = 1;
      this.color[i] = CONFETTI[(Math.random() * CONFETTI.length) | 0];
    }
  }

  ring(x: number, y: number, color: string, maxR = 60, t = 0.45): void {
    if (this.rings.length > 40) this.rings.shift();
    this.rings.push({ x, y, max: maxR, t: 0, dur: t, color });
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(24, Math.max(this.shakeAmt, amount));
  }

  clear(): void {
    this.life.fill(0);
    this.rings.length = 0;
    this.shakeAmt = 0;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.kind[i] === 1) {
        this.vx[i] *= Math.exp(-1.8 * dt);
        this.vy[i] = this.vy[i] * Math.exp(-1.8 * dt) + 420 * dt;
        this.rot[i] += dt * 8;
      } else {
        const d = Math.exp(-4 * dt);
        this.vx[i] *= d;
        this.vy[i] *= d;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt / r.dur;
      if (r.t >= 1) this.rings.splice(i, 1);
    }
    this.shakeAmt *= Math.exp(-9 * dt);
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;
    this.sx = (Math.random() * 2 - 1) * this.shakeAmt;
    this.sy = (Math.random() * 2 - 1) * this.shakeAmt;
  }

  applyShake(g: CanvasRenderingContext2D): void {
    if (this.shakeAmt) g.translate(this.sx, this.sy);
  }

  render(g: CanvasRenderingContext2D): void {
    g.save();
    for (const r of this.rings) {
      const e = 1 - Math.pow(1 - r.t, 3);
      g.globalAlpha = 1 - r.t;
      g.strokeStyle = r.color;
      g.lineWidth = 3 * (1 - r.t) + 1;
      g.beginPath();
      g.arc(r.x, r.y, r.max * e, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0 || this.kind[i] !== 0) continue;
      const t = this.life[i] / this.max[i];
      g.globalAlpha = t;
      g.fillStyle = this.color[i];
      const s = this.size[i] * (0.4 + t * 0.6);
      g.fillRect(this.x[i] - s, this.y[i] - s, s * 2, s * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0 || this.kind[i] !== 1) continue;
      const t = this.life[i] / this.max[i];
      g.globalAlpha = Math.min(1, t * 3);
      g.fillStyle = this.color[i];
      const s = this.size[i];
      const c = Math.cos(this.rot[i]);
      g.fillRect(this.x[i] - s / 2, this.y[i] - (s * Math.abs(c)) / 2, s, s * Math.abs(c) * 0.6 + 1);
    }
    g.restore();
  }
}
