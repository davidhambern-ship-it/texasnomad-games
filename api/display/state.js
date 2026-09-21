import { and, eq, gt, inArray } from 'drizzle-orm';

import { db } from '../../server/db/client.js';
import { deviceSessions, gameRooms, hostSessions } from '../../server/db/schema.js';
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
    currentTrick: Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [],
    tricksPlayed: Number(gameState.tricksPlayed || 0),
    spadesBroken: gameState.spadesBroken === true,
    handNumber: Number(gameState.handNumber || 0),
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

function projectRoom(room) {
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
      room: room ? projectRoom(room) : null,
      status: room ? 'connected' : 'waiting_for_room',
    });
  } catch (error) {
    return sendError(response, error);
  }
}
