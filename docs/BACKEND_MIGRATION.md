# TNG Backend Migration

This migration replaces Base44 as the authority for identity, profiles, Host
sessions, Game Displays, live rooms, private hands, game events, and statistics.
It is intentionally incremental so current games can remain online while each
one moves to the new room protocol.

## Current safety boundary

- Base44 backend functions and Base44 AI integrations are off by default.
- Set `VITE_ENABLE_BASE44_FUNCTIONS=true` only as a deliberate temporary rollback.
- Existing Base44 entity traffic remains in place until each game is migrated.
- `VITE_TNG_BACKEND_ENABLED` remains off until authentication and the Neon
  migration are configured in the target environment.
- No browser code receives `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, or the
  display pairing secret.

## Provisioned development infrastructure

- Neon project: `TexasNomad Games`
- Project ID: `broad-feather-94902280`
- Production branch: `production` (`br-spring-moon-avh3z3j8`)
- Development branch: `development` (`br-polished-glade-avfsrygs`)
- The initial schema is applied only to `development`.
- Managed Better Auth is enabled only on `development`.
- Google shared OAuth credentials are available for development testing.
- `http://localhost:5173` is registered as a development trusted domain.

Production remains intentionally empty until the development flow passes
end-to-end verification. Production Google sign-in will require TNG-owned
Google OAuth credentials so players see TexasNomad Games—not Neon—on Google's
consent screen.

## Invariants enforced by Postgres

1. A Host account can have only one active Host session.
2. A Host Controller can control only one active Host session.
3. A Game Display can belong to only one active Host session.
4. A Host session can own only one active live room.
5. Active room codes are unique.
6. A person can occupy only one seat in a room.
7. Public display state and private player state are stored separately.
8. Every applied command has a unique command ID and room revision.
9. Profiles are created once during onboarding; the profile endpoint does not
   provide an edit operation.

These rules are enforced by partial unique indexes and transactions, not only
by UI checks.

## API foundation

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `GET /api/health` | None | Confirms the API can reach Postgres. |
| `GET /api/profile` | Account JWT | Returns the locked TNG profile and generated statistics. |
| `POST /api/profile` | Account JWT | Creates the one-time TNG display name and unique handle. |
| `POST /api/device-session` | Account JWT | Registers a player, spectator, or Host Controller device. |
| `POST /api/host/session` | JWT + controller ID | Starts or resumes the account's only active Host session and returns any active room. |
| `DELETE /api/host/session` | JWT + controller ID | Ends the Host session, abandons any active room, and disconnects the paired display. |
| `POST /api/host/pairing` | JWT + controller ID | Generates a ten-minute Game Display pairing code. |
| `POST /api/display/pair` | One-time pairing code | Creates a restricted Game Display session and token. |
| `POST /api/host/room` | JWT + controller ID | Creates the Host session's only active room after a display is connected. |
| `DELETE /api/host/room` | JWT + controller ID | Releases the active room while keeping the Host Controller and display paired. |

Controller requests use the `X-TNG-Device-Id` header. Display tokens are random,
stored only as SHA-256 hashes, and never grant Host Controller authority.

## Phase 3 development status

The `codex/neon-backend-foundation` branch now contains the Host Controller and
Game Display wiring behind `VITE_TNG_BACKEND_ENABLED`:

- Google sign-in preserves the requested return path through TNG onboarding.
- `/host` uses the Neon Host Controller flow when the migration flag is enabled
  and preserves the legacy Base44 Host Panel when it is disabled.
- Host Controller devices start or resume the account's single active Host session.
- `/display` accepts the six-digit pairing code and creates the restricted Game
  Display session.
- The Host Panel remains locked until a Game Display is paired.
- Room creation is server-owned and automatically generates the room code.
- Reloading the Host Panel recovers its active room from Postgres.
- A second active room is rejected by both API checks and Postgres constraints.
- Disconnecting a room releases the room while keeping the display paired.
- Signing out ends the Host session and disconnects the display server-side.

Production is still untouched. End-to-end browser verification requires a
server-function environment (for example, a Vercel preview) configured with the
Neon development credentials and `VITE_TNG_BACKEND_ENABLED=true`.

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Use a pooled Neon URL for `DATABASE_URL`.
3. Use a direct Neon URL for `DATABASE_URL_UNPOOLED`.
4. Configure the authentication provider's JWKS URL, issuer, and audience.
5. Generate a random `TNG_PAIRING_SECRET` containing at least 32 characters.
6. Run `npm run db:check`.
7. Run `npm run db:migrate` against a Neon development branch.
8. Verify `GET /api/health` before turning on `VITE_TNG_BACKEND_ENABLED`.

Do not apply the first migration directly to production. Test it on a Neon
branch, then promote the same migration after the API and authentication flow
pass end-to-end verification.

## Migration sequence

1. Connect Neon and configure the authentication provider.
2. Build the new sign-in and one-time TNG profile onboarding flow.
3. Connect the Host Controller registration and Game Display pairing UI.
4. Migrate one simple community game to the revisioned room/event API.
5. Add match finalization and server-produced player/Host statistics.
6. Migrate Spades and Dominoes with private-hand delivery to the controller.
7. Migrate all remaining Base44 entity reads and writes.
8. Remove the Base44 SDK, Vite plugin, schemas, and functions only after the
   final active game has moved.

## Commands

```bash
npm run test:backend
DATABASE_URL_UNPOOLED='...' npm run db:generate
DATABASE_URL_UNPOOLED='...' npm run db:check
DATABASE_URL_UNPOOLED='...' npm run db:migrate
npm run build
```
