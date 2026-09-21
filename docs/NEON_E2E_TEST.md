# TNG Neon End-to-End Test

This test exercises the replacement TNG account, Host Controller, Game Display,
and room lifecycle without changing the production site.

## Start the development frontend

From the `codex/neon-backend-foundation` branch:

```bash
npm install
npm run dev:neon
```

Open:

```text
http://localhost:5173
```

The `neon` Vite mode automatically enables:

- Neon Auth / Google sign-in
- the deployed Neon `tngapi` Function
- the replacement Host Controller flow
- the Game Display pairing screen
- Base44 backend functions disabled for the migrated flow

The public URLs live in `.env.neon`; no database password or pairing secret is
stored in the browser configuration.

## Test 1 — TNG account and locked profile

1. Open `/host`.
2. Choose **Sign In To Host**.
3. Sign in with Google.
4. On a first-time account, complete TNG onboarding:
   - choose the TNG username/display identity requested by the form
   - choose Host or Player as appropriate
5. Confirm onboarding returns to `/host`, not the home page.
6. Refresh the page and confirm the same profile is restored.

Expected: the profile is read from Neon/Postgres and is not a customizable
social profile.

## Test 2 — Host Controller registration

1. Enter the existing Host Panel access password.
2. Wait for the Host Controller to initialize.

Expected:

- this browser is registered as a `host_controller`
- a Host session is created or resumed
- the Host Panel shows the Game Display pairing step unless a display is already
  paired

## Test 3 — Pair the Game Display

1. Keep the Host Panel open.
2. Open a second browser window/device at:

   `http://localhost:5173/display`

   If testing on a second physical device, expose the Vite dev server on the
   local network first; localhost refers to the device itself.
3. Enter the six-digit code shown by the Host Panel.

Expected:

- the Display reports **Game Display Ready**
- the Host Panel automatically changes to **Host System Ready**
- the Host cannot create a room before the display is paired

## Test 4 — Create the live room

1. Choose a game from the Host Panel.
2. Wait for the room code.

Expected:

- the room code is created by the Neon backend
- the Host Panel changes to **LIVE ROOM ACTIVE**
- refreshing the Host Panel restores the same active room

## Test 5 — Hard one-room rule

While the first room is still active, attempt another room creation from the
same Host session/controller.

Expected:

- the backend refuses the second room with `HOST_ROOM_ALREADY_ACTIVE`
- the existing room remains the authoritative active room
- a UI workaround cannot bypass the Postgres constraint

## Test 6 — Release and create again

1. Click **Disconnect Room**.
2. Confirm the Host returns to the ready/game-select state.
3. Create another room.

Expected:

- the old room becomes abandoned/inactive
- the Host Controller and Display stay paired
- a new room can now be created successfully

## Test 7 — Host sign-out cleanup

1. Sign out from the Host Panel.
2. Sign back in and return to `/host`.

Expected:

- the prior Host session was ended server-side
- any active room was abandoned
- the old Game Display session was disconnected
- a fresh Host session begins cleanly

## Backend verification

The GitHub workflow `Build Neon TNG API` performs a live smoke test against the
deployed Neon Function before bundling. It requires both:

```json
{"status":"ok","database":"connected"}
```

Production remains untouched until this checklist passes.
