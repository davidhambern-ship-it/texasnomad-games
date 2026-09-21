import { and, eq, gt, inArray, isNull } from 'drizzle-orm';

import { db } from '../../server/db/client.js';
import { deviceSessions, gameRooms, hostSessions, playerProfiles, roomParticipants } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';
import { hashDisplayToken } from '../../server/pairing.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getHeader(request, name) {
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

function hangmanProjection(gameState = {}) {
  const secret = String(gameState.secret_word || '').toUpperCase();
  const guessed = Array.isArray(gameState.guessed_letters) ? gameState.guessed_letters : [];
  const reveal = gameState.word_revealed === true;
  const maskedWord = secret
    .split('')
    .map((character) => (
      character === ' ' || guessed.includes(character) || reveal
        ? character
        : '_'
    ))
    .join('');

  return {
    phase: gameState.phase || 'setup',
    category: gameState.category || '',
    hint: gameState.hint_revealed ? (gameState.hint || '') : '',
    hintRevealed: gameState.hint_revealed === true,
    wordRevealed: reveal,
    maskedWord,
    guessedLetters: guessed,
    wrongLetters: Array.isArray(gameState.wrong_letters) ? gameState.wrong_letters : [],
    maxWrong: Number(gameState.max_wrong || 6),
    lastAction: gameState.last_action || null,
  };
}

function spadesProjection(gameState = {}) {
  return {
    phase: gameState.phase || 'setup',
    team1Name: gameState.team1Name || 'Team 1',
    team2Name: gameState.team2Name || 'Team 2',
    targetScore: Number(gameState.targetScore || 500),
    score1: Number(gameState.score1 || 0),
    score2: Number(gameState.score2 || 0),
    bid1: gameState.bid1 ?? null,
    bid2: gameState.bid2 ?? null,
    books1: Number(gameState.books1 || 0),
    books2: Number(gameState.books2 || 0),
    dealerSeat: gameState.dealerSeat || 1,
    currentBidderSeat: gameState.currentBidderSeat || null,
    currentTurnSeat: gameState.currentTurnSeat || null,
    dealStartSeat: gameState.dealStartSeat || null,
    trickWinnerSeat: gameState.trickWinnerSeat || null,
    firstHandNoBid: gameState.firstHandNoBid === true,
    currentTrick: Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [],
    tricksPlayed: Number(gameState.tricksPlayed || 0),
    spadesBroken: gameState.spadesBroken === true,
    handNumber: Number(gameState.handNumber || 0),
    lastHandResult: gameState.lastHandResult || null,
    players: Array.isArray(gameState.players)
      ? gameState.players.map((player) => ({
          seatNumber: player.seatNumber,
          playerType: player.playerType,
          characterId: player.characterId || null,
          name: player.name || null,
          role: player.role || 'player',
          cardCount: Number(player.cardCount || 0),
          bid: player.bid ?? null,
          tricksWon: Number(player.tricksWon || 0),
        }))
      : [],
  };
}


function squareBizProjection(gameState = {}, participants = []) {
  const phase = gameState.phase || 'lobby';
  const choicesVisible = ['answering', 'result', 'finished'].includes(phase);
  const answerVisible = ['result', 'finished'].includes(phase);

  const players = participants.map((participant) => {
    const mark = participant.accountId === gameState.x_account_id
      ? 'X'
      : participant.accountId === gameState.o_account_id
        ? 'O'
        : null;
    const queue = Array.isArray(gameState.queue_account_ids)
      ? gameState.queue_account_ids.indexOf(participant.accountId)
      : -1;

    return {
      accountId: participant.accountId,
      name: participant.name || 'Player',
      handle: participant.handle || null,
      mark,
      role: mark ? 'player' : 'viewer',
      queuePosition: queue >= 0 ? queue + 1 : null,
      isCurrent: mark === gameState.current_mark,
    };
  });

  return {
    phase,
    board: Array.isArray(gameState.board) ? gameState.board : Array(9).fill(null),
    currentMark: gameState.current_mark || 'X',
    selectedSquare: gameState.selected_square ?? null,
    currentQuestion: gameState.current_question_id
      ? {
          id: gameState.current_question_id,
          question: gameState.current_question,
          choices: choicesVisible ? gameState.current_choices : null,
        }
      : null,
    choicesRevealAt: gameState.choices_reveal_at || null,
    answerDeadlineAt: gameState.answer_deadline_at || null,
    resultEndsAt: gameState.result_ends_at || null,
    selectedAnswer: gameState.selected_answer || null,
    answerResult: gameState.answer_result ?? null,
    correctAnswer: answerVisible ? (gameState.correct_answer || null) : null,
    correctAnswerText: answerVisible ? (gameState.correct_answer_text || null) : null,
    introStartedAt: gameState.intro_started_at || null,
    introEndsAt: gameState.intro_ends_at || null,
    questionReplayNonce: gameState.question_replay_nonce || 0,
    winner: gameState.winner || null,
    winningLine: gameState.winning_line || null,
    roundNumber: Number(gameState.round_number || 0),
    players,
    canSelectSquare: false,
    canAnswer: false,
    lastAction: gameState.last_action || null,
  };
}

async function squareBizParticipants(roomId) {
  const participants = await db.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, roomId),
    isNull(roomParticipants.leftAt),
  ));

  const accountIds = participants.map((item) => item.accountId);
  const profiles = accountIds.length
    ? await db.select({
        accountId: playerProfiles.accountId,
        displayName: playerProfiles.displayName,
        handle: playerProfiles.handle,
      }).from(playerProfiles).where(inArray(playerProfiles.accountId, accountIds))
    : [];

  const profileByAccount = new Map(profiles.map((profile) => [profile.accountId, profile]));
  return participants.map((participant) => {
    const profile = profileByAccount.get(participant.accountId);
    return {
      ...participant,
      name: profile?.displayName || profile?.handle || 'Player',
      handle: profile?.handle || null,
    };
  });
}

async function projectRoom(room) {
  const source = room.displayState || {};
  const gameState = source.gameState || {};

  return {
    id: room.id,
    roomCode: room.roomCode,
    gameId: room.gameId,
    status: room.status,
    revision: room.revision,
    screen: source.screen || 'lobby',
    state: room.gameId === 'hangman'
      ? hangmanProjection(gameState)
      : room.gameId === 'spades'
        ? spadesProjection(gameState)
        : room.gameId === 'square-biz'
          ? squareBizProjection(gameState, await squareBizParticipants(room.id))
          : {},
    updatedAt: room.updatedAt,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

  try {
    const deviceId = getHeader(request, 'x-tng-display-id');
    const displayToken = getHeader(request, 'x-tng-display-token');

    if (!UUID_PATTERN.test(deviceId) || !displayToken) {
      const error = new Error('A paired Game Display is required.');
      error.statusCode = 401;
      error.code = 'DISPLAY_AUTH_REQUIRED';
      throw error;
    }

    const [display] = await db.select().from(deviceSessions).where(and(
      eq(deviceSessions.id, deviceId),
      eq(deviceSessions.role, 'game_display'),
      eq(deviceSessions.status, 'connected'),
      eq(deviceSessions.tokenHash, hashDisplayToken(displayToken)),
      gt(deviceSessions.expiresAt, new Date()),
    )).limit(1);

    if (!display) {
      const error = new Error('This Game Display session is invalid or expired.');
      error.statusCode = 401;
      error.code = 'INVALID_DISPLAY';
      throw error;
    }

    const [hostSession] = await db.select().from(hostSessions).where(and(
      eq(hostSessions.displayDeviceId, display.id),
      inArray(hostSessions.status, ['ready', 'live']),
    )).limit(1);

    if (!hostSession) {
      return sendJson(response, 200, { room: null, status: 'waiting_for_host' });
    }

    const [room] = await db.select().from(gameRooms).where(and(
      eq(gameRooms.hostSessionId, hostSession.id),
      inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
    )).limit(1);

    return sendJson(response, 200, {
      room: room ? await projectRoom(room) : null,
      status: room ? 'connected' : 'waiting_for_room',
    });
  } catch (error) {
    return sendError(response, error);
  }
}
