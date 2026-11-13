import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_NAME_LENGTH = 32;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function cleanName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * Creates a signed, temporary guest identity. This token identifies a visitor;
 * it does not grant host privileges or authorize access to any room by itself.
 */
export function issueGuestIdentity({
  name,
  secret,
  now = Date.now(),
  ttlSeconds = DEFAULT_TTL_SECONDS,
} = {}) {
  if (!secret || String(secret).length < 32) {
    throw new Error('TNG_GUEST_TOKEN_SECRET must contain at least 32 characters.');
  }

  const publicName = cleanName(name);
  if (!publicName) {
    const error = new Error('Choose a player name to continue.');
    error.code = 'GUEST_NAME_REQUIRED';
    throw error;
  }

  const issuedAt = Math.floor(now / 1000);
  const ttl = Math.max(60, Math.min(Number(ttlSeconds) || DEFAULT_TTL_SECONDS, DEFAULT_TTL_SECONDS));
  const claims = {
    v: TOKEN_VERSION,
    sub: randomBytes(16).toString('base64url'),
    name: publicName,
    iat: issuedAt,
    exp: issuedAt + ttl,
  };
  const payload = encode(claims);
  return { token: payload + '.' + signature(payload, secret), identity: claims };
}

/**
 * Verifies a temporary guest identity token. Invalid, expired, malformed,
 * or incorrectly signed tokens always return null.
 */
export function verifyGuestIdentity(token, { secret, now = Date.now() } = {}) {
  if (!secret || String(secret).length < 32 || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expected = Buffer.from(signature(parts[0], secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    if (
      claims?.v !== TOKEN_VERSION ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.name !== 'string' ||
      !claims.name ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp) ||
      claims.iat > nowSeconds + 60 ||
      claims.exp <= nowSeconds ||
      claims.exp - claims.iat > DEFAULT_TTL_SECONDS
    ) return null;

    return {
      guestId: claims.sub,
      publicName: cleanName(claims.name),
      isGuest: true,
      expiresAt: claims.exp,
    };
  } catch {
    return null;
  }
}
