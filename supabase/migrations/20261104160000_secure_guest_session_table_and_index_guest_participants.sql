-- Keep guest session records inaccessible through the public PostgREST API.
-- The server connects through the privileged database role for guest verification.
alter table public.tng_guest_sessions enable row level security;

-- Cover the guest identity foreign key for participant lookups and deletes.
create index if not exists room_participants_guest_id_idx
  on public.room_participants (guest_id);
