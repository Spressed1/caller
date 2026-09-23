import { critter, type Mood } from '../core/assets';
import { pill, pips, rgba } from '../core/draw';
import { withZone, type Zone } from '../core/zones';
import { INK, PLAYER_COLORS, PLAYER_NAMES } from '../theme';

/** Mascot + name tag at the edge of the zone nearest its player, with optional lives. */
export function edgeTag(
  g: CanvasRenderingContext2D,
  z: Zone,
  opts: { lives?: number; max?: number; out?: boolean; mood?: Mood } = {},
): void {
  const c = PLAYER_COLORS[z.player];
  withZone(g, z, () => {
    const y = z.h / 2 - 24;
    const mood: Mood = opts.mood ?? (opts.out ? 'ko' : 'idle');
    const label = opts.out ? `${PLAYER_NAMES[z.player]} · OUT` : PLAYER_NAMES[z.player];
    g.save();
    g.font = '700 12px "Fredoka", system-ui, sans-serif';
    const tw = g.measureText(label).width + 20;
    g.restore();
    const lifeW = opts.max && !opts.out ? opts.max * 15 + 8 : 0;
    const total = 34 + tw + lifeW;
    const x0 = -total / 2;
    g.save();
    if (opts.out) g.globalAlpha = 0.65;
    critter(g, z.player, x0 + 16, y - 4, 38, mood);
    pill(g, label, x0 + 34 + tw / 2, y, opts.out ? '#E9DCC6' : c, 12);
    if (lifeW) pips(g, x0 + 34 + tw + 8 + (opts.max! * 15) / 2 - 7, y, opts.max!, opts.lives ?? 0, c, 5);
    g.restore();
  });
}

/** Faint tint + divider lines so each player can see which area is theirs. */
export function zoneTints(g: CanvasRenderingContext2D, zones: Zone[], alpha = 0.05): void {
  for (const z of zones) {
    const c = PLAYER_COLORS[z.player];
    const grad = g.createLinearGradient(
      z.cx,
      z.cy + (Math.cos(z.angle) * z.h) / 2,
      z.cx,
      z.cy - (Math.cos(z.angle) * z.h) / 2,
    );
    grad.addColorStop(0, rgba(c, alpha * 4));
    grad.addColorStop(1, rgba(c, 0));
    g.fillStyle = grad;
    g.fillRect(z.x, z.y, z.w, z.h);
  }
}

/** On-screen joystick shared by the arena games. */
export interface Stick {
  id: number | null;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  t0: number;
  moved: number;
}

export const newStick = (): Stick => ({ id: null, ox: 0, oy: 0, dx: 0, dy: 0, t0: 0, moved: 0 });

export const STICK_RADIUS = 56;

export function stickMove(s: Stick, x: number, y: number): void {
  let dx = x - s.ox;
  let dy = y - s.oy;
  const d = Math.hypot(dx, dy);
  s.moved = Math.max(s.moved, d);
  if (d > STICK_RADIUS) {
    dx = (dx / d) * STICK_RADIUS;
    dy = (dy / d) * STICK_RADIUS;
  }
  s.dx = dx / STICK_RADIUS;
  s.dy = dy / STICK_RADIUS;
}

export function drawStick(g: CanvasRenderingContext2D, s: Stick, color: string): void {
  if (s.id === null) return;
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 2.5;
  g.setLineDash([6, 6]);
  g.fillStyle = rgba(color, 0.14);
  g.beginPath();
  g.arc(s.ox, s.oy, STICK_RADIUS, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = color;
  g.beginPath();
  g.arc(s.ox + s.dx * STICK_RADIUS, s.oy + s.dy * STICK_RADIUS, 20, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}
