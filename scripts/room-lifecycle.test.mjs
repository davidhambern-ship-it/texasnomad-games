import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeRoomHost,
  closeRoomLifecycle,
  createRoomHostMember,
  createRoomMember,
  ensureRoomLifecycle,
  findRoomPlayer,
  hashRoomCapability,
  isRoomLifecycleClosed,
  leaveRoomMember,
  takePendingHostCapability,
} from '../server/roomLifecycle.mjs';

test('player and host capabilities are distinct and only hashes are stored', () => {
  const host = createRoomHostMember({
    id: 'host-1',
    name: 'Host',
    now: 100,
    fields: { st: null },
  });
  const room = {
    authVersion: 2,
    hostId: host.member.id,
    players: [host.member],
  };

  assert.ok(host.playerCapability);
  assert.ok(host.hostCapability);
  assert.notEqual(host.playerCapability, host.hostCapability);
  assert.equal(host.member.playerCapabilityHash, hashRoomCapability(host.playerCapability));
  assert.equal(host.member.hostCapabilityHash, hashRoomCapability(host.hostCapability));
  assert.equal('token' in host.member, false);
  assert.equal(findRoomPlayer(room, host.playerCapability), host.member);
  assert.equal(authorizeRoomHost(room, host.member, host.playerCapability, 101), false);
  assert.equal(authorizeRoomHost(room, host.member, host.hostCapability, 101), true);
});

test('legacy room snapshots upgrade without stranding existing seats', () => {
  const now = 10_000;
  const room = {
    code: 'ABCDE',
    phase: 'lobby',
    hostId: 'old-host',
    players: [
      { id: 'old-host', name: 'Old Host', token: 'legacy-player-token', isAI: false },
      { id: 'old-guest', name: 'Old Guest', token: 'legacy-guest-token', isAI: false },
    ],
  };

  assert.equal(ensureRoomLifecycle(room, { now }), true);
  assert.equal(room.authVersion, 2);
  assert.equal('token' in room.players[0], false);
  assert.equal(findRoomPlayer(room, 'legacy-player-token'), room.players[0]);
  assert.equal(findRoomPlayer(room, 'legacy-guest-token'), room.players[1]);
  assert.equal(authorizeRoomHost(room, room.players[0], null, now + 100), true);

  const newHostCapability = takePendingHostCapability(room, room.players[0]);
  assert.ok(newHostCapability);
  assert.equal(authorizeRoomHost(room, room.players[0], newHostCapability, now + 100), true);
  assert.equal(ensureRoomLifecycle(room, { now: now + 200 }), false);
});

test('host leave transfers control to the next human and issues a new host capability', () => {
  const host = createRoomHostMember({ id: 'host', name: 'Host', now: 100 });
  const guest = createRoomMember({ id: 'guest', name: 'Guest', now: 100 });
  const room = {
    authVersion: 2,
    status: 'live',
    phase: 'playing',
    hostId: host.member.id,
    players: [host.member, guest.member],
  };

  const result = leaveRoomMember(room, host.member, 200);
  assert.equal(result.transferredTo, guest.member);
  assert.equal(result.closed, false);
  assert.equal(room.hostId, guest.member.id);
  assert.equal(findRoomPlayer(room, host.playerCapability), null);
  assert.equal(authorizeRoomHost(room, guest.member, null, 201), false);

  const newHostCapability = takePendingHostCapability(room, guest.member);
  assert.ok(newHostCapability);
  assert.equal(authorizeRoomHost(room, guest.member, newHostCapability, 202), true);
  assert.equal(authorizeRoomHost(room, guest.member, guest.playerCapability, 202), false);
});

test('a host leaving an empty room closes it and revokes all capabilities', () => {
  const host = createRoomHostMember({ id: 'host', name: 'Host', now: 100 });
  const room = {
    authVersion: 2,
    status: 'live',
    phase: 'lobby',
    hostId: host.member.id,
    players: [host.member],
  };

  const result = leaveRoomMember(room, host.member, 200);
  assert.equal(result.closed, true);
  assert.equal(isRoomLifecycleClosed(room), true);
  assert.equal(room.players.length, 0);
  assert.equal(findRoomPlayer(room, host.playerCapability), null);
  assert.equal(authorizeRoomHost(room, host.member, host.hostCapability, 201), false);
});

test('closing a room revokes every player and host capability', () => {
  const host = createRoomHostMember({ id: 'host', name: 'Host', now: 100 });
  const guest = createRoomMember({ id: 'guest', name: 'Guest', now: 100 });
  const room = {
    authVersion: 2,
    status: 'live',
    phase: 'lobby',
    hostId: host.member.id,
    players: [host.member, guest.member],
  };

  closeRoomLifecycle(room, 300);
  assert.equal(isRoomLifecycleClosed(room), true);
  assert.equal(findRoomPlayer(room, host.playerCapability), null);
  assert.equal(findRoomPlayer(room, guest.playerCapability), null);
  assert.equal(authorizeRoomHost(room, host.member, host.hostCapability, 301), false);
});
