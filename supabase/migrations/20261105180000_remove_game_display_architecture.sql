-- Retire the separate Game Display device and pairing architecture.
-- Shared game rooms continue to use host_sessions.controller_device_id and
-- device_sessions for the actual host/player connections.

DROP TABLE IF EXISTS public.display_pairings;

ALTER TABLE public.host_sessions
  DROP CONSTRAINT IF EXISTS host_sessions_display_device_id_fkey;
DROP INDEX IF EXISTS public.host_sessions_one_active_per_display;
ALTER TABLE public.host_sessions
  DROP COLUMN IF EXISTS display_device_id;

-- Remove orphaned second-screen devices before retiring the enum value.
DELETE FROM public.device_sessions
WHERE role::text = 'game_display';

ALTER TABLE public.device_sessions
  DROP CONSTRAINT IF EXISTS device_sessions_display_identity;
ALTER TABLE public.device_sessions
  DROP CONSTRAINT IF EXISTS device_sessions_identity_owner_check;

-- PostgreSQL enum values cannot be dropped in place; rebuild the enum without
-- game_display while preserving all remaining role values.
CREATE TYPE public.connection_role_without_display AS ENUM (
  'player',
  'host_controller',
  'spectator'
);

ALTER TABLE public.device_sessions
  ALTER COLUMN role TYPE public.connection_role_without_display
  USING role::text::public.connection_role_without_display;

DROP TYPE public.connection_role;
ALTER TYPE public.connection_role_without_display
  RENAME TO connection_role;

ALTER TABLE public.device_sessions
  ADD CONSTRAINT device_sessions_identity_owner_check
  CHECK (
    role::text IN ('player', 'host_controller', 'spectator')
    AND (
      (account_id IS NOT NULL AND guest_id IS NULL)
      OR
      (account_id IS NULL AND guest_id IS NOT NULL)
    )
  );
