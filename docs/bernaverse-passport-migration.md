# TNG → BERNAverse Passport: safe unification plan
Status: audit started 2026-10-18. NO production cutover authorized by this document.

## Goals
- A single user-facing BERNAverse Passport login for TNG, TacTalk and CREAPD.
- Preserve existing TNG user IDs, player profiles, handles, friendships, game history, stats, room metadata, scores, and paid/subscription entitlements.
- No duplicate passwords or automatic creation of separate Neon Auth users.
- Avoid additional subscriptions or unapproved costs.
- Verify Chrome/Android tablet and Safari on real devices before release.

## Verified live inventory (2026-10-18)
- TNG public site: texasnomadgames.com; API/auth server: auth.texasnomadgames.com.
- TNG's live auth/API server on Railway: project `TexasNomad Games Temp Staging`, service `tng-live`. Runtime runs an **older pinned branch commit** `a601db51a56c869c3eb1e4aaab67c844a7085b0a` on `fix/tng-browser-branding`. GitHub main pushes are NOT proof that auth runtime updated.
- Neon project `broad-feather-94902280`, branch `br-spring-moon-avh3z3j8` (production); both production and development branches show `archived`.
- Neon rejects production SQL read and Neon Auth session calls with HTTP 402 `Your account or project has exceeded the quota`. Usage period ends 2026-11-01T00:00:00Z. Do not assume DB reads or exports are possible before quota is restored.
- Neon production branch reported approx. 35,004,416 bytes logical size. This is NOT a table-row inventory.
- In-project point-in-time safety branch **created and verified READY**: `pre-migration-safety-2026-10-18`, id `br-crimson-union-av3h1pxe`, parent production, parent timestamp 2026-10-13T16:24:41Z, **no compute attached**. Treat this as a second in-Neon recovery point, NOT an independent/off-provider export. Preserve it and production.
- BERNAverse + TacTalk existing Supabase project `emexrsuuazbowxxwvalj` ACTIVE_HEALTHY. Existing schemas `bernaverse` and `public` (TacTalk); no dedicated TNG schema yet. Existing centralized members, identities, wallets, memberships and SSO tickets. No data migration performed.
- The live failure was traced in Railway logs to TNG `/neon-auth/get-session` 402 and account creation 402 **after the Supabase SSO ticket was consumed**.
- Code: `src/lib/neonAuth.js` uses Neon Auth BetterAuth client. `server.mjs` proxies Neon Auth and handles BERNAverse one-time ticket callbacks. `server.mjs` owns many Postgres operations. Game modules `server/roomRegistry.mjs` and `server/liveRoomStore.mjs` reference additional state tables.
- At least these Neon tables appear in live-branch server code: `public.accounts`, `public.player_profiles`, `public.player_game_stats`, `public.game_rooms`, `public.room_participants`, `public.host_sessions`, `public.device_sessions`, `public.tng_domino_games`, `public.tng_game_result_events`, `public.tng_room_registry`, `public.tng_live_room_state`, `public.display_pairings`, `public.player_quit_events`, `public.legacy_player_stats`, `public.bff_surveys`, `public.bff_dysfunction_prompts`, `public.tng_test_feedback`. This is NOT a complete schema inventory.

## Safe implementation phases
1. **Freeze and inventory.** Keep both Neon branches and the GitHub live commit. Review all TNG SQL and service routes, include every imported game module, identify exact schema, key constraints, row counts and external dependencies once database reads recover. Assess Supabase available limits before importing. No destructive queries.
2. **Export independently.** When Neon read access is restored, take a real off-Neon logical/schema+data backup, including Neon Auth user/session mapping and all game tables; secure backup outside public repositories and verify restore into disposable isolated destination. Never transfer plaintext passwords. Record migration totals, duplicates, row counts and checksums.
3. **Introduce central auth in isolated branch.** BERNAverse Supabase Auth is identity authority. TNG accepts a short-lived, server-validated Passport assertion and mints a first-party HTTP-only TNG session without a Neon Auth sign-up or password forwarding. Use server-side anti-CSRF, restricted origin/return targets, expiry, single-use handoff and session revocation. Keep session/auth endpoints compatible with existing UI where safe.
4. **Migrate gameplay database** to clearly isolated TNG tables/schema (new Supabase project ONLY if user approves actual cost/need; existing Supabase preferred after capacity/security review). Preserve original TNG IDs and usernames, use mapping to BERNAverse member UUID. Preserve rewards/wallet ownership and RLS. Update every SQL route and live-game store, not just login.
5. **Stage, test and reconcile.** Migration rehearsal on isolated environment; new vs legacy member sign-in; Chrome Android tablet, Safari desktop/mobile, Host/Display/Player, logout, reconnect, account linking, stats, scores, room recovery and subscriptions; compare row counts and game results before any cutover.
6. **Cut over carefully.** Snapshot last live writes, apply delta, switch service via controlled deployment with rollback, observe sign-in and game flows. Do not disable Neon or remove old data until measured stability and explicit user approval.
7. **Simplify user-facing experience.** BERNAverse Passport one login, connected-app dashboard, no redirect surprises, no extra per-app signups, explicit account recovery.

## Operational constraints / blockers
- A free-plan quota is already exhausted; Neon SQL + Auth calls report HTTP 402. A no-compute branch was possible, but data extraction and real migration are blocked until Neon DB access is restored.
- Previous attempt to change Neon suspension interval was rejected with HTTP 412 ("modifying the suspend interval is not permitted on this account"). No billing changes should be made without user approval.
- Do not equate Supabase one-time ticket consumption with successful browser login.
- The TNG live Railway source is not tracking latest main; shipping code requires deliberate deployment and careful comparison with current repo.
- No credentials, secrets, personal member data, database dumps or password hashes in GitHub.

## User actions
- At present, **none** needed for safe audit and branch-based code preparation.
- Do NOT delete Neon projects/branches, pay for an upgrade, rotate secrets, or reset players without agreeing a specific migration step first.
- Later: the user will be asked to test sign-in on tablet and Safari when the staging path is genuinely functional, not before.
