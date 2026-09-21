import { and, eq, inArray } from 'drizzle-orm';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import { hostSessions } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  try {
    const { account, device } = await requireController(request);
    const [activeSession] = await db.select().from(hostSessions).where(and(
      eq(hostSessions.hostAccountId, account.id),
      inArray(hostSessions.status, ['pairing', 'ready', 'live']),
    )).limit(1);

    if (activeSession) {
      if (activeSession.controllerDeviceId !== device.id) {
        const error = new Error('This Host account already has an active controller.');
        error.statusCode = 409;
        error.code = 'HOST_ALREADY_CONTROLLED';
        throw error;
      }
      return sendJson(response, 200, { hostSession: activeSession, resumed: true });
    }

    const [hostSession] = await db.insert(hostSessions).values({
      hostAccountId: account.id,
      controllerDeviceId: device.id,
      status: 'pairing',
    }).returning();

    return sendJson(response, 201, { hostSession, resumed: false });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.code = 'HOST_ALREADY_CONTROLLED';
      error.message = 'This Host account or controller already has an active session.';
    }
    return sendError(response, error);
  }
}
