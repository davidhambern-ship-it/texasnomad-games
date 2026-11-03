import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createWordWranglerApi } from '../server/wordWranglerApi.mjs';

function makeStore(seed = new Map()) {
  const records = seed;
  return {
    records,
    async load(code) {
      const room = records.get(code);
      return room ? structuredClone(room) : null;
    },
    async save(code, room) {
      records.set(code, structuredClone(room));
    },
    async exists(code) {
      return records.has(code);
    },
    async count() {
      return records.size;
    },
    async cleanup() {},
  };
}

function makeApi(store) {
  const reserved = new Set();
  const handler = createWordWranglerApi({
    store,
    resolveIdentity: async () => null,
    recordResults: async () => ({ recorded: 0 }),
    claimRoomCode: async ({ code }) => {
      if (reserved.has(code)) return false;
      reserved.add(code);
      return true;
    },
    touchRoomCode: async () => {},
    releaseRoomCode: async (code) => reserved.delete(code),
  });
  return handler;
}

async function request(handler, { method = 'GET', url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;

  const response = { status: 0, headers: {}, body: '' };
  const res = {
    writeHead(status, responseHeaders = {}) {
      response.status = status;
      response.headers = responseHeaders;
    },
    end(payload = '') {
      response.body = String(payload);
    },
  };

  const pending = handler(req, res);
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
  await pending;
  return {
    status: response.status,
    headers: response.headers,
    body: response.body ? JSON.parse(response.body) : {},
  };
}

test('guest host and player lifecycle works without a TNG account', async () => {
  const store = makeStore();
  const api = makeApi(store);

  const created = await request(api, {
    method: 'POST',
    url: '/ww-api/rooms',
    body: { nickname: 'Host Guest' },
  });
  assert.equal(created.status, 200);
  assert.ok(created.body.roomCode);
  assert.ok(created.body.token);
  assert.ok(created.body.hostCapability);
  assert.equal(created.body.you.isHost, true);

  const saved = store.records.get(created.body.roomCode);
  assert.equal(JSON.stringify(saved).includes(created.body.token), false);
  assert.equal(JSON.stringify(saved).includes(created.body.hostCapability), false);

  const joined = await request(api, {
    method: 'POST',
    url: `/ww-api/rooms/${created.body.roomCode}/action`,
    body: { action: 'join', nickname: 'Guest Player' },
  });
  assert.equal(joined.status, 200);
  assert.ok(joined.body.token);
  assert.equal(joined.body.hostCapability, undefined);
  assert.equal(joined.body.you.isHost, false);

  const denied = await request(api, {
    method: 'POST',
    url: `/ww-api/rooms/${created.body.roomCode}/action`,
    headers: { 'x-ww-token': joined.body.token },
    body: { action: 'setDuration', seconds: 90 },
  });
  assert.equal(denied.status, 403);

  const hostLeft = await request(api, {
    method: 'POST',
    url: `/ww-api/rooms/${created.body.roomCode}/action`,
    headers: {
      'x-ww-token': created.body.token,
      'x-tng-host-capability': created.body.hostCapability,
    },
    body: { action: 'leave' },
  });
  assert.equal(hostLeft.status, 200);
  assert.equal(hostLeft.body.result.hostTransferred, true);

  const reclaimed = await request(api, {
    url: `/ww-api/rooms/${created.body.roomCode}`,
    headers: { 'x-ww-token': joined.body.token },
  });
  assert.equal(reclaimed.status, 200);
  assert.equal(reclaimed.body.you.isHost, true);
  assert.ok(reclaimed.body.hostCapability);

  const hostAction = await request(api, {
    method: 'POST',
    url: `/ww-api/rooms/${created.body.roomCode}/action`,
    headers: {
      'x-ww-token': joined.body.token,
      'x-tng-host-capability': reclaimed.body.hostCapability,
    },
    body: { action: 'setDuration', seconds: 90 },
  });
  assert.equal(hostAction.status, 200);
  assert.equal(hostAction.body.room.duration, 90);

  const closed = await request(api, {
    method: 'POST',
    url: `/ww-api/rooms/${created.body.roomCode}/action`,
    headers: {
      'x-ww-token': joined.body.token,
      'x-tng-host-capability': reclaimed.body.hostCapability,
    },
    body: { action: 'leave' },
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.result.closed, true);

  const afterClose = await request(api, {
    url: `/ww-api/rooms/${created.body.roomCode}`,
  });
  assert.equal(afterClose.status, 404);
});

test('legacy signed-in room tokens migrate to hashes and remain usable', async () => {
  const code = 'ABCDE';
  const legacyToken = 'legacy-host-seat-token';
  const store = makeStore(new Map([[
    code,
    {
      code,
      phase: 'lobby',
      round: 0,
      duration: 150,
      seed: null,
      startsAt: 0,
      endsAt: 0,
      hostId: 'legacy-host',
      players: [{
        id: 'legacy-host',
        accountId: null,
        name: 'Legacy Host',
        token: legacyToken,
        isAI: false,
        st: null,
        lastSeen: Date.now(),
      }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]]));
  const api = makeApi(store);

  const migrated = await request(api, {
    url: `/ww-api/rooms/${code}`,
    headers: { 'x-ww-token': legacyToken },
  });
  assert.equal(migrated.status, 200);
  assert.equal(migrated.body.you.isHost, true);
  assert.ok(migrated.body.hostCapability);

  const saved = store.records.get(code);
  assert.equal(saved.authVersion, 2);
  assert.equal('token' in saved.players[0], false);
  assert.ok(saved.players[0].playerCapabilityHash);

  const oldClientAction = await request(api, {
    method: 'POST',
    url: `/ww-api/rooms/${code}/action`,
    headers: { 'x-ww-token': legacyToken },
    body: { action: 'setDuration', seconds: 240 },
  });
  assert.equal(oldClientAction.status, 200);
});
