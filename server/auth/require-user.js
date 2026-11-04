import { createHash } from 'node:crypto';
import { verifyGuestIdentity } from '../guestIdentity.mjs';
import { pool } from '../db/client.js';

function getHeader(request, name) {
  if (request?.headers?.get) return request.headers.get(name) || '';
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

export async function requireUser(request) {
  const authorization = getHeader(request, 'authorization');
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  const token = getHeader(request, 'x-tng-guest-token').trim() || bearer;
  const guest = verifyGuestIdentity(token, { secret: process.env.TNG_GUEST_TOKEN_SECRET });

  if (!guest) {
    const error = new Error('Choose a player name to continue.');
    error.statusCode = 401;
    error.code = 'GUEST_REQUIRED';
    throw error;
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = await pool.query(
    `select guest_id, display_name, expires_at
     from public.tng_guest_sessions
     where guest_id = $1
       and token_hash = $2
       and revoked_at is null
       and expires_at > now()
     limit 1`,
    [guest.guestId, tokenHash],
  );
  const session = result.rows[0];
  if (!session) {
    const error = new Error('Your guest session has expired. Choose a player name again.');
    error.statusCode = 401;
    error.code = 'GUEST_SESSION_EXPIRED';
    throw error;
  }

  return {
    subject: `guest:${guest.guestId}`,
    email: `guest-${guest.guestId}@guest.invalid`,
    emailVerified: false,
    provider: 'guest',
    guestId: guest.guestId,
    displayName: session.display_name || guest.publicName,
    expiresAt: Math.floor(new Date(session.expires_at).getTime() / 1000),
  };
}
