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
//                     { t:'presence', p }            set presence. Host claims must include
//                                                    p._tngHostAuth={token,deviceId}
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

export function createViralLive({
  isAllowedOrigin = () => true,
  verifyHostAuthorization = async () => null,
  resolvePlayerIdentity = async () => null,
  recordResults = async () => ({ recorded: 0 }),
  store = null,
} = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME });
  const rooms = new Map(); // name → { peers, lastState, lastStateAt, hostId, hostAccountId }
  const lastCheckpoint = new Map();
  const recordedSessions = new Set();

  async function getRoom(name) {
    let r = rooms.get(name);
    if (r) return r;

    let saved = null;
    if (store) {
      saved = await store.load(name).catch(() => null);
    }

    r = {
      peers: new Map(),
      lastState: saved?.lastState || null,
      lastStateAt: Number(saved?.lastStateAt || 0),
      hostId: null,
      hostAccountId: saved?.hostAccountId || null,
      playerAccounts:
        saved?.playerAccounts && typeof saved.playerAccounts === 'object'
          ? saved.playerAccounts
          : {},
      gameSerial: Math.max(1, Number(saved?.gameSerial || 1)),
      updatedAt: Number(saved?.updatedAt || saved?.lastStateAt || Date.now()),
    };
    rooms.set(name, r);
    return r;
  }

  async function persistRoom(name, r, { force = false } = {}) {
    if (!store || !r) return;

    const now = Date.now();
    const last = lastCheckpoint.get(name) || 0;
    if (!force && now - last < 3000) return;

    const updatedAt = Math.max(
      Number(r.lastStateAt || 0),
      Number(r.updatedAt || 0),
      now,
    );

    await store.save(name, {
      code: name,
      lastState: r.lastState || null,
      lastStateAt: Number(r.lastStateAt || 0),
      hostAccountId: r.hostAccountId || null,
      playerAccounts: r.playerAccounts || {},
      gameSerial: Math.max(1, Number(r.gameSerial || 1)),
      updatedAt,
    });

    r.updatedAt = updatedAt;
    lastCheckpoint.set(name, now);
  }
  async function maybeRecordResults(roomName, r, state) {
    if (!state || !state.w || !Array.isArray(state.ro) || !Array.isArray(state.pl)) return;

    const serial = Math.max(1, Number(r.gameSerial || 1));
    const sessionKey = `${roomName}:${serial}`;
    if (recordedSessions.has(sessionKey)) return;

    const results = [];

    state.ro.forEach((row, index) => {
      if (!Array.isArray(row)) return;

      const playerId = String(row[0] || '');
      const isAi = Boolean(row[3]);
      if (!playerId || isAi) return;

      const account =
        r.playerAccounts?.[playerId] ||
        (!Boolean(row[4]) && r.hostAccountId
          ? { accountId: r.hostAccountId }
          : null);

      const accountId = String(account?.accountId || '');
      if (!accountId) return;

      const playerState = Array.isArray(state.pl[index]) ? state.pl[index] : [];
      const followers = Math.max(0, Math.round(Number(playerState[1]) || 0));

      results.push({
        accountId,
        score: followers,
        won: String(state.w) === playerId,
      });
    });

    if (!results.length) {
      recordedSessions.add(sessionKey);
      return;
    }

    try {
      await recordResults({
        gameId: 'viral',
        sessionKey,
        roomCode: roomName.slice(6).toUpperCase(),
        results,
      });
      recordedSessions.add(sessionKey);
    } catch (error) {
      console.warn('[viral-live] result recording failed', error?.message || error);
    }
  }

  const peerList = (r) => [...r.peers].map(([id, p]) => {
    const presence = p.presence || {};
    const { accountId, ...publicPresence } = presence;
    return { id, presence: publicPresence };
  });
  const send = (ws, obj) => { if (ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } } };
  const broadcast = (r, obj, exceptId) => { const s = JSON.stringify(obj); for (const [id, p] of r.peers) if (id !== exceptId && p.ws.readyState === 1) { try { p.ws.send(s); } catch { /* closed */ } } };

  wss.on('connection', async (ws, req, roomName) => {
    const r = await getRoom(roomName);
    if (r.peers.size >= MAX_PEERS) { ws.close(1013, 'Room is full'); return; }
    const id = randomBytes(6).toString('base64url');
    r.peers.set(id, { ws, presence: {} });
    ws.isAlive = true;
    let budget = MAX_MSGS_PER_10S, budgetAt = Date.now();

    send(ws, { t: 'welcome', id, peers: peerList(r) });
    if (r.lastState) send(ws, { t: 'msg', topic: 'state', data: r.lastState, from: r.hostId || 'host' });
    broadcast(r, { t: 'peers', joined: [{ id, presence: {} }], left: [], peers: peerList(r) }, id);

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', async (raw, isBinary) => {
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

        if (p.role !== 'host' && typeof p.seat === 'string' && p.seat.length <= 24) {
          const playerAuth =
            p._tngPlayerAuth && typeof p._tngPlayerAuth === 'object'
              ? p._tngPlayerAuth
              : {};

          let identity = null;
          try {
            identity = await resolvePlayerIdentity({
              token: String(playerAuth.token || ''),
              roomName,
              request: req,
            });
          } catch {
            identity = null;
          }

          if (!identity?.accountId || !identity?.publicName) {
            me.presence = {};
            send(ws, {
              t: 'msg',
              topic: '__tng_player_auth',
              data: { ok: false, code: 'PLAYER_AUTH_REQUIRED' },
              from: 'tng',
            });
            broadcast(r, { t: 'peers', joined: [], left: [], peers: peerList(r) });
            return;
          }

          // One signed-in TNG account owns at most one online VIRAL seat.
          for (const [peerId, peer] of r.peers) {
            if (
              peerId !== id &&
              String(peer.presence?.accountId || '') === String(identity.accountId)
            ) {
              peer.presence = {};
            }
          }

          clean.seat = p.seat;
          clean.name = String(identity.publicName).slice(0, 24);
          clean.accountId = String(identity.accountId);

          r.playerAccounts = r.playerAccounts || {};
          r.playerAccounts[clean.seat] = {
            accountId: clean.accountId,
            name: clean.name,
          };
          r.updatedAt = now;
        } else if (typeof p.name === 'string') {
          clean.name = p.name.slice(0, 24);
        }

        if (p.role === 'host') {
          const hostAuth =
            p._tngHostAuth && typeof p._tngHostAuth === 'object'
              ? p._tngHostAuth
              : {};

          let verified = null;
          try {
            verified = await verifyHostAuthorization({
              token: String(hostAuth.token || ''),
              deviceId: String(hostAuth.deviceId || ''),
              roomName,
              request: req,
            });
          } catch {
            verified = null;
          }

          const accountId = String(verified?.accountId || '');
          const roomOwnedByAnotherAccount =
            r.hostAccountId &&
            accountId &&
            String(r.hostAccountId) !== accountId;

          if (!accountId || roomOwnedByAnotherAccount) {
            // A client may call itself "host", but without a verified active TNG
            // Host Controller it remains an ordinary peer and can never publish
            // authoritative game state.
            me.presence = clean;
            send(ws, {
              t: 'msg',
              topic: '__tng_host_auth',
              data: {
                ok: false,
                code: roomOwnedByAnotherAccount
                  ? 'ROOM_HOST_OWNED'
                  : 'HOST_AUTH_REQUIRED',
              },
              from: 'tng',
            });
            broadcast(r, { t: 'peers', joined: [], left: [], peers: peerList(r) });
            return;
          }

          clean.role = 'host';
          r.hostAccountId = accountId;
          r.hostId = id;
          r.updatedAt = now;
          me.presence = clean;
          await persistRoom(roomName, r, { force: true });

          send(ws, {
            t: 'msg',
            topic: '__tng_host_auth',
            data: { ok: true },
            from: 'tng',
          });
          broadcast(r, { t: 'peers', joined: [], left: [], peers: peerList(r) });
          return;
        }

        me.presence = clean;
        if (clean.seat && clean.accountId) {
          await persistRoom(roomName, r, { force: true });
          send(ws, {
            t: 'msg',
            topic: '__tng_player_auth',
            data: { ok: true, seat: clean.seat, name: clean.name },
            from: 'tng',
          });
        }
        broadcast(r, {
          t: 'peers',
          joined: clean.seat && clean.accountId ? [{ id }] : [],
          left: [],
          peers: peerList(r),
        });
        return;
      }

      if (m.t === 'emit' && TOPICS.has(m.topic)) {
        if (m.topic === 'state') {
          if (r.hostId !== id) return; // only the host broadcasts the game

          const previousWinner = r.lastState?.w || null;
          const nextWinner = m.data?.w || null;

          if (previousWinner && !nextWinner) {
            r.gameSerial = Math.max(1, Number(r.gameSerial || 1)) + 1;
          }

          r.lastState = m.data;
          r.lastStateAt = now;
          r.updatedAt = now;

          await maybeRecordResults(roomName, r, m.data);
          await persistRoom(roomName, r, { force: Boolean(nextWinner) });
        }
        broadcast(r, { t: 'msg', topic: m.topic, data: m.data ?? null, from: id }, id);
      }
    });
    ws.on('close', () => {
      r.peers.delete(id);
      if (r.hostId === id) r.hostId = null;
      broadcast(r, { t: 'peers', joined: [], left: [{ id }], peers: peerList(r) });
      if (!r.peers.size && !r.lastState) {
        rooms.delete(roomName);
        lastCheckpoint.delete(roomName);
        if (store) store.remove(roomName).catch(() => {});
      }
    });
    ws.on('error', () => {});
  });

  // Heartbeat: drop dead sockets, forget old empty rooms
  const timer = setInterval(async () => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { try { ws.terminate(); } catch { /* gone */ } continue; }
      ws.isAlive = false; try { ws.ping(); } catch { /* gone */ }
    }

    const cutoff = Date.now() - KEEP_STATE_MS;
    for (const [name, r] of rooms) {
      if (!r.peers.size && r.lastStateAt < cutoff) {
        rooms.delete(name);
        lastCheckpoint.delete(name);
        if (store) await store.remove(name).catch(() => {});
      }
    }

    if (store) await store.cleanup().catch(() => {});
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
    async resolveRoom(code) {
      const raw = String(code || '').trim().toLowerCase();
      const roomName = raw.startsWith('viral-') ? raw : `viral-${raw}`;
      if (!ROOM_RE.test(roomName)) {
        return { live: false, roomCode: raw.toUpperCase(), peers: 0 };
      }

      let room = rooms.get(roomName) || null;
      if (!room && store) {
        const saved = await store.load(roomName).catch(() => null);
        if (saved) {
          room = {
            peers: new Map(),
            lastState: saved.lastState || null,
            lastStateAt: Number(saved.lastStateAt || 0),
            hostId: null,
            hostAccountId: saved.hostAccountId || null,
            playerAccounts:
              saved.playerAccounts && typeof saved.playerAccounts === 'object'
                ? saved.playerAccounts
                : {},
            gameSerial: Math.max(1, Number(saved.gameSerial || 1)),
            updatedAt: Number(saved.updatedAt || saved.lastStateAt || Date.now()),
          };
          rooms.set(roomName, room);
        }
      }

      const hostPresent = Boolean(room?.hostId && room.peers.has(room.hostId));
      const hasState = Boolean(room?.lastState);
      return {
        // Persisted state still identifies this as a VIRAL room while the Host
        // reconnects after a container replacement.
        live: hostPresent || hasState,
        hostPresent,
        roomCode: roomName.slice(6).toUpperCase(),
        peers: room?.peers.size || 0,
        hasState,
      };
    },
    stats() { let peers = 0; for (const r of rooms.values()) peers += r.peers.size; return { rooms: rooms.size, peers }; },
  };
}
