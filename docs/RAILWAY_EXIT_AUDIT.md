# TexasNomad Games — Railway Exit Audit

Branch: `migration/off-railway-guest-platform`

## Confirmed deployment state

- Vercel project: `texasnomad-games` (Vite frontend).
- The current Vercel preview is not production and must not be promoted while its API/WebSocket origin points to the unavailable Railway service.
- Browser API and WebSocket origin defaults to `https://auth.texasnomadgames.com` in `src/lib/tngServiceOrigin.js`.
- `server.mjs` is a long-running Node HTTP server with WebSocket upgrade handlers. It is not a Vercel static build or a drop-in Vercel Function.
- The server depends on Node HTTP, filesystem access, `pg`, `ws`, and in-process maps for display targets and other live coordination.
- Neon is an independent database/auth provider and must be preserved; no production schema or data was changed in this audit.

## Current catalog audit

The current `src/pages/Games.jsx` catalog contains 16 entries:

### Shown as available (11)
- Word Search
- Square Biz!
- BFF
- Hangman
- Spades
- Sudoku
- See THAT?!
- Word Wrangler
- Rodeo Rumble
- VIRAL!
- TexasNomad Dominoes (catalog id: `txd`)

### Explicitly marked under construction (5)
- UNO
- Poker
- Bowling
- Snake
- Phase 10

The catalog therefore currently exposes 11 available entries, not 12. This is a source-code finding, not a judgment that the games above have all passed live multiplayer tests. The intended 12-game lineup must be reconciled against the actual game modules before release; do not silently invent or substitute a title.

## Guest-first work already present on this branch

The branch is four commits ahead of `main` and includes:
- Signed guest identity tokens in `server/guestIdentity.mjs`.
- Guest identity unit tests.
- A guest identity issue route and shared identity resolution foundations in `server.mjs`.
- CORS support for `x-tng-guest-token`.

The frontend still has an account-only gate in `src/App.jsx`; `JoinRoom.jsx` redirects guests to login and creates account-owned player devices. `src/api/tngApi.js` does not yet attach guest identity tokens. This branch is not yet guest-playable end to end.

## Hosting decision and constraints

The existing backend must retain its HTTP API and WebSocket behavior while moving off Railway. A plain static Vercel deployment cannot host this server. A full rewrite into isolated serverless routes would be a high-risk way to preserve the existing game rules.

Cloudflare Containers are the closest identified fit for running the existing Node server with minimal application changes; Durable Objects are also a viable coordination primitive for room-scoped WebSockets. Cloudflare documentation states Containers are generally available, but Container use incurs Workers, Durable Objects, compute, storage, and egress billing. The connected Cloudflare account currently reports the standard Workers usage model; the OAuth connection does not grant Billing Read access, so paid-plan entitlement and cost cannot be verified here. No paid resource was created.

## Release blockers

1. Establish an approved, cost-verified runtime for the existing Node/WebSocket backend.
2. Make room/presence/display coordination durable or room-affine; current in-process maps cannot be assumed to survive instance replacement.
3. Complete the frontend guest path from public entry through room creation/join, host authorization, reconnect, and game actions.
4. Audit/remove BERNAverse SSO/signup coupling as required; do not break unrelated Neon Auth flows without tests.
5. Reconcile the 12-game release list against source modules and route handlers.
6. Run build, lint, typecheck, game simulations, release audit, and live multiplayer smoke tests.
7. Only after successful tests, switch API/WebSocket routing and then production DNS. Preserve email/MX records.

## Safety

No production deployment was promoted, no DNS records were changed, no Railway service was restarted, and no Neon production schema/data was modified during this audit.
