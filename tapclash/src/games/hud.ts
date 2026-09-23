import { pill, pips, rgba } from '../core/draw';
import { withZone, type Zone } from '../core/zones';
import { PLAYER_COLORS, PLAYER_NAMES } from '../theme';

/** Player tag at the edge of the zone nearest its player, with optional lives. */
export function edgeTag(g: CanvasRenderingContext2D, z: Zone, opts: { lives?: number; max?: number; out?: boolean } = {}): void {
  const c = PLAYER_COLORS[z.player];
  withZone(g, z, () => {
    const y = z.h / 2 - 24;
    if (opts.out) {
      pill(g, `${PLAYER_NAMES[z.player]} · OUT`, 0, y, rgba(c, 0.5), 12, false);
      return;
    }
    if (opts.max) {
      pill(g, PLAYER_NAMES[z.player], -opts.max * 7 - 18, y, c, 12);
      pips(g, 18, y, opts.max, opts.lives ?? 0, c, 5);
    } else pill(g, PLAYER_NAMES[z.player], 0, y, c, 12);
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
    grad.addColorStop(0, rgba(c, alpha * 2.2));
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
  g.strokeStyle = rgba(color, 0.35);
  g.fillStyle = rgba(color, 0.08);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(s.ox, s.oy, STICK_RADIUS, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = rgba(color, 0.55);
  g.beginPath();
  g.arc(s.ox + s.dx * STICK_RADIUS, s.oy + s.dy * STICK_RADIUS, 22, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
