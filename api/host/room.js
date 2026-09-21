import { and, eq, inArray } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import { gameRooms, hostSessions } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const GAME_ID_PATTERN = /^[a-z0-9-]{2,64}$/;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRoomCode(length = 6) {
  return Array.from({ length }, () => ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)]).join('');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  try {
    const { hostSession } = await requireController(request, { hostSessionRequired: true });
    const gameId = typeof request.body?.gameId === 'string' ? request.body.gameId.trim().toLowerCase() : '';

    if (!GAME_ID_PATTERN.test(gameId)) {
      const error = new Error('Choose a valid community game.');
      error.statusCode = 400;
      error.code = 'INVALID_GAME';
      throw error;
    }

    if (!hostSession.displayDeviceId || !['ready', 'live'].includes(hostSession.status)) {
      const error = new Error('Connect the Game Display before creating a live room.');
      error.statusCode = 409;
      error.code = 'DISPLAY_REQUIRED';
      throw error;
    }

    const [existingRoom] = await db.select().from(gameRooms).where(and(
      eq(gameRooms.hostSessionId, hostSession.id),
      inArray(gameRooms.status, ['lobby', 'live', 'paused']),
    )).limit(1);

    if (existingRoom) {
      const error = new Error('This Host Panel is already connected to a live room.');
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
      error.message = 'This Host Panel is already connected to a live room.';
    }
    return sendError(response, error);
  }
}
