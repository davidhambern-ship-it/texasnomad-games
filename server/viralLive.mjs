// ─────────────────────────────────────────────────────────────────────────────
// VIRAL! live rooms — WebSocket relay served by server.mjs at /viral-live
//
// VIRAL is host-authoritative: the host's browser runs the whole game and
// broadcasts a compact snapshot on topic "state"; players send their button
// taps on topic "act". This relay just connects everyone using the same room
// code, passes those messages along, tracks who is connected (presence), and
// hands late joiners the latest snapshot. It never runs game rules.
//
// Wire protocol (JSON text frames):
//   client → server   { t:'emit', topic, data }      relay to everyone else in the room
//                     { t:'presence', p }            set my presence object (e.g. {role:'host'} / {seat:'p3'})
//                     { t:'ping' }
//   server → client   { t:'welcome', id, peers }     after connecting (peers = [{id, presence}], me included)
//                     { t:'msg', topic, data, from }
//                     { t:'peers', joined, left, peers }
//                     { t:'pong' }
// Connect with: wss://<host>/viral-live?room=viral-abcd
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';

const MAX_FRAME = 16 * 1024;         // VIRAL snapshots are kept under ~4 KB
const MAX_PEERS = 40;                // 12 seats + watchers
const MAX_MSGS_PER_10S = 120;        // per connection
const KEEP_STATE_MS = 6 * 60 * 60 * 1000; // remember the last snapshot of an empty room for 6 hours
const ROOM_RE = /^viral-[a-z]{4}$/;
const TOPICS = new Set(['state', 'act']);

export function createViralLive({ isAllowedOrigin = () => true } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME });
  const rooms = new Map(); // name → { peers: Map<id, {ws, presence}>, lastState, lastStateAt, hostId }

  const getRoom = (name) => {
    let r = rooms.get(name);
    if (!r) { r = { peers: new Map(), lastState: null, lastStateAt: 0, hostId: null }; rooms.set(name, r); }
    return r;
  };
  const peerList = (r) => [...r.peers].map(([id, p]) => ({ id, presence: p.presence || {} }));
  const send = (ws, obj) => { if (ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } } };
  const broadcast = (r, obj, exceptId) => { const s = JSON.stringify(obj); for (const [id, p] of r.peers) if (id !== exceptId && p.ws.readyState === 1) { try { p.ws.send(s); } catch { /* closed */ } } };

  wss.on('connection', (ws, req, roomName) => {
    const r = getRoom(roomName);
    if (r.peers.size >= MAX_PEERS) { ws.close(1013, 'Room is full'); return; }
    const id = randomBytes(6).toString('base64url');
    r.peers.set(id, { ws, presence: {} });
    ws.isAlive = true;
    let budget = MAX_MSGS_PER_10S, budgetAt = Date.now();

    send(ws, { t: 'welcome', id, peers: peerList(r) });
    if (r.lastState) send(ws, { t: 'msg', topic: 'state', data: r.lastState, from: r.hostId || 'host' });
    broadcast(r, { t: 'peers', joined: [{ id, presence: {} }], left: [], peers: peerList(r) }, id);

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw, isBinary) => {
      if (isBinary) return;
      const now = Date.now();
      if (now - budgetAt > 10000) { budget = MAX_MSGS_PER_10S; budgetAt = now; }
      if (--budget < 0) return; // drop floods quietly
      let m; try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m !== 'object') return;
      const me = r.peers.get(id); if (!me) return;

      if (m.t === 'ping') { send(ws, { t: 'pong' }); return; }

      if (m.t === 'presence') {
        const p = m.p && typeof m.p === 'object' ? m.p : {};
        const clean = {};
        if (p.role === 'host') clean.role = 'host';
        if (typeof p.seat === 'string' && p.seat.length <= 24) clean.seat = p.seat;
        if (typeof p.name === 'string') clean.name = p.name.slice(0, 24);
        me.presence = clean;
        if (clean.role === 'host') r.hostId = id; // the latest host connection owns the table
        broadcast(r, { t: 'peers', joined: [], left: [], peers: peerList(r) });
        return;
      }

      if (m.t === 'emit' && TOPICS.has(m.topic)) {
        if (m.topic === 'state') {
          if (r.hostId !== id) return; // only the host broadcasts the game
          r.lastState = m.data; r.lastStateAt = now;
        }
        broadcast(r, { t: 'msg', topic: m.topic, data: m.data ?? null, from: id }, id);
      }
    });
    ws.on('close', () => {
      r.peers.delete(id);
      if (r.hostId === id) r.hostId = null;
      broadcast(r, { t: 'peers', joined: [], left: [{ id }], peers: peerList(r) });
      if (!r.peers.size && !r.lastState) rooms.delete(roomName);
    });
    ws.on('error', () => {});
  });

  // Heartbeat: drop dead sockets, forget old empty rooms
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { try { ws.terminate(); } catch { /* gone */ } continue; }
      ws.isAlive = false; try { ws.ping(); } catch { /* gone */ }
    }
    const cutoff = Date.now() - KEEP_STATE_MS;
    for (const [name, r] of rooms) if (!r.peers.size && r.lastStateAt < cutoff) rooms.delete(name);
  }, 25000);
  timer.unref?.();

  return {
    // Call from server.on('upgrade'); returns true if it handled the request.
    handleUpgrade(request, socket, head) {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== '/viral-live') return false;
      const origin = String(request.headers.origin || '');
      let sameHost = false;
      try { sameHost = !!origin && new URL(origin).host === request.headers.host; } catch { /* bad origin */ }
      if (origin && !sameHost && !isAllowedOrigin(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return true;
      }
      const room = String(url.searchParams.get('room') || '').toLowerCase();
      if (!ROOM_RE.test(room)) { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return true; }
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request, room));
      return true;
    },
    resolveRoom(code) {
      const raw = String(code || '').trim().toLowerCase();
      const roomName = raw.startsWith('viral-') ? raw : `viral-${raw}`;
      if (!ROOM_RE.test(roomName)) {
        return { live: false, roomCode: raw.toUpperCase(), peers: 0 };
      }

      const room = rooms.get(roomName);
      const hostPresent = Boolean(room?.hostId && room.peers.has(room.hostId));
      return {
        live: hostPresent,
        roomCode: roomName.slice(6).toUpperCase(),
        peers: room?.peers.size || 0,
        hasState: Boolean(room?.lastState),
      };
    },
    stats() { let peers = 0; for (const r of rooms.values()) peers += r.peers.size; return { rooms: rooms.size, peers }; },
  };
}
