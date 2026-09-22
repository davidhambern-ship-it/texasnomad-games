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
  applyWordSearchTimeout,
  publicWordSearchState,
  submitWordSearchSelection,
} from '../../server/games/word-search.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';
import { recordGameStatEvent } from '../../server/stats/record-game-stat-event.js';

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


async function recordWordSearchRound(room, state, participants, executor = db) {
  if (state?.phase !== 'finished') return;

  const winnerSeat = Number(state.winner_seat || 0);
  const scores = state.scores || {};

  await recordGameStatEvent({
    room,
    statKey: `round:${Number(state.round_number || 1)}`,
    entries: participants.map((player) => ({
      accountId: player.accountId,
      score: Number(scores[String(player.seatNumber)] || 0),
      won: winnerSeat > 0 ? Number(player.seatNumber) === winnerSeat : null,
    })),
    result: {
      winnerSeat: winnerSeat || null,
      mode: state.mode || null,
      difficulty: state.difficulty || null,
    },
    executor,
  });
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
      const error = new Error('Join the room before opening Word Search.');
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
      const error = new Error('This Word Search room already has three Player seats filled.');
      error.statusCode = 409;
      error.code = 'WORD_SEARCH_ROOM_FULL';
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

async function findRoom(roomCode) {
  const [room] = await db.select().from(gameRooms).where(and(
    eq(gameRooms.roomCode, roomCode),
    eq(gameRooms.gameId, 'word-search'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('This Word Search room is no longer active.');
    error.statusCode = 404;
    error.code = 'WORD_SEARCH_ROOM_NOT_FOUND';
    throw error;
  }

  return room;
}

async function refreshTimeoutIfNeeded(room) {
  const state = room.displayState?.gameState || {};
  if (
    state.phase !== 'playing' ||
    state.paused === true ||
    !state.time_end ||
    Date.now() < Number(state.time_end)
  ) {
    return room;
  }

  return db.transaction(async (transaction) => {
    const [lockedRoom] = await transaction.select().from(gameRooms)
      .where(eq(gameRooms.id, room.id))
      .limit(1)
      .for('update');

    const participants = await activeParticipants(lockedRoom.id, transaction);
    const activeSeats = participants.map((item) => item.seatNumber);
    const current = lockedRoom.displayState || {};
    const nextState = applyWordSearchTimeout(current.gameState || {}, activeSeats);

    if (nextState === current.gameState) return lockedRoom;

    const [updated] = await transaction.update(gameRooms).set({
      displayState: {
        ...current,
        screen: 'game',
        gameId: 'word-search',
        gameState: nextState,
      },
      status: 'live',
      revision: lockedRoom.revision + 1,
      updatedAt: new Date(),
    }).where(eq(gameRooms.id, lockedRoom.id)).returning();

    await recordWordSearchRound(updated, nextState, participants, transaction);

    return updated;
  });
}

async function responsePayload(room, participant) {
  const refreshed = await refreshTimeoutIfNeeded(room);
  const players = await activeParticipants(refreshed.id);

  return {
    room: {
      id: refreshed.id,
      roomCode: refreshed.roomCode,
      gameId: refreshed.gameId,
      status: refreshed.status,
      revision: refreshed.revision,
      updatedAt: refreshed.updatedAt,
      gameState: publicWordSearchState(
        refreshed.displayState?.gameState || {},
        players,
        participant.seatNumber,
      ),
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
    const [joined] = await db.select().from(roomParticipants).where(and(
      eq(roomParticipants.roomId, room.id),
      eq(roomParticipants.accountId, account.id),
    )).limit(1);

    if (!joined || joined.leftAt) {
      const error = new Error('Join the room before opening Word Search.');
      error.statusCode = 409;
      error.code = 'ROOM_JOIN_REQUIRED';
      throw error;
    }

    const participant = await ensurePlayerSeat(room, joined);

    if (request.method === 'GET') {
      return sendJson(response, 200, await responsePayload(room, participant));
    }

    const action = request.body?.action;
    if (action !== 'submit_selection') {
      const error = new Error('Unknown Word Search Player action.');
      error.statusCode = 400;
      error.code = 'INVALID_WORD_SEARCH_PLAYER_ACTION';
      throw error;
    }

    const updatedRoom = await db.transaction(async (transaction) => {
      const [lockedRoom] = await transaction.select().from(gameRooms)
        .where(eq(gameRooms.id, room.id))
        .limit(1)
        .for('update');

      const [currentParticipant] = await transaction.select().from(roomParticipants).where(and(
        eq(roomParticipants.roomId, lockedRoom.id),
        eq(roomParticipants.accountId, account.id),
        isNull(roomParticipants.leftAt),
      )).limit(1);

      const seatNumber = Number(currentParticipant?.seatNumber || 0);
      if (!PLAYER_SEATS.includes(seatNumber)) {
        const error = new Error('Take a Word Search Player seat before selecting words.');
        error.statusCode = 409;
        error.code = 'WORD_SEARCH_SEAT_REQUIRED';
        throw error;
      }

      const participants = await activeParticipants(lockedRoom.id, transaction);
      const activeSeats = participants.map((item) => item.seatNumber);
      const current = lockedRoom.displayState || {};
      const result = submitWordSearchSelection(current.gameState || {}, {
        actorSeat: seatNumber,
        cells: request.body?.cells,
        activeSeats,
      });

      const [nextRoom] = await transaction.update(gameRooms).set({
        displayState: {
          ...current,
          screen: 'game',
          gameId: 'word-search',
          gameState: result.state,
        },
        status: 'live',
        revision: lockedRoom.revision + 1,
        startedAt: lockedRoom.startedAt || new Date(),
        updatedAt: new Date(),
      }).where(eq(gameRooms.id, lockedRoom.id)).returning();

      await transaction.update(roomParticipants).set({
        lastHeartbeatAt: new Date(),
      }).where(eq(roomParticipants.id, currentParticipant.id));

      await recordWordSearchRound(nextRoom, result.state, participants, transaction);

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
