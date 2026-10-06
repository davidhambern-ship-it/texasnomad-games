# OUT!

OUT! is TNG's classic card-shedding party game. It uses original TNG art and name; the official UNO name and card designs are Mattel's and aren't used anywhere.

## Rules

- **The deck.** There are 108 cards.
  - Four colours: **Chili** (red), **Sunset** (gold), **Cactus** (green) and **Sky** (blue).
  - Each colour has one 0, two each of 1 to 9, two Skip, two Reverse and two +2.
  - There are also 4 Wild and 4 Wild +4.
- **Each turn.** Everyone gets 7 cards. Play a card that matches the top card's colour or number/symbol.
  - **Skip** skips the next player.
  - **Reverse** flips the direction. With 2 players it works as a Skip.
  - **+2** makes the next player draw 2 and lose their turn.
  - **Wild** lets you pick the colour.
  - **Wild +4** picks the colour and makes the next player draw 4. It's only allowed when you hold no card of the current colour; the server enforces this, so there's no challenge step.
- **Can't play?** Draw 1. If the drawn card fits, you can play it or keep it.
- **OUT!** Call it when you're down to one card. You can press it as you play your second-to-last card or right after.
  - Until the next player moves, anyone can **Catch** you, and you draw 2.
  - CPUs will catch you too.
- **Scoring.** First to empty their hand wins the round and scores everyone's leftover cards: numbers at face value, Skip/Reverse/+2 at 20, Wilds at 50.
  - The host picks one round or play to 100 / 250 / 500.
  - The next round deals itself after a short pause.
- **Turn timer.** 20 / 30 / 45 / 60 seconds. Running out draws a card and passes.
- **House rules (host toggles):**
  - **Stacking.** Answer a +2 with a +2, or a +4 on either, to pass the total along. Whoever can't stack draws everything.
  - **7-0 swaps.** A 7 swaps hands with a player you pick, and a 0 passes every hand one seat along in the current direction.

## How a party works

1. **Host.** The TV opens `/games/out?host=1`, from the Host Panel or the Games card.
   - It reserves a five-letter code in the TNG room registry, so `/join/CODE` works.
   - Host settings: target score, turn timer, stacking, 7-0 swaps, and Add CPU player (2–10 players).
2. **Join.** Phones go to `/join` (or `/games/out?room=CODE`) and tap **Take a seat**.
   - Players need to be signed in; their TNG profile name is used.
3. **Play.** The TV shows the table: every seat with card count, score, OUT!/didn't-call badges and turn timer, plus the piles, current colour, direction, stack counter, Table Talk feed and scores.
   - Phones show your hand. Playable cards lift and glow.
   - Phones also show the colour picker for Wilds, the swap-target picker for 7s, Draw / Keep it, the OUT! button, and Catch buttons.
4. **Game Display.** `?display=CODE` is a read-only table, and TNG Game Display embeds it (`NomadCardsDisplay`).
5. **Solo.** You against 1, 2, 3 or 5 CPUs on one device, with the same house rules.

## Code map

| Path | What |
|---|---|
| `src/lib/nomadCards/game.js` | Pure rules engine: `createGame`, `act`, `tick` (timers, CPUs, next round), `view` (per-player, never leaks hands or the deck) |
| `server/nomadCardsApi.mjs` | `/nc-api` party rooms, built on the same pattern as BattleSudoku: snapshot store, TNG identity, registry codes, results recording (`gameId: 'out'`) |
| `server.mjs` | Room store, handler, `/nc-api` route, `x-nc-token` CORS header, maintenance job |
| `src/api/nomadCardsApi.js` | Client (`ncApi`, `ncSeat`, `resolveNomadCardsRoom`) |
| `src/components/nomadCards/*` | `NCTable` (TV), `NCHand` (phone/solo), `NCCard` (card art), `NCOnline` (host/player/display), `NCSolo`, sounds, CSS |
| `src/pages/NomadCardsGame.jsx` | Menu / host / join / display / solo |
| `scripts/out-sim.mjs` | `node scripts/out-sim.mjs` runs 120 CPU games across 2–10 players and every house-rule combo, and checks card conservation, legal play and finishing |

## API

The token goes in `X-NC-Token`.

| Route | Purpose |
|---|---|
| `GET /nc-api/health` | Health check |
| `POST /nc-api/rooms` | Host creates a room (signed-in) |
| `GET /nc-api/rooms/:code` | Room view for the token holder |
| `POST /nc-api/rooms/:code/action` | Host and player actions (below) |

Actions sent to `/nc-api/rooms/:code/action`:
- **Host:** `settings{target,turnSec,stacking,sevenZero}`, `addCpu`, `kick{playerId}`, `start`, `lobby`.
- **Player:** `join`, `leave`, `play{card,color,target,call}`, `draw`, `pass`, `call`, `catch{target}`.
