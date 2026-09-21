import { and, eq, gt, inArray, isNull } from 'drizzle-orm';

import { requireAccount } from '../../server/auth/require-account.js';
import { db } from '../../server/db/client.js';
import {
  deviceSessions,
  gameRooms,
  playerProfiles,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  advanceSquareBizClock,
  answerSquareBizQuestion,
  publicSquareBizState,
  selectSquareBizSquare,
  syncSquareBizRoster,
} from '../../server/games/square-biz.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

function getHeader(request, name) {
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

function roomCodeFrom(request) {
  return String(getHeader(request, 'x-tng-room-code') || request.body?.roomCode || '')
    .trim()
    .toUpperCase();
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

async function findRoom(roomCode, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(and(
    eq(gameRooms.roomCode, roomCode),
    eq(gameRooms.gameId, 'square-biz'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('This Square Biz room is no longer active.');
    error.statusCode = 404;
    error.code = 'SQUARE_BIZ_ROOM_NOT_FOUND';
    throw error;
  }

  return room;
}

async function activeParticipants(roomId, executor = db) {
  const participants = await executor.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, roomId),
    isNull(roomParticipants.leftAt),
  ));

  const accountIds = participants.map((item) => item.accountId);
  const profiles = accountIds.length > 0
    ? await executor.select({
        accountId: playerProfiles.accountId,
        displayName: playerProfiles.displayName,
        handle: playerProfiles.handle,
      }).from(playerProfiles).where(inArray(playerProfiles.accountId, accountIds))
    : [];

  const profileByAccount = new Map(profiles.map((item) => [item.accountId, item]));

  return participants.map((item) => {
    const profile = profileByAccount.get(item.accountId);
    return {
      ...item,
      name: profile?.displayName || profile?.handle || 'Player',
      handle: profile?.handle || null,
    };
  });
}

async function persistProjectedState(room, state, executor = db) {
  const current = room.displayState || {};
  const [updated] = await executor.update(gameRooms).set({
    displayState: {
      ...current,
      screen: 'game',
      gameId: 'square-biz',
      gameState: state,
    },
    status: state.phase === 'lobby' ? 'lobby' : 'live',
    revision: room.revision + 1,
    startedAt: room.startedAt || (state.phase !== 'lobby' ? new Date() : null),
    updatedAt: new Date(),
  }).where(eq(gameRooms.id, room.id)).returning();

  return updated;
}

async function refreshRoomState(room) {
  const participants = await activeParticipants(room.id);
  const original = room.displayState?.gameState || {};
  let next = syncSquareBizRoster(original, participants);
  next = advanceSquareBizClock(next);

  if (JSON.stringify(next) === JSON.stringify(original)) {
    return { room, participants };
  }

  const updated = await persistProjectedState(room, next);
  return {
    room: updated,
    participants: await activeParticipants(updated.id),
  };
}

async function responsePayload(room, participant, accountId) {
  const refreshed = await refreshRoomState(room);
  const currentParticipant = refreshed.participants.find(
    (item) => item.accountId === accountId,
  ) || participant;

  return {
    room: {
      id: refreshed.room.id,
      roomCode: refreshed.room.roomCode,
      gameId: refreshed.room.gameId,
      status: refreshed.room.status,
      revision: refreshed.room.revision,
      updatedAt: refreshed.room.updatedAt,
      gameState: publicSquareBizState(
        refreshed.room.displayState?.gameState || {},
        refreshed.participants,
        accountId,
      ),
    },
    participant: currentParticipant ? {
      id: currentParticipant.id,
      seatNumber: currentParticipant.seatNumber,
      role: currentParticipant.role,
    } : null,
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const account = await requireAccount(request);
    await requirePlayerDevice(request, account.id);

    const roomCode = roomCodeFrom(request);
    if (!ROOM_CODE_PATTERN.test(roomCode)) {
      const error = new Error('Enter a valid TNG room code.');
      error.statusCode = 400;
      error.code = 'INVALID_ROOM_CODE';
      throw error;
    }

    const room = await findRoom(roomCode);
    const [participant] = await db.select().from(roomParticipants).where(and(
      eq(roomParticipants.roomId, room.id),
      eq(roomParticipants.accountId, account.id),
      isNull(roomParticipants.leftAt),
    )).limit(1);

    if (!participant) {
      const error = new Error('Join the room before opening Square Biz.');
      error.statusCode = 409;
      error.code = 'ROOM_JOIN_REQUIRED';
      throw error;
    }

    if (request.method === 'GET') {
      return sendJson(response, 200, await responsePayload(room, participant, account.id));
    }

    const action = String(request.body?.action || '').trim();
    if (!['select_square', 'answer'].includes(action)) {
      const error = new Error('Unknown Square Biz Player action.');
      error.statusCode = 400;
      error.code = 'INVALID_SQUARE_BIZ_PLAYER_ACTION';
      throw error;
    }

    const updatedRoom = await db.transaction(async (transaction) => {
      const [lockedRoom] = await transaction.select().from(gameRooms)
        .where(eq(gameRooms.id, room.id))
        .limit(1)
        .for('update');

      const participants = await activeParticipants(lockedRoom.id, transaction);
      let state = advanceSquareBizClock(
        syncSquareBizRoster(lockedRoom.displayState?.gameState || {}, participants),
      );

      if (action === 'select_square') {
        state = await selectSquareBizSquare(state, {
          actorAccountId: account.id,
          squareIndex: request.body?.squareIndex,
          executor: transaction,
        });
      } else {
        state = await answerSquareBizQuestion(state, {
          actorAccountId: account.id,
          answer: request.body?.answer,
          executor: transaction,
        });
      }

      await transaction.update(roomParticipants).set({
        lastHeartbeatAt: new Date(),
      }).where(eq(roomParticipants.id, participant.id));

      return persistProjectedState(lockedRoom, state, transaction);
    });

    return sendJson(
      response,
      200,
      await responsePayload(updatedRoom, participant, account.id),
    );
  } catch (error) {
    return sendError(response, error);
  }
}
