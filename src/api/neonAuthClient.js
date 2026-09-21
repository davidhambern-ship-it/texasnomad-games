import { createAuthClient } from '@neondatabase/neon-js/auth';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();

export const neonAuthClient = authUrl
  ? createAuthClient(authUrl)
  : null;

export function requireNeonAuthClient() {
  if (!neonAuthClient) {
    throw new Error('TNG authentication is not configured for this environment.');
  }
  return neonAuthClient;
}

function normalizeNextPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}

export async function signInWithGoogle(nextPath = '/') {
  const client = requireNeonAuthClient();
  const onboardingUrl = new URL('/onboarding', window.location.origin);
  onboardingUrl.searchParams.set('next', normalizeNextPath(nextPath));

  return client.signIn.social({
    provider: 'google',
    callbackURL: onboardingUrl.toString(),
    newUserCallbackURL: onboardingUrl.toString(),
    errorCallbackURL: `${window.location.origin}/login?auth_error=google`,
  });
}

export async function getTngAccessToken() {
  const client = requireNeonAuthClient();
  const { data, error } = await client.token();
  if (error) throw error;
  if (!data?.token) throw new Error('Your TNG session has expired. Please sign in again.');
  return data.token;
}
