import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;

function authConfiguration() {
  const jwksUrl = process.env.TNG_AUTH_JWKS_URL;
  const issuer = process.env.TNG_AUTH_ISSUER;
  const audience = process.env.TNG_AUTH_AUDIENCE;

  if (!jwksUrl || !issuer || !audience) {
    const error = new Error('The replacement authentication provider is not configured.');
    error.statusCode = 503;
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }

  jwks ??= createRemoteJWKSet(new URL(jwksUrl));
  return { issuer, audience };
}

export async function requireUser(request) {
  const authorization = request.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    const error = new Error('A valid bearer token is required.');
    error.statusCode = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const { issuer, audience } = authConfiguration();
  const { payload } = await jwtVerify(token, jwks, { issuer, audience });

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
