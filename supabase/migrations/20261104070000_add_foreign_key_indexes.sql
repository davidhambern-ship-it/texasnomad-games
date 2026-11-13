-- Cover frequently joined foreign-key columns in the TNG game database.
-- These indexes are additive and do not change row contents or constraints.

create index if not exists bff_voice_signals_player_account_idx
  on public.bff_voice_signals (player_account_id);

create index if not exists game_events_actor_account_idx
  on public.game_events (actor_account_id);

create index if not exists game_events_actor_device_idx
  on public.game_events (actor_device_id);

create index if not exists game_invites_room_idx
  on public.game_invites (room_id);

create index if not exists match_participants_account_idx
  on public.match_participants (account_id);

create index if not exists matches_host_account_idx
  on public.matches (host_account_id);

create index if not exists participant_private_state_account_idx
  on public.participant_private_state (account_id);

create index if not exists player_quit_events_account_idx
  on public.player_quit_events (account_id);

create index if not exists room_participants_account_idx
  on public.room_participants (account_id);

create index if not exists room_participants_device_session_idx
  on public.room_participants (device_session_id);

create index if not exists social_notifications_actor_account_idx
  on public.social_notifications (actor_account_id);
