import { and, eq, inArray } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

import { requireController } from '../../auth/require-controller.js';
import { db } from '../../db/client.js';
import { gameRooms, hostSessions, roomParticipants } from '../../db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../http/respond.js';

const GAME_ID_PATTERN = /^[a-z0-9-]{2,64}$/;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];

function createRoomCode() {
  return 'TN' + Array.from({ length: 4 }, () => ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)]).join('');
}

export default async function handler(request, response) {
  if (!['POST', 'DELETE'].includes(request.method)) return methodNotAllowed(response, ['POST', 'DELETE']);

  try {
    const { hostSession } = await requireController(request, { hostSessionRequired: true });

    if (request.method === 'DELETE') {
      const [existingRoom] = await db.select().from(gameRooms).where(and(
        eq(gameRooms.hostSessionId, hostSession.id),
        inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
      )).limit(1);

      if (!existingRoom) {
        return sendJson(response, 200, { room: null, disconnected: false });
      }

      const now = new Date();
      const [room] = await db.transaction(async (transaction) => {
        const ended = await transaction.update(gameRooms).set({
          status: 'abandoned',
          updatedAt: now,
        }).where(eq(gameRooms.id, existingRoom.id)).returning();

        await transaction.update(hostSessions).set({
          status: 'ready',
          updatedAt: now,
        }).where(eq(hostSessions.id, hostSession.id));

        return ended;
      });

      return sendJson(response, 200, { room, disconnected: true });
    }

    const gameId = typeof request.body?.gameId === 'string' ? request.body.gameId.trim().toLowerCase() : '';

    if (!GAME_ID_PATTERN.test(gameId)) {
      const error = new Error('Choose a valid community game.');
      error.statusCode = 400;
      error.code = 'INVALID_GAME';
      throw error;
    }

    if (!['pairing', 'ready', 'live'].includes(hostSession.status)) {
      const error = new Error('The room controller is not ready to create a live room.');
      error.statusCode = 409;
      error.code = 'HOST_SESSION_NOT_READY';
      throw error;
    }

    const [existingRoom] = await db.select().from(gameRooms).where(and(
      eq(gameRooms.hostSessionId, hostSession.id),
      inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
    )).limit(1);

    if (existingRoom) {
      const error = new Error('This room controller already has an active live room.');
      error.statusCode = 409;
      error.code = 'HOST_ROOM_ALREADY_ACTIVE';
      error.room = existingRoom;
      throw error;
    }

    let room;
    for (let attempt = 0; attempt < 5 && !room; attempt += 1) {
      try {
        [room] = await db.transaction(async (transaction) => {
          const created = await transaction.insert(gameRooms).values({
            roomCode: createRoomCode(),
            gameId,
            hostSessionId: hostSession.id,
            status: 'lobby',
            displayState: { screen: 'lobby', gameId },
          }).returning();

          // The creator is a real participant in the shared room, not an
          // out-of-band controller. Seat 1 is reserved for the host.
          await transaction.insert(roomParticipants).values({
            roomId: created.id,
            accountId: hostSession.hostAccountId,
            deviceSessionId: hostSession.controllerDeviceId,
            role: 'host_player',
            seatNumber: 1,
            lastHeartbeatAt: new Date(),
          });

          await transaction.update(hostSessions).set({ status: 'live', updatedAt: new Date() })
            .where(eq(hostSessions.id, hostSession.id));
          return created;
        });
      } catch (error) {
        if (error.code !== '23505' || attempt === 4) throw error;
      }
    }

    return sendJson(response, 201, { room });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.code = 'HOST_ROOM_ALREADY_ACTIVE';
      error.message = 'This room controller is already connected to a live room.';
    }
    return sendError(response, error);
  }
}
