import { createClient } from '@base44/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;
let jwksUrlCache;

const BASE44_APP_ID =
  process.env.TNG_BASE44_APP_ID || '6a1faf9539e2c1e12925ead8';

function authConfiguration() {
  const jwksUrl = process.env.TNG_AUTH_JWKS_URL || process.env.NEON_AUTH_JWKS_URL;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const issuer = process.env.TNG_AUTH_ISSUER || (baseUrl ? new URL(baseUrl).origin : null);
  const audience = process.env.TNG_AUTH_AUDIENCE || null;

  if (!jwksUrl || !issuer) return null;

  if (!jwks || jwksUrlCache !== jwksUrl) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksUrlCache = jwksUrl;
  }

  return { issuer, audience };
}

function getHeader(request, name) {
  if (request?.headers?.get) return request.headers.get(name) || '';
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

async function verifyNeonIdentity(token) {
  const config = authConfiguration();
  if (!config) return null;

  const verification = { issuer: config.issuer };
  if (config.audience) verification.audience = config.audience;

  const { payload } = await jwtVerify(token, jwks, verification);

  if (!payload.sub || typeof payload.email !== 'string') {
    const error = new Error('The identity token is missing required account claims.');
    error.statusCode = 401;
    error.code = 'INVALID_IDENTITY';
    throw error;
  }

  return {
    subject: payload.sub,
    email: payload.email,
    emailVerified: payload.emailVerified === true || payload.email_verified === true,
    provider: 'neon',
  };
}

async function verifyBase44Identity(token) {
  const client = createClient({
    appId: BASE44_APP_ID,
    token,
  });

  const user = await client.auth.me();

  if (!user?.id || typeof user.email !== 'string') {
    const error = new Error('The Base44 session is not a valid TNG identity.');
    error.statusCode = 401;
    error.code = 'INVALID_IDENTITY';
    throw error;
  }

  return {
    subject: `base44:${user.id}`,
    email: user.email,
    emailVerified: user.is_verified !== false,
    provider: 'base44',
    externalUserId: user.id,
  };
}

export async function requireUser(request) {
  const authorization = getHeader(request, 'authorization');
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    const error = new Error('A valid bearer token is required.');
    error.statusCode = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  let neonError;
  try {
    const identity = await verifyNeonIdentity(token);
    if (identity) return identity;
  } catch (error) {
    neonError = error;
  }

  try {
    return await verifyBase44Identity(token);
  } catch (base44Error) {
    console.warn('[TNG auth] bearer token failed Neon and Base44 verification', {
      neon: neonError?.message,
      base44: base44Error?.message,
    });

    const error = new Error('Your TNG session could not be verified.');
    error.statusCode = 401;
    error.code = 'INVALID_IDENTITY';
    throw error;
  }
}
