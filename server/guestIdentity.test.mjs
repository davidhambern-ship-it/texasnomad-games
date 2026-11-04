import test from 'node:test';
import assert from 'node:assert/strict';
import { issueGuestIdentity, verifyGuestIdentity } from './guestIdentity.mjs';

const secret = 'test-only-secret-with-at-least-thirty-two-characters';

test('guest identity round-trips with a sanitized display name', () => {
  const issued = issueGuestIdentity({ name: '  Nomad <One>  ', secret, now: 1_800_000_000_000 });
  const verified = verifyGuestIdentity(issued.token, { secret, now: 1_800_000_001_000 });

  assert.equal(verified?.publicName, 'Nomad One');
  assert.equal(verified?.isGuest, true);
  assert.equal(verified?.guestId, issued.identity.sub);
});

test('guest identity rejects a modified signature', () => {
  const issued = issueGuestIdentity({ name: 'Nomad', secret });
  const altered = issued.token.slice(0, -1) + (issued.token.endsWith('a') ? 'b' : 'a');
  assert.equal(verifyGuestIdentity(altered, { secret }), null);
});

test('guest identity rejects expired tokens', () => {
  const now = 1_800_000_000_000;
  const issued = issueGuestIdentity({ name: 'Nomad', secret, now, ttlSeconds: 60 });
  assert.equal(verifyGuestIdentity(issued.token, { secret, now: now + 61_000 }), null);
});

test('guest identity fails closed without a strong secret or player name', () => {
  assert.throws(() => issueGuestIdentity({ name: 'Nomad', secret: 'short' }));
  assert.throws(() => issueGuestIdentity({ name: '   ', secret }));
  assert.equal(verifyGuestIdentity('anything', { secret: 'short' }), null);
});
