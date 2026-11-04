import { and, eq, inArray, isNull } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import {
  gameRooms,
  playerProfiles,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  advanceSquareBizClock,
  assignSquareBizPlayers,
  forceNextSquareBizTurn,
  publicSquareBizState,
  replaySquareBizQuestion,
  resetSquareBizBoard,
  skipSquareBizIntro,
  startSquareBizRound,
  syncSquareBizRoster,
} from '../../server/games/square-biz.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';
import { recordGameStatEvent } from '../../server/stats/record-game-stat-event.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];

async function findRoom(hostSessionId, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(and(
    eq(gameRooms.hostSessionId, hostSessionId),
    eq(gameRooms.gameId, 'square-biz'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('No active Square Biz room is connected to this Host Controller.');
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

  if (state.phase === 'finished' && state.winner) {
    const xScore = Array.isArray(state.board)
      ? state.board.filter((value) => value === 'X').length
      : 0;
    const oScore = Array.isArray(state.board)
      ? state.board.filter((value) => value === 'O').length
      : 0;

    await recordGameStatEvent({
      room: updated,
      statKey: `round:${Number(state.round_number || 1)}`,
      entries: [
        state.x_account_id
          ? {
              accountId: state.x_account_id,
              score: xScore,
              won: state.winner === 'X',
            }
          : null,
        state.o_account_id
          ? {
              accountId: state.o_account_id,
              score: oScore,
              won: state.winner === 'O',
            }
          : null,
      ].filter(Boolean),
      result: {
        winner: state.winner,
        winningLine: state.winning_line || null,
      },
      executor,
    });
  }

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

async function responsePayload(room) {
  const refreshed = await refreshRoomState(room);
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
        null,
        { host: true },
      ),
    },
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const { hostSession } = await requireController(request, {
      hostSessionRequired: true,
    });

    const room = await findRoom(hostSession.id);

    if (request.method === 'GET') {
      return sendJson(response, 200, await responsePayload(room));
    }

    const action = String(request.body?.action || '').trim();
    const allowed = new Set([
      'start_round',
      'skip_intro',
      'replay_question',
      'reset_board',
      'next_turn',
      'replay_intro',
    ]);

    if (!allowed.has(action)) {
      const error = new Error('Unknown Square Biz Host action.');
      error.statusCode = 400;
      error.code = 'INVALID_SQUARE_BIZ_HOST_ACTION';
      throw error;
    }

    const updatedRoom = await db.transaction(async (transaction) => {
      const [lockedRoom] = await transaction.select().from(gameRooms)
        .where(eq(gameRooms.id, room.id))
        .limit(1)
        .for('update');

      if (!lockedRoom) {
        const error = new Error('Square Biz room not found.');
        error.statusCode = 404;
        error.code = 'SQUARE_BIZ_ROOM_NOT_FOUND';
        throw error;
      }

      let participants = await activeParticipants(lockedRoom.id, transaction);
      let state = advanceSquareBizClock(
        syncSquareBizRoster(lockedRoom.displayState?.gameState || {}, participants),
      );

      if (action === 'start_round') {
        const assigned = await assignSquareBizPlayers(
          lockedRoom.id,
          participants,
          transaction,
        );
        participants = await activeParticipants(lockedRoom.id, transaction);
        state = startSquareBizRound(state, assigned, {
          introDurationMs: request.body?.introDurationMs,
        });
      } else if (action === 'skip_intro') {
        state = skipSquareBizIntro(state);
      } else if (action === 'replay_question') {
        state = replaySquareBizQuestion(state);
      } else if (action === 'reset_board') {
        state = resetSquareBizBoard(state);
      } else if (action === 'next_turn') {
        state = forceNextSquareBizTurn(state);
      } else if (action === 'replay_intro') {
        const now = Date.now();
        const duration = Math.max(1_000, Number(request.body?.introDurationMs || 15_000));
        state = {
          ...state,
          phase: 'intro',
          intro_started_at: now,
          intro_ends_at: now + duration,
          last_action: {
            type: 'intro_replayed',
            timestamp: now,
          },
        };
      }

      return persistProjectedState(lockedRoom, state, transaction);
    });

    return sendJson(response, 200, await responsePayload(updatedRoom));
  } catch (error) {
    return sendError(response, error);
  }
}
