import { addDays } from 'date-fns';

import { requireAccount } from '../server/auth/require-account.js';
import { db } from '../server/db/client.js';
import { deviceSessions } from '../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../server/http/respond.js';

const ALLOWED_ROLES = new Set(['player', 'host_controller', 'spectator']);

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  try {
    const account = await requireAccount(request);
    const role = request.body?.role;
    const deviceLabel = typeof request.body?.deviceLabel === 'string'
      ? request.body.deviceLabel.trim().slice(0, 100)
      : null;

    if (!ALLOWED_ROLES.has(role)) {
      const error = new Error('Choose a valid TNG device role.');
      error.statusCode = 400;
      error.code = 'INVALID_DEVICE_ROLE';
      throw error;
    }

    const [device] = await db.insert(deviceSessions).values({
      accountId: account.id,
      role,
      deviceLabel,
      status: 'connected',
      expiresAt: addDays(new Date(), 30),
    }).returning();

    return sendJson(response, 201, { device });
  } catch (error) {
    return sendError(response, error);
  }
}
