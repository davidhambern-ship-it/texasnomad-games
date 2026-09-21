import { and, eq, inArray, isNull } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import {
  gameRooms,
  playerProfiles,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  applyWordSearchTimeout,
  defaultWordSearchState,
  publicWordSearchState,
  revealWordSearchWord,
  startWordSearchGame,
  submitWordSearchSelection,
} from '../../server/games/word-search.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];

async function findRoom(hostSessionId, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(and(
    eq(gameRooms.hostSessionId, hostSessionId),
    eq(gameRooms.gameId, 'word-search'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('No active Word Search room is connected to this Host Controller.');
    error.statusCode = 404;
    error.code = 'WORD_SEARCH_ROOM_NOT_FOUND';
    throw error;
  }

  return room;
}

async function ensureHostSeat(room, accountId, deviceId, executor = db) {
  const [seatOne] = await executor.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, room.id),
    eq(roomParticipants.seatNumber, 1),
    isNull(roomParticipants.leftAt),
  )).limit(1);

  if (seatOne && seatOne.accountId !== accountId) {
    const error = new Error('Seat 1 is already occupied by another account.');
    error.statusCode = 409;
    error.code = 'WORD_SEARCH_HOST_SEAT_TAKEN';
    throw error;
  }

  const [existing] = await executor.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, room.id),
    eq(roomParticipants.accountId, accountId),
  )).limit(1);

  if (existing) {
    const [updated] = await executor.update(roomParticipants).set({
      deviceSessionId: deviceId,
      role: 'host_player',
      seatNumber: 1,
      leftAt: null,
      lastHeartbeatAt: new Date(),
    }).where(eq(roomParticipants.id, existing.id)).returning();
    return updated;
  }

  const [created] = await executor.insert(roomParticipants).values({
    roomId: room.id,
    accountId,
    deviceSessionId: deviceId,
    role: 'host_player',
    seatNumber: 1,
    lastHeartbeatAt: new Date(),
  }).returning();

  return created;
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

    return updated;
  });
}

async function responsePayload(room, hostParticipant) {
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
        1,
      ),
    },
    participant: {
      id: hostParticipant.id,
      seatNumber: 1,
      role: 'host_player',
    },
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const { account, device, hostSession } = await requireController(request, {
      hostSessionRequired: true,
    });

    const room = await findRoom(hostSession.id);
    const hostParticipant = await ensureHostSeat(room, account.id, device.id);

    if (request.method === 'GET') {
      return sendJson(response, 200, await responsePayload(room, hostParticipant));
    }

    const action = request.body?.action;
    const allowed = new Set([
      'start_game',
      'submit_selection',
      'pause',
      'resume',
      'reveal_word',
      'reset_match',
    ]);

    if (!allowed.has(action)) {
      const error = new Error('Unknown Word Search Host action.');
      error.statusCode = 400;
      error.code = 'INVALID_WORD_SEARCH_HOST_ACTION';
      throw error;
    }

    const updatedRoom = await db.transaction(async (transaction) => {
      const [lockedRoom] = await transaction.select().from(gameRooms)
        .where(eq(gameRooms.id, room.id))
        .limit(1)
        .for('update');

      const currentHost = await ensureHostSeat(
        lockedRoom,
        account.id,
        device.id,
        transaction,
      );
      const participants = await activeParticipants(lockedRoom.id, transaction);
      const activeSeats = participants.map((item) => item.seatNumber);
      const current = lockedRoom.displayState || {};
      const currentState = current.gameState || {};
      let nextState;

      if (action === 'start_game') {
        nextState = startWordSearchGame(currentState, {
          mode: request.body?.mode,
          difficulty: request.body?.difficulty,
          category: request.body?.category,
          activeSeats,
        });
      } else if (action === 'submit_selection') {
        nextState = submitWordSearchSelection(currentState, {
          actorSeat: 1,
          cells: request.body?.cells,
          activeSeats,
        }).state;
      } else if (action === 'pause') {
        const remaining = currentState.time_end
          ? Math.max(0, Number(currentState.time_end) - Date.now())
          : null;
        nextState = {
          ...currentState,
          paused: true,
          paused_remaining_ms: remaining,
          time_end: null,
          last_action: {
            type: 'pause',
            seatNumber: 1,
            timestamp: Date.now(),
          },
        };
      } else if (action === 'resume') {
        const fallback = currentState.mode === 'turn' ? 60_000 : 300_000;
        const remaining = Math.max(
          1_000,
          Number(currentState.paused_remaining_ms || fallback),
        );
        nextState = {
          ...currentState,
          paused: false,
          paused_remaining_ms: null,
          time_end: Date.now() + remaining,
          last_action: {
            type: 'resume',
            seatNumber: 1,
            timestamp: Date.now(),
          },
        };
      } else if (action === 'reveal_word') {
        nextState = revealWordSearchWord(currentState, activeSeats);
      } else {
        nextState = defaultWordSearchState();
      }

      const [nextRoom] = await transaction.update(gameRooms).set({
        displayState: {
          ...current,
          screen: 'game',
          gameId: 'word-search',
          gameState: nextState,
        },
        status: nextState.phase === 'setup' ? 'lobby' : 'live',
        revision: lockedRoom.revision + 1,
        startedAt: lockedRoom.startedAt || (nextState.phase === 'playing' ? new Date() : null),
        updatedAt: new Date(),
      }).where(eq(gameRooms.id, lockedRoom.id)).returning();

      await transaction.update(roomParticipants).set({
        lastHeartbeatAt: new Date(),
      }).where(eq(roomParticipants.id, currentHost.id));

      return nextRoom;
    });

    const [latestHost] = await db.select().from(roomParticipants).where(and(
      eq(roomParticipants.roomId, updatedRoom.id),
      eq(roomParticipants.accountId, account.id),
    )).limit(1);

    return sendJson(response, 200, await responsePayload(updatedRoom, latestHost));
  } catch (error) {
    return sendError(response, error);
  }
}
