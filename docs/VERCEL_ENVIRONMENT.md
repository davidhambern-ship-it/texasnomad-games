# Vercel migration environment

The Vercel project currently has no configured environment variables. The Node
API/WebSocket function cannot serve database-backed rooms until these are set.

## Required

- `DATABASE_URL`: PostgreSQL connection string for the Neon database/branch
  that this deployment is allowed to use. The server pins SSL to
  `verify-full`.
- `TNG_GUEST_TOKEN_SECRET`: a unique, high-entropy secret used to sign guest
  identity tokens. Use a different value for preview and production.

## Preview vs. production

- Preview deployments for `migration/off-railway-guest-platform` must use an
  isolated Neon branch and a least-privilege role. Do not point previews at the
  production database.
- Production must use the production Neon branch and a separately managed
  secret. Do not reuse preview credentials.
- Do not add actual secret values to GitHub files, issues, or commit messages.

## Optional

- `TNG_API_ORIGIN` and `NEON_AUTH_ORIGIN` default to the currently configured
  Neon API and Neon Auth endpoints.
- `TNG_LIVE_ALLOWED_ORIGINS` can add explicit browser origins. Vercel's
  `VERCEL_URL` and `VERCEL_BRANCH_URL` are already recognized for preview
  requests.

See `.env.example` for variable names and placeholder formats.
