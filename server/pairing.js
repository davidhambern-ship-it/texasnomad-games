import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

function pairingSecret() {
  const secret = process.env.TNG_PAIRING_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('Display pairing is not configured.');
    error.statusCode = 503;
    error.code = 'PAIRING_NOT_CONFIGURED';
    throw error;
  }
  return secret;
}

export function createPairingCode() {
  return String(randomInt(100_000, 1_000_000));
}

export function hashPairingCode(code) {
  return createHmac('sha256', pairingSecret()).update(String(code)).digest('hex');
}

export function createDisplayToken() {
  return randomBytes(32).toString('base64url');
}

export function hashDisplayToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
