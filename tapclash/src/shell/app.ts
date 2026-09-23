import type { Engine } from '../core/engine';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { GAMES, RANDOM_ICON, randomGame } from '../games/registry';
import type { GameDef } from '../games/types';
import { PLAYER_COLORS } from '../theme';
import { MenuScene } from './menuScene';
import { Session } from './session';

const TOURNAMENT_TARGET = 5;

interface Tournament {
  scores: number[];
  last: string;
}

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem('tapclash:' + key);
    } catch {
      return null;
    }
  },
  set(key: string, v: string): void {
    try {
      localStorage.setItem('tapclash:' + key, v);
    } catch {
      /* private mode */
    }
  },
};

const ICON_SOUND_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>`;
const ICON_SOUND_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>`;
const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>`;

export class App {
  private players: number;
  private session: Session | null = null;
  private tournament: Tournament | null = null;
  private menu = new MenuScene();
  private wakeLock: { release(): Promise<void> } | null = null;

  constructor(
    private engine: Engine,
    private ui: HTMLElement,
  ) {
    this.players = Number(store.get('players')) || 2;
    sfx.enabled = store.get('sound') !== 'off';
    ui.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.session && !this.session.paused) this.pause();
      if (!document.hidden && this.session) void this.keepAwake();
    });
    this.home();
  }

  // ───────────────────────── screens ─────────────────────────

  private mount(html: string): void {
    this.ui.innerHTML = html;
  }

  private home(): void {
    this.session = null;
    this.tournament = null;
    this.engine.scene = this.menu;
    const seg = [2, 3, 4]
      .map(
        (n) => `
        <button class="seg-btn ${n === this.players ? 'on' : ''}" data-act="players" data-n="${n}" aria-pressed="${n === this.players}">
          <span class="dots">${PLAYER_COLORS.slice(0, n).map((c) => `<i style="--c:${c}"></i>`).join('')}</span>
          <b>${n}</b>
        </button>`,
      )
      .join('');
    this.mount(`
      <section class="screen home">
        <button class="icon-btn sound" data-act="sound" aria-label="Toggle sound">${sfx.enabled ? ICON_SOUND_ON : ICON_SOUND_OFF}</button>
        <div class="logo" aria-label="TapClash">
          <span class="l1">TAP</span><span class="l2">CLASH</span>
          <p class="sub">Party games for one phone · 2–4 players</p>
        </div>
        <div class="glass players">
          <div class="label">Players</div>
          <div class="seg">${seg}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-act="quick"><span>Quick Play</span><small>Pick any of ${GAMES.length} games</small></button>
          <button class="btn secondary" data-act="tournament"><span>Tournament</span><small>First to ${TOURNAMENT_TARGET} wins takes the cup</small></button>
        </div>
        <p class="hint"><span class="phone"></span>Lay the phone flat and have everyone take a side</p>
      </section>`);
  }

  private picker(): void {
    this.session = null;
    this.engine.scene = this.menu;
    const cards = [
      `<button class="game-card random" data-act="random" style="--accent:#ffffff">
        <span class="gc-icon">${RANDOM_ICON}</span><span class="gc-name">Surprise me</span><span class="gc-tag">Random game</span>
      </button>`,
      ...GAMES.map(
        (g, i) => `
        <button class="game-card" data-act="game" data-id="${g.id}" style="--accent:${g.accent};--i:${i + 1}">
          <span class="gc-icon">${g.icon}</span><span class="gc-name">${g.name}</span><span class="gc-tag">${g.tagline}</span>
        </button>`,
      ),
    ].join('');
    this.mount(`
      <section class="screen picker">
        <header class="bar">
          <button class="icon-btn" data-act="home" aria-label="Back">${ICON_BACK}</button>
          <h2>Choose a game</h2>
          <span class="chip">${this.players}P</span>
        </header>
        <div class="grid scroll">${cards}</div>
      </section>`);
  }

  private play(def: GameDef): void {
    const s = new Session(this.engine, def, this.players, (r) => this.roundEnd(r));
    if (this.tournament) {
      s.standings = { scores: [...this.tournament.scores], target: TOURNAMENT_TARGET, champion: null };
      this.tournament.last = def.id;
    }
    this.session = s;
    this.engine.scene = s;
    this.mount(`<button class="pause-btn" data-act="pause" aria-label="Pause">${ICON_PAUSE}</button>`);
    void this.keepAwake();
  }

  private roundEnd(ranking: number[]): void {
    const s = this.session;
    if (!s || this.engine.scene !== s) return;
    let buttons: string;
    if (this.tournament) {
      this.tournament.scores[ranking[0]]++;
      const champ = this.tournament.scores.findIndex((v) => v >= TOURNAMENT_TARGET);
      s.standings = { scores: [...this.tournament.scores], target: TOURNAMENT_TARGET, champion: champ >= 0 ? champ : null };
      buttons =
        champ >= 0
          ? `<button class="btn small primary" data-act="tournament">New cup</button><button class="btn small ghost" data-act="home">Home</button>`
          : `<button class="btn small primary" data-act="next">Next round</button><button class="btn small ghost" data-act="home">Quit</button>`;
    } else {
      buttons = `<button class="btn small primary" data-act="rematch">Rematch</button><button class="btn small ghost" data-act="picker">Games</button><button class="btn small ghost" data-act="home">Home</button>`;
    }
    this.mount(`<div class="endbar">${buttons}</div>`);
  }

  private pause(): void {
    if (!this.session) return;
    this.session.paused = true;
    this.mount(`
      <div class="overlay">
        <div class="glass panel">
          <h3>Paused</h3>
          <button class="btn primary" data-act="resume"><span>Resume</span></button>
          <button class="btn secondary" data-act="restart"><span>Restart round</span></button>
          <button class="btn ghost" data-act="home"><span>Quit to menu</span></button>
        </div>
      </div>`);
  }

  // ───────────────────────── actions ─────────────────────────

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el) return;
    sfx.unlock();
    sfx.click();
    buzz(8);
    const act = el.dataset.act;
    switch (act) {
      case 'players':
        this.players = Number(el.dataset.n);
        store.set('players', String(this.players));
        this.home();
        break;
      case 'sound':
        sfx.enabled = !sfx.enabled;
        store.set('sound', sfx.enabled ? 'on' : 'off');
        el.innerHTML = sfx.enabled ? ICON_SOUND_ON : ICON_SOUND_OFF;
        break;
      case 'quick':
      case 'picker':
        this.tournament = null;
        this.picker();
        break;
      case 'tournament':
        this.enterFullscreen();
        this.tournament = { scores: new Array(this.players).fill(0), last: '' };
        this.play(randomGame());
        break;
      case 'next':
        if (this.tournament) this.play(randomGame(this.tournament.last));
        break;
      case 'game': {
        const def = GAMES.find((g) => g.id === el.dataset.id);
        if (def) {
          this.enterFullscreen();
          this.play(def);
        }
        break;
      }
      case 'random':
        this.enterFullscreen();
        this.play(randomGame());
        break;
      case 'rematch':
      case 'restart':
        if (this.session) this.play(this.session.def);
        break;
      case 'pause':
        this.pause();
        break;
      case 'resume':
        if (this.session) {
          this.session.paused = false;
          this.mount(`<button class="pause-btn" data-act="pause" aria-label="Pause">${ICON_PAUSE}</button>`);
        }
        break;
      case 'home':
        this.releaseAwake();
        this.home();
        break;
    }
  }

  private enterFullscreen(): void {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    // Only on touch devices: desktop testers keep their browser window.
    if (!matchMedia('(pointer: coarse)').matches) return;
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  }

  private async keepAwake(): Promise<void> {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (wl && !this.wakeLock) this.wakeLock = await wl.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }

  private releaseAwake(): void {
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }
}
