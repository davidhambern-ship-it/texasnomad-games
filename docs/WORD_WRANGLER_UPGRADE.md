# Word Wrangler upgrade

Word Wrangler is rebuilt from scratch. It no longer uses Base44 (which is retired and returned 405 errors).

## How it plays
- **Trace any real English word** by dragging through touching tiles; diagonals count.
  - On a phone you can also tap the tiles one by one, then tap the last tile again to play the word.
- **Scoring:** a word scores the sum of its letter values × a length bonus × 10.
  - Length bonus: 3 letters ×1, 4 ×1.5, 5 ×2, 6 ×2.5, 7 ×3, 8 ×4, and up to ×8 for longer words.
  - Each word only scores once per game.
- **Falling tiles:** used tiles vanish, the column drops, and new tiles fall in. The board keeps its mix of vowels balanced and limits how many hard letters it shows at once.
- **Look:** gold tiles on a dark wood board. A burning rope fuse wrapped around the board is the timer; when the flame reaches the TNG powder keg at the top, time's up.
- **Special tiles are precious stones** set in gold:

  | Gem | Effect |
  |---|---|
  | Emerald | ×2 |
  | Ruby | ×3 |
  | Diamond | ×4 |
  | Sapphire | +10 s on the rope in Solo Rush, or +50 points in races |
  | Amethyst | wild (any letter) |
  | Topaz | blasts its row for bonus points |
  | Opal | reveals the best word on the board |
  | Outlaw (not a gem) | sneaks down one row per word; catch him for +50, or he robs 100 points at the bottom |

  - A 5-letter word drops an Emerald, 6 letters a Ruby, 7+ a Diamond (plus an Amethyst).
  - 3-letter words can call in Outlaws.
- **Modes:**
  - **Solo Rush:** 2:30 on the clock, with a saved personal best.
  - **Vs CPU:** six Texas Nomad rivals, from Tank (level 3) to Berna (level 9).
  - **Online Race:** up to 8 players, CPUs allowed, races of 1:30, 2:30 or 4:00.

## Files
| File | What it is |
|---|---|
| `src/lib/wordWranglerEngine.js` | Shared rules engine (browser + server). Deterministic from a seed: the same seed gives the same board and the same stream of falling letters. |
| `src/lib/wordWranglerDict.js` | Loads the dictionary once per page. |
| `public/word-wrangler/words.txt` | 102,542 playable words (3–12 letters). Built from the en_US Hunspell dictionary, with abbreviations, Roman numerals and slurs/obscenities removed. |
| `public/word-wrangler/cpu.txt` | Everyday words the CPU rivals pick from. |
| `src/pages/WordWranglerGame.jsx` | Menu → Solo / Vs CPU / Online. |
| `src/components/wordWrangler/WWBoard.jsx` | Tile grid: drag or tap to trace, drop and pop animations, trace line. |
| `src/components/wordWrangler/WWPlay.jsx` | One player's play screen: HUD, word preview, effects, word list. |
| `src/components/wordWrangler/WWSolo.jsx` | Solo Rush and Vs CPU. |
| `src/components/wordWrangler/WWOnline.jsx` | Online race: host/join, lobby, race, results. |
| `src/components/wordWrangler/WWRope.jsx` | The burning-rope timer around the board. |
| `src/components/wordWrangler/WWShared.jsx`, `WWIcons.jsx`, `ww.css` | Shared bits, gem artwork, styles (plain CSS, `ww-` prefix). |
| `src/api/wordWranglerApi.js` | Client for the race server. |
| `server/wordWranglerApi.mjs` | Race rooms at `/ww-api`. Each player's moves are replayed with the engine, so scores can't be faked. Rooms live in memory. |
| `server.mjs` | Adds the `/ww-api` route and the `x-ww-token` CORS header. |
| `src/pages/Games.jsx` | The card leaves "Under construction" and opens the new menu. |
| `src/pages/JoinRoom.jsx` | The central Join page recognises Word Wrangler codes. |
| `scripts/word-wrangler-sim.mjs` | `node scripts/word-wrangler-sim.mjs`: 100 CPU games and 4,000 moves, checking legality and that the server replay matches. |

## No longer used
These files can be deleted whenever you like; nothing imports them now:
- `src/lib/wordWranglerWordGenerator.js`
- `src/lib/wordWranglerUtils.js`
- `src/components/wordWrangler/WordBoard.jsx`, `PlayerPanel.jsx`, `TargetWordDisplay.jsx`, `GameControls.jsx`, `WordList.jsx`

`src/lib/wordWranglerSound.js` is still used for the sounds.

## Health check
After Railway redeploys: `https://tng-live-production.up.railway.app/ww-api/health` → `{"ok":true,...}`
