import { CRITTERS, INK, PLAYER_COLORS } from '../theme';

export type Mood = 'idle' | 'happy' | 'worried' | 'ko' | 'win';
const MOODS: Mood[] = ['idle', 'happy', 'worried', 'ko', 'win'];

function load(src: string): HTMLImageElement {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  return i;
}

const bodies = CRITTERS.map((n) => load(`assets/critters/${n}.svg`));
const faces = Object.fromEntries(MOODS.map((m) => [m, load(`assets/faces/${m}.svg`)])) as Record<Mood, HTMLImageElement>;
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

// SVG drawImage is slow on mobile Safari, so each critter/mood/size is
// rasterised once into a small canvas and reused every frame.
const cache = new Map<string, HTMLCanvasElement>();
const DPR = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

function sprite(p: number, mood: Mood, size: number): HTMLCanvasElement | null {
  const px = Math.max(16, Math.ceil((size * DPR) / 8) * 8);
  const key = `${p}|${mood}|${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const body = bodies[p];
  const face = faces[mood];
  if (!ready(body) || !ready(face)) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d');
  if (!g) return null;
  g.drawImage(body, 0, 0, px, px);
  g.drawImage(face, 0, 0, px, px);
  if (cache.size > 300) cache.clear();
  cache.set(key, cv);
  return cv;
}

/**
 * Draw player p's mascot centred at (x, y), `size` px across.
 * `squash` > 1 flattens it (landing / tap bounce), < 1 stretches it.
 */
export function critter(
  g: CanvasRenderingContext2D,
  p: number,
  x: number,
  y: number,
  size: number,
  mood: Mood = 'idle',
  rot = 0,
  squash = 1,
): void {
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (squash !== 1) {
    g.translate(0, size / 2);
    g.scale(squash, 1 / squash);
    g.translate(0, -size / 2);
  }
  const s = sprite(p, mood, size);
  if (s) g.drawImage(s, -size / 2, -size / 2, size, size);
  else {
    g.fillStyle = PLAYER_COLORS[p];
    g.strokeStyle = INK;
    g.lineWidth = Math.max(2, size * 0.04);
    g.beginPath();
    g.arc(0, size * 0.06, size * 0.38, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

/** Soft ink shadow to sit a critter on the ground. */
export function groundShadow(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  g.save();
  g.fillStyle = 'rgba(34,25,43,0.16)';
  g.beginPath();
  g.ellipse(x, y, w / 2, w / 7, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
