import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { createSeeThatApi } from './seeThatApi.mjs';
import { createWordWranglerApi } from './wordWranglerApi.mjs';
import { createBattleSudokuApi } from './battleSudokuApi.mjs';

function request(method, url, body = undefined, headers = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [raw] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function response() {
  return {
    status: 200,
    headers: {},
    headersSent: false,
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

async function call(handler, method, url, body, headers = {}) {
  const res = response();
  await handler(request(method, url, body, headers), res);
  return {
    status: res.status,
    payload: res.body ? JSON.parse(res.body) : null,
  };
}

const host = {
  accountId: null,
  guestId: 'guest-host-001',
  publicName: 'Guest Host',
  isGuest: true,
};
const player = {
  accountId: null,
  guestId: 'guest-player-002',
  publicName: 'Guest Player',
  isGuest: true,
};

function guestResolver(req) {
  const token = String(req.headers['x-tng-guest-token'] || '');
  if (token === 'signed-host') return host;
  if (token === 'signed-player') return player;
  return null;
}

function sharedOptions() {
  return {
    resolveIdentity: guestResolver,
    recordResults: async () => ({ recorded: 0 }),
    claimRoomCode: async () => true,
    touchRoomCode: async () => {},
    releaseRoomCode: async () => {},
  };
}

test('See That allows a signed guest to host and protects host controls', async () => {
  const api = createSeeThatApi(sharedOptions());
  const created = await call(api, 'POST', '/st-api/rooms', {});
  assert.equal(created.status, 200);
  assert.ok(created.payload.roomCode);
  assert.ok(created.payload.token);

  const hostView = await call(
    api,
    'GET',
    `/st-api/rooms/${created.payload.roomCode}`,
    undefined,
    { 'x-st-token': created.payload.token, 'x-tng-guest-token': 'signed-host' },
  );
  assert.equal(hostView.status, 200);
  assert.equal(hostView.payload.you?.isHost, true);

  const stolenTokenView = await call(
    api,
    'GET',
    `/st-api/rooms/${created.payload.roomCode}`,
    undefined,
    { 'x-st-token': created.payload.token, 'x-tng-guest-token': 'signed-player' },
  );
  assert.equal(stolenTokenView.payload.you?.isHost, undefined);
});

test('Word Wrangler allows signed guests to create and join a room', async () => {
  const api = createWordWranglerApi(sharedOptions());
  const created = await call(
    api,
    'POST',
    '/ww-api/rooms',
    {},
    { 'x-tng-guest-token': 'signed-host' },
  );
  assert.equal(created.status, 200);
  assert.ok(created.payload.roomCode);
  assert.ok(created.payload.token);

  const joined = await call(
    api,
    'POST',
    `/ww-api/rooms/${created.payload.roomCode}/action`,
    { action: 'join' },
    { 'x-tng-guest-token': 'signed-player' },
  );
  assert.equal(joined.status, 200);
  assert.ok(joined.payload.token);
  assert.equal(joined.payload.you?.name, 'Guest Player');
});

test('Battle Sudoku allows a signed guest to host and join without granting another guest host rights', async () => {
  const api = createBattleSudokuApi(sharedOptions());
  const created = await call(
    api,
    'POST',
    '/bs-api/rooms',
    {},
    { 'x-tng-guest-token': 'signed-host' },
  );
  assert.equal(created.status, 200);
  assert.ok(created.payload.roomCode);
  assert.ok(created.payload.token);

  const hostView = await call(
    api,
    'GET',
    `/bs-api/rooms/${created.payload.roomCode}`,
    undefined,
    { 'x-bs-token': created.payload.token, 'x-tng-guest-token': 'signed-host' },
  );
  assert.equal(hostView.status, 200);
  assert.equal(hostView.payload.you?.isHost, true);

  const wrongIdentityView = await call(
    api,
    'GET',
    `/bs-api/rooms/${created.payload.roomCode}`,
    undefined,
    { 'x-bs-token': created.payload.token, 'x-tng-guest-token': 'signed-player' },
  );
  assert.equal(wrongIdentityView.payload.you?.isHost, undefined);

  const joined = await call(
    api,
    'POST',
    `/bs-api/rooms/${created.payload.roomCode}/action`,
    { action: 'join' },
    { 'x-tng-guest-token': 'signed-player' },
  );
  assert.equal(joined.status, 200);
  assert.ok(joined.payload.token);
});
