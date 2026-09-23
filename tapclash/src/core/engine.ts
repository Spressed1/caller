import { BG } from '../theme';

export interface Scene {
  update(dt: number): void;
  render(g: CanvasRenderingContext2D, W: number, H: number): void;
  onDown?(id: number, x: number, y: number): void;
  onMove?(id: number, x: number, y: number): void;
  onUp?(id: number, x: number, y: number): void;
}

/** Owns the canvas, the frame loop and raw pointer input. */
export class Engine {
  readonly g: CanvasRenderingContext2D;
  W = 1;
  H = 1;
  private dpr = 1;
  private rect: DOMRect;
  private last = 0;
  scene: Scene | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const g = canvas.getContext('2d', { alpha: false });
    if (!g) throw new Error('Canvas 2D not supported');
    this.g = g;
    this.rect = canvas.getBoundingClientRect();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();

    const pos = (e: PointerEvent) => ({ x: e.clientX - this.rect.left, y: e.clientY - this.rect.top });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers can't be captured */
      }
      const p = pos(e);
      this.scene?.onDown?.(e.pointerId, p.x, p.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pos(e);
      this.scene?.onMove?.(e.pointerId, p.x, p.y);
    });
    const up = (e: PointerEvent) => {
      const p = pos(e);
      this.scene?.onUp?.(e.pointerId, p.x, p.y);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    this.rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, this.rect.width);
    this.H = Math.max(1, this.rect.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  private frame(t: number): void {
    const dt = this.last ? Math.min((t - this.last) / 1000, 1 / 30) : 0;
    this.last = t;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, this.W, this.H);
    if (this.scene) {
      this.scene.update(dt);
      this.scene.render(g, this.W, this.H);
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }
}
