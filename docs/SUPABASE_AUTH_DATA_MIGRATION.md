# Neon Auth data handoff to Supabase

The application tables have already been copied to the TexasNomadGames Supabase project. This one-time step moves the remaining Better Auth records from the Neon production database into the private `neon_auth` schema in Supabase.

## What this copies

- User records and stable user IDs
- Credential and Google provider account records, including stored password hashes and provider tokens
- Existing session records
- Verification records
- Better Auth signing-key records

The script reads from Neon and writes to Supabase in one destination transaction. It never prints row contents, passwords, password hashes, OAuth tokens, session tokens, or signing keys. It prints only table row counts. It does not delete or modify anything in Neon.

## Run on Windows

1. Download the `migration/off-railway-guest-platform` branch of this repository and extract it.
2. Open PowerShell in the extracted repository folder.
3. Run `npm ci --legacy-peer-deps` once.
4. Run `powershell -ExecutionPolicy Bypass -File .\scripts\migrate-auth-to-supabase.ps1`.
5. At the hidden prompts, paste:
   - The Neon **production** PostgreSQL connection URI.
   - The Supabase **Session pooler** URI for the TexasNomadGames project.
6. Confirm the script reports `"status": "success"` and row counts.

Do not paste either connection URI into chat, GitHub issues, source files, or screenshots. The PowerShell helper asks for both as hidden input and clears the process environment variables when it exits.

## Safety notes

- This is a data-copy operation, not a cutover. Neon remains unchanged.
- The destination tables must already exist in the Supabase `neon_auth` schema.
- Re-running the script is safe for the same source snapshot: rows are upserted by their original IDs.
- The application must not be switched to the new auth service until the self-hosted Better Auth API and sign-in flows have been configured and tested.
