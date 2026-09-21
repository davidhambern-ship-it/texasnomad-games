import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDisplayToken,
  createPairingCode,
  hashDisplayToken,
  hashPairingCode,
} from '../../server/pairing.js';

process.env.TNG_PAIRING_SECRET = 'test-only-pairing-secret-that-is-long-enough';

test('pairing codes are six numeric characters', () => {
  const code = createPairingCode();
  assert.match(code, /^\d{6}$/);
});

test('pairing code hashes are deterministic without storing the code', () => {
  const first = hashPairingCode('123456');
  const second = hashPairingCode('123456');
  const different = hashPairingCode('654321');

  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.notEqual(first, '123456');
});

test('display tokens are random and stored as hashes', () => {
  const first = createDisplayToken();
  const second = createDisplayToken();

  assert.notEqual(first, second);
  assert.notEqual(hashDisplayToken(first), first);
  assert.equal(hashDisplayToken(first), hashDisplayToken(first));
});
