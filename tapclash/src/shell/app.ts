import type { Engine } from '../core/engine';
import { sfx } from '../core/audio';
import { buzz } from '../core/haptics';
import { GAMES, randomGame } from '../games/registry';
import type { GameDef } from '../games/types';
import { CRITTERS, PLAYER_NAMES } from '../theme';
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
const critterHTML = (p: number, mood = 'idle', cls = '') =>
  `<span class="critter ${cls}" data-p="${p}"><img src="assets/critters/${CRITTERS[p]}.svg" alt=""><img class="face" src="assets/faces/${mood}.svg" alt="${PLAYER_NAMES[p]}"></span>`;

const TAGLINES = [
  'One phone. Four thumbs. Zero friendships left.',
  'Lay it flat. Grab a side. No crying.',
  'Scientifically proven to end sleepovers.',
  'Settle it like adults. On a phone.',
];

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
          <span class="lineup">${[0, 1, 2, 3].slice(0, n).map((p) => critterHTML(p, n === this.players ? 'happy' : 'idle')).join('')}</span>
          <b>${n}</b>
        </button>`,
      )
      .join('');
    const letters = (w: string, off: number) =>
      [...w].map((ch, i) => `<span style="--i:${i + off}">${ch}</span>`).join('');
    this.mount(`
      <section class="screen home">
        <button class="icon-btn sound" data-act="sound" aria-label="Toggle sound">${sfx.enabled ? ICON_SOUND_ON : ICON_SOUND_OFF}</button>
        <div class="logo" aria-label="TapClash">
          <div class="peek">${[0, 1, 2, 3].map((p) => critterHTML(p, 'idle', 'poke')).join('')}</div>
          <h1><span class="w1">${letters('TAP', 0)}</span><span class="w2">${letters('CLASH!', 3)}</span></h1>
          <p class="sub">${TAGLINES[(Math.random() * TAGLINES.length) | 0]}</p>
        </div>
        <div class="card players">
          <div class="label">Who's playing?</div>
          <div class="seg">${seg}</div>
        </div>
        <div class="actions">
          <button class="btn yellow" data-act="quick"><span>Quick Game</span><small>pick from ${GAMES.length} games</small></button>
          <button class="btn pink" data-act="tournament"><span>The Big Cup</span><small>random games, first to ${TOURNAMENT_TARGET} wins</small></button>
        </div>
      </section>`);
  }

  private picker(): void {
    this.session = null;
    this.engine.scene = this.menu;
    const card = (act: string, id: string, icon: string, name: string, tag: string, accent: string, i: number) => `
        <button class="game-card" data-act="${act}" ${id ? `data-id="${id}"` : ''} style="--accent:${accent};--i:${i};--tilt:${((i * 37) % 5) - 2}deg">
          <img class="gc-icon" src="assets/icons/${icon}.svg" alt=""><span class="gc-name">${name}</span><span class="gc-tag">${tag}</span>
        </button>`;
    const cards = [
      card('random', '', 'random', 'Surprise Me', 'we pick, you suffer', '#FFFFFF', 0),
      ...GAMES.map((g, i) => card('game', g.id, g.icon, g.name, g.tagline, g.accent, i + 1)),
    ].join('');
    this.mount(`
      <section class="screen picker">
        <header class="bar">
          <button class="icon-btn" data-act="home" aria-label="Back">${ICON_BACK}</button>
          <h2>Pick a game</h2>
          <span class="chip">${[0, 1, 2, 3].slice(0, this.players).map((p) => critterHTML(p)).join('')}</span>
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
          ? `<button class="btn small yellow" data-act="tournament">New cup</button><button class="btn small white" data-act="home">Home</button>`
          : `<button class="btn small yellow" data-act="next">Next round</button><button class="btn small white" data-act="home">Quit</button>`;
    } else {
      buttons = `<button class="btn small yellow" data-act="rematch">Rematch!</button><button class="btn small white" data-act="picker">Games</button><button class="btn small white" data-act="home">Home</button>`;
    }
    this.mount(`<div class="endbar">${buttons}</div>`);
  }

  private pause(): void {
    if (!this.session) return;
    this.session.paused = true;
    this.mount(`
      <div class="overlay">
        <div class="card panel">
          <div class="panel-critters">${[0, 1, 2, 3].slice(0, this.players).map((p) => critterHTML(p, 'worried')).join('')}</div>
          <h3>Hang on!</h3>
          <button class="btn yellow" data-act="resume"><span>Back to it</span></button>
          <button class="btn white" data-act="restart"><span>Restart round</span></button>
          <button class="btn white" data-act="home"><span>Quit to menu</span></button>
        </div>
      </div>`);
  }

  // ───────────────────────── actions ─────────────────────────

  private onClick(e: MouseEvent): void {
    const poke = (e.target as HTMLElement).closest<HTMLElement>('.critter.poke');
    if (poke) {
      sfx.unlock();
      sfx.tap(Number(poke.dataset.p));
      buzz(10);
      const face = poke.querySelector<HTMLImageElement>('.face');
      if (face) face.src = 'assets/faces/happy.svg';
      poke.classList.remove('boing');
      void poke.offsetWidth;
      poke.classList.add('boing');
      setTimeout(() => face && (face.src = 'assets/faces/idle.svg'), 700);
      return;
    }
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
