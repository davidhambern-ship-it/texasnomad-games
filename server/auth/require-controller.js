import { and, eq, gt, inArray } from 'drizzle-orm';

import { db } from '../db/client.js';
import { deviceSessions, hostSessions } from '../db/schema.js';
import { requireAccount } from './require-account.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireController(request, { hostSessionRequired = false } = {}) {
  const account = await requireAccount(request);
  const deviceId = request.headers['x-tng-device-id'];

  if (typeof deviceId !== 'string' || !UUID_PATTERN.test(deviceId)) {
    const error = new Error('A valid Host Controller device is required.');
    error.statusCode = 401;
    error.code = 'CONTROLLER_REQUIRED';
    throw error;
  }

  const [device] = await db.select().from(deviceSessions).where(and(
    eq(deviceSessions.id, deviceId),
    eq(deviceSessions.accountId, account.id),
    eq(deviceSessions.role, 'host_controller'),
    eq(deviceSessions.status, 'connected'),
    gt(deviceSessions.expiresAt, new Date()),
  )).limit(1);

  if (!device) {
    const error = new Error('This device is not an active Host Controller.');
    error.statusCode = 403;
    error.code = 'INVALID_CONTROLLER';
    throw error;
  }

  let hostSession = null;
  if (hostSessionRequired) {
    [hostSession] = await db.select().from(hostSessions).where(and(
      eq(hostSessions.hostAccountId, account.id),
      eq(hostSessions.controllerDeviceId, device.id),
      inArray(hostSessions.status, ['pairing', 'ready', 'live']),
    )).limit(1);

    if (!hostSession) {
      const error = new Error('Start a Host session before controlling a room.');
      error.statusCode = 409;
      error.code = 'HOST_SESSION_REQUIRED';
      throw error;
    }
  }

  return { account, device, hostSession };
}
