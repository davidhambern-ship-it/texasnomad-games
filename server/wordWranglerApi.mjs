// ─────────────────────────────────────────────────────────────────────────────
// Word Wrangler — online race rooms (served by server.mjs under /ww-api)
//
// Everyone in a room gets the same seed, so the same opening board and the same
// stream of falling letters ("same tiles, your choices"). Each player's moves
// are replayed here with the shared engine (src/lib/wordWranglerEngine.js), so
// the leaderboard only shows real, checked words. CPU rivals play on the server.
//
// Rooms live in memory (a race lasts a few minutes); idle rooms are forgotten
// after 2 hours.
//
// Routes (JSON; seat token in the X-WW-Token header):
//   GET  /ww-api/health
//   POST /ww-api/rooms                     { name }            → { roomCode, token, playerId, room }
//   GET  /ww-api/rooms/:code[?full=1]                          → { room, you, mine? }
//   POST /ww-api/rooms/:code/action        { action, ... }
//        join{name} · addCpu{level,char} · remove{playerId} · setDuration{seconds}
//        start · word{path,move} · shuffle{move} · leave
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as E from '../src/lib/wordWranglerEngine.js';

const MAX_PLAYERS = 8;
const DURATIONS = [90, 150, 240];
const COUNTDOWN_MS = 4000;
const GRACE_MS = 1500;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CPU_CREW = [
  { id: 'berna', name: 'Berna' }, { id: 'dexter', name: 'Dexter' }, { id: 'lemonade', name: 'Lemonade' },
  { id: 'carlos', name: 'Carlos' }, { id: 'violet', name: 'Violet' }, { id: 'tank', name: 'Tank' },
];

let DICT = null;
function dictionary() {
  if (!DICT) {
    const read = (f) => readFileSync(new URL(`../public/word-wrangler/${f}`, import.meta.url), 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
    const words = read('words.txt');
    let common = null;
    try { common = new Set(read('cpu.txt')); } catch { common = null; }
    DICT = { dict: new Set(words), common, trie: E.buildTrie(words) };
  }
  return DICT;
}

const newToken = () => randomBytes(18).toString('base64url');
const newId = () => randomBytes(6).toString('base64url');
const clean = (s, n = 18) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
function err(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20000) { reject(err(413, 'TOO_LARGE', 'Request too large.')); req.destroy(); } });
    req.on('end', () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(err(400, 'BAD_JSON', 'Bad request.')); } });
    req.on('error', reject);
  });
}
function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

export function createWordWranglerApi() {
  const rooms = new Map();
  let lastSweep = Date.now();

  const sweep = () => {
    const cutoff = Date.now() - ROOM_TTL_MS;
    for (const [k, r] of rooms) if (r.updatedAt < cutoff) rooms.delete(k);
  };
  const newCode = () => {
    for (let i = 0; i < 50; i++) {
      const c = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      if (!rooms.has(c)) return c;
    }
    throw err(503, 'NO_CODE', 'Try again in a moment.');
  };

  // advance the room clock: countdown → playing → over, and let CPUs play
  function tick(room, now = Date.now()) {
    if (room.phase === 'countdown' && now >= room.startsAt) room.phase = 'playing';
    if (room.phase === 'playing' || (room.phase === 'over' && room.cpuPending)) {
      const until = Math.min(now, room.endsAt);
      const D = room.players.some(p => p.isAI) ? dictionary() : null;
      for (const p of room.players) {
        if (!p.isAI || !p.st) continue;
        for (let guard = 0; guard < 40 && p.nextAt <= until; guard++) {
          const pick = E.cpuPickWord(p.st, D.trie, p.level, { common: D.common });
          if (pick) { const r = E.applyWord(p.st, pick.path, D.dict); if (r.ok) { p.st = r.state; p.last = { w: r.word, p: r.points, at: p.nextAt }; } }
          else p.st = E.shuffleBoard(p.st);
          p.nextAt += E.cpuDelayMs(p.level);
        }
      }
      room.cpuPending = false;
    }
    if (room.phase === 'playing' && now >= room.endsAt) room.phase = 'over';
  }

  function pubPlayer(room, p, now, reveal) {
    const st = p.st;
    return {
      id: p.id, name: p.name, isAI: !!p.isAI, level: p.level || null, char: p.char || null,
      isHost: p.id === room.hostId, online: p.isAI || now - (p.lastSeen || 0) < 12000,
      score: st ? st.score : 0, words: st ? st.words.length : 0, best: st?.best || null,
      last: p.last ? { w: p.last.w, p: p.last.p } : null, caught: st?.caught || 0, escaped: st?.escaped || 0,
      list: reveal && st ? st.words.map(w => ({ w: w.w, p: w.p })) : undefined,
    };
  }
  function view(room, me, now = Date.now(), full = false) {
    const reveal = room.phase === 'over';
    const out = {
      room: {
        code: room.code, phase: room.phase, round: room.round, duration: room.duration,
        startsAt: room.startsAt || null, endsAt: room.endsAt || null, now,
        seed: room.phase === 'lobby' ? null : room.seed, hostId: room.hostId,
        players: room.players.map(p => pubPlayer(room, p, now, reveal)),
      },
      you: me ? { id: me.id, name: me.name, isHost: me.id === room.hostId } : null,
    };
    if (me && me.st) out.mine = full ? { moves: me.st.moves, score: me.st.score, state: me.st } : { moves: me.st.moves, score: me.st.score };
    return out;
  }
  const findMe = (room, token) => (token ? room.players.find(p => p.token === token) || null : null);

  function act(room, me, body, now) {
    const a = String(body.action || '');
    const isHost = me && me.id === room.hostId;
    const need = (c, m, code = 'NOT_ALLOWED', status = 403) => { if (!c) throw err(status, code, m); };
    switch (a) {
      case 'addCpu': {
        need(isHost, 'Only the host can add CPU players.');
        need(room.phase === 'lobby' || room.phase === 'over', 'Wait for this race to finish.', 'IN_PROGRESS', 409);
        need(room.players.length < MAX_PLAYERS, 'The room is full.', 'FULL', 409);
        const used = new Set(room.players.map(p => p.char).filter(Boolean));
        const c = CPU_CREW.find(x => x.id === body.char && !used.has(x.id)) || CPU_CREW.find(x => !used.has(x.id)) || CPU_CREW[0];
        const level = Math.max(1, Math.min(10, Math.round(Number(body.level) || 5)));
        room.players.push({ id: newId(), name: c.name, isAI: true, level, char: c.id, token: null, st: null });
        return {};
      }
      case 'remove': {
        need(isHost, 'Only the host can remove players.');
        const i = room.players.findIndex(p => p.id === body.playerId);
        need(i >= 0 && room.players[i].id !== room.hostId, 'Can’t remove that player.', 'BAD_PLAYER', 400);
        room.players.splice(i, 1);
        return {};
      }
      case 'setDuration': {
        need(isHost, 'Only the host can change the timer.');
        const s = Number(body.seconds);
        need(DURATIONS.includes(s), 'Pick 1:30, 2:30 or 4:00.', 'BAD_DURATION', 400);
        room.duration = s;
        return {};
      }
      case 'start': {
        need(isHost, 'Only the host can start the race.');
        need(room.phase === 'lobby' || room.phase === 'over', 'A race is already running.', 'IN_PROGRESS', 409);
        room.round++;
        room.seed = `${room.code}-${room.round}-${randomBytes(4).toString('hex')}`;
        room.startsAt = now + COUNTDOWN_MS;
        room.endsAt = room.startsAt + room.duration * 1000;
        room.phase = 'countdown';
        for (const p of room.players) {
          p.st = E.createGame({ seed: room.seed, mode: 'race' });
          p.last = null;
          if (p.isAI) p.nextAt = room.startsAt + E.cpuDelayMs(p.level);
        }
        return {};
      }
      case 'word':
      case 'shuffle': {
        need(me, 'Join the room first.', 'NO_SEAT', 403);
        need(room.phase === 'playing' || (room.phase === 'over' && now < room.endsAt + GRACE_MS), room.phase === 'over' ? 'Time’s up!' : 'The race hasn’t started.', 'NOT_PLAYING', 409);
        need(me.st, 'You weren’t in this race.', 'NO_STATE', 409);
        if (Number(body.move) !== me.st.moves) return { desync: true };
        if (a === 'shuffle') { me.st = E.shuffleBoard(me.st); return { ok: true }; }
        const r = E.applyWord(me.st, body.path, dictionary().dict);
        if (!r.ok) return { ok: false, reason: r.reason, desync: true };
        me.st = r.state; me.last = { w: r.word, p: r.points, at: now };
        return { ok: true, word: r.word, points: r.points };
      }
      case 'leave': {
        if (!me) return {};
        if (me.id === room.hostId) {
          const next = room.players.find(p => !p.isAI && p.id !== me.id);
          room.hostId = next ? next.id : room.hostId;
        }
        if (room.phase === 'lobby') room.players = room.players.filter(p => p.id !== me.id);
        else me.token = null;
        return {};
      }
      default: throw err(400, 'UNKNOWN_ACTION', 'Unknown action.');
    }
  }

  return async function handleWordWranglerApi(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname.replace(/^\/ww-api/, '') || '/';
    const token = String(req.headers['x-ww-token'] || '');
    const now = Date.now();
    try {
      if (now - lastSweep > 10 * 60 * 1000) { lastSweep = now; sweep(); }
      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, service: 'word-wrangler', rooms: rooms.size });

      if (req.method === 'POST' && path === '/rooms') {
        const body = await readBody(req);
        const name = clean(body.name);
        if (!name) throw err(400, 'NAME_REQUIRED', 'Enter your name.');
        if (rooms.size > 2000) throw err(503, 'BUSY', 'Too many rooms right now — try again soon.');
        const code = newCode();
        const host = { id: newId(), name, token: newToken(), isAI: false, st: null, lastSeen: now };
        const room = { code, phase: 'lobby', round: 0, duration: 150, seed: null, startsAt: 0, endsAt: 0, hostId: host.id, players: [host], createdAt: now, updatedAt: now };
        rooms.set(code, room);
        return send(res, 200, { roomCode: code, token: host.token, playerId: host.id, ...view(room, host, now) });
      }

      const m = path.match(/^\/rooms\/([A-Za-z]{4,6})(\/action)?$/);
      if (!m) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      const code = m[1].toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(res, 404, { error: { code: 'ROOM_NOT_FOUND', message: `Room ${code} wasn’t found.` } });

      if (req.method === 'GET' && !m[2]) {
        tick(room, now);
        const me = findMe(room, token);
        if (me) me.lastSeen = now;
        return send(res, 200, view(room, me, now, url.searchParams.get('full') === '1'));
      }

      if (req.method === 'POST' && m[2]) {
        const body = await readBody(req);
        const t = Date.now();
        tick(room, t);
        let me = findMe(room, token);
        let issued;
        if (body.action === 'join') {
          if (!me) {
            const name = clean(body.name);
            if (!name) throw err(400, 'NAME_REQUIRED', 'Type your name first.');
            const humans = room.players.filter(p => !p.isAI).length;
            if (room.players.length >= MAX_PLAYERS) {
              // bump a CPU to make room for a human
              const cpu = room.phase === 'lobby' || room.phase === 'over' ? room.players.findIndex(p => p.isAI) : -1;
              if (cpu < 0 || humans >= MAX_PLAYERS) throw err(409, 'FULL', 'This room is full.');
              room.players.splice(cpu, 1);
            }
            me = { id: newId(), name, token: newToken(), isAI: false, st: null, lastSeen: t };
            room.players.push(me);
            issued = me.token;
          }
          me.lastSeen = t;
          room.updatedAt = t;
          return send(res, 200, { token: issued || token, playerId: me.id, ...view(room, me, t) });
        }
        const result = act(room, me, body, t);
        if (me) me.lastSeen = t;
        room.updatedAt = t;
        const out = { result, ...view(room, me, t, !!result.desync) };
        return send(res, 200, out);
      }
      return send(res, 405, { error: { code: 'METHOD', message: 'Method not allowed.' } });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[word-wrangler] error', e);
      return send(res, status, { error: { code: e.code || 'SERVER_ERROR', message: status >= 500 ? 'Word Wrangler hit a snag. Try again.' : e.message } });
    }
  };
}
