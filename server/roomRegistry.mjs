// Universal TNG room registry.
//
// New standalone games reserve their public room code here before exposing it.
// The resolver also backfills older rooms from the existing TNG tables so the
// migration does not strand rooms created before this registry existed.

let schemaReady = null;

const CORE_GAME_PATHS = {
  bff: '/games/bff',
  'square-biz': '/games/square-biz',
  hangman: '/games/hangman',
  spades: '/games/spades',
  'word-search': '/games/word-search',
};

function cleanCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : '';
}

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

async function ensureSchema(pool) {
  if (!schemaReady) {
    schemaReady = pool.query(`
      create table if not exists public.tng_room_registry (
        room_code text primary key,
        game_id text not null,
        service text not null,
        room_kind text not null,
        join_path text not null,
        spectate_path text,
        host_account_id uuid,
        status text not null default 'live',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        expires_at timestamptz
      );

      create index if not exists tng_room_registry_service_idx
        on public.tng_room_registry (service, status);

      create index if not exists tng_room_registry_expires_idx
        on public.tng_room_registry (expires_at);
    `).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
}

function serialize(row) {
  if (!row) return null;
  return {
    roomCode: row.room_code,
    gameId: row.game_id,
    service: row.service,
    kind: row.room_kind,
    joinPath: row.join_path,
    spectatePath: row.spectate_path || null,
    status: row.status || 'live',
    hostAccountId: row.host_account_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    expiresAt: row.expires_at || null,
  };
}

export function createRoomRegistry(pool) {
  async function cleanupCode(code) {
    await ensureSchema(pool);
    await pool.query(
      `delete from public.tng_room_registry
       where room_code = $1
         and expires_at is not null
         and expires_at <= now()`,
      [code],
    );
  }

  async function loadRegistry(code) {
    await ensureSchema(pool);
    await cleanupCode(code);

    const result = await pool.query(
      `select
         room_code, game_id, service, room_kind, join_path, spectate_path,
         host_account_id, status, created_at, updated_at, expires_at
       from public.tng_room_registry
       where room_code = $1
         and status = 'live'
       limit 1`,
      [code],
    );

    return result.rows[0] || null;
  }

  async function loadCoreRoom(code) {
    const result = await pool.query(
      `select
         gr.room_code,
         gr.game_id,
         gr.status::text as status,
         (
           select rp.account_id
           from public.room_participants rp
           where rp.room_id = gr.id
             and rp.left_at is null
             and rp.role::text in ('host_player', 'host')
           order by rp.joined_at asc
           limit 1
         ) as host_account_id,
         gr.created_at,
         gr.updated_at,
         gr.completed_at
       from public.game_rooms gr
       where gr.room_code = $1
       order by gr.created_at desc
       limit 1`,
      [code],
    ).catch(() => ({ rows: [] }));

    const row = result.rows[0] || null;
    if (!row) return null;

    const status = String(row.status || '').toLowerCase();
    if (
      row.completed_at ||
      ['completed', 'closed', 'ended', 'finished'].includes(status)
    ) {
      return null;
    }

    const basePath = CORE_GAME_PATHS[row.game_id];
    if (!basePath) return null;

    return {
      room_code: row.room_code,
      game_id: row.game_id,
      service: 'core',
      room_kind: 'core',
      join_path: `${basePath}?room=${encodeURIComponent(row.room_code)}&neon=1`,
      spectate_path: `/spectate/${encodeURIComponent(row.room_code)}`,
      host_account_id: row.host_account_id || null,
      status: 'live',
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      expires_at: null,
    };
  }

  async function upsertDiscovered(room) {
    const code = cleanCode(room?.room_code || room?.roomCode);
    if (!code) return null;

    await ensureSchema(pool);

    const result = await pool.query(
      `insert into public.tng_room_registry
        (room_code, game_id, service, room_kind, join_path, spectate_path,
         host_account_id, status, expires_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::uuid, 'live', $8, now())
       on conflict (room_code) do update set
         game_id = excluded.game_id,
         service = excluded.service,
         room_kind = excluded.room_kind,
         join_path = excluded.join_path,
         spectate_path = excluded.spectate_path,
         host_account_id = coalesce(excluded.host_account_id, public.tng_room_registry.host_account_id),
         status = 'live',
         expires_at = excluded.expires_at,
         updated_at = now()
       returning
         room_code, game_id, service, room_kind, join_path, spectate_path,
         host_account_id, status, created_at, updated_at, expires_at`,
      [
        code,
        cleanText(room.game_id || room.gameId, 64),
        cleanText(room.service, 64),
        cleanText(room.room_kind || room.kind, 32),
        cleanText(room.join_path || room.joinPath, 500),
        room.spectate_path || room.spectatePath
          ? cleanText(room.spectate_path || room.spectatePath, 500)
          : null,
        room.host_account_id || room.hostAccountId || null,
        room.expires_at || room.expiresAt || null,
      ],
    );

    return result.rows[0] || null;
  }

  async function discoverLegacy(code) {
    const core = await loadCoreRoom(code);
    if (core) return upsertDiscovered(core);

    // Standalone room snapshots created before the registry.
    const liveSnapshot = await pool.query(
      `select service, room_code, room_state, updated_at, expires_at
       from public.tng_live_room_state
       where expires_at > now()
         and (
           room_code = $1
           or room_code = $2
         )
       order by updated_at desc`,
      [code, `viral-${code.toLowerCase()}`],
    ).catch(() => ({ rows: [] }));

    for (const row of liveSnapshot.rows || []) {
      const service = String(row.service || '');
      const state = row.room_state || {};
      const hostAccountId = state.hostAccountId || null;

      if (service === 'battle-sudoku' && row.room_code === code) {
        return upsertDiscovered({
          room_code: code,
          game_id: 'sudoku',
          service,
          room_kind: 'standalone',
          join_path: `/games/sudoku?room=${encodeURIComponent(code)}`,
          spectate_path: `/games/sudoku?display=${encodeURIComponent(code)}`,
          host_account_id: hostAccountId,
          expires_at: row.expires_at,
        });
      }

      if (service === 'word-wrangler' && row.room_code === code) {
        return upsertDiscovered({
          room_code: code,
          game_id: 'word-wrangler',
          service,
          room_kind: 'standalone',
          join_path: `/games/word-wrangler?room=${encodeURIComponent(code)}`,
          host_account_id: hostAccountId,
          expires_at: row.expires_at,
        });
      }

      if (service === 'see-that' && row.room_code === code) {
        return upsertDiscovered({
          room_code: code,
          game_id: 'see-that',
          service,
          room_kind: 'standalone',
          join_path: `/games/see-that?room=${encodeURIComponent(code)}`,
          spectate_path: `/games/see-that?display=${encodeURIComponent(code)}`,
          host_account_id: hostAccountId,
          expires_at: row.expires_at,
        });
      }

      if (
        service === 'viral-live' &&
        String(row.room_code || '').toLowerCase() === `viral-${code.toLowerCase()}`
      ) {
        return upsertDiscovered({
          room_code: code,
          game_id: 'viral',
          service,
          room_kind: 'standalone',
          join_path: `/viral/index.html?join=${encodeURIComponent(code)}`,
          host_account_id: hostAccountId,
          expires_at: row.expires_at,
        });
      }
    }

    const domino = await pool.query(
      `select room_code, game_state, host_account_id, created_at, updated_at
       from public.tng_domino_games
       where room_code = $1
       limit 1`,
      [code],
    ).catch(() => ({ rows: [] }));

    const dominoRow = domino.rows[0] || null;
    if (dominoRow) {
      const state = dominoRow.game_state || {};
      const status = String(state.status || '').toLowerCase();
      const phase = String(state.phase || '').toLowerCase();

      if (
        !['finished', 'completed', 'closed'].includes(status) &&
        !['game_over', 'game-over', 'completed', 'finished'].includes(phase)
      ) {
        return upsertDiscovered({
          room_code: code,
          game_id: 'dominoes',
          service: 'dominoes',
          room_kind: 'standalone',
          join_path: `/games/dominoes?room=${encodeURIComponent(code)}`,
          host_account_id: dominoRow.host_account_id || null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
    }

    return null;
  }

  return {
    async registerCore({
      code: value,
      gameId,
      hostAccountId = null,
    } = {}) {
      const code = cleanCode(value);
      const basePath = CORE_GAME_PATHS[gameId];
      if (!code || !basePath) return false;

      await ensureSchema(pool);
      await cleanupCode(code);

      const existing = await loadRegistry(code);
      if (existing && String(existing.service || '') !== 'core') {
        return false;
      }

      const row = await upsertDiscovered({
        room_code: code,
        game_id: gameId,
        service: 'core',
        room_kind: 'core',
        join_path: `${basePath}?room=${encodeURIComponent(code)}&neon=1`,
        spectate_path: `/spectate/${encodeURIComponent(code)}`,
        host_account_id: hostAccountId || null,
        expires_at: null,
      });

      return Boolean(row);
    },

    async resolve(value) {
      const code = cleanCode(value);
      if (!code) return null;

      const registered = await loadRegistry(code);
      if (registered) {
        if (registered.service === 'core') {
          const core = await loadCoreRoom(code);
          if (!core) {
            await this.close(code);
            return null;
          }
        }
        return serialize(registered);
      }

      const discovered = await discoverLegacy(code);
      return serialize(discovered);
    },

    async claim({
      code: value,
      gameId,
      service,
      kind = 'standalone',
      joinPath,
      spectatePath = null,
      hostAccountId = null,
      ttlMs = 3 * 60 * 60 * 1000,
      allowExisting = false,
    } = {}) {
      const code = cleanCode(value);
      if (!code) return false;

      await ensureSchema(pool);
      await cleanupCode(code);

      const core = await loadCoreRoom(code);
      if (core) return false;

      let existing = await loadRegistry(code);
      if (!existing) {
        existing = await discoverLegacy(code);
      }

      if (existing) {
        const sameOwner =
          String(existing.service || '') === String(service || '') &&
          (
            !existing.host_account_id ||
            !hostAccountId ||
            String(existing.host_account_id) === String(hostAccountId)
          );

        if (!allowExisting || !sameOwner) return false;

        await pool.query(
          `update public.tng_room_registry
           set updated_at = now(),
               expires_at = $2,
               status = 'live',
               host_account_id = coalesce($3::uuid, host_account_id)
           where room_code = $1`,
          [
            code,
            ttlMs ? new Date(Date.now() + Math.max(60_000, Number(ttlMs))) : null,
            hostAccountId || null,
          ],
        );
        return true;
      }

      const expiresAt = ttlMs
        ? new Date(Date.now() + Math.max(60_000, Number(ttlMs)))
        : null;

      const result = await pool.query(
        `insert into public.tng_room_registry
          (room_code, game_id, service, room_kind, join_path, spectate_path,
           host_account_id, status, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7::uuid, 'live', $8)
         on conflict (room_code) do nothing
         returning room_code`,
        [
          code,
          cleanText(gameId, 64),
          cleanText(service, 64),
          cleanText(kind, 32),
          cleanText(joinPath, 500),
          spectatePath ? cleanText(spectatePath, 500) : null,
          hostAccountId || null,
          expiresAt,
        ],
      );

      return Boolean(result.rowCount);
    },

    async touch(value, { ttlMs = null, status = 'live' } = {}) {
      const code = cleanCode(value);
      if (!code) return;

      await ensureSchema(pool);
      await pool.query(
        `update public.tng_room_registry
         set updated_at = now(),
             status = $2,
             expires_at = case
               when $3::bigint is null then expires_at
               else now() + ($3::bigint * interval '1 millisecond')
             end
         where room_code = $1`,
        [code, cleanText(status, 24) || 'live', ttlMs == null ? null : Math.max(60_000, Number(ttlMs))],
      );
    },

    async close(value) {
      const code = cleanCode(value);
      if (!code) return;

      await ensureSchema(pool);
      await pool.query(
        `update public.tng_room_registry
         set status = 'closed', updated_at = now(), expires_at = now()
         where room_code = $1`,
        [code],
      );
    },

    async release(value, service = null) {
      const code = cleanCode(value);
      if (!code) return;

      await ensureSchema(pool);
      if (service) {
        await pool.query(
          `delete from public.tng_room_registry
           where room_code = $1 and service = $2`,
          [code, service],
        );
      } else {
        await pool.query(
          `delete from public.tng_room_registry where room_code = $1`,
          [code],
        );
      }
    },

    async cleanup() {
      await ensureSchema(pool);
      await pool.query(
        `delete from public.tng_room_registry
         where expires_at is not null
           and expires_at <= now()`,
      );
    },
  };
}
