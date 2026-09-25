import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  authClient,
  clearTngBrowserSession,
  mapNeonUser,
  restoreTngBrowserSession,
  waitForNeonSession,
} from '@/lib/neonAuth';

const AuthContext = createContext();

const DEVICE_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
const SESSION_LIFECYCLE_URL =
  'https://tng-live-production.up.railway.app/tng-session';

function currentDeviceIds() {
  try {
    return Array.from(new Set([
      localStorage.getItem('tng_device_id'),
      localStorage.getItem('tng_player_device_id'),
    ].filter(Boolean)));
  } catch {
    return [];
  }
}

function sessionToken(session) {
  return session?.token || session?.session?.token || null;
}

async function syncBrowserDevices(action, token, { keepalive = false } = {}) {
  const deviceIds = currentDeviceIds();
  if (!token || deviceIds.length === 0) return;

  await fetch(SESSION_LIFECYCLE_URL, {
    method: 'POST',
    keepalive,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, deviceIds }),
  }).catch(() => {});
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const sessionTokenRef = useRef(null);
  const logoutInFlightRef = useRef(false);

  const isLoadingPublicSettings = false;
  const appPublicSettings = null;

  const setSignedOutState = useCallback(() => {
    sessionTokenRef.current = null;
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      // Neon Auth is the source of truth for whether this browser is signed in.
      // Do not invent a second short-lived TNG login on top of the valid Neon
      // cookie: Host controllers may sit untouched or backgrounded for long
      // stretches while a game is running.
      const isAuthHandoff =
        window.location.pathname.startsWith('/onboarding') ||
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register');

      const session = await waitForNeonSession({
        attempts: isAuthHandoff ? 8 : 4,
        initialDelayMs: isAuthHandoff ? 300 : 600,
      });

      const neonUser = session?.user || null;
      const token = sessionToken(session);

      if (neonUser && token) {
        sessionTokenRef.current = token;
        restoreTngBrowserSession();
        await syncBrowserDevices('heartbeat', token);
        setUser(mapNeonUser(neonUser));
        setIsAuthenticated(true);
      } else {
        clearTngBrowserSession();
        setSignedOutState();
      }
    } catch (error) {
      console.error('[TNG auth] session check failed:', error);

      // A temporary auth-service/rate-limit failure must not destroy a session
      // that this app has already confirmed.
      if (sessionTokenRef.current) {
        setAuthError(null);
      } else {
        setSignedOutState();
        setAuthError({
          type: 'unknown',
          message: error?.message || 'TNG could not verify your session.',
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [setSignedOutState]);

  const checkAppState = checkUserAuth;

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = useCallback(async (shouldRedirect = true, reason = 'manual') => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    const token = sessionTokenRef.current;

    try {
      await syncBrowserDevices('logout', token);
    } catch {}

    try {
      await authClient.signOut();
    } catch (error) {
      console.error('[TNG auth] sign out failed:', error);
    }

    clearTngBrowserSession();
    setSignedOutState();

    try {
      localStorage.removeItem('tng_device_id');
      localStorage.removeItem('tng_connection_role');
      localStorage.removeItem('tng_player_test_mode');
      localStorage.removeItem('tng_player_device_id');
      localStorage.removeItem('tng_player_device_owner');
    } catch {}

    logoutInFlightRef.current = false;

    if (shouldRedirect) {
      const suffix = reason === 'inactive' ? '?reason=inactive' : '';
      window.location.replace(`/login${suffix}`);
    }
  }, [setSignedOutState]);

  // Keep authenticated device IDs alive while TNG is open. Host controllers are
  // allowed to sit idle or move into the background without being signed out.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const heartbeat = () => {
      const token = sessionTokenRef.current;
      if (token) syncBrowserDevices('heartbeat', token);
    };

    const handlePageShow = () => heartbeat();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, DEVICE_HEARTBEAT_INTERVAL_MS);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated]);

  // Non-host pages may disconnect their device presence when the page really
  // leaves. The Host controller stays attached until END/SIGN OUT or backend
  // expiry so a tab switch, phone lock, or browser backgrounding cannot kill it.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const handlePageHide = () => {
      if (window.location.pathname.startsWith('/host')) return;

      const token = sessionTokenRef.current;
      if (token) {
        syncBrowserDevices('disconnect', token, { keepalive: true });
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [isAuthenticated]);

  const navigateToLogin = () => {
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
