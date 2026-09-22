import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

// Live-test staging is intentionally pinned to the Neon development Auth
// endpoint. Do not proxy Auth through Vercel and do not let a stale Vercel
// environment variable silently point this build at another Neon branch.
export const NEON_AUTH_URL =
  'https://ep-hidden-wave-avehvh0z.neonauth.c-11.us-east-1.aws.neon.tech/tng/auth';

export const isNeonStaging = true;

export const authClient = createAuthClient(NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter({
    fetchOptions: {
      onRequest: (request) => {
        try {
          localStorage.setItem('tng_last_auth_request', request.url.toString());
        } catch {}
      },
    },
  }),
});

function unwrapSession(result) {
  if (!result) return null;
  if (result.data) return result.data;
  return result;
}

export async function getNeonSession() {
  const result = await authClient.getSession();
  return unwrapSession(result);
}

export async function getNeonAuthToken() {
  // TNG backend deployment 29 verifies Neon Auth's active opaque session
  // token directly. Do not call the optional JWT/token plugin routes:
  // this Neon Auth deployment does not expose them and they return HTTP 404.
  const session = await getNeonSession();

  return (
    session?.token ||
    session?.session?.token ||
    null
  );
}

export function mapNeonUser(user) {
  if (!user) return null;

  return {
    ...user,
    id: user.id,
    email: user.email,
    full_name: user.name || user.email?.split('@')[0] || 'Nomad',
    name: user.name || user.email?.split('@')[0] || 'Nomad',
  };
}
