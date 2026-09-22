import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function sendFile(res, filePath) {
  const body = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  res.end(body);
}

const TNG_API_ORIGIN =
  'https://br-polished-glade-avfsrygs-tngapi.compute.c-11.us-east-1.aws.neon.tech';

const { Pool } = pg;
const bffPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

async function proxyTngApi(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const targetPath = sourceUrl.pathname.replace(/^\/tng-api/, '') || '/';
  const targetUrl = `${TNG_API_ORIGIN}${targetPath}${sourceUrl.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      value !== undefined &&
      !['host', 'connection', 'content-length'].includes(key.toLowerCase())
    ) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body,
    redirect: 'manual',
  });

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  const responseBody = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, responseHeaders);
  res.end(responseBody);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function getBffAuthAccount(req) {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const { rows } = await bffPool.query(`
    select a.id as account_id, a.email, u.id as auth_user_id, u.name
    from neon_auth.session s
    join neon_auth."user" u on u.id = s."userId"
    join public.accounts a
      on a.auth_subject = u.id::text
      or lower(a.email) = lower(u.email)
    where s.token = $1
      and s."expiresAt" > now()
    order by case when a.auth_subject = u.id::text then 0 else 1 end
    limit 1
  `, [match[1]]);

  return rows[0] || null;
}

async function loadRailwayBffHostRoom(controllerId, accountId) {
  const { rows } = await bffPool.query(`
    select gr.id, gr.room_code, gr.game_id, gr.status, gr.revision, gr.display_state,
           gr.created_at, gr.updated_at, hs.id as host_session_id
    from public.host_sessions hs
    join public.device_sessions ds on ds.id = hs.controller_device_id
    join public.game_rooms gr on gr.host_session_id = hs.id
    where hs.controller_device_id = $1::uuid
      and ds.account_id = $2::uuid
      and hs.status in ('pairing','ready','live')
      and gr.status in ('lobby','live','paused')
      and gr.game_id = 'bff'
    order by gr.updated_at desc
    limit 1
  `, [controllerId, accountId]);

  return rows[0] || null;
}

async function assignBffSeats(roomId) {
  const client = await bffPool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`
      select id, seat_number
      from public.room_participants
      where room_id = $1::uuid and left_at is null
      order by joined_at asc
      for update
    `, [roomId]);

    const used = new Set(rows.filter((row) => row.seat_number != null).map((row) => Number(row.seat_number)));
    used.add(1);

    let nextSeat = 2;
    for (const row of rows) {
      if (row.seat_number != null) continue;
      while (used.has(nextSeat)) nextSeat += 1;
      await client.query(
        'update public.room_participants set seat_number = $1, last_heartbeat_at = now() where id = $2::uuid',
        [nextSeat, row.id],
      );
      used.add(nextSeat);
      nextSeat += 1;
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function loadBffParticipants(roomId, gameState = {}) {
  const { rows } = await bffPool.query(`
    select rp.id, rp.account_id, rp.device_session_id, rp.role::text as role, rp.seat_number,
           rp.joined_at, rp.last_heartbeat_at,
           pp.display_name, pp.handle, a.email
    from public.room_participants rp
    join public.accounts a on a.id = rp.account_id
    left join public.player_profiles pp on pp.account_id = rp.account_id
    where rp.room_id = $1::uuid
      and rp.left_at is null
    order by rp.seat_number nulls last, rp.joined_at
  `, [roomId]);

  const teamMap = gameState?.playerTeams || {};
  return rows.map((row) => ({
    playerId: row.account_id,
    accountId: row.account_id,
    participantId: row.id,
    deviceSessionId: row.device_session_id,
    role: row.role || 'player',
    seatNumber: row.seat_number,
    familyTeam: teamMap[row.account_id] ?? null,
    playerName: row.display_name || row.handle || row.email.split('@')[0],
    name: row.display_name || row.handle || row.email.split('@')[0],
    handle: row.handle || null,
    connected: true,
    active: true,
    joinedAt: row.joined_at ? new Date(row.joined_at).getTime() : Date.now(),
    lastActionAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : Date.now(),
  }));
}

async function handleBffApi(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const path = sourceUrl.pathname.replace(/^\/bff-api/, '') || '/';

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, service: 'railway-bff-api' });
    return;
  }

  if (req.method === 'GET' && path === '/host') {
    const account = await getBffAuthAccount(req);
    if (!account) {
      sendJson(res, 401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' } });
      return;
    }

    const controllerId = String(req.headers['x-tng-device-id'] || '');
    if (!controllerId) {
      sendJson(res, 400, { error: { code: 'CONTROLLER_REQUIRED', message: 'Host controller is missing.' } });
      return;
    }

    const room = await loadRailwayBffHostRoom(controllerId, account.account_id);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    await assignBffSeats(room.id);
    const players = await loadBffParticipants(room.id, room.display_state || {});
    const gameState = { ...(room.display_state || {}), players };

    sendJson(res, 200, {
      room: {
        id: room.id,
        roomCode: room.room_code,
        gameId: room.game_id,
        status: room.status,
        revision: room.revision,
        gameState,
        players,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
      },
    });
    return;
  }

  sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'BFF route not found.' } });
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url || '').startsWith('/tng-api')) {
      await proxyTngApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/bff-api')) {
      await handleBffApi(req, res);
      return;
    }

    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = normalize(rawPath).replace(/^([.][.][/\\])+/, '');
    let filePath = join(root, safePath === '/' ? 'index.html' : safePath);

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
      await sendFile(res, filePath);
      return;
    } catch {}

    // React Router SPA fallback for /host, /join/:roomCode, /games/*, etc.
    await sendFile(res, join(root, 'index.html'));
  } catch (error) {
    console.error('[TNG temp host] request failed', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('TNG staging host error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`TNG staging frontend listening on port ${port}`);

});
