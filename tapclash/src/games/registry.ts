import { createBomb } from './bomb';
import { createChomp } from './chomp';
import { createQuickCount } from './count';
import { createMemory } from './memory';
import { createNerve } from './nerve';
import { createPaint } from './paint';
import { createPong } from './pong';
import { createColorCall, createMathDuel } from './quiz';
import { createReflex } from './reflex';
import { createSnake } from './snake';
import { createStack } from './stack';
import { createSumo } from './sumo';
import { createTanks } from './tanks';
import { createTapRush } from './tapRush';
import { createTug } from './tug';
import type { GameDef } from './types';
import { createWhack } from './whack';

/** `icon` names a file in public/assets/icons. */
export const GAMES: GameDef[] = [
  {
    id: 'chomp',
    name: 'Chomp Chomp',
    tagline: 'Eat the candy. All of it.',
    howTo: 'Tap to lunge and chomp. Candy rolls everywhere; gold ones are worth 3. Emptiest bowl loses.',
    accent: '#FF7EB6',
    icon: 'chomp',
    create: createChomp,
  },
  {
    id: 'stack',
    name: 'Stack Attack',
    tagline: 'Tallest tower, no wobbles',
    howTo: 'Tap to drop the sliding block. Whatever hangs over gets chopped. Miss completely and your tower is done.',
    accent: '#2F7BFF',
    icon: 'stack',
    create: createStack,
  },
  {
    id: 'whack',
    name: 'Whack-a-Mole',
    tagline: 'Bonk heads, not bombs',
    howTo: 'Moles pop up in your patch: whack them. Gold moles are +3. Moles holding a bomb are -2. 30 seconds.',
    accent: '#B08968',
    icon: 'whack',
    create: createWhack,
  },
  {
    id: 'tap-rush',
    name: 'Tap Rush',
    tagline: 'Your thumb vs. their thumb',
    howTo: 'Hammer your side of the screen. First to 50 taps wins. Yes, really, that is the whole game.',
    accent: '#FF5A3C',
    icon: 'tap-rush',
    create: createTapRush,
  },
  {
    id: 'reflex',
    name: 'Reflex',
    tagline: 'Wait for it… wait for it…',
    howTo: 'Tap the moment your side turns green. Jump the gun and you sit the round out. First to 3.',
    accent: '#2DBE7E',
    icon: 'reflex',
    create: createReflex,
  },
  {
    id: 'bomb',
    name: 'Bomb Pass',
    tagline: 'Not it! NOT IT!',
    howTo: 'Got the bomb? Tap it 3 times to throw it at someone. Nobody knows the fuse. Listen to the ticking.',
    accent: '#FF9A3C',
    icon: 'bomb',
    create: createBomb,
  },
  {
    id: 'sumo',
    name: 'Sumo Ring',
    tagline: 'Push. Shove. Gloat.',
    howTo: 'Drag to roll, tap to dash. Knock everyone off the ring before it shrinks under you.',
    accent: '#8B7CF6',
    icon: 'sumo',
    create: createSumo,
  },
  {
    id: 'nerve',
    name: 'Hold Your Nerve',
    tagline: 'Greed is a choice',
    howTo: 'Hold a finger down while the number climbs. Let go to bank it. Still holding when it crashes? Zero.',
    accent: '#FF3B5C',
    icon: 'nerve',
    create: createNerve,
  },
  {
    id: 'paint',
    name: 'Paint Wars',
    tagline: 'Redecorate aggressively',
    howTo: 'Drag to roll your paint around. Paint over everyone else. Grab the star for a big splat. Most floor in 30s wins.',
    accent: '#E879F9',
    icon: 'paint',
    create: createPaint,
  },
  {
    id: 'pong',
    name: 'Pong Arena',
    tagline: 'Pong, but everyone',
    howTo: 'Slide left and right to move your paddle. Let the ball past three times and you are out.',
    accent: '#FF7EB6',
    icon: 'pong',
    create: createPong,
  },
  {
    id: 'snake',
    name: 'Snake Clash',
    tagline: 'Cut them off. Politely.',
    howTo: 'Swipe to turn. Touch a wall or any trail and you crash. Last one moving wins.',
    accent: '#2DBE7E',
    icon: 'snake',
    create: createSnake,
  },
  {
    id: 'tug',
    name: 'Tug Knot',
    tagline: 'Everyone pulls. Nobody lets go.',
    howTo: 'Every tap yanks the knot towards your circle while everyone else pulls their way. Get it home to win.',
    accent: '#FFC933',
    icon: 'tug',
    create: createTug,
  },
  {
    id: 'memory',
    name: 'Memory Echo',
    tagline: 'Blip-bloop, your turn',
    howTo: 'Watch the pads light up, then play it back. First correct scores and the tune gets longer. One mistake and you sit out.',
    accent: '#2F7BFF',
    icon: 'memory',
    create: createMemory,
  },
  {
    id: 'color-call',
    name: 'Color Call',
    tagline: 'Your brain will betray you',
    howTo: 'Tap the colour the WORD says, not the colour it is painted in. A wrong tap locks you out. First to 5.',
    accent: '#FFC933',
    icon: 'color-call',
    create: createColorCall,
  },
  {
    id: 'count',
    name: 'Quick Count',
    tagline: 'Two seconds. Go.',
    howTo: 'Dots flash up for two seconds. Count the colour you are told, then tap the number. First to 5.',
    accent: '#8B7CF6',
    icon: 'count',
    create: createQuickCount,
  },
  {
    id: 'math-duel',
    name: 'Math Duel',
    tagline: 'Mental maths, but loud',
    howTo: 'Solve it and tap the answer first. A wrong tap locks you out of the round. First to 5.',
    accent: '#2F7BFF',
    icon: 'math-duel',
    create: createMathDuel,
  },
  {
    id: 'tanks',
    name: 'Tank Brawl',
    tagline: 'Tiny tanks, big feelings',
    howTo: 'Drag to drive; the cannon fires on its own. Shots bounce once. Three hits and you are scrap.',
    accent: '#FF9A3C',
    icon: 'tanks',
    create: createTanks,
  },
];

export function randomGame(except?: string): GameDef {
  const pool = GAMES.filter((g) => g.id !== except);
  return pool[(Math.random() * pool.length) | 0];
}
