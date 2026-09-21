import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;
let jwksUrlCache;

function authConfiguration() {
  const jwksUrl = process.env.TNG_AUTH_JWKS_URL || process.env.NEON_AUTH_JWKS_URL;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const issuer = process.env.TNG_AUTH_ISSUER || (baseUrl ? new URL(baseUrl).origin : null);
  const audience = process.env.TNG_AUTH_AUDIENCE || null;

  if (!jwksUrl || !issuer) {
    const error = new Error('The replacement authentication provider is not configured.');
    error.statusCode = 503;
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }

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

export async function requireUser(request) {
  const authorization = getHeader(request, 'authorization');
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    const error = new Error('A valid bearer token is required.');
    error.statusCode = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const { issuer, audience } = authConfiguration();
  const verification = { issuer };
  if (audience) verification.audience = audience;

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
  };
}
