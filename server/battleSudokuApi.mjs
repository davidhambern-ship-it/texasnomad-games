// ─────────────────────────────────────────────────────────────────────────────
// BattleSudoku — party rooms (served by server.mjs under /bs-api)
//
// The host's screen is the big screen (ocean map); players join on phones.
// The server owns the puzzle solution and every fleet, checks every move and
// resolves each volley (src/lib/battleSudoku/game.js). Rooms live in memory.
//
// Routes (JSON; token in X-BS-Token):
//   GET  /bs-api/health
//   POST /bs-api/rooms                       → { roomCode, token, ...view }   (host)
//   GET  /bs-api/rooms/:code                 → view (player view with a player token)
//   POST /bs-api/rooms/:code/action { action, ... }
//        host:   settings{difficulty,solveSec,battleSec,volleys} · addCpu{level} · kick{playerId} · start · lobby
//        player: join{name} · leave · shuffle · ready · place{cell,digit} · order{kind,target,cell,dir} · cancel{orderId}
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import * as G from '../src/lib/battleSudoku/game.js';

const MAX_PLAYERS = 8;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const COLORS = ['#ffd23f', '#ff5f6d', '#3ec5ff', '#3ef08a', '#c77dff', '#ff9f1c', '#f15bb5', '#e5e7eb'];
const CPU_NAMES = [['Tank', 3], ['Carlos', 5], ['Lemonade', 6], ['Violet', 7], ['Dexter', 8], ['Berna', 9]];
const SOLVE = [30, 40, 60], BATTLE = [10, 15, 20], VOLLEYS = [6, 8, 10];

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

export function createBattleSudokuApi({
  store = null,
  resolveIdentity = async () => null,
} = {}) {
  const rooms = new Map();
  const lastCheckpoint = new Map();
  let lastSweep = Date.now();

  async function loadRoom(code) {
    let room = rooms.get(code) || null;
    if (!room && store) {
      room = await store.load(code);
      if (room) rooms.set(code, room);
    }
    return room;
  }

  async function saveRoom(room, { force = false } = {}) {
    if (!room?.code) return;
    rooms.set(room.code, room);
    if (!store) return;

    const now = Date.now();
    const last = lastCheckpoint.get(room.code) || 0;
    if (!force && now - last < 3000) return;

    await store.save(room.code, room);
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

  const newCode = async () => {
    for (let i = 0; i < 50; i++) {
      const c = Array.from(
        { length: 5 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');
      if (!(await roomExists(c))) return c;
    }
    throw err(503, 'NO_CODE', 'Try again.');
  };

  function view(room, me, now) {
    const base = {
      code: room.code, stage: room.game ? 'game' : 'lobby', settings: room.settings, now,
      roster: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, cpu: p.cpu || 0, online: p.cpu || now - (p.lastSeen || 0) < 15000 })),
    };
    if (room.game) base.game = G.view(room.game, me ? me.id : null, now);
    return { room: base, you: me ? { id: me.id, name: me.name, color: me.color } : null };
  }

  function act(room, who, body, now) {
    const a = String(body.action || '');
    const isHost = who === 'host'; const me = isHost ? null : who;
    const need = (c, m, code = 'NOT_ALLOWED', status = 403) => { if (!c) throw err(status, code, m); };
    switch (a) {
      case 'settings': {
        need(isHost, 'Only the host can change settings.');
        const s = room.settings;
        if (['easy', 'normal', 'hard'].includes(body.difficulty)) s.difficulty = body.difficulty;
        if (SOLVE.includes(Number(body.solveSec))) s.solveSec = Number(body.solveSec);
        if (BATTLE.includes(Number(body.battleSec))) s.battleSec = Number(body.battleSec);
        if (VOLLEYS.includes(Number(body.volleys))) s.volleys = Number(body.volleys);
        return {};
      }
      case 'addCpu': {
        need(isHost, 'Only the host can add CPU captains.');
        need(!room.game, 'Wait for the next game.', 'IN_GAME', 409);
        need(room.players.length < MAX_PLAYERS, 'The room is full.', 'FULL', 409);
        const used = new Set(room.players.map(p => p.name));
        const [name, lvl] = CPU_NAMES.find(([n]) => !used.has(n)) || [`CPU ${room.players.length + 1}`, 5];
        room.players.push({ id: newId(), name, cpu: Number(body.level) || lvl, color: nextColor(room), token: null });
        return {};
      }
      case 'kick': {
        need(isHost, 'Only the host can remove players.');
        need(!room.game, 'Wait for the game to end.', 'IN_GAME', 409);
        room.players = room.players.filter(p => p.id !== body.playerId);
        return {};
      }
      case 'start': {
        need(isHost, 'Only the host can start.');
        need(room.players.length >= 2, 'You need at least 2 captains — add a CPU.', 'PLAYERS', 409);
        room.game = G.createGame({ seed: `${room.code}-${now}-${Math.random()}`, settings: room.settings, now,
          players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, cpu: p.cpu || 0 })) });
        return {};
      }
      case 'lobby': {
        need(isHost, 'Only the host can do that.');
        room.game = null; return {};
      }
      case 'leave': {
        if (me && !room.game) room.players = room.players.filter(p => p.id !== me.id);
        else if (me) me.token = null;
        return {};
      }
      case 'shuffle': case 'ready': case 'place': case 'order': case 'cancel': {
        need(me, 'Join the game first.', 'NO_SEAT');
        need(room.game, 'The game hasn’t started.', 'NO_GAME', 409);
        need(room.game.players[me.id], 'You joined after this game started — you’re in the next one.', 'NOT_IN_GAME', 409);
        return G.act(room.game, me.id, { ...body, type: a }, now);
      }
      default: throw err(400, 'UNKNOWN_ACTION', 'Unknown action.');
    }
  }
  const nextColor = (room) => { const used = new Set(room.players.map(p => p.color)); return COLORS.find(c => !used.has(c)) || COLORS[room.players.length % COLORS.length]; };

  return async function handleBattleSudokuApi(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname.replace(/^\/bs-api/, '') || '/';
    const token = String(req.headers['x-bs-token'] || '');
    const now = Date.now();
    try {
      if (now - lastSweep > 10 * 60 * 1000) {
        lastSweep = now;
        await sweepRooms(now);
      }
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, {
          ok: true,
          service: 'battle-sudoku',
          rooms: await roomCount(),
          persistent: Boolean(store),
        });
      }
      if (req.method === 'POST' && path === '/rooms') {
        const hostIdentity = await resolveIdentity(req);
        if (!hostIdentity?.accountId) {
          throw err(401, 'AUTH_REQUIRED', 'Sign in to TNG before hosting BattleSudoku.');
        }
        if ((await roomCount()) > 1000) throw err(503, 'BUSY', 'Too many games right now.');
        const code = await newCode();
        const room = {
          code,
          hostToken: newToken(),
          hostAccountId: hostIdentity.accountId,
          hostName: hostIdentity.publicName || 'Host',
          players: [],
          game: null,
          settings: { ...G.DEFAULTS },
          createdAt: now,
          updatedAt: now,
        };
        await saveRoom(room, { force: true });
        const v = view(room, null, now); v.you = { isHost: true };
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

      const findMe = () => (
        token && !tokenClaimsHost
          ? room.players.find(p => p.token === token) || null
          : null
      );

      if (room.game) G.tick(room.game, now);

      if (req.method === 'GET' && !m[2]) {
        const beforePhase = room.game?.phase || null;
        const me = findMe();
        if (me) me.lastSeen = now;
        if (token || room.game) room.updatedAt = now;

        await saveRoom(room, {
          force: beforePhase !== (room.game?.phase || null),
        });

        const v = view(room, me, now); if (isHost) v.you = { isHost: true };
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
            throw err(401, 'AUTH_REQUIRED', 'Sign in to TNG before joining BattleSudoku.');
          }

          let me = findMe() || room.players.find(
            p => String(p.accountId || '') === String(identity.accountId),
          ) || null;
          let issued;

          if (!me) {
            const name = clean(identity.publicName);
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
            me.name = clean(identity.publicName);
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
            throw err(403, 'IDENTITY_MISMATCH', 'That BattleSudoku seat belongs to another TNG account.');
          }
        }
        const result = act(room, isHost ? 'host' : me, body, t);
        if (me) me.lastSeen = t;
        await saveRoom(room, { force: true });
        const v = view(room, me, t); if (isHost) v.you = { isHost: true };
        return send(res, 200, { result, ...v });
      }
      return send(res, 405, { error: { code: 'METHOD', message: 'Method not allowed.' } });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[battle-sudoku] error', e);
      return send(res, status, { error: { code: e.code || 'SERVER_ERROR', message: status >= 500 ? 'BattleSudoku hit a snag. Try again.' : e.message } });
    }
  };
}
