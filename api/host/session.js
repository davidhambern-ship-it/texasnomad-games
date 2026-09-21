import { and, eq, inArray, isNull } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import { deviceSessions, displayPairings, gameRooms, hostSessions } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];

async function findActiveRoom(hostSessionId, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(and(
    eq(gameRooms.hostSessionId, hostSessionId),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  )).limit(1);
  return room || null;
}

export default async function handler(request, response) {
  if (!['POST', 'DELETE'].includes(request.method)) return methodNotAllowed(response, ['POST', 'DELETE']);

  try {
    if (request.method === 'DELETE') {
      const { hostSession } = await requireController(request, { hostSessionRequired: true });
      const now = new Date();

      await db.transaction(async (transaction) => {
        await transaction.update(gameRooms).set({
          status: 'abandoned',
          updatedAt: now,
        }).where(and(
          eq(gameRooms.hostSessionId, hostSession.id),
          inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
        ));

        await transaction.update(displayPairings).set({ consumedAt: now }).where(and(
          eq(displayPairings.hostSessionId, hostSession.id),
          isNull(displayPairings.consumedAt),
        ));

        if (hostSession.displayDeviceId) {
          await transaction.update(deviceSessions).set({
            status: 'disconnected',
            updatedAt: now,
          }).where(eq(deviceSessions.id, hostSession.displayDeviceId));
        }

        await transaction.update(hostSessions).set({
          status: 'ended',
          endedAt: now,
          updatedAt: now,
        }).where(eq(hostSessions.id, hostSession.id));
      });

      return sendJson(response, 200, { ended: true, hostSessionId: hostSession.id });
    }

    const { account, device } = await requireController(request);
    const [activeSession] = await db.select().from(hostSessions).where(and(
      eq(hostSessions.hostAccountId, account.id),
      inArray(hostSessions.status, ['pairing', 'ready', 'live']),
    )).limit(1);

    if (activeSession) {
      const activeRoom = await findActiveRoom(activeSession.id);

      if (activeSession.controllerDeviceId !== device.id) {
        // Development player-testing recovery:
        // if this account already owns a LIVE room, a valid controller device
        // for the same account may reclaim that room automatically. This keeps
        // Preview auth refreshes from forcing a Game Display reconnect.
        const reclaimController =
          request.body?.reclaimController === true ||
          Boolean(activeRoom);

        if (!reclaimController) {
          const error = new Error('This Host account already has an active controller.');
          error.statusCode = 409;
          error.code = 'HOST_ALREADY_CONTROLLED';
          throw error;
        }

        const now = new Date();
        const [reclaimedSession] = await db.transaction(async (transaction) => {
          await transaction.update(deviceSessions).set({
            status: 'disconnected',
            updatedAt: now,
          }).where(eq(deviceSessions.id, activeSession.controllerDeviceId));

          const [updated] = await transaction.update(hostSessions).set({
            controllerDeviceId: device.id,
            updatedAt: now,
          }).where(eq(hostSessions.id, activeSession.id)).returning();

          return [updated];
        });

        return sendJson(response, 200, {
          hostSession: reclaimedSession,
          activeRoom,
          resumed: true,
          controllerReclaimed: true,
        });
      }

      return sendJson(response, 200, { hostSession: activeSession, activeRoom, resumed: true });
    }

    const [hostSession] = await db.insert(hostSessions).values({
      hostAccountId: account.id,
      controllerDeviceId: device.id,
      status: 'pairing',
    }).returning();

    return sendJson(response, 201, { hostSession, activeRoom: null, resumed: false });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.code = 'HOST_ALREADY_CONTROLLED';
      error.message = 'This Host account or controller already has an active session.';
    }
    return sendError(response, error);
  }
}
