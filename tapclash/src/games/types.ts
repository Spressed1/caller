import type { Fx } from '../core/fx';
import type { Zone } from '../core/zones';

export interface GameContext {
  n: number;
  zones: Zone[];
  W: number;
  H: number;
  /** min(W, H): use it to scale gameplay so it plays the same on any screen. */
  S: number;
  fx: Fx;
}

export interface GameModule {
  init(ctx: GameContext): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
  onDown?(player: number, id: number, x: number, y: number): void;
  onMove?(player: number, id: number, x: number, y: number): void;
  onUp?(player: number, id: number, x: number, y: number): void;
  /** Players ordered best → worst once the round is over, otherwise null. */
  result(): number[] | null;
}

export interface GameDef {
  id: string;
  name: string;
  tagline: string;
  howTo: string;
  accent: string;
  icon: string;
  create(): GameModule;
}

/** Ranking for elimination games: survivors first, then latest-out to first-out. */
export function eliminationRanking(n: number, outOrder: number[]): number[] {
  const alive: number[] = [];
  for (let p = 0; p < n; p++) if (!outOrder.includes(p)) alive.push(p);
  return [...alive, ...[...outOrder].reverse()];
}

/** Ranking by score, highest first. */
export function scoreRanking(scores: number[]): number[] {
  return scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
}
