import { and, eq, inArray } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import {
  gameRooms,
  participantPrivateState,
  roomParticipants,
} from '../../server/db/schema.js';
import {
  chooseCpuSpadesCard,
  dealSpades,
  defaultSpadesState,
  determineSpadesTrickWinner,
  generateSpadesDeck,
  isSpadeCard,
  nextSpadesSeat,
  shuffleSpadesDeck,
  spadesTeamForSeat,
  validateSpadesPlay,
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

function stateAfterCardPlay(gameState, seatNumber, card) {
  const currentTrick = Array.isArray(gameState.currentTrick)
    ? gameState.currentTrick
    : [];
  const nextTrick = [...currentTrick, { seatNumber, card }];
  const spadesBroken = gameState.spadesBroken || isSpadeCard(card);

  if (nextTrick.length === 4) {
    const winner = determineSpadesTrickWinner(nextTrick);
    return {
      ...gameState,
      phase: 'resolving',
      currentTrick: nextTrick,
      currentTurnSeat: null,
      trickWinnerSeat: winner?.seatNumber || null,
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

function scoreCompletedHand(gameState, books1, books2) {
  if (Number(gameState.handNumber || 0) === 1) {
    return {
      score1: Number(gameState.score1 || 0) + books1,
      score2: Number(gameState.score2 || 0) + books2,
    };
  }

  const bid1 = Number(gameState.bid1 || 0);
  const bid2 = Number(gameState.bid2 || 0);

  return {
    score1: Number(gameState.score1 || 0) + (books1 >= bid1 ? books1 : -bid1),
    score2: Number(gameState.score2 || 0) + (books2 >= bid2 ? books2 : -bid2),
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

        const currentSource = room.displayState || {};
        const currentGameState = currentSource.gameState || defaultSpadesState();
        const currentHumans = Array.isArray(currentGameState.players)
          ? currentGameState.players.filter((player) => (
              player.playerType === 'human' &&
              [2, 3, 4].includes(Number(player.seatNumber))
            ))
          : [];

        const gamePlayers = [
          {
            accountId: account.id,
            seatNumber: 1,
            playerType: 'human',
            role: 'hostPlayer',
            name: 'HOST',
            cardCount: 0,
            bid: null,
            tricksWon: 0,
          },
          ...[2, 3, 4].map((seatNumber) => {
            const human = currentHumans.find((player) => Number(player.seatNumber) === seatNumber);
            if (human) {
              return {
                ...human,
                playerType: 'human',
                role: 'player',
                cardCount: 0,
                bid: null,
                tricksWon: 0,
              };
            }

            const cpu = CPU_SEATS.find((player) => player.seatNumber === seatNumber);
            return {
              ...cpu,
              role: 'player',
              cardCount: 0,
              bid: null,
              tricksWon: 0,
            };
          }),
        ];

        const gameState = {
          ...defaultSpadesState(),
          players: gamePlayers,
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
      const nextHandNumber = Number(currentGameState.handNumber || 0) + 1;

      const updatedRoom = await db.transaction(async (transaction) => {
        await transaction.insert(participantPrivateState).values({
          roomId: room.id,
          accountId: account.id,
          revision: nextHandNumber,
          privateState: { hand: hostHand },
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [
            participantPrivateState.roomId,
            participantPrivateState.accountId,
          ],
          set: {
            revision: nextHandNumber,
            privateState: { hand: hostHand },
            updatedAt: now,
          },
        });

        for (const player of players) {
          if (
            player.playerType === 'human' &&
            player.accountId &&
            [2, 3, 4].includes(Number(player.seatNumber))
          ) {
            const playerHand = hands.get(player.seatNumber) || [];
            await transaction.insert(participantPrivateState).values({
              roomId: room.id,
              accountId: player.accountId,
              revision: nextHandNumber,
              privateState: { hand: playerHand },
              updatedAt: now,
            }).onConflictDoUpdate({
              target: [
                participantPrivateState.roomId,
                participantPrivateState.accountId,
              ],
              set: {
                revision: nextHandNumber,
                privateState: { hand: playerHand },
                updatedAt: now,
              },
            });
          }
        }

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
              bid1: null,
              bid2: null,
              currentTrick: [],
              currentTurnSeat: null,
              currentBidderSeat: null,
              trickWinnerSeat: null,
              dealStartSeat: firstSeat,
              firstHandNoBid: nextHandNumber === 1,
              tricksPlayed: 0,
              books1: 0,
              books2: 0,
              spadesBroken: false,
              handNumber: nextHandNumber,
            },
            serverState: {
              cpuHands: players.reduce((accumulator, player) => {
                if (player.playerType === 'cpu' && [2, 3, 4].includes(player.seatNumber)) {
                  accumulator[player.seatNumber] = hands.get(player.seatNumber) || [];
                }
                return accumulator;
              }, {}),
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

    if (action === 'start_hand') {
      const current = room.displayState || {};
      const gameState = current.gameState || defaultSpadesState();

      if (gameState.phase !== 'dealt') {
        const error = new Error('This hand is not waiting to start.');
        error.statusCode = 409;
        error.code = 'SPADES_HAND_NOT_DEALT';
        throw error;
      }

      const firstSeat = gameState.dealStartSeat || nextSpadesSeat(gameState.dealerSeat || 1);
      const firstHand = Number(gameState.handNumber || 0) === 1;
      const players = (gameState.players || []).map((player) => ({
        ...player,
        bid: firstHand ? 0 : null,
      }));
      const now = new Date();

      const [updatedRoom] = await db.update(gameRooms).set({
        displayState: {
          ...current,
          gameState: {
            ...gameState,
            players,
            phase: firstHand ? 'playing' : 'bidding',
            bid1: firstHand ? 0 : null,
            bid2: firstHand ? 0 : null,
            currentTurnSeat: firstHand ? firstSeat : null,
            currentBidderSeat: firstHand ? null : firstSeat,
            firstHandNoBid: firstHand,
          },
        },
        status: 'live',
        revision: room.revision + 1,
        updatedAt: now,
      }).where(eq(gameRooms.id, room.id)).returning();

      return sendJson(response, 200, await payload(updatedRoom, account.id));
    }

    if (action === 'play_card') {
      const current = room.displayState || {};
      const gameState = current.gameState || defaultSpadesState();

      if (gameState.phase !== 'playing' || gameState.currentTurnSeat !== 1) {
        const error = new Error('It is not the Host player turn.');
        error.statusCode = 409;
        error.code = 'SPADES_NOT_HOST_TURN';
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
        player.seatNumber === 1
          ? { ...player, cardCount: remainingHand.length }
          : player
      ));
      const nextGameState = stateAfterCardPlay({ ...gameState, players }, 1, card);
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

      return sendJson(response, 200, await payload(updatedRoom, account.id));
    }

    if (action === 'cpu_turn') {
      const current = room.displayState || {};
      const gameState = current.gameState || defaultSpadesState();
      const serverState = current.serverState || {};
      const seatNumber = Number(gameState.currentTurnSeat || 0);
      const currentPlayer = (gameState.players || []).find(
        (player) => Number(player.seatNumber) === seatNumber,
      );

      if (gameState.phase !== 'playing' || ![2, 3, 4].includes(seatNumber)) {
        const error = new Error('No CPU turn is ready to play.');
        error.statusCode = 409;
        error.code = 'SPADES_NO_CPU_TURN';
        throw error;
      }

      if (!currentPlayer || currentPlayer.playerType !== 'cpu') {
        const error = new Error('The current Spades turn belongs to a human player.');
        error.statusCode = 409;
        error.code = 'SPADES_HUMAN_TURN';
        throw error;
      }

      const cpuHands = { ...(serverState.cpuHands || {}) };
      const hand = Array.isArray(cpuHands[seatNumber]) ? cpuHands[seatNumber] : [];
      const card = chooseCpuSpadesCard(
        hand,
        gameState.currentTrick || [],
        gameState.spadesBroken === true,
      );

      if (!card) {
        const error = new Error('The CPU has no legal card to play.');
        error.statusCode = 409;
        error.code = 'SPADES_CPU_NO_LEGAL_CARD';
        throw error;
      }

      cpuHands[seatNumber] = hand.filter((item) => item.id !== card.id);
      const players = (gameState.players || []).map((player) => (
        player.seatNumber === seatNumber
          ? { ...player, cardCount: cpuHands[seatNumber].length }
          : player
      ));
      const nextGameState = stateAfterCardPlay(
        { ...gameState, players },
        seatNumber,
        card,
      );
      const now = new Date();

      const [updatedRoom] = await db.update(gameRooms).set({
        displayState: {
          ...current,
          gameState: nextGameState,
          serverState: {
            ...serverState,
            cpuHands,
          },
        },
        revision: room.revision + 1,
        updatedAt: now,
      }).where(eq(gameRooms.id, room.id)).returning();

      return sendJson(response, 200, await payload(updatedRoom, account.id));
    }

    if (action === 'resolve_trick') {
      const current = room.displayState || {};
      const gameState = current.gameState || defaultSpadesState();
      const trick = Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [];

      if (gameState.phase !== 'resolving' || trick.length !== 4 || !gameState.trickWinnerSeat) {
        const error = new Error('There is no completed trick to resolve.');
        error.statusCode = 409;
        error.code = 'SPADES_TRICK_NOT_READY';
        throw error;
      }

      const winnerSeat = Number(gameState.trickWinnerSeat);
      const winnerTeam = spadesTeamForSeat(winnerSeat);
      const tricksPlayed = Number(gameState.tricksPlayed || 0) + 1;
      const books1 = Number(gameState.books1 || 0) + (winnerTeam === 1 ? 1 : 0);
      const books2 = Number(gameState.books2 || 0) + (winnerTeam === 2 ? 1 : 0);
      const players = (gameState.players || []).map((player) => (
        player.seatNumber === winnerSeat
          ? { ...player, tricksWon: Number(player.tricksWon || 0) + 1 }
          : player
      ));
      const handComplete = tricksPlayed >= 13;
      const score = handComplete
        ? scoreCompletedHand(gameState, books1, books2)
        : {
            score1: Number(gameState.score1 || 0),
            score2: Number(gameState.score2 || 0),
          };
      const now = new Date();

      const [updatedRoom] = await db.update(gameRooms).set({
        displayState: {
          ...current,
          gameState: {
            ...gameState,
            ...score,
            players,
            books1,
            books2,
            tricksPlayed,
            currentTrick: [],
            trickWinnerSeat: null,
            phase: handComplete ? 'round_over' : 'playing',
            currentTurnSeat: handComplete ? null : winnerSeat,
            currentBidderSeat: null,
            dealerSeat: handComplete
              ? nextSpadesSeat(gameState.dealerSeat || 1)
              : gameState.dealerSeat,
            lastHandResult: handComplete
              ? {
                  handNumber: Number(gameState.handNumber || 0),
                  books1,
                  books2,
                  score1: score.score1,
                  score2: score.score2,
                  firstHandBidsItself: Number(gameState.handNumber || 0) === 1,
                }
              : gameState.lastHandResult || null,
          },
        },
        revision: room.revision + 1,
        updatedAt: now,
      }).where(eq(gameRooms.id, room.id)).returning();

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
