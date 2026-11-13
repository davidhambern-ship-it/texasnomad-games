-- Guest-first TNG identity schema.
-- Applied and verified against Supabase project ngzrthwhjwtayhhwintc on 2026-11-04.
-- Additive/compatible: existing account-owned rows remain valid and unchanged.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tng_guest_sessions (
  guest_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS tng_guest_sessions_expires_idx
  ON public.tng_guest_sessions (expires_at);

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.device_sessions
  ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.device_sessions
  DROP CONSTRAINT IF EXISTS device_sessions_display_identity;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sessions_identity_owner_check') THEN
    ALTER TABLE public.device_sessions
      ADD CONSTRAINT device_sessions_identity_owner_check
      CHECK (
        (role = 'game_display'::connection_role AND account_id IS NULL AND guest_id IS NULL)
        OR
        (role IN ('player'::connection_role, 'host_controller'::connection_role, 'spectator'::connection_role)
          AND (
            (account_id IS NOT NULL AND guest_id IS NULL)
            OR
            (account_id IS NULL AND guest_id IS NOT NULL)
          ))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sessions_guest_id_fk') THEN
    ALTER TABLE public.device_sessions
      ADD CONSTRAINT device_sessions_guest_id_fk
      FOREIGN KEY (guest_id) REFERENCES public.tng_guest_sessions(guest_id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS device_sessions_guest_idx
  ON public.device_sessions (guest_id);

ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.room_participants
  ALTER COLUMN account_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_participants_identity_owner_check') THEN
    ALTER TABLE public.room_participants
      ADD CONSTRAINT room_participants_identity_owner_check
      CHECK (
        (account_id IS NOT NULL AND guest_id IS NULL)
        OR
        (account_id IS NULL AND guest_id IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_participants_guest_id_fk') THEN
    ALTER TABLE public.room_participants
      ADD CONSTRAINT room_participants_guest_id_fk
      FOREIGN KEY (guest_id) REFERENCES public.tng_guest_sessions(guest_id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS room_participants_guest_unique
  ON public.room_participants (room_id, guest_id)
  WHERE guest_id IS NOT NULL;

ALTER TABLE public.host_sessions
  ADD COLUMN IF NOT EXISTS guest_host_id text;
ALTER TABLE public.host_sessions
  ALTER COLUMN host_account_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'host_sessions_identity_owner_check') THEN
    ALTER TABLE public.host_sessions
      ADD CONSTRAINT host_sessions_identity_owner_check
      CHECK (
        (host_account_id IS NOT NULL AND guest_host_id IS NULL)
        OR
        (host_account_id IS NULL AND guest_host_id IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'host_sessions_guest_host_id_fk') THEN
    ALTER TABLE public.host_sessions
      ADD CONSTRAINT host_sessions_guest_host_id_fk
      FOREIGN KEY (guest_host_id) REFERENCES public.tng_guest_sessions(guest_id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS host_sessions_one_active_per_guest_host
  ON public.host_sessions (guest_host_id)
  WHERE guest_host_id IS NOT NULL
    AND status IN ('pairing'::host_session_status, 'ready'::host_session_status, 'live'::host_session_status);

COMMIT;
