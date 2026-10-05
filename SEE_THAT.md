# See That?! — hidden-object party game

This version is rebuilt from scratch. It doesn't use Base44 and it doesn't use emoji stickers.

## How it plays
- **Host:** open `/games/see-that` on the TV or a laptop and choose **Host a game**. Pick the scene, how many objects, the time limit and the number of rounds.
- **Players:** on a phone, go to `/games/see-that` and enter the 5-letter code. The central TNG Join page also accepts the code.
- **During a round:**
  - The scene shows on the big screen and on every phone.
  - Players pinch or scroll to zoom and drag to pan.
  - The first tap inside an object claims it: **+100**, plus **+25** for each back-to-back find made within 8 seconds (up to +100).
  - **Hints:** 2 per round. Each one draws a ring roughly around a remaining object and costs 25 points.
  - **Misclicks:** a miss costs 10 points and locks the player out for 1.5 s. Three misses within 6 s locks them out for 5 s.
- **Round results:** the big screen circles every find in the finder's colour and shows the missed objects in red. After the last round it shows a podium.
- **Practice solo:** the same rules on one device, with no room.
- **Read-only big screen:** `/games/see-that?display=CODE` shows a game without the host controls. It can be embedded in the TNG Game Display the same way VIRAL is.

## New layout every game
Scenes are **dynamic**. The picture is just the background; each game the server picks the objects to hunt plus some decoys from the TNG object library and drops them onto random **spots** (tabletops, benches, planters, floor…). Each object is sized for its spot, tinted to the local light and given a soft shadow.

- Every round, and every time you leave and come back, gives a new layout. The server remembers the last layout for each scene and won't reuse a spot within about 5% of the picture width, which is 84 px on the mall picture.
- Everyone in a room sees the identical layout, and the server checks every tap against it.
- Decoys are library objects that aren't on the list. Tapping one counts as a miss.
- **Difficulty** (host setting):

  | Setting | Object size | Decoys | Objects favoured |
  |---|---|---|---|
  | Easy | bigger | 4 | easy ones |
  | Normal | normal | 8 | a mix |
  | Hard | smaller | 12 | hard ones |

- Practice solo also never repeats the last layout on that device.

### Object library — `public/see-that/objects/`
`objects.json` lists every sprite and its fields:

| Field | What it is |
|---|---|
| `name` | Shown in the list players hunt from. |
| `difficulty` | easy / medium / hard. |
| `rel` | Relative real-world size; for example a backpack is 1.7 and a coin is 0.55. |
| `family` | Look-alikes, such as the three star coins, share a family and never appear in the same game. |

There are 50 objects, cut from your asset sheet. To add more, send me another asset sheet and I'll cut and add them.

## Adding scenes (made with GPT)
1. Generate a background picture with **no** hidden objects, just a busy place with lots of surfaces. Landscape works best, about 2000 px wide if you can.
2. Open `/games/see-that` → **Scene editor** and drop the picture in. Keep **"Game places them"** selected.
3. Drag a box over each surface where an object could sit (tabletops, shelves, benches, planter rims, open floor). Objects stand with their bottom inside the box.
   - Use the size slider so the preview object looks the right size at that spot. Things further away should be smaller.
   - Aim for **20+ spots**.
4. Click **Test play** a few times; each game lays out differently.
5. Click **Download scene files** and upload the `.jpg` and `.json` to `public/see-that/scenes` in GitHub.

The editor can still handle pictures with objects painted into the art: choose **"Painted in the picture"** and box each object. Those scenes always keep the same object positions, though, so prefer the dynamic kind.

### GPT prompt template (background)
> A richly detailed scene for a hidden-object game: **[a busy Texas Nomad Games mall food court seen from above]**. Wide landscape, warm cinematic lighting, painterly-realistic style, lots of tables, benches, shelves, counters and open floor where small items could sit. Keep the surfaces fairly uncluttered so objects can be placed on them later.

Tips:
- A slightly high camera angle (looking down at tables and floor) gives the most usable spots.
- Avoid having the background already contain objects from the library, such as dice or poker chips lying around, or players will tap those.

## Files
| File | What it is |
|---|---|
| `src/lib/seeThatEngine.js` | Shared rules: hit testing, claims, combos, hints, misclick lockouts. |
| `server/seeThatApi.mjs` | Party rooms at `/st-api`. Every tap is checked against the scene boxes on the server. Rooms live in memory. |
| `server.mjs` | Adds the `/st-api` route and the `x-st-token` CORS header. |
| `src/pages/SeeThatGame.jsx` | Menu, host, join, display, practice and editor. |
| `src/components/seeThat/STSceneView.jsx` | Zoom/pan scene viewer with tap detection and markers. |
| `src/components/seeThat/STBigScreen.jsx` | TV view: lobby, live round, results, podium. |
| `src/components/seeThat/STPhone.jsx` | Phone hunting screen. |
| `src/components/seeThat/STOnline.jsx` | Host / display / player room flows. |
| `src/components/seeThat/STPractice.jsx` | Solo practice. |
| `src/components/seeThat/STEditor.jsx` | Scene editor. |
| `src/components/seeThat/st.css`, `stSfx.js` | Styles (`st-` prefix) and sound effects. |
| `src/api/seeThatApi.js` | Client for `/st-api`. |
| `public/see-that/scenes/` | Scenes: `tng-mall.jpg/.json` (34 spots) and `index.json`, an offline fallback list you don't need to edit. |
| `public/see-that/objects/` | The object library: 50 sprites (.webp) plus `objects.json`. |
| `src/components/seeThat/stCompose.js` | Builds each round's picture in the browser: background plus placed objects, with lighting tint and shadow. |

## No longer used
These files can be deleted whenever you like; nothing imports them now:
- `src/components/seeThis/SaloonBackground.jsx`
- `src/components/host/panels/SeeThatHostPanel.jsx` (old host-console panel). The host console still imports this file, so leave it until the Host Panel is wired to the new game.

## Health check
`https://tng-live-production.up.railway.app/st-api/health` → `{"ok":true,..., "scenes":1}`

The old drawn "Saloon Back Room" starter scene is retired because its objects were painted in and couldn't move.
