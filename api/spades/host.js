import { and, eq, inArray } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import {
  gameRooms,
  participantPrivateState,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  dealSpades,
  defaultSpadesState,
  generateSpadesDeck,
  shuffleSpadesDeck,
} from '../../server/games/spades.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const CPU_SEATS = [
  { seatNumber: 2, playerType: 'cpu', characterId: 'dexter', name: 'Dexter' },
  { seatNumber: 3, playerType: 'cpu', characterId: 'lemonade', name: 'Lemonade' },
  { seatNumber: 4, playerType: 'cpu', characterId: 'tank', name: 'Tank' },
];

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

async function findRoom(hostSessionId, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(and(
    eq(gameRooms.hostSessionId, hostSessionId),
    eq(gameRooms.gameId, 'spades'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);

  if (!room) {
    const error = new Error('No active Spades room is connected to this Host Controller.');
    error.statusCode = 404;
    error.code = 'SPADES_ROOM_NOT_FOUND';
    throw error;
  }

  return room;
}

async function privateHand(roomId, accountId, executor = db) {
  const [privateState] = await executor.select()
    .from(participantPrivateState)
    .where(and(
      eq(participantPrivateState.roomId, roomId),
      eq(participantPrivateState.accountId, accountId),
    ))
    .limit(1);

  return privateState?.privateState?.hand || [];
}

async function payload(room, accountId) {
  return {
    room: publicRoom(room),
    hand: await privateHand(room.id, accountId),
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

    if (request.method === 'GET') {
      return sendJson(response, 200, await payload(room, account.id));
    }

    const action = request.body?.action;

    if (action === 'setup_demo') {
      const now = new Date();

      const updatedRoom = await db.transaction(async (transaction) => {
        const [seatOne] = await transaction.select().from(roomParticipants).where(and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.seatNumber, 1),
        )).limit(1);

        if (seatOne && seatOne.accountId !== account.id) {
          const error = new Error('Seat 1 is already occupied.');
          error.statusCode = 409;
          error.code = 'SPADES_HOST_SEAT_TAKEN';
          throw error;
        }

        const [existingHost] = await transaction.select().from(roomParticipants).where(and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.accountId, account.id),
        )).limit(1);

        if (existingHost) {
          await transaction.update(roomParticipants).set({
            deviceSessionId: device.id,
            role: 'host_player',
            seatNumber: 1,
            leftAt: null,
            lastHeartbeatAt: now,
          }).where(eq(roomParticipants.id, existingHost.id));
        } else {
          await transaction.insert(roomParticipants).values({
            roomId: room.id,
            accountId: account.id,
            deviceSessionId: device.id,
            role: 'host_player',
            seatNumber: 1,
          });
        }

        const gameState = {
          ...defaultSpadesState(),
          players: [
            {
              seatNumber: 1,
              playerType: 'human',
              role: 'hostPlayer',
              name: 'HOST',
              cardCount: 0,
              bid: null,
              tricksWon: 0,
            },
            ...CPU_SEATS.map((player) => ({
              ...player,
              role: 'player',
              cardCount: 0,
              bid: null,
              tricksWon: 0,
            })),
          ],
        };

        const [nextRoom] = await transaction.update(gameRooms).set({
          displayState: {
            screen: 'game',
            gameId: 'spades',
            gameState,
            serverState: {
              cpuHands: {},
              deckReady: false,
            },
          },
          status: 'lobby',
          revision: room.revision + 1,
          updatedAt: now,
        }).where(eq(gameRooms.id, room.id)).returning();

        await transaction.insert(participantPrivateState).values({
          roomId: room.id,
          accountId: account.id,
          revision: 0,
          privateState: { hand: [] },
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [
            participantPrivateState.roomId,
            participantPrivateState.accountId,
          ],
          set: {
            revision: 0,
            privateState: { hand: [] },
            updatedAt: now,
          },
        });

        return nextRoom;
      });

      return sendJson(response, 200, await payload(updatedRoom, account.id));
    }

    if (action === 'deal') {
      const current = room.displayState || {};
      const currentGameState = current.gameState || defaultSpadesState();
      const players = Array.isArray(currentGameState.players)
        ? currentGameState.players
        : [];

      if (players.length !== 4 || ![1,2,3,4].every((seat) => players.some((player) => player.seatNumber === seat))) {
        const error = new Error('Set the four-seat Spades table before dealing.');
        error.statusCode = 409;
        error.code = 'SPADES_TABLE_NOT_READY';
        throw error;
      }

      const deck = shuffleSpadesDeck(generateSpadesDeck());
      const { hands, firstSeat } = dealSpades(deck, currentGameState.dealerSeat || 1);
      const hostHand = hands.get(1) || [];
      const now = new Date();

      const updatedRoom = await db.transaction(async (transaction) => {
        await transaction.insert(participantPrivateState).values({
          roomId: room.id,
          accountId: account.id,
          revision: 1,
          privateState: { hand: hostHand },
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [
            participantPrivateState.roomId,
            participantPrivateState.accountId,
          ],
          set: {
            revision: 1,
            privateState: { hand: hostHand },
            updatedAt: now,
          },
        });

        const publicPlayers = players.map((player) => ({
          ...player,
          cardCount: hands.get(player.seatNumber)?.length || 0,
          bid: null,
          tricksWon: 0,
        }));

        const [nextRoom] = await transaction.update(gameRooms).set({
          displayState: {
            ...current,
            screen: 'game',
            gameId: 'spades',
            gameState: {
              ...currentGameState,
              phase: 'dealt',
              players: publicPlayers,
              currentTrick: [],
              currentTurnSeat: firstSeat,
              currentBidderSeat: firstSeat,
              tricksPlayed: 0,
              books1: 0,
              books2: 0,
              spadesBroken: false,
              handNumber: (currentGameState.handNumber || 0) + 1,
            },
            serverState: {
              cpuHands: {
                2: hands.get(2) || [],
                3: hands.get(3) || [],
                4: hands.get(4) || [],
              },
              deckReady: true,
            },
          },
          status: 'live',
          revision: room.revision + 1,
          startedAt: room.startedAt || now,
          updatedAt: now,
        }).where(eq(gameRooms.id, room.id)).returning();

        return nextRoom;
      });

      return sendJson(response, 200, await payload(updatedRoom, account.id));
    }

    const error = new Error('Unknown Spades Host action.');
    error.statusCode = 400;
    error.code = 'INVALID_SPADES_ACTION';
    throw error;
  } catch (error) {
    return sendError(response, error);
  }
}
