// ─────────────────────────────────────────────────────────────────────────────
// See That?! — party rooms (served by server.mjs under /st-api)
//
// The big screen (host) shows the scene; players race on their phones. Every
// tap is checked here against the scene's hidden-object boxes, so the first
// real find claims the object. Scenes are read from public/see-that/scenes/*.json
// (drop a new image + json in that folder and it shows up — no list to edit).
//
// Routes (JSON; token in the X-ST-Token header):
//   GET  /st-api/health
//   GET  /st-api/scenes                         → [{ id, title, image, width, height, count }]
//   POST /st-api/rooms                          → { roomCode, token, room }   (token = host)
//   GET  /st-api/rooms/:code                    → { room, you, mine }
//   POST /st-api/rooms/:code/action  { action, ... }
//        host:   settings{sceneId,count,seconds,rounds} · start · next · reset · kick{playerId}
//        player: join{name} · tap{x,y,round} · hint{round} · leave
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as E from '../src/lib/seeThatEngine.js';

const SCENE_DIR = new URL('../public/see-that/scenes/', import.meta.url);
const LIB_FILE = new URL('../public/see-that/objects/objects.json', import.meta.url);
let libCache = { at: 0, list: [] };
function library() {
  if (Date.now() - libCache.at < 30000 && libCache.list.length) return libCache.list;
  try { libCache = { at: Date.now(), list: JSON.parse(readFileSync(LIB_FILE, 'utf8')).objects || [] }; }
  catch (e) { console.warn('[see-that] object library unreadable', e.message); libCache = { at: Date.now(), list: [] }; }
  return libCache.list;
}
// last placement per scene (across all rooms) so the next game never reuses the same spots
const lastSpots = new Map();
const MAX_PLAYERS = 12;
const COUNTDOWN_MS = 4000;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const COLORS = ['#ffd700', '#ff5f1f', '#22d3ee', '#3ef08a', '#ff7ad9', '#a855f7', '#f97316', '#60a5fa', '#facc15', '#f43f5e', '#14b8a6', '#e5e7eb'];

// ── scenes ──────────────────────────────────────────────────────────────────
let sceneCache = { at: 0, list: [], byId: new Map() };
function scenes() {
  if (Date.now() - sceneCache.at < 30000 && sceneCache.list.length) return sceneCache;
  const byId = new Map();
  try {
    for (const f of readdirSync(SCENE_DIR)) {
      if (!f.endsWith('.json') || f === 'index.json') continue;
      try {
        const s = JSON.parse(readFileSync(new URL(f, SCENE_DIR), 'utf8'));
        if (!E.validScene(s)) { console.warn('[see-that] skipping invalid scene', f); continue; }
        try { statSync(new URL(s.image, SCENE_DIR)); } catch { console.warn('[see-that] scene image missing for', f); continue; }
        byId.set(s.id, s);
      } catch (e) { console.warn('[see-that] bad scene file', f, e.message); }
    }
  } catch (e) { console.warn('[see-that] scene folder unreadable', e.message); }
  const list = [...byId.values()].map(s => ({ id: s.id, title: s.title || s.id, image: `/see-that/scenes/${s.image}`, width: s.width, height: s.height, count: s.mode === 'dynamic' ? library().length : s.objects.length, dynamic: s.mode === 'dynamic' }))
    .sort((a, b) => a.title.localeCompare(b.title));
  sceneCache = { at: Date.now(), list, byId };
  return sceneCache;
}

const newToken = () => randomBytes(18).toString('base64url');
const newId = () => randomBytes(6).toString('base64url');
const clean = (s, n = 16) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
function err(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 10000) { reject(err(413, 'TOO_LARGE', 'Request too large.')); req.destroy(); } });
    req.on('end', () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(err(400, 'BAD_JSON', 'Bad request.')); } });
    req.on('error', reject);
  });
}
function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

export function createSeeThatApi({ store = null } = {}) {
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
    throw err(503, 'NO_CODE', 'Try again in a moment.');
  };

  function tick(room, now = Date.now()) {
    if (room.phase === 'countdown' && now >= room.round.startsAt) room.phase = 'playing';
    if (room.phase === 'playing' && E.roundOver(room.round, now)) finishRound(room, now);
  }
  function finishRound(room, now) {
    const r = room.round;
    for (const p of room.players) { const s = r.p[p.id]; if (s) p.total += s.score; }
    room.history.push({ sceneId: r.sceneId, at: now, scores: Object.fromEntries(room.players.map(p => [p.id, r.p[p.id]?.score || 0])) });
    room.phase = room.roundNo >= room.settings.rounds ? 'final' : 'roundover';
    room.endedAt = now;
  }
  function startRound(room, now) {
    const S = scenes();
    let scene = room.settings.sceneId !== 'random' ? S.byId.get(room.settings.sceneId) : null;
    if (!scene) {
      const pool = S.list.filter(s => s.id !== room.round?.sceneId);
      const pickFrom = pool.length ? pool : S.list;
      if (!pickFrom.length) throw err(409, 'NO_SCENES', 'No scenes are installed yet.');
      scene = S.byId.get(pickFrom[Math.floor(Math.random() * pickFrom.length)].id);
    }
    room.roundNo++;
    room.round = E.createRound(scene, { count: room.settings.count, seconds: room.settings.seconds, seed: `${room.code}-${room.roundNo}-${now}-${Math.random()}`, startsAt: now + COUNTDOWN_MS,
      library: library(), difficulty: room.settings.difficulty, avoid: lastSpots.get(scene.id) || [] });
    if (room.round.placements) lastSpots.set(scene.id, room.round.placements.map(p => ({ x: p.bx, y: p.by })));
    room.phase = 'countdown';
  }

  function view(room, me, now = Date.now()) {
    const S = scenes();
    const r = room.round;
    const scene = r ? S.byId.get(r.sceneId) : null;
    const byId = scene ? Object.fromEntries((r.objects || scene.objects || []).map(o => [o.id, o])) : {};
    const reveal = room.phase === 'roundover' || room.phase === 'final';
    const out = {
      room: {
        code: room.code, phase: room.phase, roundNo: room.roundNo, settings: room.settings, now,
        scene: scene ? { id: scene.id, title: scene.title, image: `/see-that/scenes/${scene.image}`, width: scene.width, height: scene.height } : null,
        startsAt: r?.startsAt || null, endsAt: r?.endsAt || null,
        targets: r ? r.ids.map(id => {
          const o = byId[id]; const f = r.found[id];
          const box = (f || reveal) && o ? { shape: o.shape, x: o.x, y: o.y, w: o.w, h: o.h } : null;
          return { id, name: o?.name || id, found: f ? { by: f.by, points: f.points, at: f.at } : null, box };
        }) : [],
        log: r ? r.log.slice(-12) : [],
        placements: r?.placements ? r.placements.map(p => ({ key: p.key, sprite: p.sprite, bx: p.bx, by: p.by, pw: p.pw, ph: p.ph, rot: p.rot })) : null,
        players: room.players.map(p => ({
          id: p.id, name: p.name, color: p.color, total: p.total + (room.phase === 'playing' || room.phase === 'countdown' ? (r?.p[p.id]?.score || 0) : 0),
          round: r?.p[p.id]?.score || 0, finds: r?.p[p.id]?.finds || 0, online: now - (p.lastSeen || 0) < 15000,
        })),
      },
      you: me ? { id: me.id, name: me.name, color: me.color, isHost: false } : null,
    };
    if (me && r) {
      const ps = r.p[me.id];
      out.mine = { lockUntil: ps?.lockUntil || 0, hintsLeft: ps ? ps.hintsLeft : E.HINTS_PER_ROUND, hints: (ps?.hints || []).filter(h => !r.found[h.id]), score: ps?.score || 0 };
    }
    return out;
  }

  function act(room, who, body, now) {
    const a = String(body.action || '');
    const isHost = who === 'host';
    const me = isHost ? null : who;
    const need = (c, m, code = 'NOT_ALLOWED', status = 403) => { if (!c) throw err(status, code, m); };
    switch (a) {
      case 'settings': {
        need(isHost, 'Only the host can change settings.');
        const s = room.settings;
        if (body.sceneId !== undefined) { const id = String(body.sceneId); need(id === 'random' || scenes().byId.has(id), 'Unknown scene.', 'BAD_SCENE', 400); s.sceneId = id; }
        if (body.count !== undefined) s.count = Math.max(3, Math.min(20, Math.round(Number(body.count) || 10)));
        if (body.seconds !== undefined) s.seconds = Math.max(30, Math.min(600, Math.round(Number(body.seconds) || 120)));
        if (body.rounds !== undefined) s.rounds = Math.max(1, Math.min(10, Math.round(Number(body.rounds) || 3)));
        if (body.difficulty !== undefined) s.difficulty = E.DIFFICULTY[body.difficulty] ? body.difficulty : 'normal';
        return {};
      }
      case 'start':
      case 'next': {
        need(isHost, 'Only the host can start.');
        need(room.phase === 'lobby' || room.phase === 'roundover', room.phase === 'final' ? 'The game is over — start a new one.' : 'A round is already running.', 'BAD_PHASE', 409);
        need(room.players.length > 0, 'Wait for at least one player to join.', 'NO_PLAYERS', 409);
        startRound(room, now);
        return {};
      }
      case 'reset': {
        need(isHost, 'Only the host can reset.');
        room.phase = 'lobby'; room.roundNo = 0; room.round = null; room.history = [];
        for (const p of room.players) p.total = 0;
        return {};
      }
      case 'kick': {
        need(isHost, 'Only the host can remove players.');
        room.players = room.players.filter(p => p.id !== body.playerId);
        return {};
      }
      case 'tap': {
        need(me, 'Join the game first.', 'NO_SEAT');
        if (!room.round || Number(body.round) !== room.roundNo) return { kind: 'stale' };
        const scene = scenes().byId.get(room.round.sceneId);
        if (!scene) return { kind: 'closed' };
        const res = E.applyTap(room.round, scene, me.id, Number(body.x), Number(body.y), now);
        if (room.phase === 'playing' && E.roundOver(room.round, now)) finishRound(room, now);
        return res;
      }
      case 'hint': {
        need(me, 'Join the game first.', 'NO_SEAT');
        if (!room.round || Number(body.round) !== room.roundNo) return { kind: 'stale' };
        const scene = scenes().byId.get(room.round.sceneId);
        return scene ? E.applyHint(room.round, scene, me.id, now) : { kind: 'closed' };
      }
      case 'leave': {
        if (me) { if (room.phase === 'lobby') room.players = room.players.filter(p => p.id !== me.id); else me.token = null; }
        return {};
      }
      default: throw err(400, 'UNKNOWN_ACTION', 'Unknown action.');
    }
  }

  return async function handleSeeThatApi(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname.replace(/^\/st-api/, '') || '/';
    const token = String(req.headers['x-st-token'] || '');
    const now = Date.now();
    try {
      if (now - lastSweep > 10 * 60 * 1000) {
        lastSweep = now;
        await sweepRooms(now);
      }
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, {
          ok: true,
          service: 'see-that',
          rooms: await roomCount(),
          scenes: scenes().list.length,
          persistent: Boolean(store),
        });
      }
      if (req.method === 'GET' && path === '/scenes') return send(res, 200, { scenes: scenes().list });

      if (req.method === 'POST' && path === '/rooms') {
        if ((await roomCount()) > 1000) throw err(503, 'BUSY', 'Too many games right now — try again soon.');
        const S = scenes();
        const code = await newCode();
        const room = {
          code, hostToken: newToken(), phase: 'lobby', roundNo: 0, round: null, history: [], players: [],
          settings: { sceneId: S.list[0]?.id || 'random', count: 10, seconds: 120, rounds: 3, difficulty: 'normal' }, createdAt: now, updatedAt: now,
        };
        await saveRoom(room, { force: true });
        const v = view(room, null, now);
        v.you = { isHost: true };
        return send(res, 200, { roomCode: code, token: room.hostToken, ...v });
      }

      const m = path.match(/^\/rooms\/([A-Za-z]{4,6})(\/action)?$/);
      if (!m) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
      const code = m[1].toUpperCase();
      const room = await loadRoom(code);
      if (!room) return send(res, 404, { error: { code: 'ROOM_NOT_FOUND', message: `Game ${code} wasn’t found.` } });
      const isHost = token && token === room.hostToken;
      const findMe = () => (token && !isHost ? room.players.find(p => p.token === token) || null : null);

      if (req.method === 'GET' && !m[2]) {
        const beforePhase = room.phase;
        tick(room, now);
        const me = findMe(); if (me) me.lastSeen = now;

        if (token || room.phase !== beforePhase) {
          room.updatedAt = now;
          await saveRoom(room, { force: room.phase !== beforePhase });
        }

        const v = view(room, me, now);
        if (isHost) v.you = { isHost: true };
        return send(res, 200, v);
      }
      if (req.method === 'POST' && m[2]) {
        const body = await readBody(req);
        const t = Date.now();
        tick(room, t);
        room.updatedAt = t;
        if (body.action === 'join') {
          let me = findMe(), issued;
          if (!me) {
            const name = clean(body.name);
            if (!name) throw err(400, 'NAME_REQUIRED', 'Type your name first.');
            if (room.players.length >= MAX_PLAYERS) throw err(409, 'FULL', 'This game is full.');
            const used = new Set(room.players.map(p => p.color));
            me = { id: newId(), name, token: newToken(), color: COLORS.find(c => !used.has(c)) || COLORS[room.players.length % COLORS.length], total: 0, lastSeen: t };
            room.players.push(me); issued = me.token;
          }
          me.lastSeen = t;
          await saveRoom(room, { force: true });
          return send(res, 200, { token: issued || token, playerId: me.id, ...view(room, me, t) });
        }
        const me = findMe();
        const result = act(room, isHost ? 'host' : me, body, t);
        if (me) me.lastSeen = t;
        await saveRoom(room, { force: true });
        const v = view(room, me, t);
        if (isHost) v.you = { isHost: true };
        return send(res, 200, { result, ...v });
      }
      return send(res, 405, { error: { code: 'METHOD', message: 'Method not allowed.' } });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[see-that] error', e);
      return send(res, status, { error: { code: e.code || 'SERVER_ERROR', message: status >= 500 ? 'See That hit a snag. Try again.' : e.message } });
    }
  };
}
