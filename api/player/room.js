import { and, eq, gt, inArray } from 'drizzle-orm';

import { requireAccount } from '../../server/auth/require-account.js';
import { db } from '../../server/db/client.js';
import { deviceSessions, gameRooms, playerProfiles, roomParticipants } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

function getHeader(request, name) {
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

function roomCodeFrom(request) {
  const raw = request.body?.roomCode || getHeader(request, 'x-tng-room-code');
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

async function requirePlayerDevice(request, accountId) {
  const deviceId = getHeader(request, 'x-tng-device-id');

  if (!UUID_PATTERN.test(deviceId)) {
    const error = new Error('A Player device is required.');
    error.statusCode = 401;
    error.code = 'PLAYER_DEVICE_REQUIRED';
    throw error;
  }

  const [device] = await db.select().from(deviceSessions).where(and(
    eq(deviceSessions.id, deviceId),
    eq(deviceSessions.accountId, accountId),
    eq(deviceSessions.role, 'player'),
    eq(deviceSessions.status, 'connected'),
    gt(deviceSessions.expiresAt, new Date()),
  )).limit(1);

  if (!device) {
    const error = new Error('This device is not an active Player device.');
    error.statusCode = 403;
    error.code = 'INVALID_PLAYER_DEVICE';
    throw error;
  }

  return device;
}

async function findRoom(roomCode) {
  const [room] = await db.select().from(gameRooms).where(and(
    eq(gameRooms.roomCode, roomCode),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error(`Room "${roomCode}" was not found.`);
    error.statusCode = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  return room;
}

function roomSummary(room) {
  return {
    id: room.id,
    roomCode: room.roomCode,
    gameId: room.gameId,
    status: room.status,
    revision: room.revision,
    updatedAt: room.updatedAt,
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const account = await requireAccount(request);
    const device = await requirePlayerDevice(request, account.id);
    const roomCode = roomCodeFrom(request);

    if (!ROOM_CODE_PATTERN.test(roomCode)) {
      const error = new Error('Enter a valid TNG room code.');
      error.statusCode = 400;
      error.code = 'INVALID_ROOM_CODE';
      throw error;
    }

    const room = await findRoom(roomCode);

    if (request.method === 'GET') {
      const [participant] = await db.select().from(roomParticipants).where(and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.accountId, account.id),
      )).limit(1);

      return sendJson(response, 200, {
        room: roomSummary(room),
        participant: participant || null,
      });
    }

    const now = new Date();
    let [participant] = await db.select().from(roomParticipants).where(and(
      eq(roomParticipants.roomId, room.id),
      eq(roomParticipants.accountId, account.id),
    )).limit(1);

    if (participant) {
      [participant] = await db.update(roomParticipants).set({
        deviceSessionId: device.id,
        role: 'player',
        leftAt: null,
        lastHeartbeatAt: now,
      }).where(eq(roomParticipants.id, participant.id)).returning();
    } else {
      [participant] = await db.insert(roomParticipants).values({
        roomId: room.id,
        accountId: account.id,
        deviceSessionId: device.id,
        role: 'player',
        seatNumber: null,
        lastHeartbeatAt: now,
      }).returning();
    }

    const [profile] = await db.select({
      displayName: playerProfiles.displayName,
      handle: playerProfiles.handle,
    }).from(playerProfiles).where(eq(playerProfiles.accountId, account.id)).limit(1);

    return sendJson(response, 200, {
      room: roomSummary(room),
      participant,
      profile: profile || null,
    });
  } catch (error) {
    return sendError(response, error);
  }
}
