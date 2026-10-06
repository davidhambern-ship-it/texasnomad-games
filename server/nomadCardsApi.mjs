// ─────────────────────────────────────────────────────────────────────────────
// OUT! — party rooms (served by server.mjs under /nc-api)
//
// The host's screen is the table (TV); players hold their hands on phones.
// The server owns the deck and every hand, validates every move and runs the
// clock + CPU players (src/lib/nomadCards/game.js). Rooms live in memory with a
// Postgres snapshot store for recovery (same pattern as BattleSudoku).
//
// Routes (JSON; token in X-NC-Token):
//   GET  /nc-api/health
//   POST /nc-api/rooms                       → { roomCode, token, ...view }   (host)
//   GET  /nc-api/rooms/:code                 → view (player view with a player token)
//   POST /nc-api/rooms/:code/action { action, ... }
//        host:   settings{target,turnSec,stacking,sevenZero} · addCpu{level} · kick{playerId} · start · lobby
//        player: join · leave · play{card,color,target,call} · draw · pass · call · catch{target}
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import * as G from '../src/lib/nomadCards/game.js';

const MAX_PLAYERS = 10;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const COLORS = ['#ffd23f', '#ff5f6d', '#3ec5ff', '#3ef08a', '#c77dff', '#ff9f1c', '#f15bb5', '#e5e7eb', '#7ae0d6', '#ffb4a2'];
const CPU_NAMES = [['Tank', 3], ['Carlos', 5], ['Lemonade', 6], ['Violet', 7], ['Dexter', 8], ['Berna', 9], ['Rio', 4], ['Duke', 6], ['Mabel', 7]];
const TARGETS = [0, 100, 250, 500], TURNS = [20, 30, 45, 60];

const newToken = () => randomBytes(18).toString('base64url');
const newId = () => randomBytes(5).toString('base64url');
const clean = (s, n = 14) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
function err(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 8000) { reject(err(413, 'TOO_LARGE', 'Request too large.')); req.destroy(); } });
    req.on('end', () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(err(400, 'BAD_JSON', 'Bad request.')); } });
    req.on('error', reject);
  });
}
function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

export function createNomadCardsApi({
  store = null,
  resolveIdentity = async () => null,
  recordResults = async () => ({ recorded: 0 }),
  claimRoomCode = async () => true,
  touchRoomCode = async () => {},
  releaseRoomCode = async () => {},
} = {}) {
  const rooms = new Map();
  const lastCheckpoint = new Map();
  const recordedSessions = new Set();
  let lastSweep = Date.now();

  async function loadRoom(code) {
    let room = rooms.get(code) || null;
    if (!room && store) {
      room = await store.load(code);
      if (room) rooms.set(code, room);
    }
    return room;
  }

  async function maybeRecordResults(room) {
    const game = room?.game;
    if (!room?.code || !game || game.phase !== 'final') return;

    const sessionKey = String(game.seed || '').trim();
    if (!sessionKey || recordedSessions.has(sessionKey)) return;

    const results = room.players
      .filter((player) => (
        !player.cpu &&
        player.accountId &&
        game.players?.[player.id]
      ))
      .map((player) => ({
        accountId: player.accountId,
        score: Number(game.players[player.id]?.score || 0),
        won: String(game.winner || '') === String(player.id),
      }));

    if (!results.length) {
      recordedSessions.add(sessionKey);
      return;
    }

    try {
      await recordResults({
        gameId: 'out',
        sessionKey,
        roomCode: room.code,
        results,
      });
      recordedSessions.add(sessionKey);
    } catch (error) {
      // Stats must never break the live game. Leave the session unmarked so a
      // later room poll/action retries the idempotent recorder.
      console.warn('[out] result recording failed', error?.message || error);
    }
  }

  async function saveRoom(room, { force = false } = {}) {
    if (!room?.code) return;
    rooms.set(room.code, room);

    await maybeRecordResults(room);

    if (!store) return;

    const now = Date.now();
    const last = lastCheckpoint.get(room.code) || 0;
    if (!force && now - last < 3000) return;

    await store.save(room.code, room);
    await touchRoomCode(room.code, { ttlMs: ROOM_TTL_MS });
    lastCheckpoint.set(room.code, now);
  }

  async function sweepRooms(now) {
    for (const [code, room] of rooms) {
      if (now - Number(room.updatedAt || 0) > ROOM_TTL_MS) {
        rooms.delete(code);
        lastCheckpoint.delete(code);
      }
    }
    if (store) await store.cleanup();
  }

  async function roomCount() {
    return store ? store.count() : rooms.size;
  }

  async function roomExists(code) {
    if (rooms.has(code)) return true;
    return store ? store.exists(code) : false;
  }

  const newCode = async (hostAccountId) => {
    for (let i = 0; i < 50; i++) {
      const c = Array.from(
        { length: 5 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');

      if (await roomExists(c)) continue;

      const claimed = await claimRoomCode({
        code: c,
        gameId: 'out',
        service: 'out',
        kind: 'standalone',
        joinPath: '/games/out?room=' + encodeURIComponent(c),
        spectatePath: '/games/out?display=' + encodeURIComponent(c),
        hostAccountId,
        ttlMs: ROOM_TTL_MS,
      });

      if (claimed) return c;
    }
    throw err(503, 'NO_CODE', 'TNG could not reserve a room code. Try again.');
  };

  function view(room, me, now) {
    const base = {
      code: room.code, stage: room.game ? 'game' : 'lobby', settings: room.settings, now,
      roster: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: Boolean(p.isHost), cpu: p.cpu || 0, online: p.cpu || now - (p.lastSeen || 0) < 15000 })),
    };
    if (room.game) base.game = G.view(room.game, me ? me.id : null, now);
    return { room: base, you: me ? { id: me.id, name: me.name, color: me.color } : null };
  }

  function act(room, who, body, now) {
    const a = String(body.action || '');
    const isHost = who === 'host'; const me = isHost ? room.players.find(p => p.id === room.hostPlayerId) : who;
    const need = (c, m, code = 'NOT_ALLOWED', status = 403) => { if (!c) throw err(status, code, m); };
    switch (a) {
      case 'settings': {
        need(isHost, 'Only the host can change settings.');
        need(!room.game || room.game.phase === 'final', 'Settings are locked during a game.', 'IN_GAME', 409);
        const st = room.settings;
        if (TARGETS.includes(Number(body.target))) st.target = Number(body.target);
        if (TURNS.includes(Number(body.turnSec))) st.turnSec = Number(body.turnSec);
        if (typeof body.stacking === 'boolean') st.stacking = body.stacking;
        if (typeof body.sevenZero === 'boolean') st.sevenZero = body.sevenZero;
        return {};
      }
      case 'addCpu': {
        need(isHost, 'Only the host can add CPU players.');
        need(!room.game || room.game.phase === 'final', 'Wait for the next game.', 'IN_GAME', 409);
        need(room.players.length < MAX_PLAYERS, 'The table is full.', 'FULL', 409);
        const used = new Set(room.players.map(p => p.name));
        const [name, lvl] = CPU_NAMES.find(([n]) => !used.has(n)) || [`CPU ${room.players.length + 1}`, 5];
        room.players.push({ id: newId(), name, cpu: Number(body.level) || lvl, color: nextColor(room), token: null });
        return {};
      }
      case 'kick': {
        need(isHost, 'Only the host can remove players.');
        need(!room.game || room.game.phase === 'final', 'Wait for the game to end.', 'IN_GAME', 409);
        need(body.playerId !== room.hostPlayerId, 'The host seat stays at the table.');
        room.players = room.players.filter(p => p.id !== body.playerId);
        return {};
      }
      case 'start': {
        need(isHost, 'Only the host can start.');
        need(!room.game || room.game.phase === 'final', 'Finish the current game first.', 'IN_GAME', 409);
        need(room.players.length >= 2, 'You need at least 2 players — add a CPU.', 'PLAYERS', 409);
        room.game = G.createGame({ seed: `${room.code}-${now}-${Math.random()}`, settings: room.settings, now,
          players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, cpu: p.cpu || 0 })) });
        return {};
      }
      case 'lobby': {
        need(isHost, 'Only the host can do that.');
        room.game = null; return {};
      }
      case 'leave': {
        need(!isHost && me?.id !== room.hostPlayerId, 'The host controls this table.');
        if (me && (!room.game || room.game.phase === 'final')) room.players = room.players.filter(p => p.id !== me.id);
        else if (me) me.token = null;
        return {};
      }
      case 'play': case 'draw': case 'pass': case 'call': case 'catch': {
        need(me, 'Join the game first.', 'NO_SEAT');
        need(room.game, 'The game hasn’t started.', 'NO_GAME', 409);
        need(room.game.players[me.id], 'You joined after this game started — you’re in the next one.', 'NOT_IN_GAME', 409);
        return G.act(room.game, me.id, { ...body, type: a }, now);
      }
      default: throw err(400, 'UNKNOWN_ACTION', 'Unknown action.');
    }
  }
  const nextColor = (room) => { const used = new Set(room.players.map(p => p.color)); return COLORS.find(c => !used.has(c)) || COLORS[room.players.length % COLORS.length]; };

  async function handleNomadCardsApi(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname.replace(/^\/nc-api/, '') || '/';
    const token = String(req.headers['x-nc-token'] || '');
    const now = Date.now();
    try {
      if (now - lastSweep > 10 * 60 * 1000) {
        lastSweep = now;
        await sweepRooms(now);
      }
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, {
          ok: true,
          service: 'out',
          rooms: await roomCount(),
          persistent: Boolean(store),
        });
      }
      if (req.method === 'POST' && path === '/rooms') {
        const hostIdentity = await resolveIdentity(req);
        if (!hostIdentity?.accountId) {
          throw err(401, 'AUTH_REQUIRED', 'Sign in to TNG before hosting OUT!.');
        }
        if ((await roomCount()) > 1000) throw err(503, 'BUSY', 'Too many games right now.');
        const code = await newCode(hostIdentity.accountId);
        const room = {
          code,
          hostToken: newToken(),
          hostAccountId: hostIdentity.accountId,
          hostName: hostIdentity.publicName || 'Host',
          hostPlayerId: newId(),
          players: [],
          game: null,
          settings: { ...G.DEFAULTS },
          createdAt: now,
          updatedAt: now,
        };
        room.players.push({ id: room.hostPlayerId, accountId: hostIdentity.accountId, name: clean(room.hostName, 32), color: COLORS[0], isHost: true, lastSeen: now });
        try {
          await saveRoom(room, { force: true });
        } catch (error) {
          await releaseRoomCode(room.code, 'out').catch(() => {});
          throw error;
        }
        const v = view(room, room.players[0], now); v.you.isHost = true;
        return send(res, 200, { roomCode: code, token: room.hostToken, ...v });
      }
      const m = path.match(/^\/rooms\/([A-Za-z]{4,6})(\/action)?$/);
      if (!m) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      const code = m[1].toUpperCase();
      const room = await loadRoom(code);
      if (!room) return send(res, 404, { error: { code: 'ROOM_NOT_FOUND', message: `Game ${code} wasn’t found.` } });
      const tokenClaimsHost = Boolean(token && token === room.hostToken);
      let requestIdentity = null;
      if (token) requestIdentity = await resolveIdentity(req);

      const isHost = Boolean(
        tokenClaimsHost &&
        requestIdentity?.accountId &&
        (!room.hostAccountId || String(room.hostAccountId) === String(requestIdentity.accountId))
      );

      const tokenSeat = tokenClaimsHost
        ? room.players.find(p => p.id === room.hostPlayerId)
        : room.players.find(p => token && p.token === token);
      if (token && !requestIdentity?.accountId) throw err(401, 'AUTH_REQUIRED', 'Sign in to use your seat.');
      if (tokenClaimsHost && !isHost) throw err(403, 'IDENTITY_MISMATCH', 'That host seat belongs to another account.');
      if (tokenSeat && String(tokenSeat.accountId) !== String(requestIdentity?.accountId)) throw err(403, 'IDENTITY_MISMATCH', 'That seat belongs to another TNG account.');
      const findMe = () => tokenSeat || null;

      if (room.game) G.tick(room.game, now);

      if (req.method === 'GET' && !m[2]) {
        const beforePhase = room.game?.phase || null;
        const me = findMe();
        if (me) me.lastSeen = now;
        if (token || room.game) room.updatedAt = now;

        await saveRoom(room, {
          force: beforePhase !== (room.game?.phase || null),
        });

        const v = view(room, me, now); if (isHost && v.you) v.you.isHost = true;
        return send(res, 200, v);
      }
      if (req.method === 'POST' && m[2]) {
        const body = await readBody(req);
        const t = Date.now();
        if (room.game) G.tick(room.game, t);
        room.updatedAt = t;
        if (body.action === 'join') {
          const identity = requestIdentity || await resolveIdentity(req);
          if (!identity?.accountId || !identity?.publicName) {
            throw err(401, 'AUTH_REQUIRED', 'Sign in to TNG before joining OUT!.');
          }

          if (String(identity.accountId) === String(room.hostAccountId) && !isHost) throw err(409, 'HOST_SEAT', 'Return to Host a table to use your reserved host seat.');
          let me = findMe() || room.players.find(
            p => String(p.accountId || '') === String(identity.accountId),
          ) || null;
          let issued;

          if (!me) {
            const name = clean(identity.publicName, 32);
            if (!name) throw err(400, 'NAME_REQUIRED', 'Your TNG profile needs a public name.');
            if (room.players.filter(p => !p.cpu).length >= MAX_PLAYERS) throw err(409, 'FULL', 'This game is full.');
            if (room.players.length >= MAX_PLAYERS) {
              const i = room.game ? -1 : room.players.findIndex(p => p.cpu);
              if (i < 0) throw err(409, 'FULL', 'This game is full.');
              room.players.splice(i, 1);
            }
            me = {
              id: newId(),
              accountId: identity.accountId,
              name,
              token: newToken(),
              color: nextColor(room),
              lastSeen: t,
            };
            room.players.push(me);
            issued = me.token;
          } else if (!token || token !== me.token) {
            me.name = clean(identity.publicName, 32);
            me.token = newToken();
            issued = me.token;
          }
          me.lastSeen = t;
          await saveRoom(room, { force: true });
          return send(res, 200, { token: issued || token, playerId: me.id, ...view(room, me, t) });
        }
        const me = findMe();
        if (me?.accountId) {
          const identity = requestIdentity || await resolveIdentity(req);
          if (!identity?.accountId || String(identity.accountId) !== String(me.accountId)) {
            throw err(403, 'IDENTITY_MISMATCH', 'That seat belongs to another TNG account.');
          }
        }
        const result = act(room, isHost ? 'host' : me, body, t);
        if (me) me.lastSeen = t;
        await saveRoom(room, { force: true });
        const v = view(room, me, t); if (isHost && v.you) v.you.isHost = true;
        return send(res, 200, { result, ...v });
      }
      return send(res, 405, { error: { code: 'METHOD', message: 'Method not allowed.' } });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[out] error', e);
      return send(res, status, { error: { code: e.code || 'SERVER_ERROR', message: status >= 500 ? 'OUT! hit a snag. Try again.' : e.message } });
    }
  }
  // Serialize requests per table: recovery and simultaneous moves must use one
  // authoritative state, including checkpoint writes.
  const pending = new Map();
  return function queuedRequest(req, res) {
    const key = new URL(req.url || '/', 'http://localhost').pathname.match(/\/rooms\/([A-Za-z]{4,6})/)?.[1]?.toUpperCase();
    if (!key) return handleNomadCardsApi(req, res);
    const task = (pending.get(key) || Promise.resolve()).catch(() => {}).then(() => handleNomadCardsApi(req, res));
    pending.set(key, task);
    return task.finally(() => { if (pending.get(key) === task) pending.delete(key); });
  };
}
