# BattleSudoku

BattleSudoku replaces the old Base44 Sudoku at `/games/sudoku`. It is Sudoku crossed with Battleship. It works for 2–8 captains in a party room (TV + phones) and also has a solo mode against 1–5 CPU captains.

## How a game plays

1. **Hide your fleet** (20 s). Each captain hides five ships (5, 4, 3, 3, 2) under their own copy of the puzzle. Everyone gets the same puzzle each game, and a new one every game.
2. **Volleys.** Each volley has three parts:
   - **Solve** (30/40/60 s).
     - Each correct number loads one shell, and every 4-streak loads one bonus shell.
     - A wrong number costs a shell and locks the pad for 1.5 s.
     - Completing a row, column or box pings sonar on your **rival**: how many unhit ship squares are in that line.
   - **Battle** (10/15/20 s). Spend shells on any rival:
     - **Fire**: 1 shell, one square.
     - **Torpedo**: 3 shells, three squares in a line.
     - **Repair**: 1 shell, fixes a hit square of your own.
     - **Shield**: 1 shell, blocks one shot on a healthy square of your own.
     - Shells you don't spend are banked, up to 8.
   - **Reveal** (7 s). The TV plays the shots one by one.
     - A hit blows the solved numbers out of that square and its four neighbours, so you have to solve them again (no shells the second time).
     - Sinking a ship steals 2 shells and freezes the victim for 5 s next solve.
     - Hits on the **★ bounty** captain (the one with the most solved squares) pay +1 shell.
3. **Ghosts.** A captain whose whole fleet is sunk becomes a Ghost. Ghosts can't be shot. They keep solving and firing, so they can still win on Admiral's Victory or points.
4. **Ways to win:**
   - **Admiral's Victory**: first to complete the whole grid.
   - **Last fleet afloat.**
   - **Most points** after the final volley. Points: cell 10, hit 30, sink 100, finish 500, surviving 200.

## Code map

| Path | What |
| --- | --- |
| `src/lib/battleSudoku/sudoku.js` | Seeded generator for unique-solution puzzles (easy 38 / normal 32 / hard 27 clues) |
| `src/lib/battleSudoku/game.js` | Pure game engine: `createGame`, `act`, `tick`, `view`, CPU captains. The server and solo mode both use it. |
| `server/battleSudokuApi.mjs` | Railway party rooms under `/bs-api` (in memory, 3 h TTL, max 8 captains) |
| `server.mjs` | Mounts `/bs-api` and adds the `x-bs-token` CORS header |
| `src/api/battleSudokuApi.js` | Client: `bsApi`, `bsSeat`, `resolveBattleSudokuRoom` |
| `src/components/battleSudoku/*` | TV (`BSBigScreen`), phone (`BSPhone`), grid, solo, online wrappers, sounds, CSS |
| `src/pages/SudokuGame.jsx` | Page: menu, solo, host, join |
| `scripts/battle-sudoku-sim.mjs` | `node scripts/battle-sudoku-sim.mjs` runs 60 CPU games and checks invariants |

The server is authoritative. The solution and every fleet stay on the server. `view()` sends each phone only its own fleet, and the public marks for everyone else.

## URLs

- `/games/sudoku`: menu (join code / host / solo).
- `/games/sudoku?host=1`: open straight into hosting (Host Panel).
- `/games/sudoku?room=CODE`: join on a phone (five-letter code; `/join/CODE` resolves it too).
- `/games/sudoku?display=CODE`: read-only big screen for TNG Game Display or a second TV.
- Health: `https://tng-live-production.up.railway.app/bs-api/health`

`VITE_BS_API_BASE` overrides the API base. By default the client calls Railway, or `/bs-api` when it is served from the Railway host.

## API

Send the token in the `X-BS-Token` header.

- `POST /bs-api/rooms` returns `{ roomCode, token, room }`. The token is the host token.
- `GET /bs-api/rooms/:code` returns `{ room, you }`.
- `POST /bs-api/rooms/:code/action` with `{ action, ... }`:
  - Host actions: `settings {difficulty, solveSec, battleSec, volleys}`, `addCpu`, `kick {playerId}`, `start`, `lobby`.
  - Player actions: `join {name}` (returns a token), `leave`, `shuffle`, `ready`, `place {cell, digit}`, `order {kind, target, cell, dir}`, `cancel {orderId}`.

## Later

- Teams mode ("Fleet vs Fleet").
- Room state lives in memory, so a Railway restart ends the live battles.
