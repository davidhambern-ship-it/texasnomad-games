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

export function createBattleSudokuApi() {
  const rooms = new Map();
  let lastSweep = Date.now();
  const newCode = () => { for (let i = 0; i < 50; i++) { const c = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); if (!rooms.has(c)) return c; } throw err(503, 'NO_CODE', 'Try again.'); };

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
      if (now - lastSweep > 10 * 60 * 1000) { lastSweep = now; for (const [k, r] of rooms) if (now - r.updatedAt > ROOM_TTL_MS) rooms.delete(k); }
      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, service: 'battle-sudoku', rooms: rooms.size });
      if (req.method === 'POST' && path === '/rooms') {
        if (rooms.size > 1000) throw err(503, 'BUSY', 'Too many games right now.');
        const code = newCode();
        const room = { code, hostToken: newToken(), players: [], game: null, settings: { ...G.DEFAULTS }, createdAt: now, updatedAt: now };
        rooms.set(code, room);
        const v = view(room, null, now); v.you = { isHost: true };
        return send(res, 200, { roomCode: code, token: room.hostToken, ...v });
      }
      const m = path.match(/^\/rooms\/([A-Za-z]{4,6})(\/action)?$/);
      if (!m) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      const code = m[1].toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(res, 404, { error: { code: 'ROOM_NOT_FOUND', message: `Game ${code} wasn’t found.` } });
      const isHost = token && token === room.hostToken;
      const findMe = () => (token && !isHost ? room.players.find(p => p.token === token) || null : null);
      if (room.game) G.tick(room.game, now);

      if (req.method === 'GET' && !m[2]) {
        const me = findMe(); if (me) me.lastSeen = now;
        const v = view(room, me, now); if (isHost) v.you = { isHost: true };
        return send(res, 200, v);
      }
      if (req.method === 'POST' && m[2]) {
        const body = await readBody(req);
        const t = Date.now();
        if (room.game) G.tick(room.game, t);
        room.updatedAt = t;
        if (body.action === 'join') {
          let me = findMe(), issued;
          if (!me) {
            const name = clean(body.name);
            if (!name) throw err(400, 'NAME_REQUIRED', 'Type your name first.');
            if (room.players.filter(p => !p.cpu).length >= MAX_PLAYERS) throw err(409, 'FULL', 'This game is full.');
            if (room.players.length >= MAX_PLAYERS) { const i = room.game ? -1 : room.players.findIndex(p => p.cpu); if (i < 0) throw err(409, 'FULL', 'This game is full.'); room.players.splice(i, 1); }
            me = { id: newId(), name, token: newToken(), color: nextColor(room), lastSeen: t };
            room.players.push(me); issued = me.token;
          }
          me.lastSeen = t;
          return send(res, 200, { token: issued || token, playerId: me.id, ...view(room, me, t) });
        }
        const me = findMe();
        const result = act(room, isHost ? 'host' : me, body, t);
        if (me) me.lastSeen = t;
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
