import type { Engine, Scene } from '../core/engine';
import { Fx } from '../core/fx';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { critter, type Mood } from '../core/assets';
import { drawCrown, easeOutBack, pill, pips, sticker, text, tint, wrap } from '../core/draw';
import { layoutZones, withZone, zoneAt, type Zone } from '../core/zones';
import type { GameDef, GameModule } from '../games/types';
import { INK, PLAYER_COLORS, PLAYER_NAMES, WIN_GOLD, inkA } from '../theme';

type Phase = 'ready' | 'countdown' | 'play' | 'end';

export interface Standings {
  scores: number[];
  target: number;
  champion: number | null;
}

const PLACES = ['1ST', '2ND', '3RD', '4TH'];
const QUIPS = ['so close!', 'not today', 'oof.', 'next time…', 'rematch?', 'ouch', 'sure, sure', 'robbed!'];
const COUNT_COLORS = ['#FF7EB6', '#FFC933', '#2DBE7E'];
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
  private quips: string[] = [];
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
        this.quips = r.map(() => QUIPS[(Math.random() * QUIPS.length) | 0]);
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
      g.fillStyle = tint(c, rdy ? 0.55 : 0.8);
      g.fillRect(z.x, z.y, z.w, z.h);
      withZone(g, z, () => {
        const hh = z.h / 2;
        const narrow = z.w < 260;
        const m = Math.min(z.w, z.h);
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.strokeRect(-z.w / 2, -hh, z.w, z.h);

        text(g, this.def.name.toUpperCase(), 0, -hh * 0.8, narrow ? 20 : 24, INK, { weight: 900, maxWidth: z.w * 0.86 });
        const bob = Math.sin(this.t * 3 + z.player) * 4;
        const size = Math.min(m * 0.4, 120);
        critter(g, z.player, 0, -hh * 0.45 + bob, size, rdy ? 'happy' : 'idle', Math.sin(this.t * 2 + z.player) * 0.05);
        pill(g, PLAYER_NAMES[z.player], 0, -hh * 0.45 + size * 0.5 + 6, c, narrow ? 12 : 14);
        if (this.standings) {
          pips(g, 0, -hh * 0.45 + size * 0.5 + 34, this.standings.target, this.standings.scores[z.player], c, 5);
        }
        const tsize = narrow ? 12.5 : 15;
        const lines = wrap(g, this.def.howTo, tsize, z.w * 0.82);
        const top = this.standings ? hh * 0.12 : hh * 0.06;
        lines.forEach((l, i) => text(g, l, 0, top + i * tsize * 1.4, tsize, inkA(0.8), { weight: 600 }));

        const bw = Math.min(z.w * 0.8, 250);
        const bh = narrow ? 50 : 58;
        const by = hh * 0.66;
        const wiggle = rdy ? 0 : Math.sin(this.t * 6) * 0.02;
        g.save();
        g.translate(0, by + (rdy ? 3 : 0));
        g.rotate(wiggle);
        sticker(g, -bw / 2, -bh / 2, bw, bh, bh / 2, rdy ? c : '#FFFFFF', rdy ? 1 : 5);
        text(g, rdy ? 'READY!' : 'TAP WHEN READY', 0, 1, narrow ? 15 : 19, INK, { weight: 900, maxWidth: bw * 0.84 });
        g.restore();
      });
    }
  }

  private renderCountdown(g: CanvasRenderingContext2D): void {
    const step = Math.min(2, Math.floor(this.t / COUNT_STEP));
    const k = (this.t - step * COUNT_STEP) / COUNT_STEP;
    const label = String(3 - step);
    g.fillStyle = `rgba(255,241,220,${0.75 - (this.t / (COUNT_STEP * 3)) * 0.5})`;
    g.fillRect(0, 0, this.gw, this.gh);
    for (const z of this.zones) {
      withZone(g, z, () => {
        const m = Math.min(z.w, z.h);
        const s = easeOutBack(Math.min(1, k * 2.2));
        g.save();
        g.rotate((step - 1) * 0.08);
        g.scale(s, s);
        text(g, label, 0, -m * 0.05, m * 0.46, COUNT_COLORS[step], { weight: 900, glow: 1 });
        g.restore();
      });
    }
  }

  private renderGo(g: CanvasRenderingContext2D): void {
    const k = this.t / 0.6;
    for (const z of this.zones) {
      withZone(g, z, () => {
        g.save();
        const s = 1 + k * 0.5;
        g.scale(s, s);
        g.rotate(-0.06);
        text(g, 'GO!', 0, 0, Math.min(z.w, z.h) * 0.32, PLAYER_COLORS[z.player], { weight: 900, glow: 1, alpha: 1 - k });
        g.restore();
      });
    }
  }

  private renderEnd(g: CanvasRenderingContext2D): void {
    const k = Math.min(1, this.t / 0.5);
    const last = this.ranking.length - 1;
    for (const z of this.zones) {
      const place = this.ranking.indexOf(z.player);
      const win = place === 0;
      const c = PLAYER_COLORS[z.player];
      g.fillStyle = `rgba(255,241,220,${0.93 * k})`;
      g.fillRect(z.x, z.y, z.w, z.h);
      if (win) {
        g.globalAlpha = k;
        g.fillStyle = tint(c, 0.55);
        g.fillRect(z.x, z.y, z.w, z.h);
        g.globalAlpha = 1;
      }
      withZone(g, z, () => {
        const m = Math.min(z.w, z.h);
        const s = easeOutBack(k);
        const size = Math.min(m * (win ? 0.46 : 0.36), win ? 160 : 120);
        const cy = -z.h * 0.1;
        const hop = win ? -Math.abs(Math.sin(this.t * 5)) * 12 : 0;
        const mood: Mood = win ? 'win' : place === last ? 'ko' : 'worried';
        g.save();
        g.scale(s, s);
        critter(g, z.player, 0, cy + hop, size, mood, win ? Math.sin(this.t * 5) * 0.08 : place === last ? 0.25 : 0);
        if (win) drawCrown(g, 0, cy + hop - size * 0.52, size * 0.2, WIN_GOLD);
        g.restore();
        if (win) {
          text(g, `${PLAYER_NAMES[z.player]} WINS!`, 0, z.h * 0.12, m * 0.15, c, { weight: 900, glow: 1, maxWidth: z.w * 0.9, alpha: k });
        } else {
          text(g, PLACES[place] ?? '', 0, z.h * 0.1, m * 0.13, '#FFFFFF', { weight: 900, glow: 1, alpha: k });
          text(g, this.quips[z.player] ?? '', 0, z.h * 0.18, Math.max(12, m * 0.055), inkA(0.7), { weight: 600, alpha: k });
        }
        const st = this.standings;
        if (st) {
          pips(g, 0, z.h * 0.26, st.target, st.scores[z.player], c, 6);
          if (st.champion !== null) {
            const champ = st.champion === z.player;
            text(g, champ ? 'CHAMPION!' : `${PLAYER_NAMES[st.champion]} takes the cup`, 0, z.h * 0.35, champ ? m * 0.1 : Math.max(12, m * 0.055), champ ? WIN_GOLD : inkA(0.8), {
              weight: champ ? 900 : 600,
              glow: champ ? 1 : 0,
              maxWidth: z.w * 0.9,
              alpha: k,
            });
          }
        }
      });
    }
    if (this.standings && this.standings.champion !== null && Math.random() < 0.15) {
      const wz = this.zones[this.standings.champion];
      this.fx.confetti(wz.cx + (Math.random() - 0.5) * wz.w, wz.cy, 6, 1.2);
    }
  }
}
