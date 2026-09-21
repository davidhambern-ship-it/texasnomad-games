import { and, eq, inArray } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import { gameRooms } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];

function defaultState(gameId) {
  if (gameId === 'spades') {
    return {
      phase: 'setup',
      team1Name: 'Team 1',
      team2Name: 'Team 2',
      targetScore: 500,
      score1: 0,
      score2: 0,
      bid1: null,
      bid2: null,
      books1: 0,
      books2: 0,
      dealerSeat: 1,
      currentBidderSeat: null,
      currentTurnSeat: null,
      currentTrick: [],
      tricksPlayed: 0,
      spadesBroken: false,
      handNumber: 0,
      players: [],
    };
  }

  if (gameId === 'hangman') {
    return {
      phase: 'setup',
      secret_word: '',
      category: '',
      hint: '',
      hint_revealed: false,
      word_revealed: false,
      guessed_letters: [],
      wrong_letters: [],
      max_wrong: 6,
      players: [],
      current_go_round: 1,
      seats_that_chose: [],
      last_action: null,
    };
  }
  return {};
}

function normalizeRoom(room) {
  const displayState = room.displayState || {};
  return {
    id: room.id,
    roomCode: room.roomCode,
    gameId: room.gameId,
    status: room.status,
    revision: room.revision,
    gameState: displayState.gameState || defaultState(room.gameId),
    lastCommand: displayState.lastCommand || null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

export default async function handler(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'PATCH']);
  }

  try {
    const { hostSession } = await requireController(request, { hostSessionRequired: true });

    const [room] = await db.select().from(gameRooms).where(and(
      eq(gameRooms.hostSessionId, hostSession.id),
      inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
    )).limit(1);

    if (!room) {
      const error = new Error('No active room is connected to this Host Controller.');
      error.statusCode = 404;
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }

    if (request.method === 'GET') {
      return sendJson(response, 200, { room: normalizeRoom(room) });
    }

    const current = room.displayState || {};
    const statePatch =
      request.body?.statePatch && typeof request.body.statePatch === 'object'
        ? request.body.statePatch
        : null;
    const command =
      request.body?.command && typeof request.body.command === 'object'
        ? request.body.command
        : null;

    if (!statePatch && !command) {
      const error = new Error('Provide a state patch or command.');
      error.statusCode = 400;
      error.code = 'EMPTY_ROOM_UPDATE';
      throw error;
    }

    const currentGameState = current.gameState || defaultState(room.gameId);
    const nextGameState = statePatch
      ? { ...currentGameState, ...statePatch }
      : currentGameState;

    const nextDisplayState = {
      ...current,
      screen: 'game',
      gameId: room.gameId,
      gameState: nextGameState,
      ...(command
        ? { lastCommand: { ...command, timestamp: Date.now() } }
        : {}),
    };

    const nextStatus =
      nextGameState.phase === 'setup' ? 'lobby' : 'live';

    const [updated] = await db.update(gameRooms).set({
      displayState: nextDisplayState,
      status: nextStatus,
      revision: room.revision + 1,
      startedAt:
        room.startedAt || (nextStatus === 'live' ? new Date() : null),
      updatedAt: new Date(),
    }).where(eq(gameRooms.id, room.id)).returning();

    return sendJson(response, 200, { room: normalizeRoom(updated) });
  } catch (error) {
    return sendError(response, error);
  }
}
