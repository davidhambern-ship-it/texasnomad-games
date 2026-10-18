// Integration smoke test: emergency guest play must not rely on Neon or a real login.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRodeoRumbleLive } from '../server/rodeoRumbleLive.mjs';

const guest = createRodeoRumbleLive({
  guest: true,
  wsPath: '/rr-guest',
  apiPrefix: '/rr-guest-api',
  claimRoomCode: async () => true,
  touchRoomCode: async () => {},
  releaseRoomCode: async () => {},
  recordResults: async () => ({ recorded: 0 }),
});
const normal = createRodeoRumbleLive(); // Must still reject unauthenticated hosts.

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/rr-guest-api')) return guest.handleHttp(req, res);
  res.writeHead(404);
  res.end();
});
server.on('upgrade', (req, socket, head) => {
  if (guest.handleUpgrade(req, socket, head)) return;
  if (normal.handleUpgrade(req, socket, head)) return;
  socket.destroy();
});

const clients = [];
function waitFor(ws, eventType, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timed out waiting for ${eventType}`));
    }, timeoutMs);
    const handler = (buffer) => {
      let message;
      try { message = JSON.parse(String(buffer)); } catch { return; }
      if (message.t !== eventType) return;
      clearTimeout(timeout);
      ws.off('message', handler);
      resolve(message);
    };
    ws.on('message', handler);
  });
}
async function connect(url) {
  const ws = new WebSocket(url);
  clients.push(ws);
  await once(ws, 'open');
  return ws;
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const base = `ws://127.0.0.1:${port}`;

  const host = await connect(`${base}/rr-guest`);
  const roomWait = waitFor(host, 'room');
  host.send(JSON.stringify({ t: 'host' }));
  const room = await roomWait;
  assert.match(room.code, /^[A-Z]{5}$/);
  assert.ok(room.token, 'Guest host must receive an unguessable room token');

  const player = await connect(`${base}/rr-guest`);
  const joinWait = waitFor(player, 'joined');
  const hostJoinWait = waitFor(host, 'pjoin');
  player.send(JSON.stringify({ t: 'join', code: room.code, name: 'Guest Player' }));
  const [seat, notice] = await Promise.all([joinWait, hostJoinWait]);
  assert.equal(seat.name, 'Guest Player');
  assert.equal(notice.name, 'Guest Player');

  const pickWait = waitFor(host, 'pick');
  player.send(JSON.stringify({ t: 'pick', fighter: 'tex' }));
  const picked = await pickWait;
  assert.equal(picked.fighter, 'tex');

  const response = await fetch(`http://127.0.0.1:${port}/rr-guest-api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.rooms, 1);
  assert.equal(health.players, 1);

  const authenticatedOnly = await connect(`${base}/rr-live`);
  const deniedWait = waitFor(authenticatedOnly, 'error');
  authenticatedOnly.send(JSON.stringify({ t: 'host' }));
  const denied = await deniedWait;
  assert.equal(denied.code, 'AUTH_REQUIRED');

  process.stdout.write('PASS emergency guest host, join, input, health and normal-route isolation\n');
} finally {
  for (const client of clients) client.terminate();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}
