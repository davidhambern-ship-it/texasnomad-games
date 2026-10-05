// Shared Postgres-backed room snapshots for standalone TNG games.
// Each game keeps a small in-process cache for speed, but Postgres is the
// recovery source after a Railway restart or replacement.

let schemaReady = null;

async function ensureSchema(pool) {
  if (!schemaReady) {
    schemaReady = pool.query(`
      create table if not exists public.tng_live_room_state (
        service text not null,
        room_code text not null,
        room_state jsonb not null,
        updated_at timestamptz not null default now(),
        expires_at timestamptz not null,
        primary key (service, room_code)
      );

      create index if not exists tng_live_room_state_expires_idx
        on public.tng_live_room_state (expires_at);
    `).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
}

export function createLiveRoomStore(pool, {
  service,
  ttlMs,
} = {}) {
  const serviceName = String(service || '').trim();
  const ttl = Math.max(60_000, Number(ttlMs) || 60 * 60 * 1000);

  if (!serviceName) throw new Error('Live room store requires a service name.');

  return {
    async load(code) {
      await ensureSchema(pool);
      const roomCode = String(code || '').trim().toUpperCase();
      if (!roomCode) return null;

      const result = await pool.query(
        `
          select room_state
          from public.tng_live_room_state
          where service = $1
            and room_code = $2
            and expires_at > now()
          limit 1
        `,
        [serviceName, roomCode],
      );

      return result.rows[0]?.room_state || null;
    },

    async save(code, room) {
      await ensureSchema(pool);
      const roomCode = String(code || room?.code || '').trim().toUpperCase();
      if (!roomCode || !room || typeof room !== 'object') return;

      const updatedAt = Number(room.updatedAt || Date.now());
      const expiresAt = new Date(updatedAt + ttl);

      await pool.query(
        `
          insert into public.tng_live_room_state
            (service, room_code, room_state, updated_at, expires_at)
          values ($1, $2, $3::jsonb, to_timestamp($4 / 1000.0), $5)
          on conflict (service, room_code) do update set
            room_state = excluded.room_state,
            updated_at = excluded.updated_at,
            expires_at = excluded.expires_at
        `,
        [
          serviceName,
          roomCode,
          JSON.stringify(room),
          updatedAt,
          expiresAt,
        ],
      );
    },

    async exists(code) {
      await ensureSchema(pool);
      const roomCode = String(code || '').trim().toUpperCase();
      if (!roomCode) return false;

      const result = await pool.query(
        `
          select 1
          from public.tng_live_room_state
          where service = $1
            and room_code = $2
            and expires_at > now()
          limit 1
        `,
        [serviceName, roomCode],
      );

      return Boolean(result.rowCount);
    },

    async count() {
      await ensureSchema(pool);
      const result = await pool.query(
        `
          select count(*)::int as count
          from public.tng_live_room_state
          where service = $1
            and expires_at > now()
        `,
        [serviceName],
      );

      return Number(result.rows[0]?.count || 0);
    },

    async remove(code) {
      await ensureSchema(pool);
      const roomCode = String(code || '').trim().toUpperCase();
      if (!roomCode) return;

      await pool.query(
        `
          delete from public.tng_live_room_state
          where service = $1
            and room_code = $2
        `,
        [serviceName, roomCode],
      );
    },

    async cleanup() {
      await ensureSchema(pool);
      await pool.query(
        `
          delete from public.tng_live_room_state
          where service = $1
            and expires_at <= now()
        `,
        [serviceName],
      );
    },
  };
}
