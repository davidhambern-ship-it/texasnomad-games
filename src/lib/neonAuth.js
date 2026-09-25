import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

// Production auth is proxied through the verified first-party TNG auth domain.
// This keeps the session same-site with texasnomadgames.com so Safari does not
// treat the Neon session as a third-party cookie.
export const NEON_AUTH_URL =
  'https://auth.texasnomadgames.com/neon-auth';

export const isNeonStaging = true;

export const TNG_BROWSER_SESSION_KEY = 'tng_browser_session';
export const TNG_LAST_ACTIVITY_KEY = 'tng_last_activity_at';
export const TNG_PAGEHIDE_KEY = 'tng_pagehide_at';
export const TNG_WELCOME_COMPLETE_KEY = 'tng_welcome_complete';

const SESSION_CACHE_TTL_MS = 60 * 1000;
const STALE_SESSION_FALLBACK_MS = 10 * 60 * 1000;

let cachedSession;
let cachedSessionAt = 0;
let sessionRequestPromise = null;

function sessionToken(session) {
  return session?.token || session?.session?.token || null;
}

function hasUsableSession(session) {
  return Boolean(session?.user && sessionToken(session));
}

function isTransientAuthStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function clearNeonSessionCache() {
  cachedSession = undefined;
  cachedSessionAt = 0;
  sessionRequestPromise = null;
}


export function startTngBrowserSession() {
  clearNeonSessionCache();
  try {
    sessionStorage.setItem(TNG_BROWSER_SESSION_KEY, '1');
    sessionStorage.setItem(TNG_LAST_ACTIVITY_KEY, String(Date.now()));
    sessionStorage.removeItem(TNG_PAGEHIDE_KEY);
    sessionStorage.removeItem(TNG_WELCOME_COMPLETE_KEY);
  } catch {}
}

export function clearTngBrowserSession() {
  clearNeonSessionCache();
  try {
    sessionStorage.removeItem(TNG_BROWSER_SESSION_KEY);
    sessionStorage.removeItem(TNG_LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(TNG_PAGEHIDE_KEY);
    sessionStorage.removeItem(TNG_WELCOME_COMPLETE_KEY);
  } catch {}
}

export function hasTngBrowserSession() {
  try {
    return sessionStorage.getItem(TNG_BROWSER_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}


export function restoreTngBrowserSession() {
  try {
    sessionStorage.setItem(TNG_BROWSER_SESSION_KEY, '1');
    if (!sessionStorage.getItem(TNG_LAST_ACTIVITY_KEY)) {
      sessionStorage.setItem(TNG_LAST_ACTIVITY_KEY, String(Date.now()));
    }
    sessionStorage.removeItem(TNG_PAGEHIDE_KEY);
  } catch {}
}


export const authClient = createAuthClient(NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter({
    fetchOptions: {
      credentials: 'include',
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

export async function getNeonSession({
  forceRefresh = false,
  allowStaleOnError = true,
} = {}) {
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedSessionAt > 0 &&
    now - cachedSessionAt < SESSION_CACHE_TTL_MS
  ) {
    return cachedSession ?? null;
  }

  // Host/game screens can make several authenticated API calls at once.
  // Share one session lookup instead of hammering Neon Auth for every poll.
  if (sessionRequestPromise) return sessionRequestPromise;

  sessionRequestPromise = (async () => {
    const response = await fetch(`${NEON_AUTH_URL}/get-session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const text = await response.text();

    if (!response.ok) {
      let message = `TNG auth session check failed (${response.status}).`;
      try {
        const payload = text ? JSON.parse(text) : null;
        message = payload?.message || payload?.error?.message || message;
      } catch {}

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    if (!text) {
      cachedSession = null;
      cachedSessionAt = Date.now();
      return null;
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('TNG received an invalid session response.');
    }

    const session = unwrapSession(payload);
    cachedSession = session ?? null;
    cachedSessionAt = Date.now();
    return cachedSession;
  })();

  try {
    return await sessionRequestPromise;
  } catch (error) {
    const cacheAge = Date.now() - cachedSessionAt;
    if (
      allowStaleOnError &&
      hasUsableSession(cachedSession) &&
      cacheAge < STALE_SESSION_FALLBACK_MS &&
      isTransientAuthStatus(error?.status)
    ) {
      console.warn('[TNG auth] using cached session after transient auth failure:', error?.status);
      return cachedSession;
    }
    throw error;
  } finally {
    sessionRequestPromise = null;
  }
}

export async function waitForNeonSession({
  attempts = 8,
  initialDelayMs = 300,
} = {}) {
  let lastSession = null;
  let lastError = null;
  let receivedAuthResponse = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      lastSession = await getNeonSession({
        forceRefresh: attempt > 0,
        allowStaleOnError: true,
      });
      receivedAuthResponse = true;
      lastError = null;
      if (lastSession?.user) return lastSession;
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      const delay = initialDelayMs + Math.min(attempt * 300, 1500);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }

  if (!receivedAuthResponse && lastError) throw lastError;
  return lastSession;
}

export async function getNeonAuthToken({ forceRefresh = false } = {}) {
  // The TNG backend verifies Neon Auth's active opaque session token directly.
  // Cache ordinary reads so high-frequency game polling does not rate-limit
  // the auth service; callers can force one fresh lookup after an HTTP 401.
  const session = await getNeonSession({ forceRefresh });

  return sessionToken(session);
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
