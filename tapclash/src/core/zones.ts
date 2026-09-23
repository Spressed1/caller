/**
 * Screen zones: one per player. Players sit around a phone lying flat, so
 * zones on the top half are rotated 180° to face the players across the table.
 * Local zone coordinates have their origin at the zone centre and +y pointing
 * towards the player who owns it.
 */
export interface Zone {
  player: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  angle: number;
}

function zone(player: number, x: number, y: number, w: number, h: number, angle: number): Zone {
  return { player, x, y, w, h, cx: x + w / 2, cy: y + h / 2, angle };
}

export function layoutZones(n: number, W: number, H: number): Zone[] {
  const hw = W / 2;
  const hh = H / 2;
  if (n === 2) {
    return [zone(0, 0, hh, W, hh, 0), zone(1, 0, 0, W, hh, Math.PI)];
  }
  if (n === 3) {
    return [zone(0, 0, hh, W, hh, 0), zone(1, 0, 0, hw, hh, Math.PI), zone(2, hw, 0, hw, hh, Math.PI)];
  }
  return [
    zone(0, 0, hh, hw, hh, 0),
    zone(1, hw, hh, hw, hh, 0),
    zone(2, hw, 0, hw, hh, Math.PI),
    zone(3, 0, 0, hw, hh, Math.PI),
  ];
}

export function zoneAt(zones: Zone[], x: number, y: number): Zone | null {
  for (const z of zones) {
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z;
  }
  return null;
}

/** Screen point → zone-local point (origin at centre, +y towards the player). */
export function toLocal(z: Zone, x: number, y: number): { x: number; y: number } {
  const dx = x - z.cx;
  const dy = y - z.cy;
  const c = Math.cos(z.angle);
  const s = Math.sin(z.angle);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

export function withZone(g: CanvasRenderingContext2D, z: Zone, fn: () => void): void {
  g.save();
  g.translate(z.cx, z.cy);
  g.rotate(z.angle);
  fn();
  g.restore();
}
