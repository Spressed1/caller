import { createBomb } from './bomb';
import { createQuickCount } from './count';
import { createMemory } from './memory';
import { createNerve } from './nerve';
import { createPaint } from './paint';
import { createColorCall, createMathDuel } from './quiz';
import { createTug } from './tug';
import { createPong } from './pong';
import { createReflex } from './reflex';
import { createSnake } from './snake';
import { createSumo } from './sumo';
import { createTanks } from './tanks';
import { createTapRush } from './tapRush';
import type { GameDef } from './types';

const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const GAMES: GameDef[] = [
  {
    id: 'tap-rush',
    name: 'Tap Rush',
    tagline: 'Fastest fingers win',
    howTo: 'Tap your area as fast as you can. First to 50 taps wins.',
    accent: '#22D3EE',
    icon: svg('<circle cx="24" cy="24" r="7"/><circle cx="24" cy="24" r="15" opacity=".55"/><path d="M24 3v5M24 40v5M3 24h5M40 24h5" opacity=".55"/>'),
    create: createTapRush,
  },
  {
    id: 'reflex',
    name: 'Reflex',
    tagline: 'Wait for green',
    howTo: 'Tap the moment your area turns green. Tap early and you sit the round out. First to 3.',
    accent: '#4ADE80',
    icon: svg('<path d="M27 4 12 27h11l-3 17 16-24H25z"/>'),
    create: createReflex,
  },
  {
    id: 'sumo',
    name: 'Sumo Ring',
    tagline: 'Push them off the edge',
    howTo: 'Drag to roll. Tap (or tap a second finger) to dash. The ring shrinks. Last one standing wins.',
    accent: '#C084FC',
    icon: svg('<circle cx="24" cy="24" r="19" opacity=".55"/><circle cx="18" cy="24" r="6"/><circle cx="31" cy="21" r="5"/>'),
    create: createSumo,
  },
  {
    id: 'pong',
    name: 'Pong Arena',
    tagline: 'Defend your arc',
    howTo: 'Slide your finger left and right to move your paddle. Let the ball past three times and you are out.',
    accent: '#F472B6',
    icon: svg('<path d="M9 16a19 19 0 0 1 30 0" /><path d="M39 32a19 19 0 0 1-30 0" opacity=".55"/><circle cx="24" cy="24" r="3.5" fill="currentColor"/>'),
    create: createPong,
  },
  {
    id: 'snake',
    name: 'Snake Clash',
    tagline: 'Cut them off',
    howTo: 'Swipe to turn. Hit a wall or any trail and you crash. Last one riding wins.',
    accent: '#A3E635',
    icon: svg('<path d="M8 38V22h14v-12h18"/><path d="M40 38H28V28" opacity=".55"/>'),
    create: createSnake,
  },
  {
    id: 'color-call',
    name: 'Color Call',
    tagline: 'Read the word, not the ink',
    howTo: 'Tap the colour the WORD names, not the colour it is painted in. A wrong tap locks you out of the round. First to 5.',
    accent: '#FBBF24',
    icon: svg('<rect x="6" y="6" width="15" height="15" rx="4"/><rect x="27" y="6" width="15" height="15" rx="4" opacity=".55"/><rect x="6" y="27" width="15" height="15" rx="4" opacity=".55"/><rect x="27" y="27" width="15" height="15" rx="4"/>'),
    create: createColorCall,
  },
  {
    id: 'math-duel',
    name: 'Math Duel',
    tagline: 'Quick maths',
    howTo: 'Solve the sum and tap the right answer first. A wrong tap locks you out of the round. First to 5.',
    accent: '#38BDF8',
    icon: svg('<path d="M10 14h12M16 8v12M28 14h12M10 34h12M28 30h12M28 38h12"/>'),
    create: createMathDuel,
  },
  {
    id: 'tanks',
    name: 'Tank Brawl',
    tagline: 'Last tank rolling',
    howTo: 'Drag to drive; your cannon fires on its own. Bullets bounce once. Three hits and you are out.',
    accent: '#FB923C',
    icon: svg('<rect x="8" y="20" width="24" height="16" rx="4"/><circle cx="20" cy="28" r="4"/><path d="M24 28h17"/><path d="M8 20h24M8 36h24" opacity=".55"/>'),
    create: createTanks,
  },
  {
    id: 'bomb',
    name: 'Bomb Pass',
    tagline: "Don't be holding it",
    howTo: 'Holding the bomb? Tap it 3 times to throw it to someone else. The fuse is hidden, so listen to the ticking. If it blows up on you, you are out.',
    accent: '#F97316',
    icon: svg('<circle cx="21" cy="28" r="14"/><path d="M29 15l4-4"/><path d="M36 6l1 3M41 10l-3 1M40 4l-2 3" opacity=".7"/>'),
    create: createBomb,
  },
  {
    id: 'nerve',
    name: 'Hold Your Nerve',
    tagline: 'Let go before it crashes',
    howTo: 'Hold a finger down while the multiplier climbs. Let go to bank it. Still holding when it crashes? You get nothing. Best total after 3 rounds.',
    accent: '#FB7185',
    icon: svg('<path d="M6 40 18 30l7 5 17-25"/><path d="M34 10h8v8"/>'),
    create: createNerve,
  },
  {
    id: 'paint',
    name: 'Paint Wars',
    tagline: 'Cover the floor',
    howTo: 'Drag to roll your brush and paint the floor. Paint over rivals, grab the star for a big splash. Most floor after 30 seconds wins.',
    accent: '#E879F9',
    icon: svg('<path d="M10 38c6 0 8-4 8-8a5 5 0 0 1 10 0c0 4-4 8-8 8"/><path d="M26 22 40 8"/><circle cx="12" cy="14" r="3" fill="currentColor"/><circle cx="36" cy="34" r="3" fill="currentColor"/>'),
    create: createPaint,
  },
  {
    id: 'memory',
    name: 'Memory Echo',
    tagline: 'Repeat the pattern',
    howTo: 'Watch the pads light up, then tap the same pattern. First to get it right scores, and the pattern gets longer. One mistake locks you out of the round. First to 3.',
    accent: '#34D399',
    icon: svg('<path d="M24 6a18 18 0 0 1 18 18H24z"/><path d="M42 24a18 18 0 0 1-18 18V24z" opacity=".55"/><path d="M24 42A18 18 0 0 1 6 24h18z"/><path d="M6 24A18 18 0 0 1 24 6v18z" opacity=".55"/>'),
    create: createMemory,
  },
  {
    id: 'tug',
    name: 'Tug Knot',
    tagline: 'Everyone pulls at once',
    howTo: 'Every tap yanks the knot towards your goal while everyone else pulls their way. Drag the knot into your circle to win.',
    accent: '#FACC15',
    icon: svg('<circle cx="24" cy="24" r="4" fill="currentColor"/><path d="M24 20V6M24 28v14M20 24H6M28 24h14" opacity=".8"/><circle cx="24" cy="6" r="3"/><circle cx="24" cy="42" r="3"/><circle cx="6" cy="24" r="3"/><circle cx="42" cy="24" r="3"/>'),
    create: createTug,
  },
  {
    id: 'count',
    name: 'Quick Count',
    tagline: 'Two seconds to count',
    howTo: 'Dots flash up for two seconds. Count the colour you are shown, then tap the right number. A wrong tap locks you out of the round. First to 5.',
    accent: '#60A5FA',
    icon: svg('<circle cx="14" cy="14" r="4" fill="currentColor"/><circle cx="32" cy="12" r="4"/><circle cx="24" cy="26" r="4" fill="currentColor"/><circle cx="12" cy="36" r="4"/><circle cx="36" cy="34" r="4" fill="currentColor"/>'),
    create: createQuickCount,
  },
];

export const RANDOM_ICON = svg('<rect x="7" y="7" width="34" height="34" rx="8"/><circle cx="17" cy="17" r="2.5" fill="currentColor"/><circle cx="31" cy="31" r="2.5" fill="currentColor"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/><circle cx="31" cy="17" r="2.5" fill="currentColor"/><circle cx="17" cy="31" r="2.5" fill="currentColor"/>');

export function randomGame(except?: string): GameDef {
  const pool = GAMES.filter((g) => g.id !== except);
  return pool[(Math.random() * pool.length) | 0];
}
