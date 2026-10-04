# TND Dominoes — upgrade notes

Drop-in replacement for the Dominoes files in `texasnomad-games`. The paths in this zip match the repo.

## What was wrong

1. **Tiles were placed by stored x/y percentages.** Every play saved a position, and the next position was guessed from the *center* of the end tile. When the chain turned at a table edge, the new tile came off the middle of the old one instead of its open end, so tiles didn't touch at the matching pips. The collision check only tested a single point, so tiles could also overlap.
2. **The spinner was always drawn vertical**, even when the chain was running up or down, so its arms grew into the chain.
3. **The play rules were copied three times** (Host play, player play, CPU play), with small differences between the copies.
4. **Round 1 never enforced leading the 6-6**, a blocked round awarded the wrong starter, and the score limit couldn't end the game in the middle of a round.
5. **The board was only about 8 tiles wide** and clipped instead of shrinking.

## What changed

### `src/lib/dominoEngine.js` (rewritten)
- **Stores plays only, not positions:** the board is the list of plays (`{ id, a, b, side, inner, outer, seat, n }`). `layoutBoard()` rebuilds every position from that list each time, so all players see a correct table.
- **Layout rules:**
  - Tiles connect pip-to-pip.
  - Doubles sit crosswise.
  - The spinner opens up and down once both of its sides are covered.
  - Chains turn into neat snakes at the edges.
  - If the chain can't fit, the soft box grows and the board zooms out. Tiles never overlap.
- **One rules reducer** used by the Host page, the player page and the CPU: `newRound()`, `applyPlay()`, `applyPass()`, `resolveBlocked()`.
- **All Fives scoring:**
  - A double on an end counts both halves.
  - Empty spinner arms don't count.
  - A domino scores the other team's pips, rounded to 5.
  - A blocked round goes to the lighter team.
  - Reaching the target with a scoring play ends the game on the spot.
- **Smarter CPU (`chooseAIMove`):** it scores when it can, avoids handing the next opponent points, dumps heavy tiles and doubles, and keeps tiles it can follow with. Its level comes from each Texas Nomad character's `intelligence` trait.

### New table UI
- `src/components/domino/DominoTable.jsx` is new: the whole in-game screen, shared by Host and players:
  - a scoreboard with progress to the target and a live **Count** (gold when it's a multiple of 5)
  - seats around the table (team colors, tile counts, a turn glow, "thinking" dots, "Knock knock!" and "+10" bubbles)
  - your hand, with playable tiles glowing and the others dimmed
  - **glowing ghost tiles** that show exactly where a tile will land
  - score pop-ups, sound effects with a mute button, a round summary that reveals every hand, and a game-over screen with confetti
- **Playing a tile:** if a tile only fits one place, tapping it plays it immediately. If it fits more than one place, you tap the glowing spot you want.
- `DominoBoard.jsx`: auto-fits the chain to the felt, animates each new tile sliding in from the seat that played it, and highlights the last play.
- `DominoTile.jsx`: the TexasNomad front and back art with the crowned-B pips (sized properly and kept upright on sideways tiles).
- `domino.css`: plain CSS with a `tnd-` prefix, so it doesn't depend on Tailwind. The look is a felt table with a leather rail and an orange neon edge.
- **Images now ship with the code:** they're stored locally in `src/components/domino/assets/` instead of being loaded from Base44 media, and resized to load fast.

### Pages
- `src/pages/DominoHost.jsx`:
  - **Create a room:** name, then target score (100 / 150 / 200 / 250).
  - **Resume:** come back to your last room after a refresh.
  - **Lobby:** big room code, a copy-invite-link button, + CPU / Remove / Kick for each seat, and Start (CPUs fill any empty seats).
  - **During the game:** the host plays Seat 1, CPU turns run on the host's screen, and there are Invite and End buttons.
- `src/pages/DominoGame.jsx`:
  - Enter a room code if the link didn't have one.
  - **Pick a seat** (you choose your team), or just watch.
  - Your seat is remembered on this device, and the table works the same as the host's.

### `base44/entities/DominoGame.jsonc`
- Adds `leadTile`, `passes` and `lastPlay`, documents the new board and `roundWinner` shapes, and raises the default `scoreLimit` to 150.
- **Update the entity in Base44** if it rejects unknown fields.

### `scripts/domino-sim.mjs`
- `node scripts/domino-sim.mjs` plays 2,000 CPU games and checks every final board. The result before shipping was 0 illegal moves, 0 overlaps and 0 bad connections.

## Unchanged
- `TXDDomino.jsx` and `BoneyardBox.jsx` aren't used by the new pages. You can leave them in or delete them.
- Routes stay the same: `/games/dominoes/host` and `/games/dominoes?room=CODE`.
- The game still uses the Base44 `DominoGame` entity (the same `filter`, `update` and `subscribe` calls). It's ready to move to the Neon/Railway rooms later, because all the rules now live in the one engine file.

## To take it out of "Under construction"
In `src/pages/Games.jsx`:
```js
const IN_CONSTRUCTION_IDS = ['sudoku', 'see-that', 'word-wrangler'];   // remove 'txd'
```
And update the card copy to match the game:
```js
description: 'Texas-style partners dominoes. Match the pips, score every five on the board, and domino out to take your opponents’ pips. First team to the target wins the table.',
tags: ['4 Players', '2v2 Partners', 'CPU fills seats'],
```
