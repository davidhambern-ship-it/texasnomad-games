import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const MAX_PLAYERS = 8;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const FIGHTERS = new Set(['tex', 'bronco', 'dusty', 'sparky', 'danni', 'katarina', 'brittani', 'richard', 'robert']);
const COLORS = ['#ff5f6d', '#3ec5ff', '#ffd23f', '#3ef08a', '#c77dff', '#ff9f1c', '#f15bb5', '#e5e7eb'];

const newToken = () => randomBytes(18).toString('base64url');
const newId = () => randomBytes(5).toString('base64url');
const clean = (value, n = 32) => String(value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export function createRodeoRumbleLive({
  isAllowedOrigin = () => true,
  verifyHostAuthorization = async () => null,
  resolvePlayerIdentity = async () => null,
  recordResults = async () => ({ recorded: 0 }),
  claimRoomCode = async () => true,
  touchRoomCode = async () => {},
  releaseRoomCode = async () => {},
  store = null,
  createRoomBridge = null,
} = {}) {
  const rooms = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const send = (ws, msg) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const roster = (room) => [...room.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    fighter: player.fighter,
    ready: player.ready,
    color: player.color,
    online: !!(player.ws && player.ws.readyState === WebSocket.OPEN),
  }));
  const sendPlayersLocal = (room, msg) => {
    const data = JSON.stringify(msg);
    for (const player of room.players.values()) {
      if (player.ws && player.ws.readyState === WebSocket.OPEN) player.ws.send(data);
    }
  };
  const sendDisplaysLocal = (room, msg) => {
    const data = JSON.stringify(msg);
    for (const ws of room.displays) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  };
  const sendHost = (room, msg) => {
    send(room.host, msg);
    room.bridge?.publish({ kind: 'to-host', message: msg });
  };
  const toPlayers = (room, msg) => {
    sendPlayersLocal(room, msg);
    room.bridge?.publish({ kind: 'to-players', message: msg });
  };
  const toDisplays = (room, msg) => {
    sendDisplaysLocal(room, msg);
    room.bridge?.publish({ kind: 'to-displays', message: msg });
  };
  function attachRoomBridge(room) {
    if (!createRoomBridge || room.bridge) return;
    room.bridge = createRoomBridge({
      game: 'rodeo-rumble',
      roomCode: room.code,
      onEvent: (event) => {
        if (!event || typeof event !== 'object') return;
        if (event.kind === 'to-host') {
          const message = event.message || {};
          if (message.t === 'pjoin') {
            const current = room.players.get(String(message.id));
            if (!current) {
              room.players.set(String(message.id), {
                id: String(message.id), name: clean(message.name), fighter: message.fighter || null,
                ready: Boolean(message.ready), color: message.color || nextColor(room),
                ws: null, remote: true,
              });
            } else {
              Object.assign(current, { name: clean(message.name), fighter: message.fighter || null, ready: Boolean(message.ready), color: message.color || current.color });
            }
          } else if (message.t === 'pleave' && message.gone) {
            const current = room.players.get(String(message.id));
            if (current?.remote) room.players.delete(String(message.id));
          }
          send(room.host, message);
        } else if (event.kind === 'to-players') {
          if (event.message?.t === 'host') room.hostOnline = Boolean(event.message.online);
          sendPlayersLocal(room, event.message || {});
        } else if (event.kind === 'to-displays') {
          sendDisplaysLocal(room, event.message || {});
        } else if (event.kind === 'kick') {
          const player = room.players.get(String(event.id || ''));
          if (player && player.ws) {
            send(player.ws, { t: 'error', code: 'KICKED', message: 'The host removed you from this rumble.' });
            try { player.ws.close(); } catch { /* ignore */ }
            room.players.delete(player.id);
            room.removedPlayerIds?.add(player.id);
            room.localPlayerIds?.delete(player.id);
            persistRoom(room).catch(() => {});
          }
        } else if (event.kind === 'room-closed') {
          const closed = { t: 'error', code: 'CLOSED', message: 'The host ended this rumble.' };
          sendPlayersLocal(room, closed);
          sendDisplaysLocal(room, closed);
          for (const player of room.players.values()) {
            try { player.ws?.close(); } catch { /* ignore */ }
          }
          for (const display of room.displays) {
            try { display.close(); } catch { /* ignore */ }
          }
          room.bridge?.close();
          rooms.delete(room.code);
        }
      },
    });
  }
  const touch = (room) => { room.updatedAt = Date.now(); };
  async function persistRoom(room) {
    if (!store || !room) return;
    const saved = await store.load(room.code).catch(() => null);
    const players = new Map((saved?.players || []).map((player) => [String(player.id), player]));
    for (const id of room.removedPlayerIds || []) players.delete(String(id));
    for (const id of room.localPlayerIds || []) {
      const player = room.players.get(String(id));
      if (player) {
        const { ws, remote, ...plain } = player;
        players.set(String(id), plain);
      } else {
        players.delete(String(id));
      }
    }
    const snapshot = {
      code: room.code, hostToken: room.hostToken, hostAccountId: room.hostAccountId,
      hostGuestId: room.hostGuestId, hostOnline: Boolean(room.hostOnline),
      lobby: room.lobby, latestFrame: room.latestFrame, latestResult: room.latestResult,
      matchSeq: room.matchSeq, recordedSeq: room.recordedSeq,
      createdAt: room.createdAt, updatedAt: room.updatedAt,
      players: [...players.values()],
    };
    await store.save(room.code, snapshot);
    room.removedPlayerIds?.clear();
  }
  async function loadRoom(code) {
    const key = String(code || '').toUpperCase();
    if (rooms.has(key)) return rooms.get(key);
    if (!store) return null;
    const saved = await store.load(key).catch(() => null);
    if (!saved) return null;
    const room = {
      ...saved, host: null, hostOnline: Boolean(saved.hostOnline),
      players: new Map((saved.players || []).map((player) => [String(player.id), { ...player, ws: null, remote: true }])),
      displays: new Set(), localPlayerIds: new Set(), removedPlayerIds: new Set(),
    };
    rooms.set(key, room);
    attachRoomBridge(room);
    return room;
  }
  const nextColor = (room) => {
    const used = new Set([...room.players.values()].map((player) => player.color));
    return COLORS.find((color) => !used.has(color)) || COLORS[room.players.size % COLORS.length];
  };

  async function createRoom(hostIdentity) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = Array.from(
        { length: 5 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');
      if (rooms.has(code)) continue;
      const ok = await claimRoomCode({
        code,
        gameId: 'rodeo-rumble',
        service: 'rodeo-rumble',
        kind: 'standalone',
        joinPath: `/games/rodeo-rumble?room=${encodeURIComponent(code)}`,
        spectatePath: `/games/rodeo-rumble?display=${encodeURIComponent(code)}`,
        hostAccountId: hostIdentity.accountId || null,
        ttlMs: ROOM_TTL_MS,
      }).catch(() => false);
      if (!ok) continue;
      const room = {
        code,
        hostToken: newToken(),
        hostAccountId: hostIdentity.accountId ? String(hostIdentity.accountId) : null,
        hostGuestId: hostIdentity.guestId ? String(hostIdentity.guestId) : null,
        host: null,
        hostOnline: false,
        players: new Map(),
        localPlayerIds: new Set(),
        removedPlayerIds: new Set(),
        displays: new Set(),
        lobby: null,
        latestFrame: null,
        latestResult: null,
        matchSeq: 0,
        recordedSeq: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      rooms.set(code, room);
      attachRoomBridge(room);
      await persistRoom(room).catch(() => {});
      return room;
    }
    return null;
  }

  async function maybeRecordResult(room, result) {
    if (!result || room.recordedSeq === room.matchSeq || room.matchSeq <= 0) return;
    const ranked = Array.isArray(result.ranked) ? result.ranked : [];
    const results = ranked
      .map((entry) => {
        const player = room.players.get(String(entry?.id || ''));
        if (!player?.accountId) return null;
        return {
          accountId: player.accountId,
          score: Math.max(0, Math.round(Number(entry.kos || 0) * 100 + Number(entry.dealt || 0))),
          won: String(entry.id) === String(result.winner || ''),
        };
      })
      .filter(Boolean);
    if (!results.length) {
      room.recordedSeq = room.matchSeq;
      return;
    }
    try {
      await recordResults({
        gameId: 'rodeo-rumble',
        sessionKey: `${room.code}:${room.createdAt}:${room.matchSeq}`,
        roomCode: room.code,
        results,
      });
      room.recordedSeq = room.matchSeq;
    } catch (error) {
      console.warn('[rodeo-rumble] result recording failed', error?.message || error);
    }
  }

  wss.on('connection', (ws) => {
    let role = null;
    let room = null;
    let me = null;
    let inCount = 0;
    let inWindow = Date.now();
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (buffer) => {
      let msg;
      try { msg = JSON.parse(buffer.toString()); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (!role) {
        if (msg.t === 'host') {
          const hostIdentity = await verifyHostAuthorization({
            token: msg.authToken,
            deviceId: msg.deviceId,
          }).catch(() => null);
          if (!hostIdentity?.accountId && !hostIdentity?.guestId) {
            send(ws, { t: 'error', code: 'AUTH_REQUIRED', message: 'Open Rodeo Rumble from the signed-in TNG Host Controller.' });
            ws.close(4000, 'auth required');
            return;
          }

          const code = String(msg.code || '').toUpperCase();
          const savedRoom = code ? await loadRoom(code) : null;
          if (
            savedRoom &&
            savedRoom.hostToken === msg.token &&
            (hostIdentity.accountId
              ? String(savedRoom.hostAccountId || '') === String(hostIdentity.accountId)
              : String(savedRoom.hostGuestId || '') === String(hostIdentity.guestId))
          ) {
            room = savedRoom;
          } else {
            room = await createRoom(hostIdentity);
          }
          if (!room) {
            send(ws, { t: 'error', code: 'NO_CODE', message: 'TNG could not reserve a room code. Try again.' });
            ws.close();
            return;
          }
          if (room.host && room.host !== ws) {
            try { room.host.close(4000, 'replaced'); } catch { /* ignore */ }
          }
          role = 'host';
          room.host = ws;
          room.hostOnline = true;
          touch(room);
          await persistRoom(room).catch(() => {});
          send(ws, { t: 'room', code: room.code, token: room.hostToken, players: roster(room) });
          toPlayers(room, { t: 'host', online: true });
          toDisplays(room, { t: 'host', online: true });
          return;
        }

        if (msg.t === 'join') {
          const code = String(msg.code || '').toUpperCase();
          room = await loadRoom(code);
          if (!room) {
            send(ws, { t: 'error', code: 'ROOM_NOT_FOUND', message: `Room ${code} wasn’t found. Check the code on the Host screen.` });
            ws.close();
            return;
          }
          const identity = await resolvePlayerIdentity({ token: msg.authToken }).catch(() => null);
          if ((!identity?.accountId && !identity?.guestId) || !identity?.publicName) {
            send(ws, { t: 'error', code: 'AUTH_REQUIRED', message: 'Choose a guest name or sign in to TNG before joining Rodeo Rumble.' });
            ws.close(4000, 'auth required');
            return;
          }

          const identityKey = identity.accountId
            ? `account:${identity.accountId}`
            : `guest:${identity.guestId}`;
          const seatByToken = msg.token
            ? [...room.players.values()].find((player) => player.token === msg.token)
            : null;
          const seatByIdentity = [...room.players.values()].find((player) =>
            player.identityKey === identityKey ||
            (identity.accountId && String(player.accountId || '') === String(identity.accountId)) ||
            (identity.guestId && String(player.guestId || '') === String(identity.guestId)),
          );
          me = seatByToken || seatByIdentity || null;

          const identityMatchesSeat = !me || (
            identity.accountId
              ? String(me.accountId || '') === String(identity.accountId)
              : String(me.guestId || '') === String(identity.guestId)
          );
          if (!identityMatchesSeat) {
            send(ws, { t: 'error', code: 'IDENTITY_MISMATCH', message: 'That Rodeo Rumble seat belongs to another player identity.' });
            ws.close(4000, 'identity mismatch');
            return;
          }

          if (!me) {
            if (room.players.size >= MAX_PLAYERS) {
              send(ws, { t: 'error', code: 'FULL', message: 'This rumble is full (8 players).' });
              ws.close();
              return;
            }
            me = {
              id: newId(),
              token: newToken(),
              identityKey,
              accountId: identity.accountId ? String(identity.accountId) : null,
              guestId: identity.guestId ? String(identity.guestId) : null,
              name: clean(identity.publicName),
              fighter: null,
              ready: false,
              color: nextColor(room),
              ws: null,
            };
            room.players.set(me.id, me);
          } else {
            me.identityKey = identityKey;
            me.name = clean(identity.publicName);
            if (!msg.token || msg.token !== me.token) me.token = newToken();
          }
          if (me.ws && me.ws !== ws) {
            try { me.ws.close(4000, 'replaced'); } catch { /* ignore */ }
          }
          me.ws = ws;
          me.remote = false;
          room.localPlayerIds.add(me.id);
          room.removedPlayerIds.delete(me.id);
          role = 'player';
          touch(room);
          await persistRoom(room).catch(() => {});
          send(ws, {
            t: 'joined',
            id: me.id,
            token: me.token,
            code: room.code,
            name: me.name,
            color: me.color,
            fighter: me.fighter,
            host: Boolean(room.hostOnline || room.host),
            lobby: room.lobby,
          });
          sendHost(room, { t: 'pjoin', id: me.id, name: me.name, fighter: me.fighter, ready: me.ready, color: me.color });
          return;
        }

        if (msg.t === 'display') {
          const code = String(msg.code || '').toUpperCase();
          room = await loadRoom(code);
          if (!room) {
            send(ws, { t: 'error', code: 'ROOM_NOT_FOUND', message: `Room ${code} wasn’t found.` });
            ws.close();
            return;
          }
          role = 'display';
          room.displays.add(ws);
          send(ws, {
            t: 'displayed',
            code: room.code,
            host: Boolean(room.hostOnline || room.host),
            lobby: room.lobby,
            frame: room.latestFrame,
            result: room.latestResult,
          });
          return;
        }
        return;
      }

      if (role === 'player') {
        if (!rooms.has(room.code) || !room.players.has(me.id)) {
          send(ws, { t: 'error', code: 'KICKED', message: 'You were removed from this rumble.' });
          ws.close();
          return;
        }
        if (msg.t === 'i') {
          const now = Date.now();
          if (now - inWindow > 1000) { inWindow = now; inCount = 0; }
          if (++inCount > 120) return;
          const b = Number(msg.b) & 15;
          const x = Math.max(-100, Math.min(100, Math.round(Number(msg.x) || 0)));
          const y = Math.max(-100, Math.min(100, Math.round(Number(msg.y) || 0)));
          if (room.host && room.host.readyState === WebSocket.OPEN) {
            room.host.send(`{"t":"i","id":"${me.id}","b":${b},"x":${x},"y":${y}}`);
          }
          return;
        }
        touch(room);
        if (msg.t === 'pick' && FIGHTERS.has(msg.fighter)) {
          me.fighter = msg.fighter;
          me.ready = false;
          sendHost(room, { t: 'pick', id: me.id, fighter: me.fighter });
          await persistRoom(room).catch(() => {});
          return;
        }
        if (msg.t === 'ready') {
          me.ready = !!msg.v;
          sendHost(room, { t: 'ready', id: me.id, v: me.ready });
          await persistRoom(room).catch(() => {});
          return;
        }
        if (msg.t === 'leave') {
          room.players.delete(me.id);
          room.localPlayerIds.delete(me.id);
          room.removedPlayerIds.add(me.id);
          await persistRoom(room).catch(() => {});
          sendHost(room, { t: 'pleave', id: me.id, gone: true });
          ws.close();
        }
        return;
      }

      if (role === 'host') {
        if (room.host !== ws) return;
        touch(room);
        if (msg.t === 'lobby') {
          const previousPhase = room.lobby?.phase || 'lobby';
          room.lobby = msg.lobby || null;
          if (room.lobby?.phase === 'fight' && previousPhase === 'lobby') {
            room.matchSeq += 1;
            room.latestResult = null;
          }
          toPlayers(room, { t: 'lobby', lobby: room.lobby });
          toDisplays(room, { t: 'lobby', lobby: room.lobby });
          await persistRoom(room).catch(() => {});
          return;
        }
        if (msg.t === 'status') {
          toPlayers(room, msg);
          return;
        }
        if (msg.t === 'frame') {
          room.latestFrame = msg.frame || null;
          toDisplays(room, { t: 'frame', frame: room.latestFrame });
          await persistRoom(room).catch(() => {});
          return;
        }
        if (msg.t === 'result') {
          room.latestResult = msg.result || null;
          toPlayers(room, msg);
          toDisplays(room, msg);
          await maybeRecordResult(room, room.latestResult);
          await persistRoom(room).catch(() => {});
          return;
        }
        if (msg.t === 'reset') {
          room.latestFrame = null;
          room.latestResult = null;
          toDisplays(room, { t: 'lobby', lobby: room.lobby });
          await persistRoom(room).catch(() => {});
          return;
        }
        if (msg.t === 'kick') {
          const player = room.players.get(String(msg.id));
          if (player) {
            send(player.ws, { t: 'error', code: 'KICKED', message: 'The host removed you from this rumble.' });
            try { player.ws?.close(); } catch { /* ignore */ }
            room.players.delete(player.id);
            room.localPlayerIds.delete(player.id);
            room.removedPlayerIds.add(player.id);
            await persistRoom(room).catch(() => {});
            sendHost(room, { t: 'pleave', id: player.id, gone: true });
          }
          room.bridge?.publish({ kind: 'kick', id: String(msg.id || '') });
          return;
        }
        if (msg.t === 'close') {
          toPlayers(room, { t: 'error', code: 'CLOSED', message: 'The host ended this rumble.' });
          toDisplays(room, { t: 'error', code: 'CLOSED', message: 'The host ended this rumble.' });
          room.bridge?.publish({ kind: 'room-closed' });
          room.bridge?.close();
          rooms.delete(room.code);
          releaseRoomCode(room.code, 'rodeo-rumble').catch(() => {});
          ws.close();
        }
      }
    });

    ws.on('close', () => {
      if (!room) return;
      if (role === 'host' && room.host === ws) {
        room.host = null;
        room.hostOnline = false;
        toPlayers(room, { t: 'host', online: false });
        toDisplays(room, { t: 'host', online: false });
        persistRoom(room).catch(() => {});
      }
      if (role === 'player' && me && me.ws === ws) {
        me.ws = null;
        room.localPlayerIds.delete(me.id);
        persistRoom(room).catch(() => {});
        sendHost(room, { t: 'pleave', id: me.id, gone: false });
      }
      if (role === 'display') room.displays.delete(ws);
    });
  });

  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
    const now = Date.now();
    for (const [code, room] of rooms) {
      const anyone = room.host || [...room.players.values()].some((player) => player.ws) || room.displays.size > 0;
      if (!anyone && now - room.updatedAt > 20 * 60 * 1000) {
        rooms.delete(code);
        room.bridge?.close();
        releaseRoomCode(code, 'rodeo-rumble').catch(() => {});
        continue;
      }
      if (now - room.updatedAt > ROOM_TTL_MS) {
        rooms.delete(code);
        releaseRoomCode(code, 'rodeo-rumble').catch(() => {});
        continue;
      }
      if (anyone && now - (room.touchedRegistry || 0) > 10 * 60 * 1000) {
        room.touchedRegistry = now;
        touchRoomCode(code, { ttlMs: ROOM_TTL_MS }).catch(() => {});
      }
    }
  }, 20_000);
  timer.unref?.();

  return {
    handleUpgrade(request, socket, head) {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== '/rr-live') return false;
      const origin = String(request.headers.origin || '');
      let sameHost = false;
      try { sameHost = !!origin && new URL(origin).host === request.headers.host; } catch { /* bad origin */ }
      if (origin && !sameHost && !isAllowedOrigin(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return true;
      }
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
      return true;
    },
    async handleHttp(req, res) {
      const url = new URL(req.url || '/', 'http://localhost');
      const json = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      if (url.pathname === '/rr-api/health') return json(200, { ok: true, service: 'rodeo-rumble', ...this.stats() });
      if (url.pathname === '/rr-api/resolve') {
        const code = String(url.searchParams.get('code') || '').toUpperCase();
        const liveRoom = await loadRoom(code);
        return json(200, {
          live: !!liveRoom,
          roomCode: code,
          hostPresent: Boolean(liveRoom?.hostOnline || liveRoom?.host),
          players: liveRoom ? liveRoom.players.size : 0,
        });
      }
      return json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
    },
    stats() {
      let players = 0;
      let displays = 0;
      for (const room of rooms.values()) {
        players += room.players.size;
        displays += room.displays.size;
      }
      return { rooms: rooms.size, players, displays };
    },
  };
}