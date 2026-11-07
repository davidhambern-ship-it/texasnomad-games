import { and, eq, inArray, isNull } from 'drizzle-orm';

import { requireController } from '../../auth/require-controller.js';
import { db } from '../../db/client.js';
import { gameRooms, playerProfiles, roomParticipants } from '../../db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../http/respond.js';

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

async function hangmanPlayers(roomId) {
  const participants = await db.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, roomId),
    isNull(roomParticipants.leftAt),
  ));

  const accountIds = participants.map((item) => item.accountId);
  const profiles = accountIds.length > 0
    ? await db.select({
        accountId: playerProfiles.accountId,
        displayName: playerProfiles.displayName,
        handle: playerProfiles.handle,
      }).from(playerProfiles).where(inArray(playerProfiles.accountId, accountIds))
    : [];

  const profileByAccount = new Map(profiles.map((item) => [item.accountId, item]));

  return participants
    .filter((item) => [2, 3, 4].includes(Number(item.seatNumber)))
    .map((item) => {
      const profile = profileByAccount.get(item.accountId);
      return {
        playerId: item.accountId,
        accountId: item.accountId,
        seatNumber: Number(item.seatNumber),
        role: 'player',
        playerType: 'human',
        name: profile?.displayName || profile?.handle || `Seat ${item.seatNumber}`,
        handle: profile?.handle || null,
      };
    })
    .sort((a, b) => a.seatNumber - b.seatNumber);
}

async function normalizeRoom(room) {
  const displayState = room.displayState || {};
  const baseGameState = displayState.gameState || defaultState(room.gameId);
  let gameState = baseGameState;

  if (room.gameId === 'hangman') {
    gameState = {
      ...baseGameState,
      secret_word: '',
      hint: baseGameState.hint_revealed ? (baseGameState.hint || '') : '',
      players: await hangmanPlayers(room.id),
    };
  }

  if (room.gameId === 'word-search') {
    gameState = {
      ...baseGameState,
      words: Array.isArray(baseGameState.words)
        ? baseGameState.words.map((word) => ({
            word: word.word,
            found: word.found === true,
            foundBy: word.foundBy ?? null,
            cells: word.found ? (word.cells || []) : [],
            points: word.found ? (word.points || null) : null,
            directionLabel: word.found ? (word.directionLabel || null) : null,
          }))
        : [],
    };
  }

  return {
    id: room.id,
    roomCode: room.roomCode,
    gameId: room.gameId,
    status: room.status,
    revision: room.revision,
    gameState,
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
      // The lobby roster is sourced from room participants, not the game
      // board's gameState. Word Search and other dedicated game APIs keep
      // their own state shape, so reading players from gameState can show 0
      // even after a guest has joined successfully.
      const participants = await db.select().from(roomParticipants).where(and(
        eq(roomParticipants.roomId, room.id),
        isNull(roomParticipants.leftAt),
      ));
      const accountIds = [...new Set(participants.map((person) => person.accountId))];
      const profiles = accountIds.length > 0
        ? await db.select({
            accountId: playerProfiles.accountId,
            displayName: playerProfiles.displayName,
            handle: playerProfiles.handle,
          }).from(playerProfiles).where(inArray(playerProfiles.accountId, accountIds))
        : [];
      const profileByAccount = new Map(profiles.map((profile) => [profile.accountId, profile]));
      const people = participants.map((person) => {
        const profile = profileByAccount.get(person.accountId);
        return {
          playerId: person.accountId,
          accountId: person.accountId,
          seatNumber: person.seatNumber == null ? null : Number(person.seatNumber),
          role: person.role,
          playerType: 'human',
          name: profile?.displayName || profile?.handle ||
            (person.role === 'host_player' ? 'HOST' : 'Player'),
          handle: profile?.handle || null,
        };
      }).sort((left, right) => (left.seatNumber || 99) - (right.seatNumber || 99));

      return sendJson(response, 200, {
        room: await normalizeRoom(room),
        people,
      });
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

    // Dedicated cabinets still own their game rules and board state, but the
    // common room owns the lobby-to-game transition for every title.
    if (
      ['hangman', 'word-search'].includes(room.gameId) &&
      command?.action !== 'start'
    ) {
      const error = new Error(
        room.gameId === 'hangman'
          ? 'Hangman state is controlled by the dedicated Hangman API.'
          : 'Word Search state is controlled by the dedicated Word Search API.',
      );
      error.statusCode = 409;
      error.code = room.gameId === 'hangman'
        ? 'HANGMAN_DEDICATED_API_REQUIRED'
        : 'WORD_SEARCH_DEDICATED_API_REQUIRED';
      throw error;
    }

    if (command?.action === 'start') {
      const participants = await db.select().from(roomParticipants).where(and(
        eq(roomParticipants.roomId, room.id),
        isNull(roomParticipants.leftAt),
      ));
      if (participants.length < 2) {
        const error = new Error('At least one other player must join before the host can start the game.');
        error.statusCode = 409;
        error.code = 'ROOM_NEEDS_PLAYERS';
        throw error;
      }
      if (room.status !== 'lobby') {
        const error = new Error('This room has already left the waiting lobby.');
        error.statusCode = 409;
        error.code = 'ROOM_ALREADY_STARTED';
        throw error;
      }
    }

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
      command?.action === 'start'
        ? 'live'
        : nextGameState.phase === 'setup'
          ? 'lobby'
          : 'live';

    const [updated] = await db.update(gameRooms).set({
      displayState: nextDisplayState,
      status: nextStatus,
      revision: room.revision + 1,
      startedAt:
        room.startedAt || (nextStatus === 'live' ? new Date() : null),
      updatedAt: new Date(),
    }).where(eq(gameRooms.id, room.id)).returning();

    return sendJson(response, 200, { room: await normalizeRoom(updated) });
  } catch (error) {
    return sendError(response, error);
  }
}
