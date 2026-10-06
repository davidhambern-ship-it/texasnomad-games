import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createRodeoRumbleLive } from '../server/rodeoRumbleLive.mjs';

const relay = createRodeoRumbleLive({
  verifyHostAuthorization: async ({ token }) => token === 'host-auth' ? { accountId: 'host' } : null,
  resolvePlayerIdentity: async ({ token }) => token ? { accountId: token, publicName: token } : null,
});
const server = createServer((req, res) => relay.handleHttp(req, res));
server.on('upgrade', (req, socket, head) => relay.handleUpgrade(req, socket, head));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const sockets = [];
async function connect(hello) {
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/rr-live`);
  const messages = [];
  ws.addEventListener('message', e => messages.push(JSON.parse(e.data)));
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.send(JSON.stringify(hello));
  sockets.push(ws);
  return { ws, messages, send: msg => ws.send(JSON.stringify(msg)), wait: async type => {
    const end = Date.now() + 3000;
    while (Date.now() < end) {
      const i = messages.findIndex(msg => msg.t === type);
      if (i >= 0) return messages.splice(i, 1)[0];
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`Missing ${type}`);
  } };
}
try {
  const host = await connect({ t: 'host', authToken: 'host-auth' });
  const room = await host.wait('room');
  const p1 = await connect({ t: 'join', code: room.code, authToken: 'player-one' });
  const one = await p1.wait('joined');
  const p2 = await connect({ t: 'join', code: room.code, authToken: 'player-two' });
  const two = await p2.wait('joined');
  assert.equal(relay.stats().displays, 0);
  const frame = { game: { fighters: [{ id: one.id }, { id: two.id }], stage: { id: 'mesa' } }, count: 2, tags: {} };
  host.send({ t: 'frame', frame });
  assert.deepEqual((await p1.wait('frame')).frame, frame);
  assert.deepEqual((await p2.wait('frame')).frame, frame);
  p1.send({ t: 'i', b: 2, x: 40, y: 0 });
  const input = await host.wait('i');
  assert.equal(input.id, one.id); assert.equal(input.b, 2);
  p2.ws.close();
  const rejoined = await connect({ t: 'join', code: room.code, authToken: 'player-two', token: two.token });
  assert.deepEqual((await rejoined.wait('joined')).frame, frame);
  host.send({ t: 'reset' });
  assert.equal((await p1.wait('frame')).frame, null);
  assert.equal((await rejoined.wait('frame')).frame, null);
  console.log('PASS: two players receive identical full arena frames with zero displays; input works; reconnect restores frame; reset clears frame.');
} finally {
  sockets.forEach(ws => ws.close());
  server.close();
}
