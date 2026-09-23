import { INK } from '../theme';

export const FONT = '"Fredoka", "Lilita One", system-ui, -apple-system, "Segoe UI", sans-serif';
export const DISPLAY = '"Lilita One", "Fredoka", system-ui, sans-serif';

/** Weight 900 selects the chunky display face; anything lighter is the rounded body face. */
export function font(size: number, weight = 800): string {
  return weight >= 900 ? `${Math.round(size)}px ${DISPLAY}` : `${Math.min(700, weight)} ${Math.round(size)}px ${FONT}`;
}

const isInk = (c: string) => c === INK || c.startsWith('rgba(34,25,43');

const rgbaCache = new Map<string, string>();
export function rgba(hex: string, a: number): string {
  const key = hex + a.toFixed(3);
  let v = rgbaCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
    if (rgbaCache.size > 4000) rgbaCache.clear();
    rgbaCache.set(key, v);
  }
  return v;
}

export interface TextOpts {
  weight?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Legacy name: any value turns on the sticker look (ink outline + hard drop shadow). */
  glow?: number;
  alpha?: number;
  maxWidth?: number;
}

/**
 * Coloured text always gets an ink outline so it reads on paper; `glow`
 * adds the chunky offset shadow used for headlines.
 */
export function text(
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  o: TextOpts = {},
): void {
  g.save();
  let sz = size;
  const weight = o.weight ?? 800;
  g.font = font(sz, weight);
  if (o.maxWidth) {
    const w = g.measureText(s).width;
    if (w > o.maxWidth) {
      sz = (sz * o.maxWidth) / w;
      g.font = font(sz, weight);
    }
  }
  g.textAlign = o.align ?? 'center';
  g.textBaseline = o.baseline ?? 'middle';
  g.globalAlpha *= o.alpha ?? 1;
  g.lineJoin = 'round';
  const outline = !isInk(color) && sz >= 13;
  const lw = Math.max(2.5, sz * 0.16);
  if (o.glow && outline) {
    g.fillStyle = INK;
    g.strokeStyle = INK;
    g.lineWidth = lw;
    const d = Math.max(2, sz * 0.07);
    g.strokeText(s, x, y + d);
    g.fillText(s, x, y + d);
  }
  if (outline) {
    g.strokeStyle = INK;
    g.lineWidth = lw;
    g.strokeText(s, x, y);
  }
  g.fillStyle = color;
  g.fillText(s, x, y);
  g.restore();
}

/** Flat panel with an ink border and a hard offset shadow. */
export function sticker(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  shadow = 4,
): void {
  g.save();
  if (shadow) {
    roundRect(g, x, y + shadow, w, h, r);
    g.fillStyle = INK;
    g.fill();
  }
  roundRect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  g.restore();
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function wrap(g: CanvasRenderingContext2D, s: string, size: number, maxW: number, weight = 500): string[] {
  g.save();
  g.font = font(size, weight);
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  g.restore();
  return lines;
}

/** Small sticker label, drawn centred at (x, y). */
export function pill(
  g: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
  size = 13,
  filled = true,
): void {
  g.save();
  g.font = font(size, 700);
  const w = g.measureText(label).width + size * 1.6;
  const h = size * 2;
  sticker(g, x - w / 2, y - h / 2, w, h, h / 2, filled ? color : '#FFF8EC', filled ? 3 : 0);
  g.fillStyle = INK;
  g.globalAlpha *= filled ? 1 : 0.6;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, x, y + 1);
  g.restore();
}

/** Row of score pips centred at (x, y). */
export function pips(g: CanvasRenderingContext2D, x: number, y: number, n: number, filled: number, color: string, r = 5): void {
  const gap = r * 3;
  const x0 = x - ((n - 1) * gap) / 2;
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1.5, r * 0.45);
  for (let i = 0; i < n; i++) {
    g.beginPath();
    g.arc(x0 + i * gap, y, r, 0, Math.PI * 2);
    g.fillStyle = i < filled ? color : 'rgba(255,255,255,0.6)';
    g.fill();
    g.stroke();
  }
  g.restore();
}

const tintCache = new Map<string, string>();
/** Mix a hex colour towards white: k = 0 keeps it, k = 1 is white. Opaque, so it never goes muddy on paper. */
export function tint(hex: string, k: number): string {
  const key = hex + k;
  let v = tintCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (x: number) => Math.round(x + (255 - x) * k);
    v = `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
    tintCache.set(key, v);
  }
  return v;
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const easeOutBack = (t: number): number => {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawCrown(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.moveTo(-s, s * 0.45);
  g.lineTo(-s, -s * 0.2);
  g.lineTo(-s * 0.5, s * 0.12);
  g.lineTo(0, -s * 0.5);
  g.lineTo(s * 0.5, s * 0.12);
  g.lineTo(s, -s * 0.2);
  g.lineTo(s, s * 0.45);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(2, s * 0.14);
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}
