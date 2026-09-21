import { and, eq, gt, inArray } from 'drizzle-orm';

import { requireAccount } from '../../server/auth/require-account.js';
import { db } from '../../server/db/client.js';
import {
  deviceSessions,
  gameRooms,
  participantPrivateState,
  playerProfiles,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  defaultSpadesState,
  isSpadeCard,
  nextSpadesSeat,
  validateSpadesPlay,
} from '../../server/games/spades.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

function getHeader(request, name) {
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

async function resolvePlayer(request) {
  const account = await requireAccount(request);
  const deviceId = getHeader(request, 'x-tng-device-id');
  const roomCode = String(getHeader(request, 'x-tng-room-code') || request.body?.roomCode || '')
    .trim()
    .toUpperCase();

  if (!UUID_PATTERN.test(deviceId)) {
    const error = new Error('A Player device is required.');
    error.statusCode = 401;
    error.code = 'PLAYER_DEVICE_REQUIRED';
    throw error;
  }
  if (!ROOM_CODE_PATTERN.test(roomCode)) {
    const error = new Error('Enter a valid TNG room code.');
    error.statusCode = 400;
    error.code = 'INVALID_ROOM_CODE';
    throw error;
  }

  const [device] = await db.select().from(deviceSessions).where(and(
    eq(deviceSessions.id, deviceId),
    eq(deviceSessions.accountId, account.id),
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

  const [room] = await db.select().from(gameRooms).where(and(
    eq(gameRooms.roomCode, roomCode),
    eq(gameRooms.gameId, 'spades'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('This Spades room is no longer active.');
    error.statusCode = 404;
    error.code = 'SPADES_ROOM_NOT_FOUND';
    throw error;
  }

  const [participant] = await db.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, room.id),
    eq(roomParticipants.accountId, account.id),
  )).limit(1);

  if (!participant || participant.leftAt) {
    const error = new Error('Join the room before opening the Spades player view.');
    error.statusCode = 409;
    error.code = 'ROOM_JOIN_REQUIRED';
    throw error;
  }

  const [profile] = await db.select({
    displayName: playerProfiles.displayName,
    handle: playerProfiles.handle,
  }).from(playerProfiles).where(eq(playerProfiles.accountId, account.id)).limit(1);

  return { account, device, room, participant, profile };
}

function publicRoom(room) {
  const source = room.displayState || {};
  return {
    id: room.id,
    roomCode: room.roomCode,
    gameId: room.gameId,
    status: room.status,
    revision: room.revision,
    gameState: source.gameState || defaultSpadesState(),
    updatedAt: room.updatedAt,
  };
}

async function privateHand(roomId, accountId, executor = db) {
  const [privateState] = await executor.select().from(participantPrivateState).where(and(
    eq(participantPrivateState.roomId, roomId),
    eq(participantPrivateState.accountId, accountId),
  )).limit(1);

  return privateState?.privateState?.hand || [];
}

async function payload(room, participant, accountId) {
  return {
    room: publicRoom(room),
    participant: {
      id: participant.id,
      seatNumber: participant.seatNumber,
      role: participant.role,
    },
    hand: await privateHand(room.id, accountId),
  };
}

function stateAfterCardPlay(gameState, seatNumber, card) {
  const currentTrick = Array.isArray(gameState.currentTrick)
    ? gameState.currentTrick
    : [];
  const nextTrick = [...currentTrick, { seatNumber, card }];
  const spadesBroken = gameState.spadesBroken || isSpadeCard(card);

  if (nextTrick.length === 4) {
    return {
      ...gameState,
      phase: 'resolving',
      currentTrick: nextTrick,
      currentTurnSeat: null,
      trickWinnerSeat: null,
      spadesBroken,
    };
  }

  return {
    ...gameState,
    phase: 'playing',
    currentTrick: nextTrick,
    currentTurnSeat: nextSpadesSeat(seatNumber),
    trickWinnerSeat: null,
    spadesBroken,
  };
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const context = await resolvePlayer(request);
    const { account, device, room, participant, profile } = context;

    if (request.method === 'GET') {
      return sendJson(response, 200, await payload(room, participant, account.id));
    }

    const action = request.body?.action;

    if (action === 'sit') {
      const seatNumber = Number(request.body?.seatNumber);

      if (![2, 3, 4].includes(seatNumber)) {
        const error = new Error('Players may choose Seat 2, 3, or 4.');
        error.statusCode = 400;
        error.code = 'INVALID_PLAYER_SEAT';
        throw error;
      }

      const result = await db.transaction(async (transaction) => {
        const [lockedRoom] = await transaction.select().from(gameRooms)
          .where(eq(gameRooms.id, room.id))
          .limit(1)
          .for('update');

        const [seatOccupant] = await transaction.select().from(roomParticipants).where(and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.seatNumber, seatNumber),
        )).limit(1);

        if (seatOccupant && seatOccupant.accountId !== account.id && !seatOccupant.leftAt) {
          const error = new Error(`Seat ${seatNumber} is already occupied by another player.`);
          error.statusCode = 409;
          error.code = 'SPADES_SEAT_TAKEN';
          throw error;
        }

        const [updatedParticipant] = await transaction.update(roomParticipants).set({
          deviceSessionId: device.id,
          seatNumber,
          role: 'player',
          leftAt: null,
          lastHeartbeatAt: new Date(),
        }).where(eq(roomParticipants.id, participant.id)).returning();

        const source = lockedRoom.displayState || {};
        const gameState = source.gameState || defaultSpadesState();
        const serverState = source.serverState || {};
        const existingPlayers = Array.isArray(gameState.players) ? gameState.players : [];
        const previousSeat = participant.seatNumber;

        const players = existingPlayers
          .filter((player) => (
            player.accountId !== account.id &&
            player.seatNumber !== seatNumber &&
            (previousSeat == null || player.seatNumber !== previousSeat)
          ));

        players.push({
          accountId: account.id,
          seatNumber,
          playerType: 'human',
          role: 'player',
          name: profile?.displayName || profile?.handle || 'Player',
          cardCount: 0,
          bid: null,
          tricksWon: 0,
        });

        players.sort((a, b) => a.seatNumber - b.seatNumber);

        const cpuHands = { ...(serverState.cpuHands || {}) };
        const transferredHand = Array.isArray(cpuHands[seatNumber]) ? cpuHands[seatNumber] : [];
        delete cpuHands[seatNumber];

        if (transferredHand.length > 0) {
          const index = players.findIndex((player) => player.seatNumber === seatNumber);
          if (index >= 0) players[index] = { ...players[index], cardCount: transferredHand.length };

          await transaction.insert(participantPrivateState).values({
            roomId: room.id,
            accountId: account.id,
            revision: lockedRoom.revision + 1,
            privateState: { hand: transferredHand },
            updatedAt: new Date(),
          }).onConflictDoUpdate({
            target: [
              participantPrivateState.roomId,
              participantPrivateState.accountId,
            ],
            set: {
              revision: lockedRoom.revision + 1,
              privateState: { hand: transferredHand },
              updatedAt: new Date(),
            },
          });
        }

        const [updatedRoom] = await transaction.update(gameRooms).set({
          displayState: {
            ...source,
            gameState: {
              ...gameState,
              players,
            },
            serverState: {
              ...serverState,
              cpuHands,
            },
          },
          revision: lockedRoom.revision + 1,
          updatedAt: new Date(),
        }).where(eq(gameRooms.id, room.id)).returning();

        return { room: updatedRoom, participant: updatedParticipant };
      });

      return sendJson(response, 200, await payload(result.room, result.participant, account.id));
    }

    if (action === 'play_card') {
      const seatNumber = Number(participant.seatNumber || 0);

      if (![2, 3, 4].includes(seatNumber)) {
        const error = new Error('Take a seat before playing a card.');
        error.statusCode = 409;
        error.code = 'SPADES_SEAT_REQUIRED';
        throw error;
      }

      const current = room.displayState || {};
      const gameState = current.gameState || defaultSpadesState();

      if (gameState.phase !== 'playing' || Number(gameState.currentTurnSeat) !== seatNumber) {
        const error = new Error('It is not your turn.');
        error.statusCode = 409;
        error.code = 'SPADES_NOT_PLAYER_TURN';
        throw error;
      }

      const hand = await privateHand(room.id, account.id);
      const card = hand.find((item) => item.id === request.body?.cardId);
      const validation = validateSpadesPlay(
        card,
        hand,
        gameState.currentTrick || [],
        gameState.spadesBroken === true,
      );

      if (!validation.valid) {
        const error = new Error(validation.reason || 'That card cannot be played.');
        error.statusCode = 409;
        error.code = 'SPADES_ILLEGAL_PLAY';
        throw error;
      }

      const remainingHand = hand.filter((item) => item.id !== card.id);
      const players = (gameState.players || []).map((player) => (
        player.seatNumber === seatNumber
          ? { ...player, cardCount: remainingHand.length }
          : player
      ));
      const nextGameState = stateAfterCardPlay({ ...gameState, players }, seatNumber, card);
      const now = new Date();

      const updatedRoom = await db.transaction(async (transaction) => {
        await transaction.update(participantPrivateState).set({
          revision: room.revision + 1,
          privateState: { hand: remainingHand },
          updatedAt: now,
        }).where(and(
          eq(participantPrivateState.roomId, room.id),
          eq(participantPrivateState.accountId, account.id),
        ));

        const [nextRoom] = await transaction.update(gameRooms).set({
          displayState: {
            ...current,
            gameState: nextGameState,
          },
          revision: room.revision + 1,
          updatedAt: now,
        }).where(eq(gameRooms.id, room.id)).returning();

        return nextRoom;
      });

      return sendJson(response, 200, await payload(updatedRoom, participant, account.id));
    }

    const error = new Error('Unknown Spades Player action.');
    error.statusCode = 400;
    error.code = 'INVALID_SPADES_PLAYER_ACTION';
    throw error;
  } catch (error) {
    return sendError(response, error);
  }
}
