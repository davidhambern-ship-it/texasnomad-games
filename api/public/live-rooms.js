import { and, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '../../server/db/client.js';
import { gameRooms, roomParticipants } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_STATUSES = ['lobby', 'live', 'paused'];

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return methodNotAllowed(response, ['GET']);
  }

  try {
    const rooms = await db
      .select({
        id: gameRooms.id,
        roomCode: gameRooms.roomCode,
        gameId: gameRooms.gameId,
        status: gameRooms.status,
        startedAt: gameRooms.startedAt,
        updatedAt: gameRooms.updatedAt,
        players: sql`count(${roomParticipants.id}) filter (where ${roomParticipants.leftAt} is null)::int`,
      })
      .from(gameRooms)
      .leftJoin(
        roomParticipants,
        and(
          sql`${roomParticipants.roomId} = ${gameRooms.id}`,
          isNull(roomParticipants.leftAt),
        ),
      )
      .where(inArray(gameRooms.status, ACTIVE_STATUSES))
      .groupBy(gameRooms.id)
      .orderBy(sql`
        case ${gameRooms.status}
          when 'live' then 0
          when 'lobby' then 1
          else 2
        end,
        ${gameRooms.updatedAt} desc
      `)
      .limit(20);

    return sendJson(response, 200, {
      rooms: rooms.map((room) => ({
        id: room.id,
        roomCode: room.roomCode,
        gameId: room.gameId,
        status: room.status,
        players: Number(room.players || 0),
        startedAt: room.startedAt,
        updatedAt: room.updatedAt,
      })),
    });
  } catch (error) {
    return sendError(response, error);
  }
}
