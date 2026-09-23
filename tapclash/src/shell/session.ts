import type { Engine, Scene } from '../core/engine';
import { Fx } from '../core/fx';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { drawCrown, easeOutBack, pill, pips, rgba, roundRect, text, wrap } from '../core/draw';
import { layoutZones, withZone, zoneAt, type Zone } from '../core/zones';
import type { GameDef, GameModule } from '../games/types';
import { PLAYER_COLORS, PLAYER_NAMES, WIN_GOLD } from '../theme';

type Phase = 'ready' | 'countdown' | 'play' | 'end';

export interface Standings {
  scores: number[];
  target: number;
  champion: number | null;
}

const PLACES = ['1ST', '2ND', '3RD', '4TH'];
const COUNT_STEP = 0.75;

/**
 * One round of one game. Handles the per-player ready check, the countdown,
 * touch → player routing and the results overlay; the game module only plays.
 */
export class Session implements Scene {
  private phase: Phase = 'ready';
  private t = 0;
  private zones: Zone[];
  private gw: number;
  private gh: number;
  private owner = new Map<number, number>();
  private ready: boolean[];
  private game: GameModule;
  private fx = new Fx();
  private ranking: number[] = [];
  private lastCount = -1;
  paused = false;
  standings: Standings | null = null;

  constructor(
    private engine: Engine,
    readonly def: GameDef,
    readonly n: number,
    private onEnd: (ranking: number[]) => void,
  ) {
    // Gameplay runs in the canvas size captured at start; if the browser
    // chrome resizes the viewport mid-round we scale instead of re-laying out.
    this.gw = engine.W;
    this.gh = engine.H;
    this.zones = layoutZones(n, this.gw, this.gh);
    this.ready = new Array(n).fill(false);
    this.game = def.create();
    this.game.init({ n, zones: this.zones, W: this.gw, H: this.gh, S: Math.min(this.gw, this.gh), fx: this.fx });
  }

  private map(x: number, y: number): [number, number] {
    return [(x * this.gw) / this.engine.W, (y * this.gh) / this.engine.H];
  }

  onDown(id: number, sx: number, sy: number): void {
    if (this.paused) return;
    sfx.unlock();
    const [x, y] = this.map(sx, sy);
    const z = zoneAt(this.zones, x, y);
    if (!z) return;
    this.owner.set(id, z.player);
    if (this.phase === 'ready') {
      this.ready[z.player] = !this.ready[z.player];
      if (this.ready[z.player]) {
        sfx.ready();
        buzz(12);
        this.fx.burst(z.cx, z.cy + z.h * 0.22 * Math.cos(z.angle), PLAYER_COLORS[z.player], 18, 220);
      } else sfx.click();
      if (this.ready.every(Boolean)) {
        this.phase = 'countdown';
        this.t = 0;
        this.lastCount = -1;
      }
    } else if (this.phase === 'play') {
      this.game.onDown?.(z.player, id, x, y);
    }
  }

  onMove(id: number, sx: number, sy: number): void {
    const p = this.owner.get(id);
    if (p === undefined || this.phase !== 'play' || this.paused) return;
    const [x, y] = this.map(sx, sy);
    this.game.onMove?.(p, id, x, y);
  }

  onUp(id: number, sx: number, sy: number): void {
    const p = this.owner.get(id);
    this.owner.delete(id);
    if (p === undefined || this.phase !== 'play') return;
    const [x, y] = this.map(sx, sy);
    this.game.onUp?.(p, id, x, y);
  }

  update(dt: number): void {
    if (this.paused) return;
    this.t += dt;
    this.fx.update(dt);
    if (this.phase === 'countdown') {
      const c = Math.floor(this.t / COUNT_STEP);
      if (c !== this.lastCount && c < 3) {
        this.lastCount = c;
        sfx.beep();
        buzz(8);
      }
      if (this.t >= COUNT_STEP * 3) {
        this.phase = 'play';
        this.t = 0;
        sfx.go();
        buzz(30);
      }
    } else if (this.phase === 'play') {
      this.game.update(dt);
      const r = this.game.result();
      if (r) {
        this.ranking = r;
        this.phase = 'end';
        this.t = 0;
        sfx.win();
        buzz([30, 60, 30]);
        const wz = this.zones[r[0]];
        this.fx.confetti(wz.cx, wz.cy, 120, 1.4);
        // Reported after the overlay settles so the buttons don't pop in mid-animation.
        setTimeout(() => this.onEnd(r), 900);
      }
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    g.save();
    g.scale(W / this.gw, H / this.gh);
    g.save();
    this.fx.applyShake(g);
    this.game.render(g);
    this.fx.render(g);
    g.restore();
    if (this.phase === 'ready') this.renderReady(g);
    else if (this.phase === 'countdown') this.renderCountdown(g);
    else if (this.phase === 'play' && this.t < 0.6) this.renderGo(g);
    else if (this.phase === 'end') this.renderEnd(g);
    g.restore();
  }

  private renderReady(g: CanvasRenderingContext2D): void {
    for (const z of this.zones) {
      const c = PLAYER_COLORS[z.player];
      const rdy = this.ready[z.player];
      g.fillStyle = 'rgba(8,8,16,0.8)';
      g.fillRect(z.x, z.y, z.w, z.h);
      withZone(g, z, () => {
        const hw = z.w / 2;
        const hh = z.h / 2;
        const grad = g.createLinearGradient(0, hh, 0, -hh);
        grad.addColorStop(0, rgba(c, rdy ? 0.28 : 0.14));
        grad.addColorStop(1, rgba(c, 0));
        g.fillStyle = grad;
        g.fillRect(-hw, -hh, z.w, z.h);
        g.strokeStyle = rgba(c, 0.35);
        g.lineWidth = 1;
        roundRect(g, -hw + 6, -hh + 6, z.w - 12, z.h - 12, 18);
        g.stroke();

        const narrow = z.w < 260;
        pill(g, PLAYER_NAMES[z.player], 0, -hh * 0.68, c, narrow ? 11 : 13);
        text(g, this.def.name.toUpperCase(), 0, -hh * 0.36, narrow ? 24 : 32, '#fff', {
          weight: 900,
          glow: 18,
          maxWidth: z.w * 0.86,
        });
        if (this.standings) {
          pips(g, 0, -hh * 0.52, this.standings.target, this.standings.scores[z.player], c, 4);
        }
        const size = narrow ? 13 : 15;
        const lines = wrap(g, this.def.howTo, size, z.w * 0.8);
        lines.forEach((l, i) => {
          text(g, l, 0, -hh * 0.18 + i * size * 1.45, size, 'rgba(255,255,255,0.72)', { weight: 500 });
        });

        const bw = Math.min(z.w * 0.78, 240);
        const bh = narrow ? 50 : 58;
        const by = hh * 0.42;
        const pulse = rdy ? 1 : 1 + Math.sin(this.t * 5) * 0.03;
        g.save();
        g.translate(0, by);
        g.scale(pulse, pulse);
        roundRect(g, -bw / 2, -bh / 2, bw, bh, bh / 2);
        if (rdy) {
          g.fillStyle = c;
          g.shadowColor = c;
          g.shadowBlur = 24;
          g.fill();
          g.shadowBlur = 0;
          text(g, 'READY ✓', 0, 1, narrow ? 17 : 20, '#0B0B14', { weight: 900 });
        } else {
          g.fillStyle = rgba(c, 0.1);
          g.fill();
          g.strokeStyle = c;
          g.lineWidth = 2;
          g.stroke();
          text(g, 'TAP TO READY', 0, 1, narrow ? 14 : 17, c, { weight: 800, maxWidth: bw * 0.85 });
        }
        g.restore();
      });
    }
  }

  private renderCountdown(g: CanvasRenderingContext2D): void {
    const step = Math.min(2, Math.floor(this.t / COUNT_STEP));
    const k = (this.t - step * COUNT_STEP) / COUNT_STEP;
    const label = String(3 - step);
    g.fillStyle = `rgba(8,8,16,${0.55 - (this.t / (COUNT_STEP * 3)) * 0.35})`;
    g.fillRect(0, 0, this.gw, this.gh);
    for (const z of this.zones) {
      const c = PLAYER_COLORS[z.player];
      withZone(g, z, () => {
        const s = easeOutBack(Math.min(1, k * 2.2));
        g.save();
        g.scale(s, s);
        text(g, label, 0, 0, Math.min(z.w, z.h) * 0.42, '#fff', { weight: 900, glow: 30, alpha: 1 - k * 0.5 });
        g.restore();
        g.strokeStyle = rgba(c, 0.8 * (1 - k));
        g.lineWidth = 4;
        g.beginPath();
        g.arc(0, 0, Math.min(z.w, z.h) * (0.2 + k * 0.25), 0, Math.PI * 2);
        g.stroke();
      });
    }
  }

  private renderGo(g: CanvasRenderingContext2D): void {
    const k = this.t / 0.6;
    for (const z of this.zones) {
      withZone(g, z, () => {
        g.save();
        const s = 1 + k * 0.6;
        g.scale(s, s);
        text(g, 'GO!', 0, 0, Math.min(z.w, z.h) * 0.3, PLAYER_COLORS[z.player], {
          weight: 900,
          glow: 30,
          alpha: 1 - k,
        });
        g.restore();
      });
    }
  }

  private renderEnd(g: CanvasRenderingContext2D): void {
    const k = Math.min(1, this.t / 0.5);
    for (const z of this.zones) {
      const place = this.ranking.indexOf(z.player);
      const win = place === 0;
      const c = PLAYER_COLORS[z.player];
      g.fillStyle = `rgba(8,8,16,${0.86 * k})`;
      g.fillRect(z.x, z.y, z.w, z.h);
      if (win) {
        g.fillStyle = rgba(c, 0.2 * k);
        g.fillRect(z.x, z.y, z.w, z.h);
      }
      withZone(g, z, () => {
        const m = Math.min(z.w, z.h);
        const s = easeOutBack(k);
        g.save();
        g.translate(0, z.h * 0.06);
        g.scale(s, s);
        if (win) {
          drawCrown(g, 0, -m * 0.26, m * 0.2, WIN_GOLD);
          text(g, 'WINNER', 0, 0, m * 0.2, WIN_GOLD, { weight: 900, glow: 26, maxWidth: z.w * 0.85 });
        } else {
          text(g, PLACES[place] ?? '', 0, 0, m * 0.2, rgba(c, 0.9), { weight: 900, glow: 10 });
        }
        g.restore();
        const st = this.standings;
        if (st) {
          pips(g, 0, z.h * 0.24, st.target, st.scores[z.player], c, 5);
          if (st.champion !== null) {
            const champ = st.champion === z.player;
            text(g, champ ? 'CHAMPION!' : `${PLAYER_NAMES[st.champion]} TAKES THE CUP`, 0, z.h * 0.33, m * (champ ? 0.1 : 0.06), champ ? WIN_GOLD : '#fff', {
              weight: 900,
              glow: champ ? 20 : 0,
              maxWidth: z.w * 0.9,
              alpha: k,
            });
          }
        }
      });
    }
    if (this.standings?.champion !== null && this.standings && Math.random() < 0.15) {
      const wz = this.zones[this.standings.champion!];
      this.fx.confetti(wz.cx + (Math.random() - 0.5) * wz.w, wz.cy, 6, 1.2);
    }
  }
}
