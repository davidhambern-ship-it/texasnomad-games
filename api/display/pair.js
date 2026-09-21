import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { addHours } from 'date-fns';

import { db } from '../../server/db/client.js';
import { deviceSessions, displayPairings, gameRooms, hostSessions } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';
import { createDisplayToken, hashDisplayToken, hashPairingCode } from '../../server/pairing.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  try {
    const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      const error = new Error('Enter the six-digit display pairing code.');
      error.statusCode = 400;
      error.code = 'INVALID_PAIRING_CODE';
      throw error;
    }

    const displayToken = createDisplayToken();
    const result = await db.transaction(async (transaction) => {
      const [pairing] = await transaction.select().from(displayPairings).where(and(
        eq(displayPairings.codeHash, hashPairingCode(code)),
        isNull(displayPairings.consumedAt),
        gt(displayPairings.expiresAt, new Date()),
      )).limit(1).for('update');

      if (!pairing) {
        const error = new Error('That pairing code is invalid or expired.');
        error.statusCode = 404;
        error.code = 'PAIRING_NOT_FOUND';
        throw error;
      }

      const [hostSession] = await transaction.select().from(hostSessions)
        .where(eq(hostSessions.id, pairing.hostSessionId)).limit(1).for('update');

      if (!hostSession || hostSession.displayDeviceId || hostSession.status === 'ended') {
        const error = new Error('This Host session already has a Game Display.');
        error.statusCode = 409;
        error.code = 'DISPLAY_ALREADY_CONNECTED';
        throw error;
      }

      const [displayDevice] = await transaction.insert(deviceSessions).values({
        role: 'game_display',
        status: 'connected',
        deviceLabel: 'Paired Game Display',
        tokenHash: hashDisplayToken(displayToken),
        expiresAt: addHours(new Date(), 12),
      }).returning();

      const [activeRoom] = await transaction.select({ id: gameRooms.id })
        .from(gameRooms)
        .where(and(
          eq(gameRooms.hostSessionId, hostSession.id),
          inArray(gameRooms.status, ['lobby', 'live', 'paused']),
        ))
        .limit(1);

      await transaction.update(hostSessions).set({
        displayDeviceId: displayDevice.id,
        status: activeRoom ? 'live' : 'ready',
        updatedAt: new Date(),
      }).where(eq(hostSessions.id, hostSession.id));

      await transaction.update(displayPairings).set({ consumedAt: new Date() })
        .where(eq(displayPairings.id, pairing.id));

      return { displayDevice, hostSessionId: hostSession.id };
    });

    return sendJson(response, 201, {
      display: {
        deviceId: result.displayDevice.id,
        hostSessionId: result.hostSessionId,
        token: displayToken,
        expiresAt: result.displayDevice.expiresAt,
      },
    });
  } catch (error) {
    return sendError(response, error);
  }
}
