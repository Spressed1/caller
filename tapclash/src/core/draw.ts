export const FONT = '"Rubik", system-ui, -apple-system, "Segoe UI", sans-serif';

export function font(size: number, weight = 800): string {
  return `${weight} ${Math.round(size)}px ${FONT}`;
}

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
  glow?: number;
  alpha?: number;
  maxWidth?: number;
}

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
  g.font = font(sz, o.weight ?? 800);
  if (o.maxWidth) {
    const w = g.measureText(s).width;
    if (w > o.maxWidth) {
      sz = (sz * o.maxWidth) / w;
      g.font = font(sz, o.weight ?? 800);
    }
  }
  g.textAlign = o.align ?? 'center';
  g.textBaseline = o.baseline ?? 'middle';
  g.globalAlpha *= o.alpha ?? 1;
  g.fillStyle = color;
  if (o.glow) {
    g.shadowColor = color;
    g.shadowBlur = o.glow;
  }
  g.fillText(s, x, y);
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

/** Small rounded pill label, drawn centred at (x, y). */
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
  g.font = font(size, 800);
  const w = g.measureText(label).width + size * 1.6;
  const h = size * 2;
  roundRect(g, x - w / 2, y - h / 2, w, h, h / 2);
  if (filled) {
    g.fillStyle = color;
    g.fill();
  } else {
    g.fillStyle = 'rgba(11,11,20,0.55)';
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.fillStyle = filled ? '#0B0B14' : color;
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
  for (let i = 0; i < n; i++) {
    g.beginPath();
    g.arc(x0 + i * gap, y, r, 0, Math.PI * 2);
    if (i < filled) {
      g.fillStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 8;
      g.fill();
      g.shadowBlur = 0;
    } else {
      g.strokeStyle = rgba(color, 0.45);
      g.lineWidth = 1.5;
      g.stroke();
    }
  }
  g.restore();
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
  g.shadowColor = color;
  g.shadowBlur = 20;
  g.fill();
  g.restore();
}

