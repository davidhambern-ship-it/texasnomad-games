// Shared guest-first room lifecycle primitives for TNG games.
// Game modules keep their own rules/state; this module owns room membership
// credentials, host authority, reconnect identity, host handoff, and closure.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const ROOM_AUTH_VERSION = 2;
export const LEGACY_HOST_GRACE_MS = 2 * 60 * 60 * 1000;

export function createRoomCapability() {
  return randomBytes(32).toString('base64url');
}

export function hashRoomCapability(value) {
  const token = String(value || '');
  return token ? createHash('sha256').update(token).digest('hex') : '';
}

function hashesMatch(candidate, stored) {
  if (!candidate || !stored) return false;
  const left = Buffer.from(String(candidate));
  const right = Buffer.from(String(stored));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueRoomPlayerCapability(member) {
  if (!member || member.isAI) return null;
  const capability = createRoomCapability();
  member.playerCapabilityHash = hashRoomCapability(capability);
  member.leftAt = null;
  member.revokedAt = null;
  return capability;
}

export function issueRoomHostCapability(member) {
  if (!member || member.isAI) return null;
  const capability = createRoomCapability();
  member.hostCapabilityHash = hashRoomCapability(capability);
  member.hostCapabilityPending = false;
  return capability;
}

export function createRoomMember({
  id,
  name,
  accountId = null,
  now = Date.now(),
  fields = {},
} = {}) {
  const member = {
    ...fields,
    id: String(id || randomBytes(6).toString('base64url')),
    name: String(name || '').trim(),
    accountId: accountId || null,
    isAI: false,
    joinedAt: now,
    lastSeen: now,
  };
  const playerCapability = issueRoomPlayerCapability(member);
  return { member, playerCapability };
}

export function createRoomHostMember(options = {}) {
  const created = createRoomMember(options);
  const hostCapability = issueRoomHostCapability(created.member);
  return { ...created, hostCapability };
}

// Upgrade a pre-v2 room snapshot in place. Existing seat tokens are hashed
// before being removed from the snapshot, so already-open rooms remain usable.
// The short grace period lets older clients finish their current session while
// the new client receives a distinct host capability on its first reconnect.
export function ensureRoomLifecycle(
  room,
  { now = Date.now(), legacyHostGraceMs = LEGACY_HOST_GRACE_MS } = {},
) {
  if (!room || !Array.isArray(room.players)) {
    throw new TypeError('A room with a players array is required.');
  }
  if (room.authVersion === ROOM_AUTH_VERSION) return false;

  for (const member of room.players) {
    if (member?.token && !member.playerCapabilityHash) {
      member.playerCapabilityHash = hashRoomCapability(member.token);
    }
    if (member) delete member.token;
    if (
      member &&
      !member.isAI &&
      member.id === room.hostId &&
      !member.hostCapabilityHash
    ) {
      member.hostCapabilityPending = true;
    }
  }

  room.authVersion = ROOM_AUTH_VERSION;
  room.legacyHostAuthUntil = now + Math.max(0, Number(legacyHostGraceMs) || 0);
  return true;
}

export function findRoomPlayer(room, playerCapability) {
  const digest = hashRoomCapability(playerCapability);
  if (!digest || !Array.isArray(room?.players)) return null;

  return room.players.find((member) =>
    member &&
    !member.isAI &&
    !member.leftAt &&
    !member.revokedAt &&
    hashesMatch(digest, member.playerCapabilityHash)
  ) || null;
}

export function authorizeRoomHost(
  room,
  member,
  hostCapability,
  now = Date.now(),
) {
  if (
    !room ||
    !member ||
    member.isAI ||
    member.id !== room.hostId ||
    member.leftAt ||
    member.revokedAt
  ) return false;

  if (hostCapability) {
    return hashesMatch(
      hashRoomCapability(hostCapability),
      member.hostCapabilityHash,
    );
  }

  // Transitional support is limited to snapshots upgraded from the old
  // single-token model. Newly created v2 rooms never receive this grace.
  return Number(room.legacyHostAuthUntil || 0) > now;
}

export function takePendingHostCapability(room, member) {
  if (
    !room ||
    !member ||
    member.isAI ||
    member.id !== room.hostId ||
    !member.hostCapabilityPending
  ) return null;

  return issueRoomHostCapability(member);
}

export function revokeRoomPlayer(member, now = Date.now()) {
  if (!member) return;
  member.playerCapabilityHash = null;
  member.hostCapabilityHash = null;
  member.hostCapabilityPending = false;
  member.leftAt = now;
  member.revokedAt = now;
}

export function closeRoomLifecycle(room, now = Date.now()) {
  if (!room) return;
  room.status = 'closed';
  room.phase = 'closed';
  room.closedAt = now;
  room.legacyHostAuthUntil = null;
  for (const member of room.players || []) revokeRoomPlayer(member, now);
}

export function leaveRoomMember(room, member, now = Date.now()) {
  if (!room || !member) return { transferredTo: null, closed: false };

  const wasHost = member.id === room.hostId;
  revokeRoomPlayer(member, now);
  let transferredTo = null;

  if (wasHost) {
    transferredTo = (room.players || []).find((candidate) =>
      candidate &&
      !candidate.isAI &&
      candidate.id !== member.id &&
      !candidate.leftAt &&
      !candidate.revokedAt
    ) || null;

    if (transferredTo) {
      room.hostId = transferredTo.id;
      transferredTo.hostCapabilityHash = null;
      transferredTo.hostCapabilityPending = true;
      room.legacyHostAuthUntil = null;
    } else {
      closeRoomLifecycle(room, now);
    }
  }

  if (room.phase === 'lobby') {
    room.players = room.players.filter((candidate) => candidate.id !== member.id);
  }

  return {
    transferredTo,
    closed: room.status === 'closed' || room.phase === 'closed',
  };
}

export function isRoomLifecycleClosed(room) {
  return room?.status === 'closed' || room?.phase === 'closed';
}
