# TapClash

Party mini-games for 2, 3 or 4 players on **one phone lying flat on a table**.
Each player owns one side of the screen, and every player's text faces them.

## Run

```bash
npm install
npm run dev      # open the printed Network URL on your phone (same Wi-Fi)
npm run build    # static build in dist/, deploy anywhere (installable PWA)
```

## Games

| Game | Goal |
|---|---|
| Tap Rush | First to 50 taps |
| Reflex | Tap on green; tapping early costs you the round. First to 3 |
| Sumo Ring | Push the others off a shrinking ring. Drag to roll, tap to dash |
| Pong Arena | Circular pong: defend your arc; 3 lives |
| Snake Clash | Light cycles: swipe to turn; last one riding wins |
| Color Call | Tap the colour the word names, not its ink. First to 5 |
| Math Duel | First correct answer scores. First to 5 |
| Tank Brawl | Drag to drive, auto-fire, bullets bounce once; 3 HP |

Modes: **Quick Play** (pick a game, rematch) and **Tournament** (random games, first to 5 wins).

## Structure

```
src/core/    engine loop + input, zone layout, drawing helpers, fx, synth audio, haptics
src/shell/   DOM menus (app.ts), round flow (session.ts: ready → countdown → play → results)
src/games/   one file per game, all implementing GameModule (types.ts)
```

Adding a game: implement `GameModule` (`init`, `update`, `render`, touch handlers,
`result()` returning players best → worst) and register it in `games/registry.ts`.
The session handles ready checks, countdown, touch → player routing and results.

No runtime dependencies: Canvas 2D for rendering, WebAudio for generated sound effects.
