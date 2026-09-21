import { and, eq, isNull } from 'drizzle-orm';
import { addMinutes } from 'date-fns';

import { requireController } from '../../server/auth/require-controller.js';
import { db } from '../../server/db/client.js';
import { displayPairings } from '../../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../server/http/respond.js';
import { createPairingCode, hashPairingCode } from '../../server/pairing.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  try {
    const { hostSession } = await requireController(request, { hostSessionRequired: true });

    if (hostSession.displayDeviceId) {
      const error = new Error('A Game Display is already connected to this Host session.');
      error.statusCode = 409;
      error.code = 'DISPLAY_ALREADY_CONNECTED';
      throw error;
    }

    const code = createPairingCode();
    const expiresAt = addMinutes(new Date(), 10);

    await db.transaction(async (transaction) => {
      await transaction.update(displayPairings).set({ consumedAt: new Date() }).where(and(
        eq(displayPairings.hostSessionId, hostSession.id),
        isNull(displayPairings.consumedAt),
      ));

      await transaction.insert(displayPairings).values({
        hostSessionId: hostSession.id,
        codeHash: hashPairingCode(code),
        expiresAt,
      });
    });

    return sendJson(response, 201, { pairing: { code, expiresAt } });
  } catch (error) {
    return sendError(response, error);
  }
}
