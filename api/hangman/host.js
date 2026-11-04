import { and, eq, inArray, isNull } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import {
  gameRooms,
  playerProfiles,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  applyHangmanGuess,
  defaultHangmanState,
  nextHangmanGuessSeat,
  normalizedHangmanState,
  publicHangmanState,
  startHangmanBoard,
} from '../../server/games/hangman.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';
import { recordGameStatEvent } from '../../server/stats/record-game-stat-event.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];

async function findRoom(hostSessionId, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(and(
    eq(gameRooms.hostSessionId, hostSessionId),
    eq(gameRooms.gameId, 'hangman'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('No active Hangman room is connected to this Host Controller.');
    error.statusCode = 404;
    error.code = 'HANGMAN_ROOM_NOT_FOUND';
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
    error.code = 'HANGMAN_HOST_SEAT_TAKEN';
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


async function recordHangmanRound(room, state, participants, executor = db) {
  if (
    state?.phase !== 'finished' ||
    !['solved', 'stumped'].includes(state?.round_result)
  ) {
    return;
  }

  const winnerSeat = state.round_result === 'stumped'
    ? Number(state.word_setter_seat || 0)
    : Number(state.winner_seat || 0);

  const scores = state.scores || {};
  const baseline = state.round_start_scores || {};

  await recordGameStatEvent({
    room,
    statKey: `round:${Number(state.round_number || 1)}`,
    entries: participants.map((player) => ({
      accountId: player.accountId,
      score: Number(scores[String(player.seatNumber)] || 0)
        - Number(baseline[String(player.seatNumber)] || 0),
      won: winnerSeat > 0 ? Number(player.seatNumber) === winnerSeat : null,
    })),
    result: {
      roundResult: state.round_result,
      winnerSeat: winnerSeat || null,
      setterSeat: Number(state.word_setter_seat || 0) || null,
    },
    executor,
  });
}

async function responsePayload(room, hostParticipant) {
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
      gameState: publicHangmanState(gameState, players, 1),
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
    const allowedActions = [
      'set_board',
      'guess_letter',
      'guess_word',
      'reveal_hint',
      'reveal_word',
      'reset_round',
      'new_game',
    ];

    if (!allowedActions.includes(action)) {
      const error = new Error('Unknown Hangman Host action.');
      error.statusCode = 400;
      error.code = 'INVALID_HANGMAN_HOST_ACTION';
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

      const currentHost = await ensureHostSeat(
        lockedRoom,
        account.id,
        device.id,
        transaction,
      );
      const participants = await activeParticipants(lockedRoom.id, transaction);
      const activeSeats = participants.map((item) => item.seatNumber);
      const current = lockedRoom.displayState || {};
      const currentGameState = normalizedHangmanState(current.gameState || {});
      let nextGameState;

      if (action === 'set_board') {
        nextGameState = startHangmanBoard(currentGameState, {
          actorSeat: 1,
          word: request.body?.word,
          category: request.body?.category,
          hint: request.body?.hint,
          activeSeats,
        });
      } else if (action === 'guess_letter' || action === 'guess_word') {
        nextGameState = applyHangmanGuess(currentGameState, {
          actorSeat: 1,
          actorAccountId: account.id,
          activeSeats,
          action,
          letter: request.body?.letter,
          guess: request.body?.guess,
        });
      } else if (action === 'reveal_hint') {
        nextGameState = {
          ...currentGameState,
          hint_revealed: true,
          last_action: {
            type: 'reveal_hint',
            playerId: account.id,
            seatNumber: 1,
            timestamp: Date.now(),
          },
        };
      } else if (action === 'reveal_word') {
        const setterSeat = Number(currentGameState.word_setter_seat || 1);
        nextGameState = {
          ...currentGameState,
          phase: 'finished',
          word_revealed: true,
          current_turn_seat: null,
          round_result: 'revealed',
          winner_seat: null,
          winner_player_id: null,
          next_setter_seat: setterSeat,
          last_action: {
            type: 'reveal_word',
            playerId: account.id,
            seatNumber: 1,
            timestamp: Date.now(),
          },
        };
      } else if (action === 'reset_round') {
        const setterSeat = Number(currentGameState.word_setter_seat || 1);
        nextGameState = {
          ...currentGameState,
          phase: 'playing',
          hint_revealed: false,
          word_revealed: false,
          guessed_letters: [],
          wrong_letters: [],
          current_turn_seat: nextHangmanGuessSeat(activeSeats, setterSeat, setterSeat),
          round_result: null,
          winner_seat: null,
          winner_player_id: null,
          next_setter_seat: null,
          last_action: {
            type: 'reset_round',
            playerId: account.id,
            seatNumber: 1,
            timestamp: Date.now(),
          },
        };
      } else {
        nextGameState = defaultHangmanState();
      }

      const [nextRoom] = await transaction.update(gameRooms).set({
        displayState: {
          ...current,
          screen: 'game',
          gameId: 'hangman',
          gameState: nextGameState,
        },
        status: nextGameState.phase === 'setup' ? 'lobby' : 'live',
        revision: lockedRoom.revision + 1,
        startedAt: lockedRoom.startedAt || (nextGameState.phase === 'playing' ? new Date() : null),
        updatedAt: new Date(),
      }).where(eq(gameRooms.id, lockedRoom.id)).returning();

      await transaction.update(roomParticipants).set({
        lastHeartbeatAt: new Date(),
      }).where(eq(roomParticipants.id, currentHost.id));

      await recordHangmanRound(nextRoom, nextGameState, participants, transaction);

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
