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
  applyHangmanGuess,
  publicHangmanState,
  startHangmanBoard,
} from '../../server/games/hangman.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;
const PLAYER_SEATS = [2, 3, 4];

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

  return participants
    .filter((item) => [1, 2, 3, 4].includes(Number(item.seatNumber)))
    .map((item) => {
      const profile = profileByAccount.get(item.accountId);
      return {
        playerId: item.accountId,
        accountId: item.accountId,
        seatNumber: Number(item.seatNumber),
        role: item.role,
        playerType: 'human',
        name: profile?.displayName || profile?.handle || (item.seatNumber === 1 ? 'HOST' : `Seat ${item.seatNumber}`),
        handle: profile?.handle || null,
      };
    })
    .sort((a, b) => a.seatNumber - b.seatNumber);
}

async function ensurePlayerSeat(room, participant) {
  if (PLAYER_SEATS.includes(Number(participant.seatNumber))) return participant;

  return db.transaction(async (transaction) => {
    await transaction.select({ id: gameRooms.id })
      .from(gameRooms)
      .where(eq(gameRooms.id, room.id))
      .limit(1)
      .for('update');

    const participants = await transaction.select().from(roomParticipants).where(and(
      eq(roomParticipants.roomId, room.id),
      isNull(roomParticipants.leftAt),
    ));

    const current = participants.find((item) => item.id === participant.id);
    if (!current) {
      const error = new Error('Join the room before opening Hangman.');
      error.statusCode = 409;
      error.code = 'ROOM_JOIN_REQUIRED';
      throw error;
    }

    if (PLAYER_SEATS.includes(Number(current.seatNumber))) return current;

    const occupied = new Set(
      participants
        .map((item) => Number(item.seatNumber))
        .filter((seat) => PLAYER_SEATS.includes(seat)),
    );
    const seatNumber = PLAYER_SEATS.find((seat) => !occupied.has(seat));

    if (!seatNumber) {
      const error = new Error('This Hangman room already has three Player seats filled.');
      error.statusCode = 409;
      error.code = 'HANGMAN_ROOM_FULL';
      throw error;
    }

    const [updated] = await transaction.update(roomParticipants).set({
      seatNumber,
      role: 'player',
      leftAt: null,
      lastHeartbeatAt: new Date(),
    }).where(eq(roomParticipants.id, current.id)).returning();

    return updated;
  });
}

async function resolvePlayer(request) {
  const account = await requireAccount(request);
  const device = await requirePlayerDevice(request, account.id);
  const roomCode = roomCodeFrom(request);

  if (!ROOM_CODE_PATTERN.test(roomCode)) {
    const error = new Error('Enter a valid TNG room code.');
    error.statusCode = 400;
    error.code = 'INVALID_ROOM_CODE';
    throw error;
  }

  const [room] = await db.select().from(gameRooms).where(and(
    eq(gameRooms.roomCode, roomCode),
    eq(gameRooms.gameId, 'hangman'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('This Hangman room is no longer active.');
    error.statusCode = 404;
    error.code = 'HANGMAN_ROOM_NOT_FOUND';
    throw error;
  }

  const [joined] = await db.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, room.id),
    eq(roomParticipants.accountId, account.id),
  )).limit(1);

  if (!joined || joined.leftAt) {
    const error = new Error('Join the room before opening Hangman.');
    error.statusCode = 409;
    error.code = 'ROOM_JOIN_REQUIRED';
    throw error;
  }

  const participant = await ensurePlayerSeat(room, joined);
  return { account, device, room, participant };
}

async function responsePayload(room, participant) {
  const players = await activeParticipants(room.id);
  const gameState = room.displayState?.gameState || {};

  return {
    room: {
      id: room.id,
      roomCode: room.roomCode,
      gameId: room.gameId,
      status: room.status,
      revision: room.revision,
      updatedAt: room.updatedAt,
      gameState: publicHangmanState(gameState, players, participant.seatNumber),
    },
    participant: {
      id: participant.id,
      seatNumber: participant.seatNumber,
      role: participant.role,
    },
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const context = await resolvePlayer(request);
    const { account, room, participant } = context;

    if (request.method === 'GET') {
      return sendJson(response, 200, await responsePayload(room, participant));
    }

    const action = request.body?.action;
    if (!['guess_letter', 'guess_word', 'set_board'].includes(action)) {
      const error = new Error('Unknown Hangman Player action.');
      error.statusCode = 400;
      error.code = 'INVALID_HANGMAN_PLAYER_ACTION';
      throw error;
    }

    const updatedRoom = await db.transaction(async (transaction) => {
      const [lockedRoom] = await transaction.select().from(gameRooms)
        .where(eq(gameRooms.id, room.id))
        .limit(1)
        .for('update');

      if (!lockedRoom) {
        const error = new Error('This Hangman room is no longer active.');
        error.statusCode = 404;
        error.code = 'HANGMAN_ROOM_NOT_FOUND';
        throw error;
      }

      const [currentParticipant] = await transaction.select().from(roomParticipants).where(and(
        eq(roomParticipants.roomId, lockedRoom.id),
        eq(roomParticipants.accountId, account.id),
        isNull(roomParticipants.leftAt),
      )).limit(1);

      const seatNumber = Number(currentParticipant?.seatNumber || 0);
      if (!PLAYER_SEATS.includes(seatNumber)) {
        const error = new Error('Take a Hangman Player seat before acting.');
        error.statusCode = 409;
        error.code = 'HANGMAN_SEAT_REQUIRED';
        throw error;
      }

      const participants = await activeParticipants(lockedRoom.id, transaction);
      const activeSeats = participants.map((item) => item.seatNumber);
      const current = lockedRoom.displayState || {};
      const currentGameState = current.gameState || {};

      const nextGameState = action === 'set_board'
        ? startHangmanBoard(currentGameState, {
            actorSeat: seatNumber,
            word: request.body?.word,
            category: request.body?.category,
            hint: request.body?.hint,
            activeSeats,
          })
        : applyHangmanGuess(currentGameState, {
            actorSeat: seatNumber,
            actorAccountId: account.id,
            activeSeats,
            action,
            letter: request.body?.letter,
            guess: request.body?.guess,
          });

      const [nextRoom] = await transaction.update(gameRooms).set({
        displayState: {
          ...current,
          screen: 'game',
          gameId: 'hangman',
          gameState: nextGameState,
        },
        status: nextGameState.phase === 'setup' ? 'lobby' : 'live',
        revision: lockedRoom.revision + 1,
        startedAt: lockedRoom.startedAt || new Date(),
        updatedAt: new Date(),
      }).where(eq(gameRooms.id, lockedRoom.id)).returning();

      await transaction.update(roomParticipants).set({
        lastHeartbeatAt: new Date(),
      }).where(eq(roomParticipants.id, currentParticipant.id));

      return nextRoom;
    });

    const [latestParticipant] = await db.select().from(roomParticipants).where(and(
      eq(roomParticipants.roomId, updatedRoom.id),
      eq(roomParticipants.accountId, account.id),
    )).limit(1);

    return sendJson(response, 200, await responsePayload(updatedRoom, latestParticipant));
  } catch (error) {
    return sendError(response, error);
  }
}
